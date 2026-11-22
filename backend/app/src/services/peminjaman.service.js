import prisma from '../lib/prisma.js';
import {
  STATUS_PEMINJAMAN,
  STATUS_DETAIL_PEMINJAMAN,
  STATUS_EKSEMPLAR,
  STATUS_DENDA,
  JALUR_PEMINJAMAN,
  ROLE,
  KONFIGURASI,
} from '../constants/status.js';

/** Error dengan kode HTTP, dibaca oleh errorHandler. */
export class PeminjamanError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const ZONA_WAKTU = 'Asia/Jakarta';

/** Tanggal hari ini (WIB) sebagai Date tengah malam UTC, cocok untuk kolom @db.Date. */
export const tanggalHariIni = (sekarang = new Date()) => {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_WAKTU })
    .format(sekarang)
    .split('-')
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const tambahHari = (tanggal, hari) => new Date(tanggal.getTime() + hari * 86400000);

export const formatTanggal = (tanggal) => (tanggal ? tanggal.toISOString().slice(0, 10) : null);

/** BR-10: aturan diambil dari konfigurasi sistem, tidak ditulis tetap di program. */
export const ambilKetentuan = async (db = prisma) => {
  const daftar = await db.konfigurasiSistem.findMany({
    where: {
      kunci_parameter: {
        in: [KONFIGURASI.MAKS_PINJAM, KONFIGURASI.DURASI_PINJAM, KONFIGURASI.TARIF_DENDA],
      },
    },
  });
  // Tarif hanya untuk informasi; tidak wajib untuk proses peminjaman.
  const tarif = Number(daftar.find((k) => k.kunci_parameter === KONFIGURASI.TARIF_DENDA)?.nilai);
  const nilai = (kunci) => {
    const angka = Number(daftar.find((k) => k.kunci_parameter === kunci)?.nilai);
    if (!Number.isInteger(angka) || angka < 1) {
      throw new PeminjamanError(500, 'Konfigurasi peminjaman belum diatur. Hubungi admin.');
    }
    return angka;
  };
  return {
    maks_pinjam: nilai(KONFIGURASI.MAKS_PINJAM),
    durasi_hari: nilai(KONFIGURASI.DURASI_PINJAM),
    tarif_denda_per_hari: Number.isFinite(tarif) && tarif >= 0 ? tarif : null,
  };
};

/** Tarif denda dibaca sendiri agar pengembalian tidak terikat konfigurasi peminjaman. */
export const ambilTarifDenda = async (db = prisma) => {
  const daftar = await db.konfigurasiSistem.findMany({
    where: { kunci_parameter: { in: [KONFIGURASI.TARIF_DENDA] } },
  });
  const aturan = daftar.find((item) => item.kunci_parameter === KONFIGURASI.TARIF_DENDA);
  const nilai = typeof aturan?.nilai === 'string' ? aturan.nilai.trim() : aturan?.nilai;
  const tarif = nilai === null || nilai === undefined || nilai === '' ? NaN : Number(nilai);
  if (!Number.isFinite(tarif) || tarif < 0) {
    throw new PeminjamanError(500, 'Tarif denda belum diatur. Pengembalian terlambat tidak dapat diproses.');
  }
  return tarif;
};

/**
 * BR-01 & BR-12: syarat peminjaman, dipakai peminjaman mandiri (UC-03)
 * dan peminjaman melalui pustakawan (UC-09).
 * Urutan pemeriksaan mengikuti activity diagram A3.
 */
