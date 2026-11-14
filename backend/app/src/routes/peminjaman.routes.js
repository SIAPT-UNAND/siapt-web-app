import { Router } from 'express';
import { getKetentuan, postPeminjamanMandiri } from '../controllers/peminjaman.controller.js';
import { penggunaSementara, hanyaPeran } from '../middleware/penggunaSementara.js';
import { ROLE } from '../constants/status.js';

const router = Router();

router.use(penggunaSementara);

router.get('/ketentuan', hanyaPeran(ROLE.ANGGOTA, ROLE.PUSTAKAWAN), getKetentuan);
router.post('/mandiri', hanyaPeran(ROLE.ANGGOTA), postPeminjamanMandiri);

export default router;
