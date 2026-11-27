/**
 * Fungsi murni untuk halaman Konfigurasi Sistem: jenis input, format tampilan, dan
 * validasi bantu di browser. Server tetap sumber kebenaran (tipe dan rentang dari database).
 */

const TIPE_BULAT = ['number', 'integer'];

export function jenisTipe(tipeData) {
  const tipe = String(tipeData ?? '').toLowerCase();
  if (TIPE_BULAT.includes(tipe)) return 'bulat';
  if (tipe === 'decimal') return 'desimal';
  if (tipe === 'boolean') return 'boolean';
  return 'teks';
}

function angkaAtauNull(nilai) {
  if (nilai === null || nilai === undefined || String(nilai).trim() === '') return null;
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : null;
}

function formatAngka(angka, satuan) {
  if (satuan === 'rupiah') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: Number.isInteger(angka) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(angka);
  }
  const teks = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(angka);
  return satuan ? `${teks} ${satuan}` : teks;
}

/** Nilai untuk ditampilkan, misalnya "Rp1.000", "7 hari", "Aktif". */
export function formatNilai(parameter, nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return '-';
  const jenis = jenisTipe(parameter?.tipe_data);
  if (jenis === 'boolean') return nilai === 'true' ? 'Aktif' : 'Nonaktif';
  if (jenis === 'teks') return String(nilai);
  const angka = angkaAtauNull(nilai);
  return angka === null ? String(nilai) : formatAngka(angka, parameter?.satuan);
}

/** Rentang valid untuk ditampilkan, misalnya "1–30 hari" atau "Rp500–Rp10.000". */
export function formatRentang(parameter) {
  const jenis = jenisTipe(parameter?.tipe_data);
  if (jenis === 'boolean') return 'Aktif / Nonaktif';
  if (jenis === 'teks') return 'Teks, maks. 255 karakter';
  const min = angkaAtauNull(parameter.nilai_min);
  const maks = angkaAtauNull(parameter.nilai_maks);
  const satuan = parameter.satuan;
  if (min === null && maks === null) return 'Tanpa batas';
  if (satuan === 'rupiah') {
    if (min !== null && maks !== null) return `${formatAngka(min, satuan)}–${formatAngka(maks, satuan)}`;
    return min !== null ? `min. ${formatAngka(min, satuan)}` : `maks. ${formatAngka(maks, satuan)}`;
  }
  const akhiran = satuan ? ` ${satuan}` : '';
  if (min !== null && maks !== null) return `${min}–${maks}${akhiran}`;
  return min !== null ? `min. ${min}${akhiran}` : `maks. ${maks}${akhiran}`;
}

/**
 * Validasi bantu sebelum dikirim. Mengembalikan pesan kesalahan, atau '' jika lolos.
 * Pesan server tetap ditampilkan apa adanya jika server menolak.
 */
export function validasiKlien(parameter, masukan) {
  const teks = String(masukan ?? '').trim();
  if (teks === '') return 'Nilai wajib diisi.';

  const jenis = jenisTipe(parameter.tipe_data);
  if (jenis === 'boolean') return teks === 'true' || teks === 'false' ? '' : 'Pilih Aktif atau Nonaktif.';
  if (jenis === 'teks') return teks.length > 255 ? 'Maksimal 255 karakter.' : '';

  const pola = jenis === 'bulat' ? /^-?\d+$/ : /^-?\d+(\.\d{1,2})?$/;
  if (!pola.test(teks)) {
    return jenis === 'bulat' ? 'Masukkan bilangan bulat tanpa koma.' : 'Masukkan angka dengan maksimal 2 angka desimal.';
  }

  const angka = Number(teks);
  // Sama dengan server: angka terlalu panjang menjadi Infinity atau kehilangan presisi
  if (!Number.isFinite(angka) || (jenis === 'bulat' && !Number.isSafeInteger(angka))) {
    return 'Nilai terlalu besar.';
  }
  const min = angkaAtauNull(parameter.nilai_min);
  const maks = angkaAtauNull(parameter.nilai_maks);
  if ((min !== null && angka < min) || (maks !== null && angka > maks)) {
    return `Nilai harus dalam rentang ${formatRentang(parameter)}.`;
  }
  return '';
}

export function formatWaktu(nilai) {
  if (!nilai) return '-';
  const waktu = new Date(nilai);
  if (Number.isNaN(waktu.getTime())) return '-';
  return waktu.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
