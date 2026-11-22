import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// Protect all admin routes with authentication and strict ADMIN role
router.use(authenticateToken);
router.use(requireRole([Role.ADMIN]));

// Admin Overview Analytics & Metrics
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalCustomers,
      totalTechnicians,
      activeProjects,
      pendingRequests,
      completedProjects,
      openTickets,
      lowStockItems,
      allPayments,
      recentActivities
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.CUSTOMER } }),
      prisma.user.count({ where: { role: Role.TECHNICIAN, status: 'ACTIVE' } }),
      prisma.installationRequest.count({
        where: {
          status: { in: ['SURVEY_SCHEDULED', 'SURVEY_COMPLETED', 'ESTIMATE_APPROVED', 'INSTALLATION_SCHEDULED', 'INSTALLATION_IN_PROGRESS'] }
        }
      }),
      prisma.installationRequest.count({
        where: { status: 'ENQUIRY' }
      }),
      prisma.installationRequest.count({
        where: { status: 'COMPLETED' }
      }),
      prisma.serviceTicket.count({
        where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } }
      }),
      prisma.inventory.count({
        where: {
          quantityOnHand: { lte: prisma.inventory.fields.reorderLevel }
        }
      }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED' },
        select: { amount: true }
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { fullName: true, role: true } } }
      })
    ]);

    const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      data: {
        totalCustomers,
        totalTechnicians,
        activeProjects,
        pendingRequests,
        completedProjects,
        openTickets,
        lowStockItems,
        totalRevenue,
        recentActivities: recentActivities.map(a => ({
          id: a.id,
          action: a.action,
          details: a.details,
          userName: a.user?.fullName || 'System',
          userRole: a.user?.role || 'SYSTEM',
          createdAt: a.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Admin creates technician account
const createTechSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  skills: z.string().optional(),
  certificationNumber: z.string().optional(),
  temporaryPassword: z.string().min(6, 'Password must be at least 6 characters')
});

router.post('/technicians', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createTechSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: validated.email.toLowerCase() }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists'
      });
    }

    const passwordHash = await bcrypt.hash(validated.temporaryPassword, 10);

    const tech = await prisma.user.create({
      data: {
        email: validated.email.toLowerCase(),
        passwordHash,
        fullName: validated.fullName,
        phone: validated.phone,
        role: Role.TECHNICIAN,
        technicianProfile: {
          create: {
            skills: validated.skills || 'Rooftop Solar Installation, Electrical Wiring',
            certificationNumber: validated.certificationNumber || 'CERT-SOLAR-TBD',
            status: 'AVAILABLE'
          }
        }
      },
      include: { technicianProfile: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_TECHNICIAN_ACCOUNT',
        entity: 'USER',
        entityId: String(tech.id),
        details: `Admin ${req.user!.fullName} created technician account for ${tech.fullName} (${tech.email})`
      }
    });

    res.status(201).json({
      success: true,
      message: `Technician account for ${tech.fullName} created successfully`,
      technician: {
        id: tech.id,
        email: tech.email,
        fullName: tech.fullName,
        phone: tech.phone,
        profile: tech.technicianProfile
      }
    });
  } catch (error) {
    next(error);
  }
});

// List all technicians with workload
router.get('/technicians', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: Role.TECHNICIAN },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        technicianProfile: true,
        assignedJobs: {
          where: { status: 'ASSIGNED' },
          select: { id: true, assignmentType: true, scheduledDate: true, projectId: true }
        }
      },
      orderBy: { fullName: 'asc' }
    });

    res.json({
      success: true,
      data: technicians.map(t => ({
        ...t,
        activeTasksCount: t.status === 'ACTIVE' ? t.assignedJobs.length : 0
      }))
    });
  } catch (error) {
    next(error);
  }
});

const technicianCredentialsSchema = z.object({
  email: z.string().email().optional(),
  temporaryPassword: z.string().min(8).optional()
}).refine((data) => data.email || data.temporaryPassword, 'Enter a new email or password');

