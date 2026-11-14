/**
 * Nilai status yang dipakai bersama.
 * Nilai yang sudah ada di prisma/seed.js dipakai apa adanya,
 * sisanya dilengkapi dengan gaya penulisan yang sama.
 */

export const STATUS_PEMINJAMAN = {
  DIPINJAM: 'DIPINJAM',
  SELESAI: 'SELESAI', // dari seed
};

export const STATUS_DETAIL_PEMINJAMAN = {
  DIPINJAM: 'DIPINJAM',
  KEMBALI: 'KEMBALI', // dari seed
};

export const STATUS_EKSEMPLAR = {
  TERSEDIA: 'TERSEDIA', // dari seed
  DIPINJAM: 'DIPINJAM',
};

export const STATUS_DENDA = {
  BELUM_DIBAYAR: 'BELUM_DIBAYAR',
  MENUNGGU_VERIFIKASI: 'MENUNGGU_VERIFIKASI',
  LUNAS: 'LUNAS', // dari seed
};

export const JALUR_PEMINJAMAN = {
  MANDIRI: 'MANDIRI', // dari seed
  PUSTAKAWAN: 'PUSTAKAWAN',
};

// Nama role mengikuti seed
export const ROLE = {
  ADMIN: 'Admin',
  PUSTAKAWAN: 'Pustakawan',
  ANGGOTA: 'Anggota',
  PENGELOLA: 'Pengelola',
};

// Kunci konfigurasi mengikuti seed
export const KONFIGURASI = {
  MAKS_PINJAM: 'maks_pinjam_eksemplar',
  DURASI_PINJAM: 'durasi_pinjam_hari',
  TARIF_DENDA: 'tarif_denda_per_hari',
};
