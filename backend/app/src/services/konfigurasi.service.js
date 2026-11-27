/**
 * Logika bisnis UC-15 (Mengelola Konfigurasi Sistem).
 * - Validasi tipe dan rentang memakai tipe_data, nilai_min, nilai_maks DARI DATABASE, bukan dari client.
 * - Baca nilai lama, validasi, tulis nilai, dan LogKonfigurasi dalam SATU transaksi Serializable,
 *   sehingga nilai_lama di log selalu nilai yang benar-benar digantikan (aman untuk dua Admin bersamaan).
 * - Tidak ada tambah/hapus parameter; kunci_parameter tidak pernah diubah (dipakai modul lain).
 * - BR-10: modul lain membaca nilai terbaru saat membuat transaksi; tidak ada hitung ulang di sini.
 */
import prisma from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { transaksiSerializable } from './akun.service.js';

const PESAN_BENTROK = 'Parameter sedang diubah oleh Admin lain. Silakan coba lagi.';

// Metadata tampilan (bukan di database). Kunci lain: label = kunci_parameter, deskripsi = ''.
export const META = {
  maks_pinjam_eksemplar: {
    label: 'Batas maksimum peminjaman',
    deskripsi: 'Jumlah eksemplar yang boleh dipinjam bersamaan oleh satu Anggota (UC-03, UC-09).',
  },
  durasi_pinjam_hari: {
    label: 'Durasi peminjaman',
    deskripsi: 'Jumlah hari sampai jatuh tempo (UC-03, UC-04, UC-09).',
  },
  tarif_denda_per_hari: {
    label: 'Tarif denda per hari',
    deskripsi: 'Nominal denda per hari keterlambatan (UC-05, UC-06, UC-10).',
  },
  chatbot_aktif: {
    label: 'Chatbot aktif',
    deskripsi: 'Menyalakan atau mematikan chatbot untuk Anggota (UC-07).',
  },
  chatbot_panjang_maks: {
    label: 'Panjang maksimum pesan chatbot',
    deskripsi: 'Batas karakter pertanyaan ke chatbot (UC-07).',
  },
};

const PESAN_TIDAK_DIKENAL = 'Parameter tidak dikenal.';
const TIPE_BULAT = ['number', 'integer'];
const POLA_BULAT = /^-?\d+$/;
const POLA_DESIMAL = /^-?\d+(\.\d{1,2})?$/;

export function labelParameter(kunci) {
  return META[kunci]?.label ?? kunci;
}

export function keParameterPublik(p) {
  return {
    kunci_parameter: p.kunci_parameter,
    label: labelParameter(p.kunci_parameter),
    deskripsi: META[p.kunci_parameter]?.deskripsi ?? '',
    nilai: p.nilai ?? null,
    tipe_data: p.tipe_data ?? null,
    satuan: p.satuan ?? null,
    nilai_min: p.nilai_min ?? null,
    nilai_maks: p.nilai_maks ?? null,
    wajib: p.wajib === true,
  };
}

function jenisTipe(tipeData) {
  const tipe = String(tipeData ?? '').toLowerCase();
  if (TIPE_BULAT.includes(tipe)) return 'bulat';
  if (tipe === 'decimal') return 'desimal';
  if (tipe === 'boolean') return 'boolean';
  return 'teks';
}

function angkaBatas(nilai) {
  if (nilai === null || nilai === undefined || String(nilai).trim() === '') return null;
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : null;
}

function teksRentang(min, maks, satuan) {
  const akhiran = satuan ? ` ${satuan}` : '';
  if (min !== null && maks !== null) return ` antara ${min} dan ${maks}${akhiran}`;
  if (min !== null) return ` minimal ${min}${akhiran}`;
  if (maks !== null) return ` maksimal ${maks}${akhiran}`;
  return '';
}

/** Mengubah input client (string/number/boolean) menjadi teks; selain itu ditolak. */
export function normalisasiMasukan(nilai) {
  if (typeof nilai === 'boolean') return String(nilai);
  if (typeof nilai === 'number') return Number.isFinite(nilai) ? String(nilai) : null;
  if (typeof nilai === 'string') return nilai.trim();
  return null;
}

/**
 * Validasi nilai baru berdasarkan definisi parameter di database.
 * Mengembalikan nilai yang sudah dinormalisasi (string) atau melempar AppError 400.
 */
