/**
 * Controller UC-15: parsing request dan bentuk respons.
 * Validasi tipe/rentang nilai dilakukan di service berdasarkan definisi parameter di database.
 */
import * as konfigurasiService from '../services/konfigurasi.service.js';
import { AppError } from '../utils/AppError.js';

const POLA_KUNCI = /^[a-z0-9_]{1,100}$/;

export function parseKunci(nilai) {
  // Kunci yang bentuknya saja sudah salah pasti tidak terdaftar.
  if (typeof nilai !== 'string' || !POLA_KUNCI.test(nilai)) {
    throw new AppError(404, 'Parameter tidak dikenal.');
  }
  return nilai;
}

export function parseQueryRiwayat(query = {}) {
  let kunci;
  if (query.kunci !== undefined) {
    if (typeof query.kunci !== 'string') {
      throw new AppError(400, 'Parameter kunci tidak valid.');
    }
    const teks = query.kunci.trim();
    kunci = teks === '' ? undefined : parseKunci(teks);
  }

  let batas = 20;
  if (query.batas !== undefined) {
    const angka = typeof query.batas === 'string' && /^\d{1,3}$/.test(query.batas) ? Number(query.batas) : 0;
    if (angka < 1 || angka > 100) {
      throw new AppError(400, 'Batas riwayat harus antara 1 dan 100.');
    }
    batas = angka;
  }

  return { kunci, batas };
}

function kirimOk(res, data) {
  return res.status(200).json({ success: true, data });
}

export async function daftar(req, res, next) {
  try {
    return kirimOk(res, await konfigurasiService.daftarKonfigurasi());
  } catch (err) {
    return next(err);
  }
}

export async function ubah(req, res, next) {
  try {
    const kunci = parseKunci(req.params.kunci);
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    if (!('nilai' in body)) {
      throw new AppError(400, 'Nilai wajib diisi.');
    }
    return kirimOk(res, await konfigurasiService.ubahKonfigurasi(kunci, body.nilai, req.user.id));
  } catch (err) {
    return next(err);
  }
}

export async function riwayat(req, res, next) {
  try {
    const filter = parseQueryRiwayat(req.query);
    return kirimOk(res, await konfigurasiService.riwayatKonfigurasi(filter));
  } catch (err) {
    return next(err);
  }
}
