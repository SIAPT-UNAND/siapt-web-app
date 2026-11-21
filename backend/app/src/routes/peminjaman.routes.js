import { Router } from 'express';
import {
  getAnggotaUntukPustakawan,
  getInfoBuku,
  getCekKelayakan,
  getKetentuan,
  getRiwayatSaya,
  getTransaksiTerbaru,
  postPeminjamanMandiri,
  postPeminjamanPustakawan,
} from '../controllers/peminjaman.controller.js';
import { penggunaSementara, hanyaPeran } from '../middleware/penggunaSementara.js';
import { ROLE } from '../constants/status.js';

const router = Router();

router.use(penggunaSementara);

router.get('/ketentuan', hanyaPeran(ROLE.ANGGOTA, ROLE.PUSTAKAWAN), getKetentuan);

// Anggota (UC-03, UC-04)
router.get('/saya', hanyaPeran(ROLE.ANGGOTA), getRiwayatSaya);
router.get('/cek', hanyaPeran(ROLE.ANGGOTA), getCekKelayakan);
router.post('/mandiri', hanyaPeran(ROLE.ANGGOTA), postPeminjamanMandiri);

// Pustakawan (UC-09)
router.get('/pustakawan/anggota/:pengenal', hanyaPeran(ROLE.PUSTAKAWAN), getAnggotaUntukPustakawan);
router.get('/pustakawan/buku/:kode', hanyaPeran(ROLE.PUSTAKAWAN), getInfoBuku);
router.post('/pustakawan', hanyaPeran(ROLE.PUSTAKAWAN), postPeminjamanPustakawan);
router.get('/terbaru', hanyaPeran(ROLE.PUSTAKAWAN), getTransaksiTerbaru);

export default router;
