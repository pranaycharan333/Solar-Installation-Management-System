import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Role, ProjectStatus } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

const surveySchema = z.object({
  projectId: z.number(),
  roofType: z.string().min(2, 'Roof type is required'),
  roofAreaSqft: z.number().positive('Roof area must be greater than 0'),
  shadingCondition: z.string().min(2, 'Shading condition is required'),
  structuralFeasibility: z.string().min(2, 'Structural feasibility evaluation is required'),
  electricalPanelCondition: z.string().min(2, 'Electrical panel condition is required'),
  proposedCapacityKw: z.number().positive('Proposed capacity must be greater than 0'),
  surveyNotes: z.string().optional()
});

// Technician or Admin submits Site Survey
router.post('/', requireRole([Role.TECHNICIAN, Role.ADMIN]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = surveySchema.parse(req.body);
    const techId = req.user!.id;

    const project = await prisma.installationRequest.findUnique({ where: { id: data.projectId } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const survey = await prisma.siteSurvey.create({
      data: {
        projectId: data.projectId,
        technicianId: techId,
        roofType: data.roofType,
        roofAreaSqft: data.roofAreaSqft,
        shadingCondition: data.shadingCondition,
        structuralFeasibility: data.structuralFeasibility,
        electricalPanelCondition: data.electricalPanelCondition,
        proposedCapacityKw: data.proposedCapacityKw,
        surveyNotes: data.surveyNotes,
        status: 'COMPLETED'
      }
    });

    // Advance project status to SURVEY_COMPLETED and progress to 45%
    await prisma.installationRequest.update({
      where: { id: data.projectId },
      data: {
        status: ProjectStatus.SURVEY_COMPLETED,
        progress: 45
      }
    });

    // Mark technician assignment as completed
    await prisma.technicianAssignment.updateMany({
      where: { projectId: data.projectId, technicianId: techId, assignmentType: 'SURVEY' },
      data: { status: 'COMPLETED' }
    });

    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, status: 'ACTIVE' }, select: { id: true } });
    if (admins.length) await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, title: 'Site review submitted', message: `${req.user!.fullName} submitted requirements for ${project.requestNumber}. Review the visit details and prepare a quotation.` })) });

    await prisma.auditLog.create({
      data: {
        userId: techId,
        action: 'SUBMIT_SITE_SURVEY',
        entity: 'SITE_SURVEY',
        entityId: String(survey.id),
        details: `Site survey completed for project ${project.requestNumber} (${data.proposedCapacityKw} kW recommended)`
      }
    });

    res.status(201).json({
      success: true,
      message: 'Site survey recorded successfully! Project advanced to Estimate stage.',
      data: survey
    });
  } catch (error) {
    next(error);
  }
});

router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = parseInt(String(req.params.projectId), 10);
    const surveys = await prisma.siteSurvey.findMany({
      where: { projectId },
      include: { technician: { select: { fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: surveys });
  } catch (error) {
    next(error);
  }
});

export default router;
