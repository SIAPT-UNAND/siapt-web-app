/**
 * Controller UC-13 (akun) dan UC-14 (peran): parsing dan validasi request, bentuk respons.
 * Validasi di sini adalah sumber kebenaran (NFR-03); validasi form di frontend hanya membantu.
 */
import * as akunService from '../services/akun.service.js';
import { AppError } from '../utils/AppError.js';

const POLA_PENGENAL = /^[A-Za-z0-9._-]+$/;
const ID_MAKS = 2147483647; // batas kolom INT MySQL
const BATAS_BYTE_BCRYPT = 72;

const KOLOM_TERLARANG_UBAH_AKUN = [
  'role',
  'id_role',
  'status_aktif',
  'alasan',
  'alasan_nonaktif',
  'kata_sandi',
  'kata_sandi_baru',
  'kata_sandi_hash',
];

export function bacaBody(req) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  return body;
}

export function parseId(nilai) {
  if (typeof nilai !== 'string' || !/^[1-9]\d*$/.test(nilai) || Number(nilai) > ID_MAKS) {
    throw new AppError(400, 'ID akun tidak valid.');
  }
  return Number(nilai);
}

export function validasiPengenal(nilai) {
  const teks = typeof nilai === 'string' ? nilai.trim() : '';
  if (teks.length < 3 || teks.length > 50 || !POLA_PENGENAL.test(teks)) {
    throw new AppError(400, 'Pengenal wajib diisi (3–50 karakter, huruf/angka/titik/garis).');
  }
  return teks;
}

export function validasiNama(nilai) {
  const teks = typeof nilai === 'string' ? nilai.trim() : '';
  if (teks.length < 2 || teks.length > 255) {
    throw new AppError(400, 'Nama wajib diisi (2–255 karakter).');
  }
  return teks;
}

export function validasiPeran(nilai) {
  const teks = typeof nilai === 'string' ? nilai.trim() : '';
  if (!teks || teks.length > 255) {
    throw new AppError(400, 'Peran tidak dikenal.');
  }
  return teks;
}

export function validasiKataSandi(nilai) {
  if (typeof nilai !== 'string' || nilai.length < 8) {
    throw new AppError(400, 'Kata sandi minimal 8 karakter.');
  }
  if (Buffer.byteLength(nilai, 'utf8') > BATAS_BYTE_BCRYPT) {
    throw new AppError(400, 'Kata sandi maksimal 72 karakter.');
  }
  return nilai;
}

export function validasiAlasan(nilai) {
  const teks = typeof nilai === 'string' ? nilai.trim() : '';
  if (teks.length < 3 || teks.length > 255) {
    throw new AppError(400, 'Alasan penonaktifan wajib diisi (3–255 karakter).');
  }
  return teks;
}

function ambilQueryTeks(query, kunci) {
  const nilai = query[kunci];
  if (nilai === undefined) return undefined;
  if (typeof nilai !== 'string') {
    throw new AppError(400, `Parameter ${kunci} tidak valid.`);
  }
  const teks = nilai.trim();
  return teks === '' ? undefined : teks;
}

export function parseQueryDaftar(query = {}) {
  const q = ambilQueryTeks(query, 'q');
  if (q !== undefined && q.length > 100) {
    throw new AppError(400, 'Kata kunci pencarian maksimal 100 karakter.');
  }

  const role = ambilQueryTeks(query, 'role');
  if (role !== undefined && role.length > 255) {
    throw new AppError(400, 'Peran tidak dikenal.');
  }

  const status = ambilQueryTeks(query, 'status');
  if (status !== undefined && status !== 'aktif' && status !== 'nonaktif') {
    throw new AppError(400, 'Status harus "aktif" atau "nonaktif".');
  }

  const teksHalaman = ambilQueryTeks(query, 'halaman');
  let halaman = 1;
  if (teksHalaman !== undefined) {
    if (!/^[1-9]\d{0,5}$/.test(teksHalaman)) {
      throw new AppError(400, 'Halaman harus bilangan bulat minimal 1.');
    }
    halaman = Number(teksHalaman);
  }

  const teksPerHalaman = ambilQueryTeks(query, 'per_halaman');
  let perHalaman = 20;
  if (teksPerHalaman !== undefined) {
    const angka = /^\d{1,3}$/.test(teksPerHalaman) ? Number(teksPerHalaman) : 0;
    if (angka < 1 || angka > 100) {
      throw new AppError(400, 'Jumlah per halaman harus antara 1 dan 100.');
    }
    perHalaman = angka;
  }

  return { q, role, status, halaman, perHalaman };
}

function kirimOk(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export async function daftar(req, res, next) {
  try {
    const filter = parseQueryDaftar(req.query);
    return kirimOk(res, await akunService.daftarAkun(filter));
  } catch (err) {
    return next(err);
  }
}

export async function ambil(req, res, next) {
  try {
    const id = parseId(req.params.id);
    return kirimOk(res, await akunService.ambilAkun(id));
  } catch (err) {
    return next(err);
  }
}

export async function tambah(req, res, next) {
  try {
    const body = bacaBody(req);
    const data = {
      pengenal: validasiPengenal(body.pengenal),
      nama: validasiNama(body.nama),
      role: validasiPeran(body.role),
      kataSandi: validasiKataSandi(body.kata_sandi),
    };
    return kirimOk(res, await akunService.tambahAkun(data), 201);
  } catch (err) {
    return next(err);
  }
}

export async function ubah(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const body = bacaBody(req);

    if (KOLOM_TERLARANG_UBAH_AKUN.some((kolom) => kolom in body)) {
      throw new AppError(400, 'Peran, status, dan kata sandi diubah melalui menu masing-masing.');
    }
    if (body.nama === undefined && body.pengenal === undefined) {
      throw new AppError(400, 'Isi nama atau pengenal yang ingin diubah.');
    }

    const data = {};
    if (body.pengenal !== undefined) data.pengenal = validasiPengenal(body.pengenal);
    if (body.nama !== undefined) data.nama = validasiNama(body.nama);

    return kirimOk(res, await akunService.ubahAkun(id, data));
  } catch (err) {
    return next(err);
  }
}

export async function ubahStatus(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const body = bacaBody(req);

    if (typeof body.status_aktif !== 'boolean') {
      throw new AppError(400, 'Status akun harus dipilih (aktif atau nonaktif).');
    }
    const statusAktif = body.status_aktif;
    const alasan = statusAktif ? null : validasiAlasan(body.alasan);

    return kirimOk(res, await akunService.ubahStatusAkun(id, { statusAktif, alasan }, req.user.id));
  } catch (err) {
    return next(err);
  }
}

export async function resetKataSandi(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const kataSandiBaru = validasiKataSandi(bacaBody(req).kata_sandi_baru);
    return kirimOk(res, await akunService.resetKataSandi(id, kataSandiBaru));
  } catch (err) {
    return next(err);
  }
}

export async function daftarPeran(req, res, next) {
  try {
    return kirimOk(res, await akunService.daftarPeran());
  } catch (err) {
    return next(err);
  }
}

export async function ubahPeran(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const role = validasiPeran(bacaBody(req).role);
    return kirimOk(res, await akunService.ubahPeran(id, role, req.user.id));
  } catch (err) {
    return next(err);
  }
}
