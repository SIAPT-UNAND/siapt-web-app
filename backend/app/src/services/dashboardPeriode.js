/**
 * Periode dashboard (menu Sirkulasi, Denda & Pembayaran, Layanan & Chatbot).
 * Semua batas dihitung dalam hari kalender WIB (Asia/Jakarta).
 *
 * - Kolom @db.Date (mis. peminjaman.tanggal_pinjam) dibandingkan dengan `rentangTanggal`.
 * - Kolom DateTime (disimpan UTC, mis. denda.dibuat_pada) dibandingkan dengan `rentangWaktu`,
 *   yaitu batas tengah malam WIB yang dikonversi ke UTC (mundur 7 jam).
 */
import { AppError } from '../utils/AppError.js';
import { tanggalAcuan } from './dashboard.service.js';

const SATU_HARI_MS = 24 * 60 * 60 * 1000;
const SELISIH_WIB_MS = 7 * 60 * 60 * 1000;

export const PILIHAN_PERIODE = {
  '7h': { label: '7 hari terakhir', hari: 7, satuan: 'hari' },
  '30h': { label: '30 hari terakhir', hari: 30, satuan: 'hari' },
  '90h': { label: '90 hari terakhir', hari: 90, satuan: 'minggu' },
  bulan: { label: 'Bulan ini', hari: null, satuan: 'hari' },
};

export const PERIODE_BAWAAN = '30h';

function keYmd(tanggal) {
  return tanggal.toISOString().slice(0, 10);
}

export function tambahHari(tanggal, hari) {
  return new Date(tanggal.getTime() + hari * SATU_HARI_MS);
}

export function parsePeriode(nilai) {
  if (nilai === undefined || nilai === '') return PERIODE_BAWAAN;
  if (typeof nilai !== 'string' || !Object.hasOwn(PILIHAN_PERIODE, nilai)) {
    throw new AppError(400, 'Periode harus salah satu dari: 7 hari, 30 hari, 90 hari, atau bulan ini.');
  }
  return nilai;
}

/** Rentang periode berakhir di hari ini (WIB), inklusif. */
export function hitungPeriode(kode, sekarang = new Date()) {
  const pilihan = PILIHAN_PERIODE[kode];
  const hariIni = tanggalAcuan(sekarang);
  const akhir = tambahHari(hariIni, 1); // eksklusif
  const mulai =
    pilihan.hari === null
      ? new Date(Date.UTC(hariIni.getUTCFullYear(), hariIni.getUTCMonth(), 1))
      : tambahHari(akhir, -pilihan.hari);

  return {
    kode,
    label: pilihan.label,
    satuan: pilihan.satuan,
    mulai,
    akhir,
    rentangTanggal: { gte: mulai, lt: akhir },
    rentangWaktu: {
      gte: new Date(mulai.getTime() - SELISIH_WIB_MS),
      lt: new Date(akhir.getTime() - SELISIH_WIB_MS),
    },
  };
}

/**
 * Periode pembanding: rentang dengan panjang yang sama, tepat sebelum periode aktif.
 * Contoh: 30 hari terakhir (23 Okt–21 Nov) dibandingkan dengan 23 Sep–22 Okt.
 */
export function hitungPeriodeSebelumnya(periode) {
  const durasi = periode.akhir.getTime() - periode.mulai.getTime();
  const akhir = periode.mulai;
  const mulai = new Date(akhir.getTime() - durasi);
  const hari = Math.round(durasi / SATU_HARI_MS);
  return {
    kode: `${periode.kode}-sebelumnya`,
    label: `${hari} hari sebelumnya`,
    satuan: periode.satuan,
    mulai,
    akhir,
    rentangTanggal: { gte: mulai, lt: akhir },
    rentangWaktu: {
      gte: new Date(mulai.getTime() - SELISIH_WIB_MS),
      lt: new Date(akhir.getTime() - SELISIH_WIB_MS),
    },
  };
}

/** Bentuk periode untuk respons API (tanggal akhir inklusif). */
export function periodePublik(periode) {
  return {
    kode: periode.kode,
    label: periode.label,
    satuan: periode.satuan,
    mulai: keYmd(periode.mulai),
    akhir: keYmd(tambahHari(periode.akhir, -1)),
  };
}

/** Nilai DATE dari database (Date atau string) -> "YYYY-MM-DD". */
export function normalisasiYmd(nilai) {
  if (nilai instanceof Date) return keYmd(nilai);
  return String(nilai).slice(0, 10);
}

/**
 * Mengubah baris hasil GROUP BY tanggal menjadi deret lengkap per hari atau per minggu
 * (hari tanpa data tetap muncul dengan nilai 0, agar tren tidak menipu).
 * `baris`: [{ t: Date|string, n: number|bigint, total?: number|Decimal }]
 */
export function susunTren(periode, baris, denganTotal = false) {
  const perTanggal = new Map();
  for (const b of baris) {
    perTanggal.set(normalisasiYmd(b.t), { n: Number(b.n ?? 0), total: Number(b.total ?? 0) });
  }

  const langkah = periode.satuan === 'minggu' ? 7 : 1;
  const hasil = [];
  for (let awal = periode.mulai; awal < periode.akhir; awal = tambahHari(awal, langkah)) {
    let jumlah = 0;
    let total = 0;
    for (let i = 0; i < langkah; i++) {
      const hari = tambahHari(awal, i);
      if (hari >= periode.akhir) break;
      const isi = perTanggal.get(keYmd(hari));
      if (isi) {
        jumlah += isi.n;
        total += isi.total;
      }
    }
    const titik = { tanggal: keYmd(awal), jumlah };
    if (denganTotal) titik.total_nominal = total;
    hasil.push(titik);
  }
  return hasil;
}

/** "USULAN_KOLEKSI" -> "Usulan koleksi"; kosong -> pengganti. */
export function labelKode(nilai, pengganti = 'Tidak tercatat') {
  const teks = String(nilai ?? '').trim();
  if (!teks) return pengganti;
  const kecil = teks.replace(/[_-]+/g, ' ').toLowerCase();
  return kecil.charAt(0).toUpperCase() + kecil.slice(1);
}

/** Menggabungkan baris groupBy yang ejaannya berbeda (huruf besar/kecil, spasi/garis bawah). */
export function gabungPerLabel(baris, ambilKunci, pengganti) {
  const peta = new Map();
  for (const b of baris) {
    const label = labelKode(ambilKunci(b), pengganti);
    const lama = peta.get(label) ?? { label, jumlah: 0 };
    lama.jumlah += b._count?._all ?? 0;
    peta.set(label, lama);
  }
  return [...peta.values()].sort((a, b) => b.jumlah - a.jumlah || a.label.localeCompare(b.label));
}
