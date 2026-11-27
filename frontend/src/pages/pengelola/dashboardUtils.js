/** Fungsi murni untuk Dashboard Analitik: format angka/waktu dan daftar "Perlu perhatian". */

export function formatAngka(nilai) {
  return new Intl.NumberFormat('id-ID').format(Number(nilai) || 0);
}

export function formatRupiah(nilai) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(nilai) || 0);
}

/** Persentase bulat 0–100; total 0 menghasilkan 0 (bukan NaN). */
export function persen(bagian, total) {
  if (!total) return 0;
  return Math.round((bagian / total) * 100);
}

/** "2026-11-21" -> "21 November 2026" (tanggal kalender, tanpa geser zona waktu). */
export function formatTanggalAcuan(ymd) {
  if (!ymd) return '-';
  const tanggal = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(tanggal.getTime())) return '-';
  return tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Waktu hitung dalam WIB, misalnya "15.49 WIB". */
export function formatJamWib(iso) {
  if (!iso) return '-';
  const waktu = new Date(iso);
  if (Number.isNaN(waktu.getTime())) return '-';
  const jam = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  return `${jam} WIB`;
}

export function permintaanTerbuka(data) {
  return (data.permintaan_layanan?.Baru ?? 0) + (data.permintaan_layanan?.Diproses ?? 0);
}

export function totalPermintaan(data) {
  return Object.values(data.permintaan_layanan ?? {}).reduce((a, b) => a + b, 0);
}

/** True jika semua indikator bernilai 0 (belum ada data operasional). */
export function semuaNol(data) {
  return (
    !data.koleksi_aktif &&
    !data.peminjaman_dipinjam &&
    !data.peminjaman_terlambat &&
    !data.denda_belum_lunas?.jumlah &&
    totalPermintaan(data) === 0
  );
}

/**
 * Hal yang paling perlu ditindaklanjuti, urut dari yang paling mendesak.
 * Hanya memakai angka dari ringkasan (tanpa data pribadi).
 */
export function daftarPerhatian(data) {
  const hasil = [];
  const lebih30 = data.keterlambatan?.lebih_30 ?? 0;
  const terlambatLain = (data.peminjaman_terlambat ?? 0) - lebih30;
  const menunggu = data.denda_belum_lunas?.rincian?.menunggu_verifikasi?.jumlah ?? 0;
  const baru = data.permintaan_layanan?.Baru ?? 0;

  if (lebih30 > 0) hasil.push(`${formatAngka(lebih30)} peminjaman terlambat lebih dari 30 hari`);
  if (terlambatLain > 0) hasil.push(`${formatAngka(terlambatLain)} peminjaman terlambat 1–30 hari`);
  if (menunggu > 0) hasil.push(`${formatAngka(menunggu)} pembayaran denda menunggu verifikasi`);
  if (baru > 0) hasil.push(`${formatAngka(baru)} permintaan layanan baru belum diproses`);
  return hasil;
}

export const PILIHAN_PERIODE = [
  { kode: '7h', label: '7 hari' },
  { kode: '30h', label: '30 hari' },
  { kode: 'bulan', label: 'Bulan ini' },
  { kode: '90h', label: '90 hari' },
];

/** Batas atas sumbu Y yang "bulat" (1, 2, 5 × 10^n), minimal 1. */
export function batasAtas(nilai) {
  if (nilai <= 1) return 1;
  const pangkat = 10 ** Math.floor(Math.log10(nilai));
  const langkah = [1, 2, 5, 10].find((k) => k * pangkat >= nilai);
  return langkah * pangkat;
}

export function labelTanggal(ymd, satuan = 'hari') {
  const t = new Date(`${ymd}T00:00:00.000Z`);
  const teks = t.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return satuan === 'minggu' ? `mgg ${teks}` : teks;
}

/** Tooltip menempel ke kiri/kanan di dekat tepi grafik agar tidak terpotong. */
export function geserTooltip(posisiRelatif) {
  if (posisiRelatif < 0.15) return '0%';
  if (posisiRelatif > 0.85) return '-100%';
  return '-50%';
}

/**
 * Perubahan terhadap periode pembanding. Arah dinyatakan dengan kata (naik/turun/sama),
 * bukan warna, karena "naik" bisa baik (peminjaman) atau buruk (denda).
 */
export function hitungPerubahan(sekarang, sebelumnya, labelPembanding) {
  const s = Number(sekarang) || 0;
  const p = Number(sebelumnya) || 0;
  if (s === p) return { arah: 'sama', teks: `sama dengan ${labelPembanding} (${formatAngka(p)})` };
  if (p === 0) return { arah: 'naik', teks: `naik dari 0 pada ${labelPembanding}` };
  const selisih = Math.round((Math.abs(s - p) / p) * 100);
  const arah = s > p ? 'naik' : 'turun';
  return { arah, teks: `${arah} ${selisih}% dari ${labelPembanding} (${formatAngka(p)})` };
}
