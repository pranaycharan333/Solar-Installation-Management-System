import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Customers see their requests, technicians see requests assigned to them, admins see all.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, id: userId } = req.user!;
    let whereClause: any = {};

    if (role === Role.CUSTOMER) {
      whereClause = { customerId: userId };
    } else if (role === Role.TECHNICIAN) {
      whereClause = { technicianId: userId };
    }

    const tickets = await prisma.serviceTicket.findMany({
      where: whereClause,
      include: {
        customer: { select: { fullName: true, email: true, phone: true } },
        project: { select: { requestNumber: true, projectName: true, installationAddress: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: tickets.map(({ photoData, ...ticket }) => ({
      ...ticket,
      hasPhoto: Boolean(photoData),
      visualFinding: null,
      photoAnalysisStatus: photoData ? 'MODEL_NOT_CONFIGURED' : null
    })) });
  } catch (error) {
    next(error);
  }
});

const createTicketSchema = z.object({
  projectId: z.number().optional(),
  category: z.enum(['MAINTENANCE', 'COMPLAINT']).default('COMPLAINT'),
  issueDescription: z.string().min(10, 'Please describe the issue in at least 10 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  photoData: z.string().max(4_300_000).optional().refine((value) => !value || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value), 'Photo must be a JPEG, PNG, or WebP image')
});

// Customer raises service or maintenance request
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createTicketSchema.parse(req.body);
    const customerId = req.user!.id;

    const relatedAssignment = validated.projectId
      ? await prisma.technicianAssignment.findFirst({
          where: { projectId: validated.projectId, technician: { status: 'ACTIVE' } },
          orderBy: { createdAt: 'desc' },
          select: { technicianId: true }
        })
      : null;

    const count = await prisma.serviceTicket.count();
    const ticketNumber = `TKT-${8800 + count + 1}`;

    const ticket = await prisma.serviceTicket.create({
      data: {
        ticketNumber,
        customerId,
        projectId: validated.projectId,
        issueDescription: validated.issueDescription,
        photoData: validated.photoData,
        technicianId: relatedAssignment?.technicianId,
        priority: validated.priority as TicketPriority,
        status: TicketStatus.OPEN
      },
      include: {
        customer: { select: { fullName: true } }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: customerId,
        action: 'RAISE_SERVICE_TICKET',
        entity: 'SERVICE_TICKET',
        entityId: String(ticket.id),
        details: `Service ticket ${ticketNumber} raised by ${ticket.customer.fullName} with ${ticket.priority} priority`
      }
    });

    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true } });
    const recipients = new Set([...admins.map((admin) => admin.id), ...(relatedAssignment ? [relatedAssignment.technicianId] : [])]);
    await prisma.notification.createMany({
      data: [...recipients].map((userId) => ({
        userId,
        title: validated.category === 'MAINTENANCE' ? 'New maintenance request' : 'New customer concern',
        message: `${ticket.customer.fullName} submitted ${validated.category.toLowerCase()} request ${ticketNumber}${validated.photoData ? ' with a photo' : ''}.`
      }))
    });

    res.status(201).json({
      success: true,
      message: 'Service ticket submitted successfully! A technician will review it shortly.',
      data: ticket
    });
  } catch (error) {
    next(error);
  }
});

// Serve an attached customer photo only to the customer, assigned technician, or an admin.
router.get('/:id/photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await prisma.serviceTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ success: false, message: 'Service request not found' });

    const { role, id: userId } = req.user!;
    const allowed = role === Role.ADMIN || (role === Role.CUSTOMER && ticket.customerId === userId) || (role === Role.TECHNICIAN && ticket.technicianId === userId);
    if (!allowed) return res.status(403).json({ success: false, message: 'You are not allowed to view this photo' });
    if (!ticket.photoData) return res.status(404).json({ success: false, message: 'No photo was attached' });

    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(ticket.photoData);
    if (!match) return res.status(422).json({ success: false, message: 'Stored photo format is invalid' });
    res.type(match[1]).send(Buffer.from(match[2], 'base64'));
  } catch (error) {
    next(error);
  }
});

// Admin or Technician updates ticket status / resolution notes
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketId = parseInt(String(req.params.id), 10);
    const { status, resolutionNotes, technicianId, visualFinding } = req.body;

    const ticket = await prisma.serviceTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return res.status(404).json({ success: false, message: 'Service request not found' });
    if (req.user!.role === Role.CUSTOMER) return res.status(403).json({ success: false, message: 'Customers cannot update service requests' });
    if (req.user!.role === Role.TECHNICIAN && ticket.technicianId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'This request is not assigned to you' });
    }
    if (technicianId && req.user!.role !== Role.ADMIN) {
      return res.status(403).json({ success: false, message: 'Only admins can assign service requests' });
    }

    if (technicianId) {
      const technician = await prisma.user.findFirst({ where: { id: Number(technicianId), role: Role.TECHNICIAN, status: 'ACTIVE' } });
      if (!technician) return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    const updated = await prisma.serviceTicket.update({
      where: { id: ticketId },
      data: {
        status: status || undefined,
        resolutionNotes: resolutionNotes || undefined,
        technicianId: technicianId ? Number(technicianId) : undefined,
        visualFinding: visualFinding || undefined,
        resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : undefined
      }
    });

    if (technicianId && Number(technicianId) !== ticket.technicianId) {
      await prisma.notification.create({
        data: {
          userId: Number(technicianId),
          title: 'Customer request assigned to you',
          message: `Service request ${ticket.ticketNumber} is ready for your review${ticket.photoData ? ', including a customer photo' : ''}.`
        }
      });
    }

    res.json({
      success: true,
      message: 'Service ticket updated',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

export default router;
