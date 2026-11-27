/**
 * Menu dashboard rinci untuk Pengelola (usulan perluasan UC-12, lihat .prd/07):
 * Koleksi & Inventaris (K-1..K-3), Sirkulasi (S-1..S-5), Denda & Pembayaran (F-1..F-5),
 * Layanan & Chatbot (L-1..L-5).
 *
 * Aturan yang sama dengan Ringkasan: read-only, hanya angka agregat (tanpa data pribadi),
 * query paralel, tanpa mengambil seluruh baris. Query yang butuh JOIN/AVG memakai
 * $queryRaw dengan parameter terikat (tagged template), bukan string gabungan.
 */
import prisma from '../lib/prisma.js';
import {
  FILTER_BELUM_LUNAS,
  filterJatuhTempo,
  keAngka,
  mundurHari,
  ringkasDenda,
  ringkasPermintaan,
  tanggalAcuan,
} from './dashboard.service.js';
import {
  gabungPerLabel,
  hitungPeriode,
  hitungPeriodeSebelumnya,
  periodePublik,
  susunTren,
} from './dashboardPeriode.js';

const LABEL_STATUS_EKSEMPLAR = { TERSEDIA: 'Tersedia', DIPINJAM: 'Dipinjam' };

/** Status pembayaran denda dari modul Fahri (ejaan belum seragam). */
export function kelompokPembayaran(status) {
  const kode = String(status ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (kode.includes('MENUNGGU') || kode === '') return 'Menunggu verifikasi';
  if (['TERVERIFIKASI', 'DITERIMA', 'DISETUJUI', 'LUNAS', 'VALID'].includes(kode)) return 'Terverifikasi';
  if (kode.includes('TOLAK')) return 'Ditolak';
  return 'Lainnya';
}

function bulat1(nilai) {
  return Math.round(nilai * 10) / 10;
}

function persen(bagian, total) {
  return total ? bulat1((bagian / total) * 100) : 0;
}

// MySQL DAYOFWEEK: 1 = Minggu, 2 = Senin, ..., 7 = Sabtu. Ditampilkan mulai Senin.
const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const URUTAN_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function susunPerHariMinggu(baris) {
  const peta = new Map(URUTAN_HARI.map((h) => [h, 0]));
  for (const b of baris) {
    const hari = NAMA_HARI[Number(b.d) - 1];
    if (hari) peta.set(hari, peta.get(hari) + Number(b.n ?? 0));
  }
  return URUTAN_HARI.map((label) => ({ label, jumlah: peta.get(label) }));
}

/** 24 jam (WIB), jam tanpa data tetap 0. */
export function susunPerJam(baris) {
  const jumlah = Array(24).fill(0);
  for (const b of baris) {
    const jam = Number(b.j);
    if (Number.isInteger(jam) && jam >= 0 && jam < 24) jumlah[jam] += Number(b.n ?? 0);
  }
  return jumlah.map((n, jam) => ({ label: String(jam).padStart(2, '0'), jumlah: n }));
}

/** Baris GROUP BY dekade (Decimal/number/null) -> urut naik, "Tahun tidak tercatat" di akhir. */
export function susunPerDekade(baris) {
  const hasil = [];
  let tanpaTahun = 0;
  for (const b of baris) {
    if (b.dekade === null || b.dekade === undefined) tanpaTahun += Number(b.n ?? 0);
    else hasil.push({ dekade: keAngka(b.dekade), jumlah: Number(b.n ?? 0) });
  }
  hasil.sort((a, c) => a.dekade - c.dekade);
  const daftar = hasil.map((h) => ({ label: `${h.dekade}-an`, jumlah: h.jumlah }));
  if (tanpaTahun > 0) daftar.push({ label: 'Tahun tidak tercatat', jumlah: tanpaTahun });
  return daftar;
}

const KELOMPOK_TERLAMBAT = ['1–3 hari', '4–7 hari', '8–14 hari', '> 14 hari'];

export function kelompokHariTerlambat(hari) {
  const n = Number(hari);
  if (hari === null || hari === undefined || !Number.isFinite(n) || n < 1) return 'Tidak tercatat';
  if (n <= 3) return '1–3 hari';
  if (n <= 7) return '4–7 hari';
  if (n <= 14) return '8–14 hari';
  return '> 14 hari';
}

export function susunDendaPerKeterlambatan(baris) {
  const peta = new Map(
    [...KELOMPOK_TERLAMBAT, 'Tidak tercatat'].map((label) => [label, { label, jumlah: 0, total_nominal: 0 }]),
  );
  for (const b of baris) {
    const isi = peta.get(kelompokHariTerlambat(b.hari_terlambat));
    isi.jumlah += b._count?._all ?? 0;
    isi.total_nominal += keAngka(b._sum?.nominal);
  }
  return [...peta.values()].filter((p) => p.label !== 'Tidak tercatat' || p.jumlah > 0);
}

// ---------------------------------------------------------------------------
// Menu 2: Koleksi & Inventaris (kondisi saat ini, tidak memakai periode)
// ---------------------------------------------------------------------------
export async function ambilKoleksi(sekarang = new Date()) {
  const [perKategoriStatus, kategori, eksemplarPerStatus, totalEksemplar, tanpaTersedia] = await Promise.all([
    prisma.koleksi.groupBy({ by: ['id_kategori', 'status_aktif'], _count: { _all: true } }),
    prisma.kategori.findMany({ select: { id_kategori: true, nama_kategori: true } }),
    prisma.eksemplar.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.eksemplar.count(),
    prisma.$queryRaw`
      SELECT COUNT(*) AS n FROM koleksi k
      WHERE k.status_aktif = 1
        AND NOT EXISTS (
          SELECT 1 FROM eksemplar e
          WHERE e.id_koleksi = k.id_koleksi AND UPPER(e.status) = 'TERSEDIA'
        )`,
  ]);

  const namaKategori = new Map(kategori.map((k) => [k.id_kategori, k.nama_kategori]));
  const perKategori = new Map();
  for (const baris of perKategoriStatus) {
    const isi = perKategori.get(baris.id_kategori) ?? {
      id_kategori: baris.id_kategori,
      nama_kategori: namaKategori.get(baris.id_kategori) ?? 'Tanpa kategori',
      aktif: 0,
      nonaktif: 0,
    };
    if (baris.status_aktif === true) isi.aktif += baris._count._all;
    else isi.nonaktif += baris._count._all;
    perKategori.set(baris.id_kategori, isi);
  }
  const daftarKategori = [...perKategori.values()].sort(
    (a, b) => b.aktif - a.aktif || a.nama_kategori.localeCompare(b.nama_kategori),
  );

  const [perDekade, perBahasa] = await Promise.all([
    prisma.$queryRaw`
      SELECT FLOOR(tahun_terbit / 10) * 10 AS dekade, COUNT(*) AS n
      FROM koleksi WHERE status_aktif = 1
      GROUP BY dekade`,
    prisma.koleksi.groupBy({ by: ['bahasa'], where: { status_aktif: true }, _count: { _all: true } }),
  ]);

  const statusEksemplar = gabungPerLabel(
    eksemplarPerStatus,
    (b) => LABEL_STATUS_EKSEMPLAR[String(b.status ?? '').trim().toUpperCase()] ?? b.status,
    'Tanpa status',
  );

  return {
    koleksi_aktif: daftarKategori.reduce((n, k) => n + k.aktif, 0),
    koleksi_nonaktif: daftarKategori.reduce((n, k) => n + k.nonaktif, 0),
    per_kategori: daftarKategori,
    total_eksemplar: totalEksemplar,
    eksemplar_per_status: statusEksemplar,
    judul_tanpa_eksemplar_tersedia: Number(tanpaTersedia[0]?.n ?? 0),
    per_dekade: susunPerDekade(perDekade),
    per_bahasa: gabungPerLabel(perBahasa, (b) => b.bahasa, 'Tidak tercatat'),
    dihitung_pada: sekarang.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Menu 3: Sirkulasi
// ---------------------------------------------------------------------------
export async function ambilSirkulasi(kodePeriode, sekarang = new Date()) {
  const periode = hitungPeriode(kodePeriode, sekarang);
  const { gte: mulai, lt: akhir } = periode.rentangTanggal;
  const acuan = tanggalAcuan(sekarang);

  const [trenMentah, perJalur, lamaPinjam, topKoleksi, terlambat1sd7, terlambat8sd30, terlambatLebih30] =
    await Promise.all([
      prisma.$queryRaw`
        SELECT tanggal_pinjam AS t, COUNT(*) AS n FROM peminjaman
        WHERE tanggal_pinjam >= ${mulai} AND tanggal_pinjam < ${akhir}
        GROUP BY tanggal_pinjam`,
      prisma.peminjaman.groupBy({
        by: ['jalur'],
        where: { tanggal_pinjam: periode.rentangTanggal },
        _count: { _all: true },
      }),
      prisma.$queryRaw`
        SELECT AVG(DATEDIFF(d.tanggal_kembali, p.tanggal_pinjam)) AS rata, COUNT(*) AS n
        FROM detail_peminjaman d JOIN peminjaman p ON p.id_peminjaman = d.id_peminjaman
        WHERE d.tanggal_kembali >= ${mulai} AND d.tanggal_kembali < ${akhir}
          AND p.tanggal_pinjam IS NOT NULL`,
      prisma.$queryRaw`
        SELECT k.id_koleksi, k.judul, COUNT(*) AS n
        FROM detail_peminjaman d
        JOIN peminjaman p ON p.id_peminjaman = d.id_peminjaman
        JOIN eksemplar e ON e.id_eksemplar = d.id_eksemplar
        JOIN koleksi k ON k.id_koleksi = e.id_koleksi
        WHERE p.tanggal_pinjam >= ${mulai} AND p.tanggal_pinjam < ${akhir}
        GROUP BY k.id_koleksi, k.judul
        ORDER BY n DESC, k.judul ASC
        LIMIT 5`,
      prisma.detailPeminjaman.count({ where: filterJatuhTempo({ gte: mundurHari(acuan, 7), lt: acuan }) }),
      prisma.detailPeminjaman.count({
        where: filterJatuhTempo({ gte: mundurHari(acuan, 30), lt: mundurHari(acuan, 7) }),
      }),
      prisma.detailPeminjaman.count({ where: filterJatuhTempo({ lt: mundurHari(acuan, 30) }) }),
    ]);

  const sebelumnya = hitungPeriodeSebelumnya(periode);
  const [totalSebelumnya, perHari] = await Promise.all([
    prisma.peminjaman.count({ where: { tanggal_pinjam: sebelumnya.rentangTanggal } }),
    prisma.$queryRaw`
      SELECT DAYOFWEEK(tanggal_pinjam) AS d, COUNT(*) AS n FROM peminjaman
      WHERE tanggal_pinjam >= ${mulai} AND tanggal_pinjam < ${akhir}
      GROUP BY d`,
  ]);

  const jalur = gabungPerLabel(perJalur, (b) => b.jalur, 'Tidak tercatat');
  const rata = lamaPinjam[0]?.rata;

  return {
    periode: periodePublik(periode),
    total_peminjaman: jalur.reduce((n, j) => n + j.jumlah, 0),
    tren_peminjaman: susunTren(periode, trenMentah),
    per_jalur: jalur,
    rata_lama_pinjam_hari: rata === null || rata === undefined ? null : bulat1(keAngka(rata)),
    jumlah_dikembalikan: Number(lamaPinjam[0]?.n ?? 0),
    keterlambatan: { hari_1_7: terlambat1sd7, hari_8_30: terlambat8sd30, lebih_30: terlambatLebih30 },
    top_koleksi: topKoleksi.map((b) => ({ id_koleksi: b.id_koleksi, judul: b.judul, jumlah: Number(b.n) })),
    per_hari_minggu: susunPerHariMinggu(perHari),
    pembanding: { ...periodePublik(sebelumnya), total_peminjaman: totalSebelumnya },
    dihitung_pada: sekarang.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Menu 4: Denda & Pembayaran
// ---------------------------------------------------------------------------
export async function ambilDenda(kodePeriode, sekarang = new Date()) {
  const periode = hitungPeriode(kodePeriode, sekarang);
  const { gte: mulaiUtc, lt: akhirUtc } = periode.rentangWaktu;

  const [dendaPerStatus, trenMentah, pembayaranPerStatus, verifikasi, koreksi] = await Promise.all([
    prisma.denda.groupBy({
      by: ['status'],
      where: FILTER_BELUM_LUNAS,
      _count: { _all: true },
      _sum: { nominal: true },
    }),
    prisma.$queryRaw`
      SELECT DATE(DATE_ADD(dibuat_pada, INTERVAL 7 HOUR)) AS t, COUNT(*) AS n, COALESCE(SUM(nominal), 0) AS total
      FROM denda
      WHERE dibuat_pada >= ${mulaiUtc} AND dibuat_pada < ${akhirUtc}
      GROUP BY t`,
    prisma.pembayaranDenda.groupBy({
      by: ['status'],
      where: { waktu_unggah: periode.rentangWaktu },
      _count: { _all: true },
      _sum: { nominal_bayar: true },
    }),
    prisma.$queryRaw`
      SELECT AVG(TIMESTAMPDIFF(MINUTE, waktu_unggah, waktu_verifikasi)) AS menit, COUNT(*) AS n
      FROM pembayaran_denda
      WHERE waktu_verifikasi >= ${mulaiUtc} AND waktu_verifikasi < ${akhirUtc}
        AND waktu_unggah IS NOT NULL`,
    prisma.koreksiDenda.aggregate({
      where: { waktu: periode.rentangWaktu },
      _count: { _all: true },
      _sum: { nominal_lama: true, nominal_baru: true },
    }),
  ]);

  const urutanPembayaran = ['Menunggu verifikasi', 'Terverifikasi', 'Ditolak', 'Lainnya'];
  const pembayaran = new Map(urutanPembayaran.map((label) => [label, { label, jumlah: 0, total_nominal: 0 }]));
  for (const baris of pembayaranPerStatus) {
    const isi = pembayaran.get(kelompokPembayaran(baris.status));
    isi.jumlah += baris._count._all;
    isi.total_nominal += keAngka(baris._sum?.nominal_bayar);
  }

  const sebelumnya = hitungPeriodeSebelumnya(periode);
  const [dendaSebelumnya, pembayaranSebelumnya, perHariTerlambat] = await Promise.all([
    prisma.denda.aggregate({
      where: { dibuat_pada: sebelumnya.rentangWaktu },
      _count: { _all: true },
      _sum: { nominal: true },
    }),
    prisma.pembayaranDenda.count({ where: { waktu_unggah: sebelumnya.rentangWaktu } }),
    prisma.denda.groupBy({
      by: ['hari_terlambat'],
      where: { dibuat_pada: periode.rentangWaktu },
      _count: { _all: true },
      _sum: { nominal: true },
    }),
  ]);

  const tren = susunTren(periode, trenMentah, true);
  const menit = verifikasi[0]?.menit;
  const totalLama = keAngka(koreksi._sum?.nominal_lama);
  const totalBaru = keAngka(koreksi._sum?.nominal_baru);

  return {
    periode: periodePublik(periode),
    belum_lunas: ringkasDenda(dendaPerStatus),
    tren_denda: tren,
    denda_terbentuk: {
      jumlah: tren.reduce((n, t) => n + t.jumlah, 0),
      total_nominal: tren.reduce((n, t) => n + t.total_nominal, 0),
    },
    pembayaran_per_status: [...pembayaran.values()].filter((p) => p.label !== 'Lainnya' || p.jumlah > 0),
    rata_waktu_verifikasi_jam: menit === null || menit === undefined ? null : bulat1(keAngka(menit) / 60),
    jumlah_diverifikasi: Number(verifikasi[0]?.n ?? 0),
    koreksi: {
      jumlah: koreksi._count?._all ?? 0,
      total_selisih: totalLama - totalBaru,
    },
    denda_per_keterlambatan: susunDendaPerKeterlambatan(perHariTerlambat),
    pembanding: {
      ...periodePublik(sebelumnya),
      denda_terbentuk: {
        jumlah: dendaSebelumnya?._count?._all ?? 0,
        total_nominal: keAngka(dendaSebelumnya?._sum?.nominal),
      },
      total_pembayaran: pembayaranSebelumnya,
    },
    dihitung_pada: sekarang.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Menu 5: Layanan & Chatbot
// ---------------------------------------------------------------------------
export async function ambilLayanan(kodePeriode, sekarang = new Date()) {
  const periode = hitungPeriode(kodePeriode, sekarang);
  const { gte: mulaiUtc, lt: akhirUtc } = periode.rentangWaktu;
  const filterWaktu = { dibuat_pada: periode.rentangWaktu };

  const [perStatus, perJenis, trenMentah, ringkasChatbot, topFaq, usulan] = await Promise.all([
    prisma.permintaanLayanan.groupBy({ by: ['status'], where: filterWaktu, _count: { _all: true } }),
    prisma.permintaanLayanan.groupBy({ by: ['jenis_permintaan'], where: filterWaktu, _count: { _all: true } }),
    prisma.$queryRaw`
      SELECT DATE(DATE_ADD(dibuat_pada, INTERVAL 7 HOUR)) AS t, COUNT(*) AS n
      FROM permintaan_layanan
      WHERE dibuat_pada >= ${mulaiUtc} AND dibuat_pada < ${akhirUtc}
      GROUP BY t`,
    // Satu query agar total dan jumlah gagal dijawab berasal dari himpunan baris yang sama.
    prisma.$queryRaw`
      SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_fallback = TRUE THEN 1 ELSE 0 END), 0) AS gagal
      FROM pesan_chatbot
      WHERE waktu >= ${mulaiUtc} AND waktu < ${akhirUtc}`,
    prisma.$queryRaw`
      SELECT f.id_faq, f.pertanyaan, COUNT(*) AS n
      FROM pesan_chatbot pc JOIN faq f ON f.id_faq = pc.id_faq
      WHERE pc.waktu >= ${mulaiUtc} AND pc.waktu < ${akhirUtc}
      GROUP BY f.id_faq, f.pertanyaan
      ORDER BY n DESC, f.id_faq ASC
      LIMIT 5`,
    prisma.usulanKoleksi.groupBy({ by: ['status_pengadaan'], _count: { _all: true } }),
  ]);

  const sebelumnya = hitungPeriodeSebelumnya(periode);
  const [permintaanSebelumnya, pesanSebelumnya, perJam] = await Promise.all([
    prisma.permintaanLayanan.count({ where: { dibuat_pada: sebelumnya.rentangWaktu } }),
    prisma.pesanChatbot.count({ where: { waktu: sebelumnya.rentangWaktu } }),
    prisma.$queryRaw`
      SELECT HOUR(DATE_ADD(waktu, INTERVAL 7 HOUR)) AS j, COUNT(*) AS n
      FROM pesan_chatbot
      WHERE waktu >= ${mulaiUtc} AND waktu < ${akhirUtc}
      GROUP BY j`,
  ]);

  const tren = susunTren(periode, trenMentah);
  const totalPesan = Number(ringkasChatbot?.[0]?.total ?? 0);
  const totalFallback = Number(ringkasChatbot?.[0]?.gagal ?? 0);

  return {
    periode: periodePublik(periode),
    total_permintaan: tren.reduce((n, t) => n + t.jumlah, 0),
    permintaan_per_status: ringkasPermintaan(perStatus),
    permintaan_per_jenis: gabungPerLabel(perJenis, (b) => b.jenis_permintaan, 'Tidak tercatat'),
    tren_permintaan: tren,
    chatbot: {
      total_pertanyaan: totalPesan,
      gagal_dijawab: totalFallback,
      persen_gagal: persen(totalFallback, totalPesan),
    },
    top_faq: topFaq.map((b) => ({ id_faq: b.id_faq, pertanyaan: b.pertanyaan ?? '-', jumlah: Number(b.n) })),
    usulan_per_status: gabungPerLabel(usulan, (b) => b.status_pengadaan, 'Tidak tercatat'),
    pertanyaan_per_jam: susunPerJam(perJam),
    pembanding: {
      ...periodePublik(sebelumnya),
      total_permintaan: permintaanSebelumnya,
      total_pertanyaan_chatbot: pesanSebelumnya,
    },
    dihitung_pada: sekarang.toISOString(),
  };
}

