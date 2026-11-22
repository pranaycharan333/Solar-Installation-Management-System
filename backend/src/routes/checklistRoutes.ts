import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { Role, ProjectStatus } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Get checklist items for project
router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const checklist = await prisma.installationChecklist.findMany({
      where: { projectId },
      orderBy: { sequenceOrder: 'asc' }
    });
    res.json({ success: true, data: checklist });
  } catch (error) {
    next(error);
  }
});

// Technician or Admin toggles checklist step completion
router.patch('/:id/toggle', requireRole([Role.TECHNICIAN, Role.ADMIN]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checklistId = parseInt(String(req.params.id), 10);
    const { isCompleted, remarks } = req.body;

    const current = await prisma.installationChecklist.findUnique({
      where: { id: checklistId },
      include: { project: true }
    });

    if (!current) return res.status(404).json({ success: false, message: 'Checklist step not found' });

    const updated = await prisma.installationChecklist.update({
      where: { id: checklistId },
      data: {
        isCompleted: isCompleted !== undefined ? isCompleted : !current.isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedBy: isCompleted ? req.user!.fullName : null,
        remarks: remarks || current.remarks
      }
    });

    // Recalculate project progress
    const allSteps = await prisma.installationChecklist.findMany({
      where: { projectId: current.projectId }
    });

    const completedCount = allSteps.filter(s => s.isCompleted).length;
    // Map checklist completion to 60% -> 100%
    const calculatedProgress = 60 + Math.round((completedCount / allSteps.length) * 40);

    const isAllDone = completedCount === allSteps.length;
    let nextStatus = current.project.status;

    if (isAllDone && current.project.status !== ProjectStatus.COMPLETED) {
      nextStatus = ProjectStatus.COMPLETED;

      // Auto-generate Warranty upon completion if none exists
      const existingWarranty = await prisma.warranty.findUnique({
        where: { projectId: current.projectId }
      });

      if (!existingWarranty) {
        const certNo = `WRTY-2026-${current.project.requestNumber.replace('SO-', '')}`;
        const warrantyEnd = new Date();
        warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 1);

        await prisma.warranty.create({
          data: {
            projectId: current.projectId,
            customerId: current.project.customerId,
            certificateNumber: certNo,
            systemWarrantyYears: 1,
            inverterWarrantyYears: 1,
            panelWarrantyYears: 1,
            startDate: new Date(),
            endDate: warrantyEnd,
            terms: '12-month warranty from system commissioning, subject to the product and service terms provided with the handover.'
          }
        });
      }
    } else if (completedCount > 0 && current.project.status !== ProjectStatus.COMPLETED) {
      nextStatus = ProjectStatus.INSTALLATION_IN_PROGRESS;
    }

    await prisma.installationRequest.update({
      where: { id: current.projectId },
      data: { progress: calculatedProgress, status: nextStatus }
    });

    res.json({
      success: true,
      message: `Checklist step "${updated.title}" updated`,
      data: updated,
      projectProgress: calculatedProgress,
      projectStatus: nextStatus
    });
  } catch (error) {
    next(error);
  }
});

export default router;