export const periksaSyaratPeminjaman = async (db, { idAnggota, idKoleksi, kodeKoleksi, kodeBuku }) => {
  const anggota = await db.pengguna.findUnique({
    where: { id_pengguna: idAnggota },
    include: { role: true },
  });
  if (!anggota || anggota.role?.nama_role !== ROLE.ANGGOTA) {
    throw new PeminjamanError(404, 'Anggota tidak ditemukan.');
  }
  if (anggota.status_aktif !== true) {
    throw new PeminjamanError(422, 'Akun anggota tidak aktif sehingga tidak dapat meminjam.');
  }

  const dendaBelumLunas = await db.denda.count({
    where: {
      status: { in: [STATUS_DENDA.BELUM_DIBAYAR, STATUS_DENDA.MENUNGGU_VERIFIKASI] },
      nominal: { gt: 0 },
      detail_peminjaman: { peminjaman: { id_anggota: idAnggota } },
    },
  });
  if (dendaBelumLunas > 0) {
    throw new PeminjamanError(422, 'Masih ada denda yang belum lunas. Selesaikan denda terlebih dahulu.');
  }

  // kodeBuku (UC-09) boleh berupa kode eksemplar (buku fisik tertentu) atau kode koleksi
  const eksemplarDipilih = kodeBuku
    ? await db.eksemplar.findUnique({ where: { kode_eksemplar: kodeBuku }, include: { koleksi: true } })
    : null;

  const koleksi =
    eksemplarDipilih?.koleksi ??
    (await db.koleksi.findUnique({
      where: idKoleksi ? { id_koleksi: idKoleksi } : { kode_koleksi: kodeKoleksi ?? kodeBuku },
    }));
  if (!koleksi) {
    throw new PeminjamanError(404, kodeBuku ? 'Kode eksemplar atau koleksi tidak ditemukan.' : 'Koleksi tidak ditemukan.');
  }
  if (koleksi.status_aktif !== true) {
    throw new PeminjamanError(422, 'Koleksi ini sedang tidak aktif sehingga tidak dapat dipinjam.');
  }

  let eksemplar;
  if (eksemplarDipilih) {
    if (eksemplarDipilih.status !== STATUS_EKSEMPLAR.TERSEDIA) {
      throw new PeminjamanError(422, `Eksemplar ${eksemplarDipilih.kode_eksemplar} tercatat sedang dipinjam.`);
    }
    eksemplar = eksemplarDipilih;
  } else {
    eksemplar = await db.eksemplar.findFirst({
      where: { id_koleksi: koleksi.id_koleksi, status: STATUS_EKSEMPLAR.TERSEDIA },
      orderBy: { id_eksemplar: 'asc' },
    });
    if (!eksemplar) {
      throw new PeminjamanError(422, 'Stok koleksi ini sedang habis.');
    }
  }

  const ketentuan = await ambilKetentuan(db);
  const pinjamanAktif = await db.detailPeminjaman.count({
    where: {
      status: STATUS_DETAIL_PEMINJAMAN.DIPINJAM,
      peminjaman: { id_anggota: idAnggota },
    },
  });
  if (pinjamanAktif >= ketentuan.maks_pinjam) {
    throw new PeminjamanError(
      422,
      `Batas peminjaman tercapai (maksimal ${ketentuan.maks_pinjam} eksemplar).`,
    );
  }

  return { anggota, koleksi, eksemplar, ketentuan, pinjamanAktif };
};

/**
 * Cek kelayakan sebelum buku masuk keranjang: aturan sama dengan saat menyimpan,
 * tetapi tidak menyimpan apa pun. Pengecekan ulang tetap dilakukan saat konfirmasi.
 */
export const cekKelayakanPinjam = async ({ idAnggota, kodeKoleksi }) => {
  const { koleksi, eksemplar, ketentuan, pinjamanAktif } = await periksaSyaratPeminjaman(prisma, {
    idAnggota,
    kodeKoleksi,
  });
  const eksemplarTersedia = await prisma.eksemplar.count({
    where: { id_koleksi: koleksi.id_koleksi, status: STATUS_EKSEMPLAR.TERSEDIA },
  });
  return {
    koleksi: {
      id_koleksi: koleksi.id_koleksi,
      kode_koleksi: koleksi.kode_koleksi,
      judul: koleksi.judul,
      sampul: koleksi.sampul ?? null,
    },
    lokasi_rak: eksemplar.lokasi_rak,
    eksemplar_tersedia: eksemplarTersedia,
    maks_pinjam: ketentuan.maks_pinjam,
    sisa_kuota: ketentuan.maks_pinjam - pinjamanAktif,
  };
};

const SATU_HARI = 86400000;
const selisihHari = (dari, sampai) => Math.round((sampai.getTime() - dari.getTime()) / SATU_HARI);
const keAngka = (desimal) => (desimal === null || desimal === undefined ? null : Number(desimal));

