import { Router } from 'express';
import healthRoutes from './health.routes.js';
import exampleRoutes from './example.routes.js';
import pengembalianRoutes from './pengembalian.routes.js';
import koleksiRoutes from './koleksi.routes.js';
import peminjamanRoutes from './peminjaman.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/items', exampleRoutes);
router.use('/pengembalian', pengembalianRoutes);
router.use('/koleksi', koleksiRoutes);
router.use('/peminjaman', peminjamanRoutes);

export default router;
