import { Router, Request, Response, NextFunction } from 'express';
import { AiService } from '../services/aiService';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticateToken);

/**
 * AI/ML Integration Layer Endpoints
 * Conforms to guidelines:
 * - Strictly advisory
 * - No fake confidence scores
 * - No autonomous price, inventory, or warranty updates
 */

// Advisory Demand Forecast
router.get('/forecast-demand', requireRole([Role.ADMIN]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const predictions = await AiService.getMaterialDemandForecast();
    res.json({
      success: true,
      advisory_notice: 'Linear Regression and Random Forest forecasts trained on included synthetic sample history. Demonstration only; not validated for real purchasing decisions.',
      data: predictions
    });
  } catch (error) {
    console.error('[ML forecast unavailable]', error);
    res.status(503).json({
      success: false,
      message: 'The local ML forecast could not load its Python libraries. No substitute values were generated.'
    });
  }
});

// Advisory Computer Vision Roof Feasibility Assessment
router.post('/roof-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analysis = AiService.analyzeRoofPhotograph();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

export default router;