/** Satu baris riwayat untuk UC-04. */
export const formatRiwayat = (p, hariIni = tanggalHariIni()) => {
  const detail = p.detail_peminjaman?.[0];
  const denda = detail?.denda;
  const dikembalikan =
    p.status === STATUS_PEMINJAMAN.SELESAI || detail?.status === STATUS_DETAIL_PEMINJAMAN.KEMBALI;
  const tanggalKembali = detail?.tanggal_kembali ?? null;

  // Masih dipinjam: dihitung sampai hari ini. Sudah kembali: sampai tanggal kembali.
  const acuan = dikembalikan ? tanggalKembali : hariIni;
  const hariTerlambat =
    denda?.hari_terlambat ??
    (acuan && p.tanggal_jatuh_tempo ? Math.max(selisihHari(p.tanggal_jatuh_tempo, acuan), 0) : 0);

  return {
    id_peminjaman: p.id_peminjaman,
    nomor_transaksi: p.nomor_transaksi,
    jalur: p.jalur,
    status: dikembalikan ? STATUS_PEMINJAMAN.SELESAI : STATUS_PEMINJAMAN.DIPINJAM,
    tanggal_pinjam: formatTanggal(p.tanggal_pinjam),
    tanggal_jatuh_tempo: formatTanggal(p.tanggal_jatuh_tempo),
    tanggal_kembali: formatTanggal(tanggalKembali),
    terlambat: hariTerlambat > 0,
    hari_terlambat: hariTerlambat,
    koleksi: detail && {
      kode_koleksi: detail.eksemplar.koleksi.kode_koleksi,
      judul: detail.eksemplar.koleksi.judul,
      sampul: detail.eksemplar.koleksi.sampul ?? null,
    },
    eksemplar: detail && {
      kode_eksemplar: detail.eksemplar.kode_eksemplar,
      lokasi_rak: detail.eksemplar.lokasi_rak,
    },
    denda: denda ? { nominal: keAngka(denda.nominal), status: denda.status } : null,
  };
};

export const FILTER_STATUS_RIWAYAT = {
  semua: undefined,
  dipinjam: STATUS_PEMINJAMAN.DIPINJAM,
  dikembalikan: STATUS_PEMINJAMAN.SELESAI,
};

/**
 * UC-04: riwayat peminjaman milik anggota yang login saja,
 * dengan filter status dan kata kunci (judul atau nomor transaksi).
 */
export const ambilRiwayatAnggota = async ({ idAnggota, status = 'semua', kataKunci = '' }) => {
  const hariIni = tanggalHariIni();
  const milikAnggota = { id_anggota: idAnggota };

  const where = { ...milikAnggota };
  if (FILTER_STATUS_RIWAYAT[status]) where.status = FILTER_STATUS_RIWAYAT[status];
  if (kataKunci) {
    where.OR = [
      { nomor_transaksi: { contains: kataKunci } },
      { detail_peminjaman: { some: { eksemplar: { koleksi: { judul: { contains: kataKunci } } } } } },
    ];
  }

  const [daftar, sedangDipinjam, terlambat, dendaBelumLunas, dikembalikan, terdekat, ketentuan] = await Promise.all([
    prisma.peminjaman.findMany({
      where,
      include: {
        detail_peminjaman: { include: { eksemplar: { include: { koleksi: true } }, denda: true } },
      },
      orderBy: [{ tanggal_pinjam: 'desc' }, { id_peminjaman: 'desc' }],
    }),
    prisma.peminjaman.count({ where: { ...milikAnggota, status: STATUS_PEMINJAMAN.DIPINJAM } }),
    prisma.peminjaman.count({
      where: { ...milikAnggota, status: STATUS_PEMINJAMAN.DIPINJAM, tanggal_jatuh_tempo: { lt: hariIni } },
    }),
    prisma.denda.aggregate({
      where: {
        status: { in: [STATUS_DENDA.BELUM_DIBAYAR, STATUS_DENDA.MENUNGGU_VERIFIKASI] },
        detail_peminjaman: { peminjaman: milikAnggota },
      },
      _sum: { nominal: true },
      _count: true,
    }),
    prisma.peminjaman.count({ where: { ...milikAnggota, status: STATUS_PEMINJAMAN.SELESAI } }),
    // Pinjaman aktif dengan jatuh tempo paling dekat
    prisma.peminjaman.findFirst({
      where: { ...milikAnggota, status: STATUS_PEMINJAMAN.DIPINJAM },
      include: { detail_peminjaman: { include: { eksemplar: { include: { koleksi: true } } } } },
      orderBy: [{ tanggal_jatuh_tempo: 'asc' }, { id_peminjaman: 'asc' }],
    }),
    ambilKetentuan().catch(() => null),
  ]);

  return {
    ringkasan: {
      sedang_dipinjam: sedangDipinjam,
      dikembalikan,
      terlambat,
      maks_pinjam: ketentuan?.maks_pinjam ?? null,
      jumlah_denda_belum_lunas: dendaBelumLunas._count ?? 0,
      total_denda_belum_lunas: keAngka(dendaBelumLunas._sum?.nominal) ?? 0,
      jatuh_tempo_terdekat: terdekat
        ? {
            nomor_transaksi: terdekat.nomor_transaksi,
            judul: terdekat.detail_peminjaman?.[0]?.eksemplar.koleksi.judul ?? null,
            tanggal_jatuh_tempo: formatTanggal(terdekat.tanggal_jatuh_tempo),
            sisa_hari: selisihHari(hariIni, terdekat.tanggal_jatuh_tempo),
          }
        : null,
    },
    transaksi: daftar.map((p) => formatRiwayat(p, hariIni)),
  };
};

