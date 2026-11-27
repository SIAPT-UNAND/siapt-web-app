import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as dashboard from '../controllers/dashboard.controller.js';

const router = Router();

// UC-12: hanya Pengelola (Admin pun tidak punya akses, A2 §3.1). Semua endpoint read-only.
router.use(requireAuth, requireRole('Pengelola'));

router.get('/ringkasan', dashboard.ringkasan);
// Menu rinci (usulan perluasan UC-12, .prd/07). `?periode=7h|30h|90h|bulan` untuk 3 menu terakhir.
router.get('/koleksi', dashboard.koleksi);
router.get('/sirkulasi', dashboard.sirkulasi);
router.get('/denda', dashboard.denda);
router.get('/layanan', dashboard.layanan);

export default router;
