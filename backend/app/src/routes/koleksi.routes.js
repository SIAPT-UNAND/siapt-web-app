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

const router = Router();

router.get('/kategori', getKategoriList);
router.get('/opsi-form', getFormOptions);
router.post('/import', importKoleksi);
router.get('/', getKoleksi);
router.get('/:id', getKoleksiById);
router.post('/', createKoleksi);
router.put('/:id', updateKoleksi);
router.delete('/:id', deleteKoleksi);

export default router;