const PILIH_NAMA = { select: { pengenal: true, nama: true } };

const INCLUDE_HASIL = {
  detail_peminjaman: { include: { eksemplar: { include: { koleksi: true } }, denda: true } },
  anggota: PILIH_NAMA,
  pustakawan_peminjaman: PILIH_NAMA,
};

/** Bentuk data yang dikirim ke frontend. */
export const formatPeminjaman = (p) => {
  const detail = p.detail_peminjaman?.[0];
  const denda = detail?.denda;
  const terlambat = p.status === STATUS_PEMINJAMAN.DIPINJAM
    && p.tanggal_jatuh_tempo
    && p.tanggal_jatuh_tempo < tanggalHariIni();
  return {
    id_peminjaman: p.id_peminjaman,
    nomor_transaksi: p.nomor_transaksi,
    jalur: p.jalur,
    status: terlambat ? 'TERLAMBAT' : p.status,
    tanggal_pinjam: formatTanggal(p.tanggal_pinjam),
    tanggal_jatuh_tempo: formatTanggal(p.tanggal_jatuh_tempo),
    anggota: p.anggota ? { pengenal: p.anggota.pengenal, nama: p.anggota.nama } : undefined,
    pustakawan: p.pustakawan_peminjaman ? { nama: p.pustakawan_peminjaman.nama } : null,
    koleksi: detail && {
      id_koleksi: detail.eksemplar.koleksi.id_koleksi,
      kode_koleksi: detail.eksemplar.koleksi.kode_koleksi,
      judul: detail.eksemplar.koleksi.judul,
      sampul: detail.eksemplar.koleksi.sampul ?? null,
    },
    denda: denda ? { nominal: keAngka(denda.nominal), status: denda.status } : null,
    eksemplar: detail && {
      kode_eksemplar: detail.eksemplar.kode_eksemplar,
      lokasi_rak: detail.eksemplar.lokasi_rak,
    },
  };
};

const cariByKunci = (kunci, db = prisma) =>
  db.peminjaman.findUnique({ where: { kunci_idempotensi: kunci }, include: INCLUDE_HASIL });

const hasilUlang = (lama, idAnggota) => {
  if (lama.id_anggota !== idAnggota) {
    throw new PeminjamanError(409, 'Kunci transaksi sudah dipakai. Muat ulang halaman lalu coba lagi.');
  }
  return { peminjaman: lama, baru: false };
};

/**
 * Mencatat satu peminjaman (BR-02: satu transaksi = satu eksemplar).
 * Pengiriman ulang dengan kunci_idempotensi yang sama tidak membuat transaksi ganda.
 */
