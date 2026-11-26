import { Router } from 'express';
import {
  getKategoriList,
  getFormOptions,
  getKoleksi,
  getKoleksiById,
  createKoleksi,
  importKoleksi,
  updateKoleksi,
  deleteKoleksi,
} from '../controllers/koleksi.controller.js';
import { penggunaSementara, hanyaPeran } from '../middleware/penggunaSementara.js';
import { ROLE } from '../constants/status.js';

const router = Router();

router.get('/kategori', getKategoriList);
router.get('/opsi-form', getFormOptions);
router.post('/import', penggunaSementara, hanyaPeran(ROLE.PUSTAKAWAN), importKoleksi);
router.get('/', getKoleksi);
router.get('/:id', getKoleksiById);
router.post('/', penggunaSementara, hanyaPeran(ROLE.PUSTAKAWAN), createKoleksi);
router.put('/:id', penggunaSementara, hanyaPeran(ROLE.PUSTAKAWAN), updateKoleksi);
router.delete('/:id', penggunaSementara, hanyaPeran(ROLE.PUSTAKAWAN), deleteKoleksi);

export default router;
