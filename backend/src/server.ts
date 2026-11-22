import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import projectRoutes from './routes/projectRoutes';
import surveyRoutes from './routes/surveyRoutes';
import estimateRoutes from './routes/estimateRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import checklistRoutes from './routes/checklistRoutes';
import serviceRoutes from './routes/serviceRoutes';
import warrantyRoutes from './routes/warrantyRoutes';
import paymentRoutes from './routes/paymentRoutes';
import aiRoutes from './routes/aiRoutes';
import { errorHandler } from './middleware/errorHandler';
import { getJwtSecret } from './config/env';

dotenv.config();

if (process.env.NODE_ENV !== 'test') {
  getJwtSecret();
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow frontend dev server
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'SolarOps Intelligence Enterprise Platform',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/warranties', warrantyRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);

// Global Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`☀ SolarOps Intelligence Backend API running on port ${PORT}`);
    console.log(`✓ Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

export default app;
