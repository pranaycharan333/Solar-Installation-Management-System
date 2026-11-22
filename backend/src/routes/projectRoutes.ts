import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Role, ProjectStatus } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// List projects: Customers see only their own; Techs see assigned; Admins see all
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, id: userId } = req.user!;
    let whereClause: any = {};

    if (role === Role.CUSTOMER) {
      whereClause = { customerId: userId };
    } else if (role === Role.TECHNICIAN) {
      whereClause = {
        assignments: {
          some: { technicianId: userId }
        }
      };
    }

    const projects = await prisma.installationRequest.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true, address: true } },
        assignments: {
          where: { technician: { status: 'ACTIVE' } },
          include: { technician: { select: { id: true, fullName: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        surveys: { take: 1, orderBy: { createdAt: 'desc' } },
        estimates: { take: 1, orderBy: { createdAt: 'desc' }, include: { items: true } },
        payments: true,
        warranty: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
});

// Get detailed project
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    const { role, id: userId } = req.user!;

    const project = await prisma.installationRequest.findUnique({
      where: { id: projectId },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true, address: true } },
        assignments: {
          where: { technician: { status: 'ACTIVE' } },
          include: { technician: { select: { id: true, fullName: true, phone: true, email: true } } },
          orderBy: { createdAt: 'desc' }
        },
        surveys: { orderBy: { createdAt: 'desc' } },
        estimates: { orderBy: { createdAt: 'desc' }, include: { items: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        checklists: { orderBy: { sequenceOrder: 'asc' } },
        photographs: { orderBy: { uploadedAt: 'desc' } },
        warranty: true,
        serviceTickets: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Role verification
    if (role === Role.CUSTOMER && project.customerId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to project' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
});

const createProjectSchema = z.object({
  projectName: z.string().min(3, 'Project name is required'),
  systemCapacityKw: z.number().positive('System capacity must be greater than 0'),
  systemType: z.string().min(2, 'System type is required'),
  installationAddress: z.string().min(5, 'Installation address is required'),
  notes: z.string().optional()
});

// Customer or Admin creates a new Installation Request
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createProjectSchema.parse(req.body);
    const customerId = req.user!.role === Role.CUSTOMER ? req.user!.id : (req.body.customerId || req.user!.id);

    // Generate unique requestNumber (e.g. SO-2410)
    const count = await prisma.installationRequest.count();
    const requestNumber = `SO-${2410 + count}`;

    const project = await prisma.installationRequest.create({
      data: {
        requestNumber,
        customerId,
        projectName: validated.projectName,
        systemCapacityKw: validated.systemCapacityKw,
        systemType: validated.systemType,
        installationAddress: validated.installationAddress,
        status: ProjectStatus.ENQUIRY,
        progress: 10,
        notes: validated.notes || 'Installation request submitted by customer.'
      },
      include: {
        customer: { select: { fullName: true, email: true } }
      }
    });

    // Create initial standard installation checklist
    const standardSteps = [
      { stepKey: 'SITE_INSPECTION', title: 'Site Inspection & Safety Setup', sequenceOrder: 1 },
      { stepKey: 'MOUNTING_RAILS', title: 'Mounting Rails Anchored & Torqued', sequenceOrder: 2 },
      { stepKey: 'PANEL_LAYOUT', title: 'Solar PV Modules Clamped & Grounded', sequenceOrder: 3 },
      { stepKey: 'INVERTER_WIRING', title: 'Inverter & DC/AC Disconnect Connection', sequenceOrder: 4 },
      { stepKey: 'EARTHING_TEST', title: 'Earthing Resistance Verification (< 5 Ohms)', sequenceOrder: 5 },
      { stepKey: 'NET_METERING', title: 'DISCOM Net Metering Sync & Commissioning', sequenceOrder: 6 }
    ];

    await prisma.installationChecklist.createMany({
      data: standardSteps.map(s => ({
        projectId: project.id,
        stepKey: s.stepKey,
        title: s.title,
        sequenceOrder: s.sequenceOrder
      }))
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_INSTALLATION_REQUEST',
        entity: 'INSTALLATION_REQUEST',
        entityId: String(project.id),
        details: `Installation request ${project.requestNumber} created for ${project.customer.fullName} (${project.systemCapacityKw} kW)`
      }
    });

    res.status(201).json({
      success: true,
      message: 'Solar installation request submitted successfully!',
      data: project
    });
  } catch (error) {
    next(error);
  }
});

// Update project status (Admin or Technician with permission)
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    const { status, progress, notes } = req.body;

    const project = await prisma.installationRequest.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    // Authorization: Customers cannot change project status
    if (req.user!.role === Role.CUSTOMER) {
      return res.status(403).json({ success: false, message: 'Customers cannot change project status' });
    }

    const updated = await prisma.installationRequest.update({
      where: { id: projectId },
      data: {
        status: status || project.status,
        progress: progress !== undefined ? progress : project.progress,
        notes: notes ? `${project.notes || ''}\n[Update]: ${notes}` : project.notes
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'UPDATE_PROJECT_STATUS',
        entity: 'INSTALLATION_REQUEST',
        entityId: String(project.id),
        details: `Status updated to ${updated.status} (${updated.progress}% progress)`
      }
    });

    res.json({ success: true, message: 'Project status updated', data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
