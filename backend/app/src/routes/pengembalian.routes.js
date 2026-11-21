import { Router } from 'express';
import {
  getDaftarPembayaranDenda,
  getDaftarPengembalian,
  getQrisInfo,
  koreksiDenda,
  prosesPengembalian,
  triggerSyncDenda,
  uploadBuktiPembayaranDenda,
  verifikasiPembayaranDenda,
} from '../controllers/pengembalian.controller.js';

const router = Router();

router.get('/', getDaftarPengembalian);
router.post('/sync-denda', triggerSyncDenda);
router.post('/proses', prosesPengembalian);
router.post('/denda/koreksi', koreksiDenda);
router.get('/qris', getQrisInfo);
router.get('/pembayaran', getDaftarPembayaranDenda);
router.post('/pembayaran', uploadBuktiPembayaranDenda);
router.post('/pembayaran/:id_pembayaran/verifikasi', verifikasiPembayaranDenda);

export default router;
