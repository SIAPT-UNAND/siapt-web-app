/**
 * UC-12 Mengakses Dashboard Analitik (Pengelola). Hanya membaca data (read-only).
 *
 * Lima indikator A2 (FR-12) dihitung persis seperti PRD 02 §5, ditambah rincian dari
 * data yang sama agar mudah dianalisis. Semua memakai query agregat (count/aggregate/groupBy),
 * dijalankan paralel, tanpa mengambil seluruh baris ke memori (NFR-01).
 *
 * Catatan SQL: `notIn`/`not` TIDAK mencocokkan baris NULL, jadi setiap filter "bukan X"
 * dipasangkan dengan `{ status: null }`.
 */
import prisma from '../lib/prisma.js';

// Nilai status belum seragam antar modul (PRD 05 §3.2): Loly, Fahri, seed.
export const STATUS_SUDAH_KEMBALI = ['KEMBALI', 'SELESAI', 'Dikembalikan', 'DIKEMBALIKAN'];
export const STATUS_LUNAS = ['LUNAS', 'Lunas'];

export const STATUS_PERMINTAAN = ['Baru', 'Diproses', 'Selesai', 'Ditolak'];

const SATU_HARI_MS = 24 * 60 * 60 * 1000;

/** Detail peminjaman yang eksemplarnya masih di tangan Anggota (BR-02: 1 detail = 1 eksemplar). */
export const FILTER_AKTIF = {
  tanggal_kembali: null,
  OR: [{ status: null }, { status: { notIn: STATUS_SUDAH_KEMBALI } }],
};

/** Denda dengan status apa pun selain Lunas (termasuk menunggu verifikasi dan NULL). */
export const FILTER_BELUM_LUNAS = {
  OR: [{ status: null }, { status: { notIn: STATUS_LUNAS } }],
};

/**
 * Tanggal hari ini di zona Asia/Jakarta sebagai Date UTC tengah malam,
 * cocok untuk membandingkan kolom @db.Date (pola sama dengan modul peminjaman).
 */
export function tanggalAcuan(sekarang = new Date()) {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(sekarang);
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function mundurHari(tanggal, hari) {
  return new Date(tanggal.getTime() - hari * SATU_HARI_MS);
}

/** Decimal Prisma / string / number -> number; kosong atau tidak valid -> 0. */
export function keAngka(nilai) {
  if (nilai === null || nilai === undefined) return 0;
  const angka = Number(typeof nilai === 'object' ? nilai.toString() : nilai);
  return Number.isFinite(angka) ? angka : 0;
}

/** null -> Baru (perilaku modul Clara); cocokkan tanpa beda huruf; selain itu -> Lainnya. */
export function kelompokPermintaan(status) {
  if (status === null || status === undefined || String(status).trim() === '') return 'Baru';
  const kecil = String(status).trim().toLowerCase();
  return STATUS_PERMINTAAN.find((s) => s.toLowerCase() === kecil) ?? 'Lainnya';
}

/** Rincian denda belum lunas: belum dibayar vs menunggu verifikasi (ejaan modul berbeda-beda). */
export function kelompokDenda(status) {
  const kode = String(status ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (kode.includes('MENUNGGU')) return 'menunggu_verifikasi';
  if (['', 'BELUM_DIBAYAR', 'BELUM_LUNAS', 'BELUM_BAYAR'].includes(kode)) return 'belum_dibayar';
  return 'lainnya';
}

export function ringkasPermintaan(barisGroupBy) {
  const hasil = { Baru: 0, Diproses: 0, Selesai: 0, Ditolak: 0, Lainnya: 0 };
  for (const baris of barisGroupBy) {
    hasil[kelompokPermintaan(baris.status)] += baris._count._all;
  }
  return hasil;
}

export function ringkasDenda(barisGroupBy) {
  const kosong = () => ({ jumlah: 0, total_nominal: 0 });
  const hasil = { belum_dibayar: kosong(), menunggu_verifikasi: kosong(), lainnya: kosong() };
  for (const baris of barisGroupBy) {
    const kelompok = hasil[kelompokDenda(baris.status)];
    kelompok.jumlah += baris._count._all;
    kelompok.total_nominal += keAngka(baris._sum?.nominal);
  }
  return hasil;
}

export function filterJatuhTempo(rentang) {
  return { ...FILTER_AKTIF, peminjaman: { tanggal_jatuh_tempo: rentang } };
}

export async function ambilRingkasan(sekarang = new Date()) {
  const acuan = tanggalAcuan(sekarang);
  const tujuhHariLalu = mundurHari(acuan, 7);
  const tigaPuluhHariLalu = mundurHari(acuan, 30);

  const [
    koleksiAktif,
    koleksiTotal,
    dipinjam,
    terlambat,
    terlambat1sd7,
    terlambat8sd30,
    terlambatLebih30,
    jumlahDenda,
    totalDenda,
    dendaPerStatus,
    permintaanPerStatus,
  ] = await Promise.all([
    prisma.koleksi.count({ where: { status_aktif: true } }),
    prisma.koleksi.count(),
    prisma.detailPeminjaman.count({ where: FILTER_AKTIF }),
    // Melewati jatuh tempo = jatuh tempo SEBELUM hari ini; jatuh tempo hari ini belum terlambat.
    prisma.detailPeminjaman.count({ where: filterJatuhTempo({ lt: acuan }) }),
    prisma.detailPeminjaman.count({ where: filterJatuhTempo({ gte: tujuhHariLalu, lt: acuan }) }),
    prisma.detailPeminjaman.count({ where: filterJatuhTempo({ gte: tigaPuluhHariLalu, lt: tujuhHariLalu }) }),
    prisma.detailPeminjaman.count({ where: filterJatuhTempo({ lt: tigaPuluhHariLalu }) }),
    prisma.denda.count({ where: FILTER_BELUM_LUNAS }),
    prisma.denda.aggregate({ where: FILTER_BELUM_LUNAS, _sum: { nominal: true } }),
    prisma.denda.groupBy({
      by: ['status'],
      where: FILTER_BELUM_LUNAS,
      _count: { _all: true },
      _sum: { nominal: true },
    }),
    prisma.permintaanLayanan.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    // Lima indikator A2 (bentuk persis PRD 02 §4.5)
    koleksi_aktif: koleksiAktif,
    peminjaman_dipinjam: dipinjam,
    peminjaman_terlambat: terlambat,
    denda_belum_lunas: {
      jumlah: jumlahDenda,
      total_nominal: keAngka(totalDenda._sum?.nominal),
      rincian: ringkasDenda(dendaPerStatus),
    },
    permintaan_layanan: ringkasPermintaan(permintaanPerStatus),
    // Rincian tambahan untuk analisis
    koleksi_total: koleksiTotal,
    keterlambatan: {
      hari_1_7: terlambat1sd7,
      hari_8_30: terlambat8sd30,
      lebih_30: terlambatLebih30,
    },
    tanggal_acuan: acuan.toISOString().slice(0, 10),
    dihitung_pada: sekarang.toISOString(),
  };
}
