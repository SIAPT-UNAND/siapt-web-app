import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as akun from '../controllers/akun.controller.js';
import * as konfigurasi from '../controllers/konfigurasi.controller.js';

const router = Router();

// Dipasang di level router supaya tidak ada route Admin yang lupa dilindungi (NFR-02).
router.use(requireAuth, requireRole('Admin'));

// UC-13 Mengelola Akun Pengguna (tidak ada DELETE: akun historis tidak dihapus permanen)
router.get('/akun', akun.daftar);
router.post('/akun', akun.tambah);
router.get('/akun/:id', akun.ambil);
router.patch('/akun/:id', akun.ubah);
router.patch('/akun/:id/status', akun.ubahStatus);
router.patch('/akun/:id/kata-sandi', akun.resetKataSandi);

// UC-14 Mengelola Hak Akses
router.get('/peran', akun.daftarPeran);
router.patch('/akun/:id/peran', akun.ubahPeran);

// UC-15 Mengelola Konfigurasi Sistem (tidak ada POST/DELETE parameter).
// `riwayat` didaftarkan sebelum `/:kunci` agar tidak tertangkap sebagai kunci.
router.get('/konfigurasi', konfigurasi.daftar);
router.get('/konfigurasi/riwayat', konfigurasi.riwayat);
router.patch('/konfigurasi/:kunci', konfigurasi.ubah);

export default router;