export function validasiNilai(parameter, nilaiMentah) {
  const label = labelParameter(parameter.kunci_parameter);
  const teks = normalisasiMasukan(nilaiMentah);
  if (teks === null) {
    throw new AppError(400, `Nilai ${label} tidak valid.`);
  }
  if (teks === '') {
    throw new AppError(400, `Nilai ${label} wajib diisi.`);
  }

  const jenis = jenisTipe(parameter.tipe_data);

  if (jenis === 'boolean') {
    const kecil = teks.toLowerCase();
    if (kecil !== 'true' && kecil !== 'false') {
      throw new AppError(400, `Nilai ${label} harus "true" atau "false".`);
    }
    return kecil;
  }

  if (jenis === 'teks') {
    if (teks.length > 255) {
      throw new AppError(400, `Nilai ${label} maksimal 255 karakter.`);
    }
    return teks;
  }

  const min = angkaBatas(parameter.nilai_min);
  const maks = angkaBatas(parameter.nilai_maks);
  const rentang = teksRentang(min, maks, parameter.satuan);
  const namaJenis = jenis === 'bulat' ? 'bilangan bulat' : 'angka (maksimal 2 angka desimal)';
  const pesan = `Nilai ${label} harus ${namaJenis}${rentang}.`;

  const pola = jenis === 'bulat' ? POLA_BULAT : POLA_DESIMAL;
  if (!pola.test(teks)) {
    throw new AppError(400, pesan);
  }

  const angka = Number(teks);
  // Angka yang terlalu panjang menjadi Infinity atau kehilangan presisi ("99999999999999999999" -> 1e20)
  if (!Number.isFinite(angka) || (jenis === 'bulat' && !Number.isSafeInteger(angka))) {
    throw new AppError(400, `Nilai ${label} terlalu besar.${rentang ? ` Gunakan nilai${rentang}.` : ''}`);
  }
  if ((min !== null && angka < min) || (maks !== null && angka > maks)) {
    throw new AppError(400, pesan);
  }

  // Bilangan bulat disimpan tanpa nol di depan ("007" -> "7"); desimal disimpan apa adanya.
  return jenis === 'bulat' ? String(angka) : teks;
}

/** Nilai dianggap sama jika teksnya sama, atau angkanya sama untuk tipe angka ("1000" = "1000.00"). */
export function nilaiSama(parameter, nilaiLama, nilaiBaru) {
  if (nilaiLama === nilaiBaru) return true;
  const jenis = jenisTipe(parameter.tipe_data);
  if (jenis !== 'bulat' && jenis !== 'desimal') return false;
  if (nilaiLama === null || nilaiLama === undefined || String(nilaiLama).trim() === '') return false;
  return Number(nilaiLama) === Number(nilaiBaru);
}

async function cariParameter(kunci, db = prisma) {
  const parameter = await db.konfigurasiSistem.findUnique({ where: { kunci_parameter: kunci } });
  if (!parameter) {
    throw new AppError(404, PESAN_TIDAK_DIKENAL);
  }
  return parameter;
}

export async function daftarKonfigurasi() {
  const daftar = await prisma.konfigurasiSistem.findMany({ orderBy: { kunci_parameter: 'asc' } });
  return daftar.map(keParameterPublik);
}

export async function ubahKonfigurasi(kunci, nilaiMentah, idPengubah) {
  return transaksiSerializable(async (tx) => {
    // Dibaca di dalam transaksi: bentrok dengan Admin lain -> diulang dengan nilai terbaru
    const parameter = await cariParameter(kunci, tx);
    const nilaiBaru = validasiNilai(parameter, nilaiMentah);

    if (nilaiSama(parameter, parameter.nilai, nilaiBaru)) {
      return { parameter: keParameterPublik(parameter), berubah: false };
    }

    const diperbarui = await tx.konfigurasiSistem.update({
      where: { id_konfigurasi: parameter.id_konfigurasi },
      data: { nilai: nilaiBaru },
    });
    await tx.logKonfigurasi.create({
      data: {
        id_konfigurasi: parameter.id_konfigurasi,
        id_pengubah: idPengubah,
        nilai_lama: parameter.nilai,
        nilai_baru: nilaiBaru,
        waktu: new Date(),
      },
    });

    return { parameter: keParameterPublik(diperbarui), berubah: true };
  }, PESAN_BENTROK);
}

export async function riwayatKonfigurasi({ kunci, batas = 20 } = {}) {
  let where = {};
  if (kunci) {
    const parameter = await cariParameter(kunci);
    where = { id_konfigurasi: parameter.id_konfigurasi };
  }

  const log = await prisma.logKonfigurasi.findMany({
    where,
    orderBy: [{ waktu: 'desc' }, { id_log: 'desc' }],
    take: batas,
    include: {
      konfigurasi: { select: { kunci_parameter: true } },
      pengubah: { select: { id_pengguna: true, nama: true, pengenal: true } },
    },
  });

  return log.map((baris) => ({
    id_log: baris.id_log,
    kunci_parameter: baris.konfigurasi.kunci_parameter,
    label: labelParameter(baris.konfigurasi.kunci_parameter),
    nilai_lama: baris.nilai_lama ?? null,
    nilai_baru: baris.nilai_baru ?? null,
    waktu: baris.waktu ?? null,
    pengubah: baris.pengubah,
  }));
}
