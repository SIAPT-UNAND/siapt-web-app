import { Router } from 'express';
import {
  getBuktiPembayaranDenda,
  getDaftarPembayaranDenda,
  getDaftarPengembalian,
  getQrisInfo,
  koreksiDenda,
  koreksiDendaMassal,
  prosesPengembalian,
  triggerSyncDenda,
  uploadBuktiPembayaranDenda,
  verifikasiPembayaranDenda,
} from '../controllers/pengembalian.controller.js';
import { hanyaPeran, penggunaSementara } from '../middleware/penggunaSementara.js';
import { ROLE } from '../constants/status.js';

const router = Router();

router.get(
  '/',
  penggunaSementara,
  hanyaPeran(ROLE.ANGGOTA, ROLE.PUSTAKAWAN),
  getDaftarPengembalian
);
router.post('/sync-denda', penggunaSementara, hanyaPeran(ROLE.PUSTAKAWAN), triggerSyncDenda);
router.post('/proses', penggunaSementara, hanyaPeran(ROLE.PUSTAKAWAN), prosesPengembalian);
router.post('/denda/koreksi', penggunaSementara, hanyaPeran(ROLE.PUSTAKAWAN), koreksiDenda);
router.post(
  '/denda/koreksi-massal',
  penggunaSementara,
  hanyaPeran(ROLE.PUSTAKAWAN),
  koreksiDendaMassal
);
router.get('/qris', getQrisInfo);
router.get(
  '/pembayaran',
  penggunaSementara,
  hanyaPeran(ROLE.PUSTAKAWAN),
  getDaftarPembayaranDenda
);
router.get('/pembayaran/:id_pembayaran/bukti', penggunaSementara, getBuktiPembayaranDenda);
router.post('/pembayaran', penggunaSementara, uploadBuktiPembayaranDenda);
router.post(
  '/pembayaran/:id_pembayaran/verifikasi',
  penggunaSementara,
  hanyaPeran(ROLE.PUSTAKAWAN),
  verifikasiPembayaranDenda
);

export default router;
