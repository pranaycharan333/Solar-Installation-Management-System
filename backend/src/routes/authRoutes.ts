import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { getJwtSecret } from '../config/env';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';

const router = Router();
const googleClient = new OAuth2Client();

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  address: z.string().optional(),
  electricityProvider: z.string().optional(),
  monthlyBillAvg: z.number().optional()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

// Customer Registration - automatically assigns CUSTOMER role
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.'
      });
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);

    const newUser = await prisma.user.create({
      data: {
        email: validated.email.toLowerCase(),
        passwordHash,
        fullName: validated.fullName,
        phone: validated.phone,
        address: validated.address,
        role: Role.CUSTOMER, // Strict: Customer cannot select Admin or Technician
        customerProfile: {
          create: {
            electricityProvider: validated.electricityProvider || 'BESCOM',
            monthlyBillAvg: validated.monthlyBillAvg || 3500
          }
        }
      },
      include: {
        customerProfile: true
      }
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: newUser.id,
        action: 'CUSTOMER_REGISTER',
        entity: 'USER',
        entityId: String(newUser.id),
        details: `Customer registered account for ${newUser.fullName} (${newUser.email})`
      }
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, fullName: newUser.fullName },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to SolarOps Intelligence.',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        phone: newUser.phone,
        address: newUser.address
      }
    });
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

// Common Login for Customer, Admin, and Technician
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        customerProfile: true,
        technicianProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Your account is currently inactive. Please contact support.'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'USER',
        entityId: String(user.id),
        details: `Successful login for role ${user.role}`
      }
    });

    res.json({
      success: true,
      message: `Welcome back, ${user.fullName}`,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        phone: user.phone,
        address: user.address,
        customerProfile: user.customerProfile,
        technicianProfile: user.technicianProfile
      }
    });
  } catch (error) {
    next(error);
  }
});

// Verify Google's signed ID token on the server before creating a customer session.
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ success: false, message: 'Google sign-in has not been configured yet.' });
    }

    const credential = z.string().min(1).parse(req.body?.credential);
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    const claims = ticket.getPayload();
    if (!claims?.email || claims.email_verified !== true) {
      return res.status(401).json({ success: false, message: 'Google did not provide a verified email address.' });
    }

    const email = claims.email.toLowerCase();
    let user = await prisma.user.findUnique({
      where: { email },
      include: { customerProfile: true, technicianProfile: true }
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: claims.name || email.split('@')[0],
          role: Role.CUSTOMER,
          customerProfile: { create: { electricityProvider: 'BESCOM', monthlyBillAvg: 3500 } }
        },
        include: { customerProfile: true, technicianProfile: true }
      });
    }

    // Google sign-in is for customer accounts only. Administrative and
    // technician access must use their role-specific email/password login.
    if (user.role !== Role.CUSTOMER) {
      return res.status(403).json({ success: false, message: 'Google sign-in is available for customer accounts. Use your work email and password for this account.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your account is currently inactive. Please contact support.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    await prisma.auditLog.create({
      data: { userId: user.id, action: 'GOOGLE_LOGIN', entity: 'USER', entityId: String(user.id), details: `Google sign-in for role ${user.role}` }
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id, email: user.email, fullName: user.fullName, role: user.role,
        phone: user.phone, address: user.address,
        customerProfile: user.customerProfile, technicianProfile: user.technicianProfile
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user details from JWT
router.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        address: true,
        status: true,
        createdAt: true,
        customerProfile: true,
        technicianProfile: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

const customerProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  address: z.string().trim().max(250).optional()
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'Add at least one profile change');

router.patch('/profile', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.CUSTOMER) {
      return res.status(403).json({ success: false, message: 'Only customers can edit a customer profile.' });
    }
    const changes = customerProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: changes,
      select: { id: true, email: true, fullName: true, role: true, phone: true, address: true }
    });
    await prisma.auditLog.create({
      data: { userId: user.id, action: 'CUSTOMER_PROFILE_UPDATED', entity: 'USER', entityId: String(user.id), details: 'Customer updated their profile details.' }
    });
    res.json({ success: true, message: 'Profile updated successfully.', user });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/read', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
