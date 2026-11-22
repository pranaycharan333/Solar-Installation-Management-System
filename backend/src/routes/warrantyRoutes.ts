import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// List warranties
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, id: userId } = req.user!;
    let whereClause: any = {};

    if (role === Role.CUSTOMER) {
      whereClause = { customerId: userId };
    }

    const warranties = await prisma.warranty.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            requestNumber: true,
            projectName: true,
            systemCapacityKw: true,
            installationAddress: true,
            systemType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: warranties });
  } catch (error) {
    next(error);
  }
});

export default router;
