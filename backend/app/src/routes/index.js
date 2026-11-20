import { Router } from 'express';
import healthRoutes from './health.routes.js';
import exampleRoutes from './example.routes.js';
import koleksiRoutes from './koleksi.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/items', exampleRoutes);
router.use('/koleksi', koleksiRoutes);

export default router;
