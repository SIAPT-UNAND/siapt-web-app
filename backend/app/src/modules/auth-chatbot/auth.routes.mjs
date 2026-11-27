import { Router } from 'express';
import { prisma } from './db.mjs';
import { COOKIE_NAME, SESSION_HOURS, getWhatsAppNumber, isProduction } from './config.mjs';
import { createRateLimiter, sendFail, sendOk } from './http.mjs';
import {
  AuthError,
  authenticate,
  signSessionToken,
  toPublicUser,
  validateLoginInput,
} from './auth.service.mjs';
import { requireAuth } from './auth.middleware.mjs';
import { buildWhatsAppLink } from './whatsapp.mjs';

const router = Router();

// Batas total per IP untuk semua akun. Dibuat longgar karena banyak pengguna bisa
// berbagi satu IP (NAT kampus atau reverse proxy).
const loginIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.',
  keyFn: (req) => req.ip,
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.',
  keyFn: (req) => `${req.ip}|${String(req.body?.pengenal ?? '').trim().toLowerCase()}`,
});

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  };
}

router.post('/auth/login', loginIpLimiter, loginLimiter, async (req, res) => {
  try {
    const input = validateLoginInput(req.body);
    if (input.error) {
      return sendFail(res, 400, input.error);
    }

    const akun = await authenticate(prisma, input.pengenal, input.kataSandi);
    res.cookie(COOKIE_NAME, signSessionToken(akun), cookieOptions());
    return sendOk(res, { user: toPublicUser(akun) });
  } catch (err) {
    if (err instanceof AuthError) {
      return sendFail(res, err.status, err.message);
    }
    console.error('[auth] login gagal:', err);
    return sendFail(res, 500, 'Proses login belum dapat dilakukan. Coba lagi nanti.');
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
  });
  return sendOk(res, null);
});

router.get('/auth/me', requireAuth, (req, res) => {
  return sendOk(res, { user: req.user });
});

// Lupa kata sandi: skema database belum punya email/token reset,
// jadi pengguna diarahkan menghubungi Admin lewat WhatsApp.
router.get('/auth/bantuan', (req, res) => {
  const teks =
    'Halo Admin SIAPT UNAND, saya lupa kata sandi akun saya. NIM/NIP saya: ';
  return sendOk(res, { whatsapp: buildWhatsAppLink(getWhatsAppNumber(), teks) });
});

export default router;