export const buatPeminjaman = async ({
  idAnggota,
  idKoleksi,
  kodeKoleksi,
  kodeBuku,
  jalur,
  idPustakawan = null,
  kunciIdempotensi = null,
}) => {
  if (kunciIdempotensi) {
    const lama = await cariByKunci(kunciIdempotensi);
    if (lama) return hasilUlang(lama, idAnggota);
  }

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      // Kunci baris anggota agar dua permintaan bersamaan tidak sama-sama lolos batas pinjam.
      await tx.$queryRaw`SELECT id_pengguna FROM pengguna WHERE id_pengguna = ${idAnggota} FOR UPDATE`;

      if (kunciIdempotensi) {
        const lama = await cariByKunci(kunciIdempotensi, tx);
        if (lama) return hasilUlang(lama, idAnggota);
      }

      const { eksemplar, ketentuan } = await periksaSyaratPeminjaman(tx, {
        idAnggota,
        idKoleksi,
        kodeKoleksi,
        kodeBuku,
      });

      // BR-03: eksemplar diambil hanya jika masih TERSEDIA.
      const diambil = await tx.eksemplar.updateMany({
        where: { id_eksemplar: eksemplar.id_eksemplar, status: STATUS_EKSEMPLAR.TERSEDIA },
        data: { status: STATUS_EKSEMPLAR.DIPINJAM },
      });
      if (diambil.count !== 1) {
        throw new PeminjamanError(409, 'Eksemplar baru saja dipinjam orang lain. Silakan coba lagi.');
      }

      const tanggalPinjam = tanggalHariIni();
      const dibuat = await tx.peminjaman.create({
        data: {
          nomor_transaksi: `TMP-${crypto.randomUUID()}`,
          id_anggota: idAnggota,
          id_pustakawan_peminjaman: idPustakawan,
          jalur,
          tanggal_pinjam: tanggalPinjam,
          tanggal_jatuh_tempo: tambahHari(tanggalPinjam, ketentuan.durasi_hari),
          status: STATUS_PEMINJAMAN.DIPINJAM,
          kunci_idempotensi: kunciIdempotensi,
          detail_peminjaman: {
            create: { id_eksemplar: eksemplar.id_eksemplar, status: STATUS_DETAIL_PEMINJAMAN.DIPINJAM },
          },
        },
      });

      // Format nomor mengikuti seed: TRX-YYYYMM-001
      const bulan = formatTanggal(tanggalPinjam).slice(0, 7).replace('-', '');
      const peminjaman = await tx.peminjaman.update({
        where: { id_peminjaman: dibuat.id_peminjaman },
        data: { nomor_transaksi: `TRX-${bulan}-${String(dibuat.id_peminjaman).padStart(3, '0')}` },
        include: INCLUDE_HASIL,
      });
      return { peminjaman, baru: true };
    });
    return hasil;
  } catch (err) {
    // Dua permintaan bersamaan dengan kunci sama: kembalikan transaksi yang sudah tersimpan.
    if (kunciIdempotensi && err.code === 'P2002') {
      const lama = await cariByKunci(kunciIdempotensi);
      if (lama) return hasilUlang(lama, idAnggota);
    }
    throw err;
  }
};

// ==========================================
// UC-09: Peminjaman melalui Pustakawan
// ==========================================

const cariAnggotaByPengenal = async (pengenal) => {
  const anggota = await prisma.pengguna.findUnique({ where: { pengenal }, include: { role: true } });
  if (!anggota || anggota.role?.nama_role !== ROLE.ANGGOTA) {
    throw new PeminjamanError(404, `Anggota dengan NIM/ID "${pengenal}" tidak ditemukan.`);
  }
  return anggota;
};

/**
 * Kartu anggota untuk pustakawan sebelum memproses peminjaman:
 * status akun, pinjaman aktif, denda, dan apakah boleh meminjam (BR-01, BR-12).
 */
