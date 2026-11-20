import { Router } from 'express';
import { prisma } from './db.mjs';
import { createRateLimiter, sendFail, sendOk } from './http.mjs';
import { requireAuth, requireRole } from './auth.middleware.mjs';
import {
  PermintaanError,
  ajukanPermintaan,
  daftarPermintaanAnggota,
  daftarPermintaanPustakawan,
  detailPermintaan,
  tanggapiPermintaan,
  validateAjukanInput,
  validateTanggapanInput,
} from './permintaan.service.mjs';

const router = Router();

const ajukanLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 6,
  message: 'Terlalu banyak pengajuan. Coba lagi sebentar lagi.',
  keyFn: (req) => `ajukan|${req.user?.id ?? req.ip}`,
});

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function tanganiGalat(res, err, label) {
  if (err instanceof PermintaanError) {
    return sendFail(res, err.status, err.message);
  }
  console.error(`[permintaan] ${label}:`, err);
  return sendFail(res, 500, 'Terjadi kesalahan pada server. Coba lagi nanti.');
}

// ---------- Anggota ----------

router.post('/permintaan', requireAuth, requireRole('Anggota'), ajukanLimiter, async (req, res) => {
  try {
    const input = validateAjukanInput(req.body);
    if (input.error) {
      return sendFail(res, 400, input.error);
    }
    const dibuat = await ajukanPermintaan(prisma, req.user, input);
    return sendOk(res, { permintaan: dibuat }, 201);
  } catch (err) {
    return tanganiGalat(res, err, 'ajukan');
  }
});

router.get('/permintaan/saya', requireAuth, requireRole('Anggota'), async (req, res) => {
  try {
    const permintaan = await daftarPermintaanAnggota(prisma, req.user.id);
    return sendOk(res, { permintaan });
  } catch (err) {
    return tanganiGalat(res, err, 'daftar anggota');
  }
});

// ---------- Pustakawan ----------

router.get('/pustakawan/permintaan', requireAuth, requireRole('Pustakawan'), async (req, res) => {
  try {
    const status = String(req.query.status ?? '').trim();
    const hasil = await daftarPermintaanPustakawan(prisma, status && status !== 'Semua' ? status : undefined);
    return sendOk(res, hasil);
  } catch (err) {
    return tanganiGalat(res, err, 'daftar pustakawan');
  }
});

router.get('/pustakawan/permintaan/:id', requireAuth, requireRole('Pustakawan'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return sendFail(res, 400, 'ID permintaan tidak valid.');
    }
    const permintaan = await detailPermintaan(prisma, id);
    return sendOk(res, { permintaan });
  } catch (err) {
    return tanganiGalat(res, err, 'detail');
  }
});

router.post(
  '/pustakawan/permintaan/:id/tanggapan',
  requireAuth,
  requireRole('Pustakawan'),
  async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        return sendFail(res, 400, 'ID permintaan tidak valid.');
      }
      const input = validateTanggapanInput(req.body);
      if (input.error) {
        return sendFail(res, 400, input.error);
      }
      const hasil = await tanggapiPermintaan(prisma, req.user, id, input);
      return sendOk(res, hasil, 201);
    } catch (err) {
      return tanganiGalat(res, err, 'tanggapi');
    }
  },
);

export default router;