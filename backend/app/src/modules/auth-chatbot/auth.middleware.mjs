import { prisma } from './db.mjs';
import { COOKIE_NAME } from './config.mjs';
import { parseCookies, sendFail } from './http.mjs';
import { toPublicUser, verifySessionToken } from './auth.service.mjs';

// Wajib login. Akun dibaca ulang dari database supaya akun yang dinonaktifkan langsung ditolak.
export async function requireAuth(req, res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) {
      return sendFail(res, 401, 'Silakan login terlebih dahulu.');
    }

    let payload;
    try {
      payload = verifySessionToken(token);
    } catch (err) {
      if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError' || err?.name === 'NotBeforeError') {
        return sendFail(res, 401, 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.');
      }
      throw err;
    }

    const akun = await prisma.pengguna.findUnique({
      where: { id_pengguna: Number(payload.sub) },
      include: { role: true },
    });

    if (!akun || akun.status_aktif !== true) {
      return sendFail(res, 401, 'Sesi tidak valid atau akun tidak aktif. Silakan login kembali.');
    }

    req.user = toPublicUser(akun);
    return next();
  } catch (err) {
    return next(err);
  }
}

// Pemeriksaan hak akses di sisi server (bukan sekadar menyembunyikan menu)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendFail(res, 401, 'Silakan login terlebih dahulu.');
    }
    if (!roles.includes(req.user.role)) {
      return sendFail(res, 403, 'Kamu tidak memiliki izin untuk mengakses fungsi ini.');
    }
    return next();
  };
}