export const ringkasanAnggota = async (pengenal) => {
  const anggota = await cariAnggotaByPengenal(pengenal);
  const [pinjamanAktif, denda, ketentuan] = await Promise.all([
    prisma.detailPeminjaman.count({
      where: { status: STATUS_DETAIL_PEMINJAMAN.DIPINJAM, peminjaman: { id_anggota: anggota.id_pengguna } },
    }),
    prisma.denda.aggregate({
      where: {
        status: { in: [STATUS_DENDA.BELUM_DIBAYAR, STATUS_DENDA.MENUNGGU_VERIFIKASI] },
        detail_peminjaman: { peminjaman: { id_anggota: anggota.id_pengguna } },
      },
      _sum: { nominal: true },
      _count: true,
    }),
    ambilKetentuan(),
  ]);

  const jumlahDenda = denda._count ?? 0;
  let alasan = null;
  if (anggota.status_aktif !== true) alasan = 'Akun anggota tidak aktif.';
  else if (jumlahDenda > 0) alasan = 'Masih ada denda yang belum lunas.';
  else if (pinjamanAktif >= ketentuan.maks_pinjam) {
    alasan = `Batas peminjaman tercapai (maksimal ${ketentuan.maks_pinjam} eksemplar).`;
  }

  return {
    pengenal: anggota.pengenal,
    nama: anggota.nama,
    status_aktif: anggota.status_aktif === true,
    alasan_nonaktif: anggota.alasan_nonaktif ?? null,
    pinjaman_aktif: pinjamanAktif,
    maks_pinjam: ketentuan.maks_pinjam,
    denda_belum_lunas: { jumlah: jumlahDenda, total: keAngka(denda._sum?.nominal) ?? 0 },
    boleh_meminjam: alasan === null,
    alasan,
  };
};

/** Pustakawan mencatat peminjaman atas nama anggota; aturan sama dengan UC-03. */
export const buatPeminjamanViaPustakawan = async ({ pengenalAnggota, kodeBuku, idPustakawan, kunciIdempotensi }) => {
  const anggota = await cariAnggotaByPengenal(pengenalAnggota);
  return buatPeminjaman({
    idAnggota: anggota.id_pengguna,
    kodeBuku,
    jalur: JALUR_PEMINJAMAN.PUSTAKAWAN,
    idPustakawan,
    kunciIdempotensi,
  });
};

/** Transaksi terbaru untuk tabel "Transaksi Sirkulasi Terbaru". */
export const ambilTransaksiTerbaru = async (jumlah = 5) => {
  const daftar = await prisma.peminjaman.findMany({
    include: INCLUDE_HASIL,
    orderBy: { id_peminjaman: 'desc' },
    take: jumlah,
  });
  return daftar.map(formatPeminjaman);
};

export const ambilPeminjamanAktif = async ({ kataKunci = '', halaman = 1, limit = 20 }) => {
  const where = { status: STATUS_PEMINJAMAN.DIPINJAM };
  if (kataKunci) {
    where.OR = [
      { nomor_transaksi: { contains: kataKunci } },
      { detail_peminjaman: { some: { eksemplar: { kode_eksemplar: { contains: kataKunci } } } } },
    ];
  }

  const [daftar, total] = await Promise.all([
    prisma.peminjaman.findMany({
      where,
      include: INCLUDE_HASIL,
      orderBy: [{ tanggal_jatuh_tempo: 'asc' }, { id_peminjaman: 'asc' }],
      skip: (halaman - 1) * limit,
      take: limit,
    }),
    prisma.peminjaman.count({ where }),
  ]);

  return {
    transaksi: daftar.map(formatPeminjaman),
    pagination: {
      halaman,
      limit,
      total,
      halaman_total: Math.ceil(total / limit),
    },
  };
};

