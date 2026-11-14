import { Router } from 'express';
import {
  getCekKelayakan,
  getKetentuan,
  postPeminjamanMandiri,
} from '../controllers/peminjaman.controller.js';
import { penggunaSementara, hanyaPeran } from '../middleware/penggunaSementara.js';
import { ROLE } from '../constants/status.js';

const router = Router();

router.use(penggunaSementara);

router.get('/ketentuan', hanyaPeran(ROLE.ANGGOTA, ROLE.PUSTAKAWAN), getKetentuan);
router.get('/cek', hanyaPeran(ROLE.ANGGOTA), getCekKelayakan);
router.post('/mandiri', hanyaPeran(ROLE.ANGGOTA), postPeminjamanMandiri);

export default router;