router.patch('/technicians/:id/credentials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const changes = technicianCredentialsSchema.parse(req.body);
    const technician = await prisma.user.findFirst({ where: { id, role: Role.TECHNICIAN } });
    if (!technician) return res.status(404).json({ success: false, message: 'Technician account not found.' });

    const email = changes.email?.trim().toLowerCase();
    if (email) {
      const existing = await prisma.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
      if (existing) return res.status(409).json({ success: false, message: 'That email is already used by another account.' });
    }
    const passwordHash = changes.temporaryPassword ? await bcrypt.hash(changes.temporaryPassword, 10) : undefined;
    const updated = await prisma.user.update({ where: { id }, data: { email, passwordHash }, select: { id: true, email: true, fullName: true } });
    await prisma.auditLog.create({ data: { userId: req.user!.id, action: 'TECHNICIAN_CREDENTIALS_CHANGED', entity: 'USER', entityId: String(id), details: `Admin changed login credentials for ${technician.fullName}.` } });
    res.json({ success: true, message: 'Technician login details updated.', technician: updated });
  } catch (error) { next(error); }
});

router.patch('/technicians/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const technician = await prisma.user.findFirst({ where: { id, role: Role.TECHNICIAN } });
    if (!technician) return res.status(404).json({ success: false, message: 'Technician account not found.' });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: active ? 'ACTIVE' : 'INACTIVE' } });
      await tx.technicianProfile.updateMany({ where: { userId: id }, data: { status: active ? 'AVAILABLE' : 'INACTIVE' } });
      if (!active) {
        await tx.technicianAssignment.updateMany({ where: { technicianId: id, status: 'ASSIGNED' }, data: { status: 'CANCELLED' } });
        await tx.serviceTicket.updateMany({ where: { technicianId: id, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } }, data: { technicianId: null } });
      }
      await tx.auditLog.create({ data: { userId: req.user!.id, action: active ? 'TECHNICIAN_ACCESS_RESTORED' : 'TECHNICIAN_ACCESS_REMOVED', entity: 'USER', entityId: String(id), details: `Admin ${active ? 'restored' : 'removed'} login access for ${technician.fullName}.` } });
    });
    res.json({ success: true, message: active ? 'Technician access restored.' : 'Technician access removed; active work was unassigned.' });
  } catch (error) { next(error); }
});

