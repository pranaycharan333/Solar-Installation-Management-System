import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Customer-safe component catalog; does not expose warehouse quantities or locations.
router.get('/catalog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.material.findMany({
      select: { id: true, name: true, category: true, unit: true, unitCost: true },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: items });
  } catch (error) { next(error); }
});

// List inventory & materials
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.material.findMany({
      include: { inventory: true },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: items.map(m => ({
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        unit: m.unit,
        unitCost: m.unitCost,
        quantityOnHand: m.inventory?.quantityOnHand || 0,
        allocatedQuantity: m.inventory?.allocatedQuantity || 0,
        reorderLevel: m.inventory?.reorderLevel || 10,
        location: m.inventory?.location || 'Central Warehouse',
        isLowStock: (m.inventory?.quantityOnHand || 0) <= (m.inventory?.reorderLevel || 10)
      }))
    });
  } catch (error) {
    next(error);
  }
});

const adjustStockSchema = z.object({
  materialId: z.number(),
  quantityChange: z.number(),
  reason: z.string().min(3, 'Reason is required')
});

const materialSchema = z.object({ name: z.string().min(2), category: z.string().min(2), unit: z.string().min(1), unitCost: z.number().positive(), quantityOnHand: z.number().nonnegative().default(0) });
router.post('/materials', requireRole([Role.ADMIN]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = materialSchema.parse(req.body);
    const code = `${data.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18)}-${Date.now().toString().slice(-5)}`;
    const material = await prisma.material.create({ data: { code, name: data.name, category: data.category, unit: data.unit, unitCost: data.unitCost, inventory: { create: { quantityOnHand: data.quantityOnHand } } }, include: { inventory: true } });
    res.status(201).json({ success: true, message: 'Material added to the catalog.', data: material });
  } catch (error) { next(error); }
});

// Admin adjusts stock
router.post('/adjust', requireRole([Role.ADMIN]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { materialId, quantityChange, reason } = adjustStockSchema.parse(req.body);

    const inventory = await prisma.inventory.findUnique({
      where: { materialId },
      include: { material: true }
    });

    if (!inventory) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }

    const newQuantity = inventory.quantityOnHand + quantityChange;
    if (newQuantity < 0) {
      return res.status(400).json({ success: false, message: 'Stock quantity cannot be negative' });
    }

    const updated = await prisma.inventory.update({
      where: { materialId },
      data: { quantityOnHand: newQuantity }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'INVENTORY_ADJUST',
        entity: 'INVENTORY',
        entityId: String(inventory.id),
        details: `Stock for ${inventory.material.name} adjusted by ${quantityChange} (New balance: ${newQuantity}). Reason: ${reason}`
      }
    });

    res.json({
      success: true,
      message: `Stock updated for ${inventory.material.name}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

export default router;
