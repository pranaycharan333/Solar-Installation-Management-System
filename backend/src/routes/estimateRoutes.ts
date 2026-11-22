import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Role, EstimateStatus, ProjectStatus } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

const estimateSchema = z.object({
  projectId: z.number(),
  items: z.array(z.object({ materialId: z.number().int().positive(), quantity: z.number().positive() })).min(1),
  serviceCharge: z.number().nonnegative().default(0),
  subsidyAmount: z.number().nonnegative().default(0),
  validityDays: z.number().positive().default(30),
  terms: z.string().optional()
});

// Admin creates estimate
router.post('/', requireRole([Role.ADMIN]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = estimateSchema.parse(req.body);
    const materials = await prisma.material.findMany({ where: { id: { in: data.items.map((item) => item.materialId) } } });
    if (materials.length !== new Set(data.items.map((item) => item.materialId)).size) return res.status(400).json({ success: false, message: 'One or more selected materials are unavailable.' });
    const lines = data.items.map((item) => {
      const material = materials.find((entry) => entry.id === item.materialId)!;
      return { name: material.name, unit: material.unit, quantity: item.quantity, unitCost: material.unitCost, lineTotal: material.unitCost * item.quantity };
    });
    if (data.serviceCharge > 0) lines.push({ name: 'Installation & service charge', unit: 'service', quantity: 1, unitCost: data.serviceCharge, lineTotal: data.serviceCharge });
    const totalAmount = lines.reduce((sum, item) => sum + item.lineTotal, 0);
    const netAmount = Math.max(0, totalAmount - data.subsidyAmount);

    const project = await prisma.installationRequest.findUnique({
      where: { id: data.projectId },
      include: { customer: true }
    });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (project.status !== ProjectStatus.SURVEY_COMPLETED) return res.status(409).json({ success: false, message: 'Complete the technician site visit before preparing a quotation.' });

    const count = await prisma.estimate.count();
    const estimateNumber = `EST-${project.requestNumber.replace('SO-', '')}-${count + 1}`;

    const estimate = await prisma.estimate.create({
      data: {
        projectId: data.projectId,
        estimateNumber,
        totalAmount,
        subsidyAmount: data.subsidyAmount,
        netAmount,
        validityDays: data.validityDays,
        terms: data.terms || 'Standard quotation valid for 30 days. Includes installation, commissioning, and DISCOM liaison.',
        status: EstimateStatus.SENT,
        items: { create: lines }
      },
      include: { items: true }
    });

    // Update project status to ESTIMATE_SENT
    await prisma.installationRequest.update({
      where: { id: data.projectId },
      data: { status: ProjectStatus.ESTIMATE_SENT, progress: 50 }
    });

    // Notify customer
    await prisma.notification.create({
      data: {
        userId: project.customerId,
        title: 'Quotation Generated',
        message: `Your solar quotation ${estimate.estimateNumber} for ₹${netAmount.toLocaleString('en-IN')} is ready for review.`
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'GENERATE_ESTIMATE',
        entity: 'ESTIMATE',
        entityId: String(estimate.id),
        details: `Quotation ${estimateNumber} created for ₹${netAmount}`
      }
    });

    res.status(201).json({
      success: true,
      message: 'Quotation generated and sent to customer',
      data: estimate
    });
  } catch (error) {
    next(error);
  }
});

// Customer approves or rejects estimate
router.post('/:id/action', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.CUSTOMER) return res.status(403).json({ success: false, message: 'Only a customer or admin can respond to a quotation.' });
    const estimateId = parseInt(String(req.params.id), 10);
    const { action } = req.body; // 'APPROVE' or 'REJECT'

    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { project: true }
    });

    if (!estimate) return res.status(404).json({ success: false, message: 'Estimate not found' });
    if (estimate.status !== EstimateStatus.SENT) return res.status(409).json({ success: false, message: 'This quotation has already been answered.' });

    // Authorization: customer must own the project, or be admin
    if (req.user!.role === Role.CUSTOMER && estimate.project.customerId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (action === 'APPROVE') {
      const updated = await prisma.estimate.update({
        where: { id: estimateId },
        data: { status: EstimateStatus.APPROVED, approvedAt: new Date() }
      });

      // Advance project to ESTIMATE_APPROVED / INSTALLATION_SCHEDULED
      await prisma.installationRequest.update({
        where: { id: estimate.projectId },
        data: { status: ProjectStatus.ESTIMATE_APPROVED, progress: 60 }
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'APPROVE_ESTIMATE',
          entity: 'ESTIMATE',
          entityId: String(estimate.id),
          details: `Quotation ${estimate.estimateNumber} approved by ${req.user!.fullName}`
        }
      });

      return res.json({ success: true, message: 'Quotation approved! Next step: installation scheduling and advance payment.', data: updated });
    } else {
      const updated = await prisma.estimate.update({
        where: { id: estimateId },
        data: { status: EstimateStatus.REJECTED }
      });

      await prisma.installationRequest.update({ where: { id: estimate.projectId }, data: { status: ProjectStatus.SURVEY_COMPLETED, progress: 45 } });

      return res.json({ success: true, message: 'Quotation rejected', data: updated });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const estimates = await prisma.estimate.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    });
    res.json({ success: true, data: estimates });
  } catch (error) {
    next(error);
  }
});

export default router;