router.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: Role.CUSTOMER },
      select: {
        id: true, fullName: true, email: true, phone: true, address: true, createdAt: true,
        serviceTickets: { select: { id: true, ticketNumber: true, issueDescription: true, priority: true, status: true, technicianId: true, createdAt: true } },
        projects: {
          select: {
            id: true, requestNumber: true, projectName: true, systemType: true, systemCapacityKw: true, status: true,
            payments: { where: { status: 'COMPLETED' }, select: { amount: true, paymentStage: true, paidAt: true } },
            assignments: { orderBy: { createdAt: 'desc' }, include: { technician: { select: { id: true, fullName: true, phone: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { fullName: 'asc' }
    });
    res.json({ success: true, data: customers.map((customer) => ({
      id: customer.id, fullName: customer.fullName, email: customer.email, phone: customer.phone, address: customer.address,
      serviceCount: customer.serviceTickets.length,
      totalPaid: customer.projects.reduce((sum, project) => sum + project.payments.reduce((paid, payment) => paid + payment.amount, 0), 0),
      currentSystems: customer.projects.filter((project) => project.status === 'COMPLETED').map(({ payments, ...project }) => project),
      serviceTickets: customer.serviceTickets,
      projects: customer.projects.map(({ payments, ...project }) => ({ ...project, paidAmount: payments.reduce((sum, payment) => sum + payment.amount, 0), payments }))
    })) });
  } catch (error) { next(error); }
});

// Admin assigns technician to installation project
const assignTechSchema = z.object({
  projectId: z.number(),
  technicianId: z.number(),
  assignmentType: z.enum(['SURVEY', 'INSTALLATION', 'MAINTENANCE']),
  scheduledDate: z.string().optional(),
  notes: z.string().optional()
});

router.post('/assign-technician', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, technicianId, assignmentType, scheduledDate, notes } = assignTechSchema.parse(req.body);

    const [project, tech] = await Promise.all([
      prisma.installationRequest.findUnique({ where: { id: projectId } }),
      prisma.user.findFirst({ where: { id: technicianId, role: Role.TECHNICIAN, status: 'ACTIVE' } })
    ]);

    if (!project) return res.status(404).json({ success: false, message: 'Installation request not found' });
    if (!tech) return res.status(404).json({ success: false, message: 'Technician not found' });
    if (assignmentType === 'SURVEY' && project.status !== 'ENQUIRY') return res.status(409).json({ success: false, message: 'A site survey can only be assigned to a new customer request.' });
    if (assignmentType === 'INSTALLATION') {
      const [approvedQuote, advance] = await Promise.all([
        prisma.estimate.findFirst({ where: { projectId, status: 'APPROVED' } }),
        prisma.payment.findFirst({ where: { projectId, paymentStage: 'ADVANCE', status: 'COMPLETED' } })
      ]);
      if (!approvedQuote || !advance) return res.status(409).json({ success: false, message: 'The customer must accept the quotation and record the advance before installation is assigned.' });
    }

    // Create assignment
    const assignment = await prisma.technicianAssignment.create({
      data: {
        projectId,
        technicianId,
        assignedBy: req.user!.id,
        assignmentType,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        notes: notes || `Assigned by Admin ${req.user!.fullName}`
      }
    });

    // Advance project status if applicable
    let nextStatus = project.status;
    let nextProgress = project.progress;

    if (assignmentType === 'SURVEY' && project.status === 'ENQUIRY') {
      nextStatus = 'SURVEY_SCHEDULED';
      nextProgress = 25;
    } else if (assignmentType === 'INSTALLATION' && ['ESTIMATE_APPROVED', 'INSTALLATION_SCHEDULED'].includes(project.status)) {
      nextStatus = 'INSTALLATION_SCHEDULED';
      nextProgress = Math.max(project.progress, 65);
    }

    await prisma.installationRequest.update({
      where: { id: projectId },
      data: { status: nextStatus, progress: nextProgress }
    });

    // Create notification for technician
    await prisma.notification.create({
      data: {
        userId: tech.id,
        title: `New ${assignmentType} Task Assigned`,
        message: `You have been assigned to project ${project.requestNumber} (${project.projectName}) at ${project.installationAddress}.`
      }
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'ASSIGN_TECHNICIAN',
        entity: 'INSTALLATION_REQUEST',
        entityId: String(project.id),
        details: `Assigned technician ${tech.fullName} to project ${project.requestNumber} for ${assignmentType}`
      }
    });

    res.json({
      success: true,
      message: `Technician ${tech.fullName} successfully assigned to ${project.requestNumber}`,
      assignment
    });
  } catch (error) {
    next(error);
  }
});

// Admin view audit logs
router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, email: true, role: true } }
      }
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

