import { Router } from 'express';
import healthRoutes from './health.routes.js';
import exampleRoutes from './example.routes.js';
import adminRoutes from './admin.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/items', exampleRoutes);
router.use('/admin', adminRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
