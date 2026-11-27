/**
 * Satu-satunya titik impor middleware autentikasi untuk route modul Akun, Konfigurasi, dan Dashboard.
 *
 * SEMENTARA: shim sampai modul auth Clara (modules/auth-chatbot) masuk staging.
 * Setelah itu, ganti seluruh isi file ini menjadi:
 *   export { requireAuth, requireRole } from '../modules/auth-chatbot/index.mjs';
 *
 * Aturan shim:
 * - Default MATI. Tanpa AUTH_SEMENTARA=true, requireAuth selalu menolak (401),
 *   sehingga header x-pengenal tidak bisa dipakai untuk mengaku sebagai pengguna lain di server.
 * - Hanya bisa aktif saat NODE_ENV=development atau test. Di server deploy (production, staging,
 *   atau NODE_ENV kosong) shim tetap mati walaupun AUTH_SEMENTARA=true.
 * - Identitas dibaca dari header `x-pengenal` (kolom pengguna.pengenal).
 * - Akun nonaktif ditolak 401, dan bentuk req.user serta pesan 401/403 sama dengan milik Clara.
 */
import prisma from '../lib/prisma.js';

const PESAN_BELUM_LOGIN = 'Silakan login terlebih dahulu.';
const PESAN_AKUN_TIDAK_AKTIF = 'Sesi tidak valid atau akun tidak aktif. Silakan login kembali.';
const PESAN_TANPA_IZIN = 'Kamu tidak memiliki izin untuk mengakses fungsi ini.';

function kirimGagal(res, status, message) {
  return res.status(status).json({ success: false, message });
}

// Lingkungan lokal yang boleh memakai shim; selain ini dianggap server deploy.
const LINGKUNGAN_LOKAL = ['development', 'test'];

export function shimAktif() {
  return process.env.AUTH_SEMENTARA === 'true' && LINGKUNGAN_LOKAL.includes(process.env.NODE_ENV);
}

export async function requireAuth(req, res, next) {
  try {
    if (!shimAktif()) {
      return kirimGagal(res, 401, PESAN_BELUM_LOGIN);
    }

    const pengenal = String(req.get('x-pengenal') ?? '').trim();
    if (!pengenal) {
      return kirimGagal(res, 401, PESAN_BELUM_LOGIN);
    }

    const akun = await prisma.pengguna.findUnique({
      where: { pengenal },
      include: { role: true },
    });

    if (!akun || akun.status_aktif !== true) {
      return kirimGagal(res, 401, PESAN_AKUN_TIDAK_AKTIF);
    }

    req.user = {
      id: akun.id_pengguna,
      nama: akun.nama || akun.pengenal,
      pengenal: akun.pengenal,
      role: akun.role.nama_role,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return kirimGagal(res, 401, PESAN_BELUM_LOGIN);
    }
    if (!roles.includes(req.user.role)) {
      return kirimGagal(res, 403, PESAN_TANPA_IZIN);
    }
    return next();
  };
}
