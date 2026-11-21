import { PERAN_RESMI } from '../../services/akunService.js';

export const PESAN_GAGAL_UMUM = 'Terjadi kesalahan. Silakan coba lagi.';

// Ringkasan kewenangan tiap peran (A2 §3.1), hanya untuk teks bantuan di UI.
export const DESKRIPSI_PERAN = {
  Anggota: 'Mencari koleksi, meminjam mandiri, melihat pinjaman dan denda.',
  Pustakawan: 'Mengelola koleksi, sirkulasi, denda, dan permintaan layanan.',
  Pengelola: 'Membaca dashboard analitik (hanya lihat).',
  Admin: 'Mengelola akun, hak akses, dan konfigurasi sistem.',
};

export function pesanDari(err) {
  return err?.message || PESAN_GAGAL_UMUM;
}

export function hitungTotalHalaman(total, perHalaman) {
  return Math.max(1, Math.ceil((Number(total) || 0) / perHalaman));
}

export function formatTanggal(nilai) {
  if (!nilai) return '-';
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return '-';
  return tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function kelasPeran(role) {
  return `role-pill role-${String(role ?? '').toLowerCase()}`;
}

/**
 * Keadaan tampilan dari hasil muat terakhir: 'memuat' selama hasil belum sesuai
 * permintaan terbaru (kunci), lalu 'error' atau 'siap'.
 */
export function keadaanMuat(hasil, kunci) {
  if (hasil.kunci !== kunci) return 'memuat';
  return hasil.error ? 'error' : 'siap';
}

// Empat peran resmi selalu tampil (A2 §3.1); peran lain dari database ditaruh di akhir.
// `tersedia` = peran sudah ada di tabel role, sehingga bisa dipilih.
export function susunPilihanPeran(daftarDariServer) {
  const tersedia = daftarDariServer.map((p) => p.nama_role);
  const lain = tersedia.filter((p) => !PERAN_RESMI.includes(p));
  return [...PERAN_RESMI, ...lain].map((nama) => ({ nama, tersedia: tersedia.includes(nama) }));
}
