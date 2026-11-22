import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { PaymentStage, PaymentStatus } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

const paymentSchema = z.object({
  projectId: z.number(),
  amount: z.number().positive(),
  paymentStage: z.enum(['ADVANCE', 'SURVEY_MILESTONE', 'INSTALLATION_MILESTONE', 'FINAL']),
  paymentMethod: z.string().default('UPI / NetBanking')
});

// Process/Record payment
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!['ADMIN', 'CUSTOMER'].includes(req.user!.role)) return res.status(403).json({ success: false, message: 'Only an admin or the customer can record a payment.' });
    const data = paymentSchema.parse(req.body);

    const project = await prisma.installationRequest.findUnique({
      where: { id: data.projectId },
      include: { customer: true }
    });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (req.user!.role === 'CUSTOMER' && project.customerId !== req.user!.id) return res.status(403).json({ success: false, message: 'Unauthorized' });
    const approvedEstimate = await prisma.estimate.findFirst({ where: { projectId: project.id, status: 'APPROVED' }, orderBy: { createdAt: 'desc' } });
    if (data.paymentStage === 'ADVANCE') {
      if (!approvedEstimate) return res.status(400).json({ success: false, message: 'Accept a quotation before paying an advance.' });
      const paidAdvance = await prisma.payment.findFirst({ where: { projectId: project.id, paymentStage: 'ADVANCE', status: PaymentStatus.COMPLETED } });
      if (paidAdvance) return res.status(409).json({ success: false, message: 'The advance has already been recorded.' });
      if (data.amount > approvedEstimate.netAmount) return res.status(400).json({ success: false, message: 'Advance cannot exceed the accepted quotation.' });
    }
    if (data.paymentStage === 'FINAL') {
      if (!approvedEstimate) return res.status(400).json({ success: false, message: 'There is no accepted quotation for this project.' });
      if (project.status !== 'COMPLETED') return res.status(409).json({ success: false, message: 'The remaining balance is available after installation is complete.' });
      const previousPayments = await prisma.payment.aggregate({ where: { projectId: project.id, status: PaymentStatus.COMPLETED }, _sum: { amount: true } });
      const remaining = Math.max(0, approvedEstimate.netAmount - (previousPayments._sum.amount || 0));
      if (remaining <= 0) return res.status(409).json({ success: false, message: 'No balance remains on this quotation.' });
      if (data.amount > remaining) return res.status(400).json({ success: false, message: `Payment cannot exceed the remaining balance of ₹${remaining.toLocaleString('en-IN')}.` });
    }

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const transactionRef = `TXN-SOL-${Date.now().toString().slice(-4)}${randomSuffix}`;

    const payment = await prisma.payment.create({
      data: {
        projectId: data.projectId,
        amount: data.amount,
        paymentStage: data.paymentStage as PaymentStage,
        paymentMethod: data.paymentMethod,
        transactionRef,
        status: PaymentStatus.COMPLETED
      }
    });

    // If advance payment is made, advance progress and update status
    if (data.paymentStage === 'ADVANCE' && project.progress < 65) {
      await prisma.installationRequest.update({
        where: { id: data.projectId },
        data: {
          progress: 65,
          status: 'INSTALLATION_SCHEDULED'
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'PAYMENT_RECORDED',
        entity: 'PAYMENT',
        entityId: String(payment.id),
        details: `Payment of ₹${data.amount.toLocaleString('en-IN')} received for project ${project.requestNumber} (${data.paymentStage})`
      }
    });

    res.status(201).json({
      success: true,
      message: `Payment of ₹${data.amount.toLocaleString('en-IN')} recorded successfully!`,
      data: payment
    });
  } catch (error) {
    next(error);
  }
});

router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const payments = await prisma.payment.findMany({
      where: { projectId },
      orderBy: { paidAt: 'desc' }
    });
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
});

export default router;