// Business trends use clearly labeled demo financial values until accounting history and model files are connected.
router.get('/insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const monthDate = (offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const monthKey = (date: Date) => date.toISOString().slice(0, 7);
    const monthLabel = (date: Date) => date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const season = [0.03, 0.01, 0.04, 0.08, 0.1, 0.05, -0.12, -0.08, -0.01, 0.04, 0.12, 0.1];
    const explanations = [
      'Post-holiday enquiries begin to pick up as households plan upgrades.',
      'A shorter month and a quieter booking period keep expected work lower.',
      'Longer sunny days and pre-summer planning increase enquiry volume.',
      'Customers often schedule work before the hottest part of the year.',
      'Peak pre-monsoon installation demand supports a stronger month.',
      'Demand remains steady, although some customers wait for monsoon timing.',
      'Heavy rain can delay rooftop visits and installation schedules.',
      'Weather disruptions may keep field activity and revenue below average.',
      'Clearer weather brings delayed site visits back into the pipeline.',
      'Festive home improvements tend to lift customer enquiries.',
      'A strong seasonal booking period supports higher expected activity.',
      'Year-end upgrades and favorable weather support a stronger close.'
    ];

    const history = Array.from({ length: 12 }, (_, index) => {
      const date = monthDate(index - 12);
      const monthSeason = season[date.getUTCMonth()];
      const repeatableVariation = ((date.getUTCFullYear() * 7 + date.getUTCMonth() * 11) % 9 - 4) * 9000;
      const income = Math.max(160000, Math.round(310000 * (1 + monthSeason) + repeatableVariation));
      const monsoonSlowdown = monthSeason < -0.05;
      const expenditure = Math.round(income * (monsoonSlowdown ? 0.75 : 0.52));
      const charges = monsoonSlowdown ? 90000 : 26000 + (date.getUTCMonth() % 4) * 2500;
      return { month: monthKey(date), label: monthLabel(date), income, expenditure, charges, profit: income - expenditure - charges };
    });
    const lastIncome = history[history.length - 1].income;
    const forecast = Array.from({ length: 12 }, (_, index) => {
      const date = monthDate(index + 1);
      const monthSeason = season[date.getUTCMonth()];
      const income = Math.round(lastIncome * (1 + (index + 1) * 0.018 + monthSeason));
      const monsoonSlowdown = monthSeason < -0.05;
      const expenditure = Math.round(income * (monsoonSlowdown ? 0.75 : 0.52));
      const charges = monsoonSlowdown ? Math.round(90000 * Math.pow(1.015, index + 1)) : Math.round(30000 * Math.pow(1.015, index + 1));
      return { month: monthKey(date), label: monthLabel(date), income, expenditure, charges, profit: income - expenditure - charges, explanation: explanations[date.getUTCMonth()] };
    });

    const tickets = await prisma.serviceTicket.findMany({
      orderBy: { createdAt: 'asc' },
      select: { issueDescription: true, createdAt: true, project: { select: { installationAddress: true } } }
    });
    const monthlyCounts = new Map<string, number>();
    const areaCounts = new Map<string, number>();
    const problemCounts = new Map<string, number>();
    const complaints = tickets.filter((ticket) => /complaint|concern|problem|issue/i.test(ticket.issueDescription));
    for (const ticket of complaints) {
      const key = monthKey(ticket.createdAt);
      monthlyCounts.set(key, (monthlyCounts.get(key) || 0) + 1);
      const addressMatch = ticket.issueDescription.match(/Site address:\s*([^\n]+)/i)?.[1] || ticket.project?.installationAddress || 'Address not provided';
      const area = addressMatch.split(',')[0].trim() || 'Address not provided';
      areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
      const description = ticket.issueDescription.toLowerCase();
      const problem = /dirt|dust|clean|soiling/.test(description) ? 'Cleaning and dirt' :
        /crack|damage|broken|leak/.test(description) ? 'Physical damage' :
        /wire|electrical|power|inverter|connection/.test(description) ? 'Electrical or power' : 'Other concerns';
      problemCounts.set(problem, (problemCounts.get(problem) || 0) + 1);
    }
    const complaintMonths = Array.from({ length: 12 }, (_, index) => {
      const date = monthDate(index - 11);
      return { month: monthKey(date), label: monthLabel(date), count: monthlyCounts.get(monthKey(date)) || 0 };
    });
    const rank = (counts: Map<string, number>) => [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    res.json({ success: true, data: {
      financial: { history, forecast, isDemo: true, note: 'Illustrative trend values only. They are not accounting records or a trained-model forecast.' },
      complaints: { monthly: complaintMonths, areas: rank(areaCounts), problems: rank(problemCounts), total: complaints.length }
    } });
  } catch (error) {
    next(error);
  }
});

export default router;