export const kembalikanPeminjaman = async (idPeminjaman, idPustakawan) => {
  return prisma.$transaction(async (tx) => {
    const peminjaman = await tx.peminjaman.findUnique({
      where: { id_peminjaman: idPeminjaman },
      include: INCLUDE_HASIL,
    });
    if (!peminjaman) {
      throw new PeminjamanError(404, 'Transaksi peminjaman tidak ditemukan.');
    }
    if (peminjaman.status !== STATUS_PEMINJAMAN.DIPINJAM) {
      throw new PeminjamanError(409, 'Transaksi peminjaman sudah dikembalikan.');
    }

    const detail = peminjaman.detail_peminjaman?.[0];
    if (!detail) {
      throw new PeminjamanError(409, 'Detail eksemplar peminjaman tidak ditemukan.');
    }

    const tanggalKembali = tanggalHariIni();
    const hariTerlambat = peminjaman.tanggal_jatuh_tempo
      ? Math.max(selisihHari(peminjaman.tanggal_jatuh_tempo, tanggalKembali), 0)
      : 0;
    let tarifDendaPerHari = null;
    if (hariTerlambat > 0) {
      tarifDendaPerHari = await ambilTarifDenda(tx);
    }

    const detailDiperbarui = await tx.detailPeminjaman.updateMany({
      where: { id_peminjaman: idPeminjaman, status: STATUS_DETAIL_PEMINJAMAN.DIPINJAM },
      data: {
        status: STATUS_DETAIL_PEMINJAMAN.KEMBALI,
        tanggal_kembali: tanggalKembali,
        id_pustakawan_pengembalian: idPustakawan,
      },
    });
    if (detailDiperbarui.count !== 1) {
      throw new PeminjamanError(409, 'Detail peminjaman sudah berubah atau tidak aktif.');
    }
    const nominalDenda = hariTerlambat * tarifDendaPerHari;
    if (nominalDenda > 0) {
      await tx.denda.create({
        data: {
          id_detail: detail.id_detail,
          hari_terlambat: hariTerlambat,
          tarif_per_hari: tarifDendaPerHari,
          nominal: nominalDenda,
          total_terbayar: 0,
          status: STATUS_DENDA.BELUM_DIBAYAR,
          dibuat_pada: tanggalKembali,
        },
      });
    }
    const eksemplarDiperbarui = await tx.eksemplar.updateMany({
      where: { id_eksemplar: detail.id_eksemplar, status: STATUS_EKSEMPLAR.DIPINJAM },
      data: { status: STATUS_EKSEMPLAR.TERSEDIA },
    });
    if (eksemplarDiperbarui.count !== 1) {
      throw new PeminjamanError(409, 'Eksemplar sudah tidak aktif dipinjam.');
    }
    const dikembalikan = await tx.peminjaman.update({
      where: { id_peminjaman: idPeminjaman },
      data: { status: STATUS_PEMINJAMAN.SELESAI },
      include: INCLUDE_HASIL,
    });
    return formatPeminjaman(dikembalikan);
  });
};

/**
 * Pratinjau buku untuk pustakawan: kode boleh kode eksemplar atau kode koleksi.
 * Hanya membaca data; keputusan akhir tetap di buatPeminjaman.
 */
export const infoBuku = async (kode) => {
  const eksemplarDipilih = await prisma.eksemplar.findUnique({
    where: { kode_eksemplar: kode },
    include: { koleksi: true },
  });
  const koleksi =
    eksemplarDipilih?.koleksi ?? (await prisma.koleksi.findUnique({ where: { kode_koleksi: kode } }));
  if (!koleksi) {
    throw new PeminjamanError(404, `Kode "${kode}" tidak ditemukan.`);
  }

  const [tersedia, total, pertamaTersedia] = await Promise.all([
    prisma.eksemplar.count({ where: { id_koleksi: koleksi.id_koleksi, status: STATUS_EKSEMPLAR.TERSEDIA } }),
    prisma.eksemplar.count({ where: { id_koleksi: koleksi.id_koleksi } }),
    eksemplarDipilih
      ? null
      : prisma.eksemplar.findFirst({
          where: { id_koleksi: koleksi.id_koleksi, status: STATUS_EKSEMPLAR.TERSEDIA },
          orderBy: { id_eksemplar: 'asc' },
        }),
  ]);

  const eksemplar = eksemplarDipilih ?? pertamaTersedia;
  let alasan = null;
  if (koleksi.status_aktif !== true) alasan = 'Koleksi ini sedang tidak aktif.';
  else if (eksemplarDipilih && eksemplarDipilih.status !== STATUS_EKSEMPLAR.TERSEDIA) {
    alasan = `Eksemplar ${eksemplarDipilih.kode_eksemplar} tercatat sedang dipinjam.`;
  } else if (!eksemplar) alasan = 'Stok koleksi ini sedang habis.';

  return {
    jenis: eksemplarDipilih ? 'eksemplar' : 'koleksi',
    koleksi: { kode_koleksi: koleksi.kode_koleksi, judul: koleksi.judul, sampul: koleksi.sampul ?? null },
    eksemplar: eksemplar
      ? { kode_eksemplar: eksemplar.kode_eksemplar, lokasi_rak: eksemplar.lokasi_rak, status: eksemplar.status }
      : null,
    eksemplar_tersedia: tersedia,
    total_eksemplar: total,
    bisa_dipinjam: alasan === null,
    alasan,
  };
};
