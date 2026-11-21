import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const DENDA_UPLOAD_DIR = path.join(PUBLIC_DIR, 'denda');
const QRIS_PUBLIC_DIR = path.join(PUBLIC_DIR, 'qris');
const QRIS_LEGACY_DIR = path.resolve(__dirname, '../../qris');

const DEFAULT_TARIF_DENDA = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_BUKTI_BYTES = 100 * 1024; // Maksimal 100 KB

let lastSyncedDateKey = null;
let midnightTimer = null;

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toUtcDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Mengonversi nilai kolom `@db.Date` dari database (atau string YYYY-MM-DD)
 * menjadi timestamp UTC midnight (ms).
 */
function dbDateToUtcMidnightMs(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Mengonversi waktu referensi (seperti `new Date()` waktu lokal server)
 * menjadi timestamp UTC midnight (ms) berdasarkan tanggal kalender lokal.
 */
function localDateToUtcMidnightMs(dateInput = new Date()) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const match = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateOnly(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

async function getTarifDendaPerHari(dbClient = prisma) {
  const config = await dbClient.konfigurasiSistem.findUnique({
    where: { kunci_parameter: 'tarif_denda_per_hari' },
  });
  const parsed = Number(config?.nilai);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TARIF_DENDA;
}

async function resolvePustakawanId(tx, { id_pustakawan, pengenal_pustakawan } = {}, requireValid = false) {
  if (id_pustakawan && Number.isInteger(Number(id_pustakawan))) {
    const staff = await tx.pengguna.findUnique({
      where: { id_pengguna: Number(id_pustakawan) },
      select: { id_pengguna: true },
    });
    if (staff?.id_pengguna) return staff.id_pengguna;
  }

  if (typeof pengenal_pustakawan === 'string' && pengenal_pustakawan.trim()) {
    const staff = await tx.pengguna.findUnique({
      where: { pengenal: pengenal_pustakawan.trim() },
      select: { id_pengguna: true },
    });
    if (staff?.id_pengguna) return staff.id_pengguna;
  }

  if (requireValid && tx.pengguna.findFirst) {
    const fallbackStaff = await tx.pengguna.findFirst({
      where: {
        OR: [
          { role: { nama_role: 'Pustakawan' } },
          { role: { nama_role: 'Admin' } },
        ],
      },
      select: { id_pengguna: true },
    });
    if (fallbackStaff?.id_pengguna) return fallbackStaff.id_pengguna;
  }

  return null;
}

/**
 * Menghitung selisih hari kalender penuh antara tanggal jatuh tempo dan tanggal referensi.
 * Otomatis menyesuaikan jumlah hari tiap bulan (28, 29, 30, atau 31 hari).
 * Contoh: Jatuh tempo 20 November, sekarang 22 November -> selisih 2 hari.
 * Contoh: Jatuh tempo 20 November (30 hari), sekarang 1 Desember -> selisih 11 hari.
 */
export function countOverdueDaysDifference(dueDate, referenceDate, isDbRefDate = false) {
  const dueMs = dbDateToUtcMidnightMs(dueDate);
  const refMs = isDbRefDate
    ? dbDateToUtcMidnightMs(referenceDate)
    : localDateToUtcMidnightMs(referenceDate);

  if (dueMs === null || refMs === null || refMs <= dueMs) {
    return 0;
  }

  return Math.max(0, Math.round((refMs - dueMs) / MS_PER_DAY));
}

function calculateLateInfo(
  dueDate,
  referenceDate,
  existingDenda,
  tarifPerHari,
  isDbRefDate = false
) {
  if (!dueDate) {
    return {
      hari_terlambat: 0,
      nominal_denda: existingDenda ? Number(existingDenda.nominal || 0) : 0,
      is_terlambat: false,
    };
  }

  const daysLate = countOverdueDaysDifference(dueDate, referenceDate, isDbRefDate);

  if (existingDenda) {
    if (existingDenda.status === 'LUNAS') {
      const existingDays = daysLate > 0 ? daysLate : existingDenda.hari_terlambat ?? 0;
      return {
        hari_terlambat: existingDays,
        nominal_denda: Number(existingDenda.nominal || 0),
        is_terlambat: existingDays > 0,
      };
    }

    const hasManualKoreksi =
      Array.isArray(existingDenda.koreksi_denda) && existingDenda.koreksi_denda.length > 0;

    if (hasManualKoreksi && existingDenda.hari_terlambat === daysLate) {
      return {
        hari_terlambat: daysLate,
        nominal_denda: Number(existingDenda.nominal || 0),
        is_terlambat: daysLate > 0,
      };
    }
  }

  return {
    hari_terlambat: daysLate,
    nominal_denda: daysLate * tarifPerHari,
    is_terlambat: daysLate > 0,
  };
}

/**
 * Sinkronisasi otomatis denda harian ke database berdasarkan selisih hari kalender
 * dari tanggal jatuh tempo ke tanggal hari ini.
 */
export async function syncDendaHarian(referenceDate = new Date()) {
  const tarifPerHari = await getTarifDendaPerHari(prisma);
  const activeDetails = await prisma.detailPeminjaman.findMany({
    where: {
      OR: [
        { status: { not: 'KEMBALI' } },
        { denda: { status: 'BELUM_LUNAS' } },
      ],
    },
    include: {
      peminjaman: true,
      denda: {
        include: {
          koreksi_denda: true,
        },
      },
    },
  });

  let updatedCount = 0;

  for (const detail of activeDetails) {
    const dueDate = detail.peminjaman?.tanggal_jatuh_tempo;
    if (!dueDate) continue;

    const isReturned = detail.status === 'KEMBALI';
    const hasReturnDate = Boolean(isReturned && detail.tanggal_kembali);
    const effectiveRefDate = hasReturnDate ? detail.tanggal_kembali : referenceDate;

    const lateInfo = calculateLateInfo(
      dueDate,
      effectiveRefDate,
      detail.denda,
      tarifPerHari,
      hasReturnDate
    );
    if (!lateInfo.is_terlambat || lateInfo.hari_terlambat <= 0) continue;

    if (
      !isReturned &&
      detail.peminjaman &&
      detail.peminjaman.status !== 'TERLAMBAT' &&
      detail.peminjaman.status !== 'SELESAI'
    ) {
      await prisma.peminjaman.update({
        where: { id_peminjaman: detail.id_peminjaman },
        data: { status: 'TERLAMBAT' },
      });
    }

    if (!detail.denda) {
      await prisma.denda.create({
        data: {
          id_detail: detail.id_detail,
          hari_terlambat: lateInfo.hari_terlambat,
          tarif_per_hari: tarifPerHari,
          nominal: lateInfo.nominal_denda,
          total_terbayar: 0,
          status: 'BELUM_LUNAS',
          dibuat_pada: referenceDate,
        },
      });
      updatedCount++;
    } else if (detail.denda.status !== 'LUNAS') {
      const currentDays = detail.denda.hari_terlambat ?? 0;
      const currentNominal = Number(detail.denda.nominal ?? 0);
      if (
        lateInfo.hari_terlambat !== currentDays ||
        lateInfo.nominal_denda !== currentNominal
      ) {
        const totalTerbayar = Number(detail.denda.total_terbayar || 0);
        await prisma.denda.update({
          where: { id_denda: detail.denda.id_denda },
          data: {
            hari_terlambat: lateInfo.hari_terlambat,
            tarif_per_hari: tarifPerHari,
            nominal: lateInfo.nominal_denda,
            status: totalTerbayar >= lateInfo.nominal_denda ? 'LUNAS' : 'BELUM_LUNAS',
          },
        });
        updatedCount++;
      }
    }
  }

  lastSyncedDateKey = getLocalDateKey(referenceDate);

  return {
    date_key: lastSyncedDateKey,
    synced_at: referenceDate.toISOString(),
    tarif_per_hari: tarifPerHari,
    updated_count: updatedCount,
  };
}

/**
 * Menjadwalkan pembaruan denda otomatis setiap tepat tengah malam (00:00:00).
 */
export function startMidnightDendaScheduler() {
  if (midnightTimer) {
    clearTimeout(midnightTimer);
  }

  const scheduleNext = () => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      100
    );
    const delayMs = Math.max(1000, nextMidnight.getTime() - now.getTime());

    midnightTimer = setTimeout(async () => {
      try {
        const res = await syncDendaHarian(new Date());
        console.log(
          `🕛 [Denda Scheduler] Sinkronisasi tengah malam selesai (${res.date_key}): ${res.updated_count} denda diperbarui.`
        );
      } catch (err) {
        console.error('❌ [Denda Scheduler] Gagal sinkronisasi denda tengah malam:', err.message);
      } finally {
        scheduleNext();
      }
    }, delayMs);

    if (typeof midnightTimer.unref === 'function') {
      midnightTimer.unref();
    }
  };

  scheduleNext();
}

function normalizeBuktiUrl(rawPath) {
  if (!rawPath) return null;
  if (rawPath.startsWith('/api/public/')) return rawPath;
  if (rawPath.startsWith('/public/')) return `/api${rawPath}`;
  return rawPath;
}

function normalizePaymentStatus(rawStatus) {
  if (!rawStatus) return 'MENUNGGU VERIFIKASI';
  return String(rawStatus).replace(/_/g, ' ');
}

function formatDetailPengembalian(detail, tarifPerHari, referenceDate = new Date()) {
  const isReturned = detail.status === 'KEMBALI';
  const hasReturnDate = Boolean(isReturned && detail.tanggal_kembali);
  const effectiveRefDate = hasReturnDate ? detail.tanggal_kembali : referenceDate;
  const lateInfo = calculateLateInfo(
    detail.peminjaman?.tanggal_jatuh_tempo,
    effectiveRefDate,
    detail.denda,
    tarifPerHari,
    hasReturnDate
  );

  const isOverdue =
    !isReturned && (lateInfo.is_terlambat || detail.peminjaman?.status === 'TERLAMBAT');
  const nominalDenda = lateInfo.nominal_denda;
  const totalTerbayar = detail.denda?.total_terbayar != null ? Number(detail.denda.total_terbayar) : 0;
  const sisaDenda = Math.max(0, nominalDenda - totalTerbayar);
  const statusDenda =
    detail.denda?.status || (nominalDenda > 0 ? 'BELUM_LUNAS' : 'TIDAK_ADA');

  const riwayatKoreksi = Array.isArray(detail.denda?.koreksi_denda)
    ? detail.denda.koreksi_denda.map((k) => ({
        id_koreksi: k.id_koreksi,
        nominal_lama: Number(k.nominal_lama || 0),
        nominal_baru: Number(k.nominal_baru || 0),
        alasan: k.alasan || '',
        waktu: k.waktu ? new Date(k.waktu).toISOString() : null,
        pustakawan: k.pustakawan
          ? {
              id_pengguna: k.pustakawan.id_pengguna,
              pengenal: k.pustakawan.pengenal,
              nama: k.pustakawan.nama,
            }
          : null,
      }))
    : [];

  const rincianList = Array.isArray(detail.denda?.rincian_pembayaran)
    ? detail.denda.rincian_pembayaran
    : [];
  const latestRincian = rincianList[0];
  const latestPembayaran = latestRincian?.pembayaran
    ? {
        id_pembayaran: latestRincian.pembayaran.id_pembayaran,
        nominal_bayar: Number(latestRincian.pembayaran.nominal_bayar || 0),
        nominal_dialokasikan: Number(latestRincian.nominal_dialokasikan || 0),
        path_bukti: normalizeBuktiUrl(latestRincian.pembayaran.path_bukti),
        tipe_berkas: latestRincian.pembayaran.tipe_berkas || 'image/webp',
        status: normalizePaymentStatus(latestRincian.pembayaran.status),
        alasan_penolakan: latestRincian.pembayaran.alasan_penolakan || null,
        waktu_unggah: latestRincian.pembayaran.waktu_unggah
          ? new Date(latestRincian.pembayaran.waktu_unggah).toISOString()
          : null,
        waktu_verifikasi: latestRincian.pembayaran.waktu_verifikasi
          ? new Date(latestRincian.pembayaran.waktu_verifikasi).toISOString()
          : null,
        pemverifikasi: latestRincian.pembayaran.pemverifikasi || null,
      }
    : null;

  return {
    id_detail: detail.id_detail,
    id_peminjaman: detail.id_peminjaman,
    id_eksemplar: detail.id_eksemplar,
    id_denda: detail.denda?.id_denda || null,
    nomor_transaksi: detail.peminjaman?.nomor_transaksi || '-',
    kode_eksemplar: detail.eksemplar?.kode_eksemplar || '-',
    lokasi_rak: detail.eksemplar?.lokasi_rak || '-',
    id_koleksi: detail.eksemplar?.koleksi?.id_koleksi || null,
    kode_koleksi: detail.eksemplar?.koleksi?.kode_koleksi || '-',
    judul: detail.eksemplar?.koleksi?.judul || '-',
    anggota: detail.peminjaman?.anggota
      ? {
          id_pengguna: detail.peminjaman.anggota.id_pengguna,
          pengenal: detail.peminjaman.anggota.pengenal,
          nama: detail.peminjaman.anggota.nama,
        }
      : null,
    jalur: detail.peminjaman?.jalur || null,
    tanggal_pinjam: formatDateOnly(detail.peminjaman?.tanggal_pinjam),
    tanggal_jatuh_tempo: formatDateOnly(detail.peminjaman?.tanggal_jatuh_tempo),
    tanggal_kembali: formatDateOnly(detail.tanggal_kembali),
    status_detail: detail.status,
    status: isReturned ? 'SELESAI' : isOverdue ? 'TERLAMBAT' : 'SEDANG_DIPINJAM',
    hari_terlambat: lateInfo.hari_terlambat,
    tarif_per_hari:
      detail.denda?.tarif_per_hari != null ? Number(detail.denda.tarif_per_hari) : tarifPerHari,
    denda: nominalDenda,
    total_terbayar: totalTerbayar,
    sisa_denda: sisaDenda,
    status_denda: statusDenda,
    riwayat_koreksi: riwayatKoreksi,
    pembayaran_terakhir: latestPembayaran,
  };
}

const detailInclude = {
  peminjaman: {
    include: {
      anggota: {
        select: {
          id_pengguna: true,
          pengenal: true,
          nama: true,
        },
      },
    },
  },
  eksemplar: {
    include: {
      koleksi: {
        select: {
          id_koleksi: true,
          kode_koleksi: true,
          judul: true,
        },
      },
    },
  },
  denda: {
    include: {
      koreksi_denda: {
        include: {
          pustakawan: {
            select: {
              id_pengguna: true,
              pengenal: true,
              nama: true,
            },
          },
        },
        orderBy: { waktu: 'desc' },
      },
      rincian_pembayaran: {
        include: {
          pembayaran: {
            include: {
              pemverifikasi: {
                select: {
                  id_pengguna: true,
                  pengenal: true,
                  nama: true,
                },
              },
            },
          },
        },
        orderBy: { id_rincian: 'desc' },
      },
    },
  },
};

/**
 * GET /api/pengembalian
 * Mengambil daftar eksemplar peminjaman dari database.
 * Query `status`: 'aktif' (default) | 'selesai' | 'denda' | 'semua'
 * Query `pengenal_anggota`: filter khusus anggota tertentu
 * Query `search`: filter nomor transaksi, kode eksemplar, judul, atau nama/pengenal anggota
 */
export const getDaftarPengembalian = async (req, res, next) => {
  try {
    const now = new Date();
    const todayKey = getLocalDateKey(now);
    if (lastSyncedDateKey !== todayKey) {
      await syncDendaHarian(now);
    }

    const statusParam = String(req.query.status || 'aktif').toLowerCase();
    const searchQuery = String(req.query.search || '').trim().toLowerCase();
    const pengenalAnggota = String(req.query.pengenal_anggota || '').trim();

    const whereClause = {};
    if (statusParam === 'aktif') {
      whereClause.status = { not: 'KEMBALI' };
    } else if (statusParam === 'selesai') {
      whereClause.status = 'KEMBALI';
    } else if (statusParam === 'denda') {
      whereClause.denda = { isNot: null };
    }

    if (pengenalAnggota) {
      whereClause.peminjaman = {
        anggota: {
          pengenal: pengenalAnggota,
        },
      };
    }

    const [tarifPerHari, details] = await Promise.all([
      getTarifDendaPerHari(prisma),
      prisma.detailPeminjaman.findMany({
        where: whereClause,
        include: detailInclude,
        orderBy: [
          { peminjaman: { tanggal_pinjam: 'desc' } },
          { id_detail: 'desc' },
        ],
      }),
    ]);

    let items = details.map((detail) => formatDetailPengembalian(detail, tarifPerHari, now));

    if (searchQuery) {
      items = items.filter((item) => {
        const fields = [
          item.nomor_transaksi,
          item.kode_eksemplar,
          item.judul,
          item.anggota?.nama,
          item.anggota?.pengenal,
        ];
        return fields.some((val) => String(val || '').toLowerCase().includes(searchQuery));
      });
    }

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/pengembalian/sync-denda
 * Memicu sinkronisasi perhitungan denda harian ke database.
 */
export const triggerSyncDenda = async (req, res, next) => {
  try {
    const syncResult = await syncDendaHarian(new Date());
    res.status(200).json({
      success: true,
      data: syncResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/pengembalian/proses
 * Memproses pengembalian satu eksemplar buku berdasarkan `id_detail` atau `kode` (No. Transaksi / Kode Eksemplar).
 */
export const prosesPengembalian = async (req, res, next) => {
  try {
    const {
      id_detail: rawIdDetail,
      kode: rawKode,
      id_pustakawan,
      pengenal_pustakawan,
    } = req.body || {};

    const hasIdDetail = rawIdDetail !== undefined && rawIdDetail !== null && rawIdDetail !== '';
    const kode = typeof rawKode === 'string' ? rawKode.trim() : '';

    if (!hasIdDetail && !kode) {
      return res.status(400).json({
        success: false,
        message: 'Harap sertakan id_detail atau kode eksemplar.',
      });
    }

    if (hasIdDetail && (!Number.isInteger(Number(rawIdDetail)) || Number(rawIdDetail) <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Parameter id_detail harus berupa angka positif yang valid.',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetDetail = null;

      if (hasIdDetail) {
        targetDetail = await tx.detailPeminjaman.findUnique({
          where: { id_detail: Number(rawIdDetail) },
          include: detailInclude,
        });

        if (!targetDetail) {
          throw createHttpError(404, 'Data detail peminjaman tidak ditemukan.');
        }
        if (targetDetail.status === 'KEMBALI') {
          throw createHttpError(400, 'Eksemplar buku ini sudah dikembalikan sebelumnya.');
        }
      } else {
        targetDetail = await tx.detailPeminjaman.findFirst({
          where: {
            status: { not: 'KEMBALI' },
            eksemplar: {
              kode_eksemplar: kode,
            },
          },
          include: detailInclude,
        });

        if (!targetDetail) {
          throw createHttpError(404, `Eksemplar aktif dengan kode "${kode}" tidak ditemukan.`);
        }
      }

      const resolvedPustakawanId = await resolvePustakawanId(
        tx,
        { id_pustakawan, pengenal_pustakawan },
        false
      );

      const now = new Date();
      const todayUtc = toUtcDate(now);
      const tarifPerHari = await getTarifDendaPerHari(tx);
      const lateInfo = calculateLateInfo(
        targetDetail.peminjaman?.tanggal_jatuh_tempo,
        now,
        targetDetail.denda,
        tarifPerHari
      );

      await tx.detailPeminjaman.update({
        where: { id_detail: targetDetail.id_detail },
        data: {
          status: 'KEMBALI',
          tanggal_kembali: todayUtc,
          ...(resolvedPustakawanId ? { id_pustakawan_pengembalian: resolvedPustakawanId } : {}),
        },
      });

      await tx.eksemplar.update({
        where: { id_eksemplar: targetDetail.id_eksemplar },
        data: { status: 'TERSEDIA' },
      });

      if (lateInfo.hari_terlambat > 0 && lateInfo.nominal_denda > 0) {
        if (targetDetail.denda) {
          if (targetDetail.denda.status !== 'LUNAS') {
            await tx.denda.update({
              where: { id_denda: targetDetail.denda.id_denda },
              data: {
                hari_terlambat: lateInfo.hari_terlambat,
                tarif_per_hari: tarifPerHari,
                nominal: lateInfo.nominal_denda,
              },
            });
          }
        } else {
          await tx.denda.create({
            data: {
              id_detail: targetDetail.id_detail,
              hari_terlambat: lateInfo.hari_terlambat,
              tarif_per_hari: tarifPerHari,
              nominal: lateInfo.nominal_denda,
              total_terbayar: 0,
              status: 'BELUM_LUNAS',
              dibuat_pada: now,
            },
          });
        }
      }

      const remainingActiveCount = await tx.detailPeminjaman.count({
        where: {
          id_peminjaman: targetDetail.id_peminjaman,
          status: { not: 'KEMBALI' },
        },
      });

      if (remainingActiveCount === 0) {
        await tx.peminjaman.update({
          where: { id_peminjaman: targetDetail.id_peminjaman },
          data: { status: 'SELESAI' },
        });
      }

      const updatedDetail = await tx.detailPeminjaman.findUnique({
        where: { id_detail: targetDetail.id_detail },
        include: detailInclude,
      });

      return {
        item: formatDetailPengembalian(updatedDetail, tarifPerHari, now),
        remaining_active_in_transaction: remainingActiveCount,
      };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/pengembalian/denda/koreksi
 * Melakukan koreksi nominal denda oleh pustakawan dan mencatat riwayat ke tabel `koreksi_denda`.
 */
export const koreksiDenda = async (req, res, next) => {
  try {
    const {
      id_denda: rawIdDenda,
      id_detail: rawIdDetail,
      nominal_baru: rawNominalBaru,
      alasan: rawAlasan,
      id_pustakawan,
      pengenal_pustakawan,
    } = req.body || {};

    const alasan = typeof rawAlasan === 'string' ? rawAlasan.trim() : '';
    const nominalBaru = Number(rawNominalBaru);

    if (!rawIdDenda && !rawIdDetail) {
      return res.status(400).json({
        success: false,
        message: 'Harap sertakan id_denda atau id_detail yang akan dikoreksi.',
      });
    }

    if (!Number.isFinite(nominalBaru) || nominalBaru < 0) {
      return res.status(400).json({
        success: false,
        message: 'Nominal denda baru harus berupa angka minimal 0.',
      });
    }

    if (!alasan) {
      return res.status(400).json({
        success: false,
        message: 'Alasan koreksi denda wajib diisi.',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const tarifPerHari = await getTarifDendaPerHari(tx);
      const now = new Date();
      let dendaRecord = null;
      let detailId = rawIdDetail ? Number(rawIdDetail) : null;

      if (rawIdDenda) {
        dendaRecord = await tx.denda.findUnique({
          where: { id_denda: Number(rawIdDenda) },
        });
        if (dendaRecord) {
          detailId = dendaRecord.id_detail;
        }
      } else if (detailId) {
        dendaRecord = await tx.denda.findUnique({
          where: { id_detail: detailId },
        });
      }

      if (!dendaRecord && detailId) {
        const detail = await tx.detailPeminjaman.findUnique({
          where: { id_detail: detailId },
          include: { peminjaman: true },
        });
        if (!detail) {
          throw createHttpError(404, 'Data detail peminjaman tidak ditemukan.');
        }

        const lateInfo = calculateLateInfo(
          detail.peminjaman?.tanggal_jatuh_tempo,
          now,
          null,
          tarifPerHari
        );
        dendaRecord = await tx.denda.create({
          data: {
            id_detail: detail.id_detail,
            hari_terlambat: lateInfo.hari_terlambat,
            tarif_per_hari: tarifPerHari,
            nominal: lateInfo.nominal_denda,
            total_terbayar: 0,
            status: 'BELUM_LUNAS',
            dibuat_pada: now,
          },
        });
      }

      if (!dendaRecord) {
        throw createHttpError(404, 'Data denda tidak ditemukan.');
      }

      if (dendaRecord.status === 'LUNAS') {
        throw createHttpError(400, 'Denda yang sudah berstatus LUNAS tidak dapat dikoreksi.');
      }

      const resolvedPustakawanId = await resolvePustakawanId(
        tx,
        { id_pustakawan, pengenal_pustakawan },
        true
      );

      if (!resolvedPustakawanId) {
        throw createHttpError(400, 'Akun pustakawan pengoreksi tidak ditemukan di database.');
      }

      const nominalLama = Number(dendaRecord.nominal || 0);
      const totalTerbayar = Number(dendaRecord.total_terbayar || 0);
      const newStatus = nominalBaru <= totalTerbayar ? 'LUNAS' : 'BELUM_LUNAS';

      const createdKoreksi = await tx.koreksiDenda.create({
        data: {
          id_denda: dendaRecord.id_denda,
          id_pustakawan: resolvedPustakawanId,
          nominal_lama: nominalLama,
          nominal_baru: nominalBaru,
          alasan,
          waktu: now,
        },
      });

      await tx.denda.update({
        where: { id_denda: dendaRecord.id_denda },
        data: {
          nominal: nominalBaru,
          status: newStatus,
        },
      });

      const updatedDetail = await tx.detailPeminjaman.findUnique({
        where: { id_detail: dendaRecord.id_detail },
        include: detailInclude,
      });

      return {
        koreksi: {
          id_koreksi: createdKoreksi.id_koreksi,
          id_denda: createdKoreksi.id_denda,
          nominal_lama: nominalLama,
          nominal_baru: nominalBaru,
          alasan,
          waktu: now.toISOString(),
        },
        item: formatDetailPengembalian(updatedDetail, tarifPerHari, now),
      };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/pengembalian/qris
 * Mengambil URL gambar QRIS dari folder `public/qris` (atau fallback `qris`).
 */
export const getQrisInfo = async (req, res, next) => {
  try {
    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif']);
    let foundFile = null;

    for (const dir of [QRIS_PUBLIC_DIR, QRIS_LEGACY_DIR]) {
      try {
        const files = await fs.readdir(dir);
        const match = files.find((f) => allowedExt.has(path.extname(f).toLowerCase()));
        if (match) {
          foundFile = match;
          break;
        }
      } catch {
        // Lanjut cek direktori fallback
      }
    }

    if (!foundFile) {
      return res.status(404).json({
        success: false,
        message: 'Gambar QRIS belum tersedia di folder public/qris.',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        filename: foundFile,
        url: `/api/public/qris/${encodeURIComponent(foundFile)}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

function parseWebpBase64(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw createHttpError(400, 'Berkas gambar bukti pembayaran wajib diunggah.');
  }

  const trimmed = input.trim();
  let base64Data = trimmed;

  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx === -1) {
      throw createHttpError(400, 'Format data gambar tidak valid.');
    }
    const header = trimmed.slice(0, commaIdx).toLowerCase();
    if (!header.includes('image/webp')) {
      throw createHttpError(400, 'Bukti pembayaran harus dikonversi ke format WebP.');
    }
    base64Data = trimmed.slice(commaIdx + 1);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (!buffer || buffer.length === 0) {
    throw createHttpError(400, 'Isi berkas gambar kosong atau tidak valid.');
  }

  if (buffer.length > MAX_BUKTI_BYTES) {
    throw createHttpError(
      400,
      `Ukuran gambar bukti pembayaran (${(buffer.length / 1024).toFixed(1)} KB) melebihi batas maksimal 100 KB.`
    );
  }

  // Validasi header RIFF....WEBP jika ukuran minimal 12 byte
  const isRiffWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isRiffWebp) {
    throw createHttpError(400, 'Berkas yang diunggah bukan file gambar WebP yang valid.');
  }

  return buffer;
}

/**
 * POST /api/pengembalian/pembayaran
 * Anggota mengunggah bukti pembayaran denda (WebP <= 100KB) yang disimpan ke `backend/app/public/denda`.
 */
export const uploadBuktiPembayaranDenda = async (req, res, next) => {
  try {
    const {
      id_pembayaran: rawIdPembayaran,
      id_denda: rawIdDenda,
      id_detail: rawIdDetail,
      id_anggota: rawIdAnggota,
      pengenal_anggota,
      nominal_bayar: rawNominalBayar,
      file_base64,
    } = req.body || {};

    if (!rawIdDenda && !rawIdDetail) {
      return res.status(400).json({
        success: false,
        message: 'Harap pilih tagihan denda (id_denda atau id_detail) yang akan dibayar.',
      });
    }

    const webpBuffer = parseWebpBase64(file_base64);
    await fs.mkdir(DENDA_UPLOAD_DIR, { recursive: true });

    const dendaIncludeWithPayments = {
      detail_peminjaman: {
        include: { peminjaman: true },
      },
      rincian_pembayaran: {
        include: { pembayaran: true },
        orderBy: { id_rincian: 'desc' },
      },
    };

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const tarifPerHari = await getTarifDendaPerHari(tx);
      let dendaRecord = null;

      if (rawIdDenda) {
        dendaRecord = await tx.denda.findUnique({
          where: { id_denda: Number(rawIdDenda) },
          include: dendaIncludeWithPayments,
        });
      } else if (rawIdDetail) {
        dendaRecord = await tx.denda.findUnique({
          where: { id_detail: Number(rawIdDetail) },
          include: dendaIncludeWithPayments,
        });

        if (!dendaRecord) {
          const detail = await tx.detailPeminjaman.findUnique({
            where: { id_detail: Number(rawIdDetail) },
            include: { peminjaman: true },
          });
          if (!detail) {
            throw createHttpError(404, 'Data peminjaman tidak ditemukan.');
          }
          const lateInfo = calculateLateInfo(
            detail.peminjaman?.tanggal_jatuh_tempo,
            now,
            null,
            tarifPerHari
          );
          if (lateInfo.nominal_denda <= 0) {
            throw createHttpError(400, 'Peminjaman ini tidak memiliki tagihan denda.');
          }
          dendaRecord = await tx.denda.create({
            data: {
              id_detail: detail.id_detail,
              hari_terlambat: lateInfo.hari_terlambat,
              tarif_per_hari: tarifPerHari,
              nominal: lateInfo.nominal_denda,
              total_terbayar: 0,
              status: 'BELUM_LUNAS',
              dibuat_pada: now,
            },
            include: dendaIncludeWithPayments,
          });
        }
      }

      if (!dendaRecord) {
        throw createHttpError(404, 'Data tagihan denda tidak ditemukan.');
      }

      if (dendaRecord.status === 'LUNAS') {
        throw createHttpError(400, 'Tagihan denda ini sudah berstatus LUNAS.');
      }

      let resolvedAnggotaId =
        dendaRecord.detail_peminjaman?.peminjaman?.id_anggota ||
        (rawIdAnggota ? Number(rawIdAnggota) : null);

      if (!resolvedAnggotaId && typeof pengenal_anggota === 'string' && pengenal_anggota.trim()) {
        const member = await tx.pengguna.findUnique({
          where: { pengenal: pengenal_anggota.trim() },
          select: { id_pengguna: true },
        });
        resolvedAnggotaId = member?.id_pengguna || null;
      }

      if (!resolvedAnggotaId) {
        throw createHttpError(400, 'Data anggota pembayar denda tidak ditemukan.');
      }

      const sisaDenda = Math.max(
        0,
        Number(dendaRecord.nominal || 0) - Number(dendaRecord.total_terbayar || 0)
      );
      const nominalBayar =
        rawNominalBayar !== undefined && rawNominalBayar !== null && Number(rawNominalBayar) > 0
          ? Number(rawNominalBayar)
          : sisaDenda;

      // Cek apakah sudah ada data bukti pembayaran sebelumnya untuk denda ini yang belum TERVERIFIKASI
      const rincianList = Array.isArray(dendaRecord.rincian_pembayaran)
        ? dendaRecord.rincian_pembayaran
        : [];
      let existingRincian = rincianList.find(
        (r) =>
          r.pembayaran &&
          r.pembayaran.status !== 'TERVERIFIKASI' &&
          (!rawIdPembayaran || r.id_pembayaran === Number(rawIdPembayaran))
      );
      if (!existingRincian) {
        existingRincian = rincianList.find(
          (r) => r.pembayaran && r.pembayaran.status !== 'TERVERIFIKASI'
        );
      }

      let existingPembayaran = existingRincian?.pembayaran || null;
      if (!existingPembayaran && rawIdPembayaran && tx.pembayaranDenda.findUnique) {
        const foundPayment = await tx.pembayaranDenda.findUnique({
          where: { id_pembayaran: Number(rawIdPembayaran) },
        });
        if (foundPayment && foundPayment.status !== 'TERVERIFIKASI') {
          existingPembayaran = foundPayment;
        }
      }

      const fileName = `bukti-denda-${resolvedAnggotaId}-${dendaRecord.id_denda}-${Date.now()}.webp`;
      const fullPath = path.join(DENDA_UPLOAD_DIR, fileName);
      await fs.writeFile(fullPath, webpBuffer);

      const publicPath = `/api/public/denda/${fileName}`;

      if (existingPembayaran) {
        // Hapus file gambar bukti pembayaran yang lama dari folder public/denda
        if (existingPembayaran.path_bukti) {
          const oldFileName = path.basename(existingPembayaran.path_bukti);
          if (
            oldFileName &&
            oldFileName !== fileName &&
            oldFileName !== '.gitkeep' &&
            oldFileName !== '.gitignore'
          ) {
            const oldFilePath = path.join(DENDA_UPLOAD_DIR, oldFileName);
            await fs.unlink(oldFilePath).catch(() => {});
          }
        }

        // Update record pembayaran_denda yang sudah ada (tidak membuat record baru)
        const updatedPembayaran = await tx.pembayaranDenda.update({
          where: { id_pembayaran: existingPembayaran.id_pembayaran },
          data: {
            nominal_bayar: nominalBayar,
            path_bukti: publicPath,
            tipe_berkas: 'image/webp',
            status: 'MENUNGGU VERIFIKASI',
            alasan_penolakan: null,
            id_pemverifikasi: null,
            waktu_unggah: now,
            waktu_verifikasi: null,
          },
        });

        if (existingRincian?.id_rincian && tx.rincianPembayaran.update) {
          await tx.rincianPembayaran.update({
            where: { id_rincian: existingRincian.id_rincian },
            data: { nominal_dialokasikan: nominalBayar },
          });
        }

        return {
          id_pembayaran: updatedPembayaran.id_pembayaran,
          id_denda: dendaRecord.id_denda,
          id_anggota: resolvedAnggotaId,
          nominal_bayar: nominalBayar,
          path_bukti: publicPath,
          tipe_berkas: 'image/webp',
          ukuran_bytes: webpBuffer.length,
          status: updatedPembayaran.status,
          waktu_unggah: now.toISOString(),
          is_updated: true,
        };
      }

      const createdPembayaran = await tx.pembayaranDenda.create({
        data: {
          id_anggota: resolvedAnggotaId,
          id_pemverifikasi: null,
          nominal_bayar: nominalBayar,
          path_bukti: publicPath,
          tipe_berkas: 'image/webp',
          status: 'MENUNGGU VERIFIKASI',
          alasan_penolakan: null,
          waktu_unggah: now,
          waktu_verifikasi: null,
        },
      });

      await tx.rincianPembayaran.create({
        data: {
          id_pembayaran: createdPembayaran.id_pembayaran,
          id_denda: dendaRecord.id_denda,
          nominal_dialokasikan: nominalBayar,
        },
      });

      return {
        id_pembayaran: createdPembayaran.id_pembayaran,
        id_denda: dendaRecord.id_denda,
        id_anggota: resolvedAnggotaId,
        nominal_bayar: nominalBayar,
        path_bukti: publicPath,
        tipe_berkas: 'image/webp',
        ukuran_bytes: webpBuffer.length,
        status: createdPembayaran.status,
        waktu_unggah: now.toISOString(),
        is_updated: false,
      };
    });

    res.status(result.is_updated ? 200 : 201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/pengembalian/pembayaran
 * Mengambil daftar pembayaran denda untuk dilihat dan diverifikasi oleh pustakawan.
 */
export const getDaftarPembayaranDenda = async (req, res, next) => {
  try {
    const statusFilter = String(req.query.status || 'SEMUA').toUpperCase();
    const whereClause = {};
    if (statusFilter !== 'SEMUA') {
      whereClause.status = statusFilter;
    }

    const payments = await prisma.pembayaranDenda.findMany({
      where: whereClause,
      include: {
        anggota: {
          select: {
            id_pengguna: true,
            pengenal: true,
            nama: true,
          },
        },
        pemverifikasi: {
          select: {
            id_pengguna: true,
            pengenal: true,
            nama: true,
          },
        },
        rincian_pembayaran: {
          include: {
            denda: {
              include: {
                detail_peminjaman: {
                  include: {
                    peminjaman: true,
                    eksemplar: {
                      include: {
                        koleksi: {
                          select: {
                            id_koleksi: true,
                            kode_koleksi: true,
                            judul: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ waktu_unggah: 'desc' }, { id_pembayaran: 'desc' }],
    });

    const formatted = payments.map((p) => ({
      id_pembayaran: p.id_pembayaran,
      nominal_bayar: Number(p.nominal_bayar || 0),
      path_bukti: normalizeBuktiUrl(p.path_bukti),
      tipe_berkas: p.tipe_berkas || 'image/webp',
      status: normalizePaymentStatus(p.status),
      alasan_penolakan: p.alasan_penolakan || null,
      waktu_unggah: p.waktu_unggah ? new Date(p.waktu_unggah).toISOString() : null,
      waktu_verifikasi: p.waktu_verifikasi ? new Date(p.waktu_verifikasi).toISOString() : null,
      anggota: p.anggota || null,
      pemverifikasi: p.pemverifikasi || null,
      rincian: Array.isArray(p.rincian_pembayaran)
        ? p.rincian_pembayaran.map((r) => ({
            id_rincian: r.id_rincian,
            id_denda: r.id_denda,
            nominal_dialokasikan: Number(r.nominal_dialokasikan || 0),
            nominal_denda: Number(r.denda?.nominal || 0),
            hari_terlambat: r.denda?.hari_terlambat || 0,
            status_denda: r.denda?.status || 'BELUM_LUNAS',
            id_detail: r.denda?.detail_peminjaman?.id_detail || null,
            nomor_transaksi: r.denda?.detail_peminjaman?.peminjaman?.nomor_transaksi || '-',
            kode_eksemplar: r.denda?.detail_peminjaman?.eksemplar?.kode_eksemplar || '-',
            judul: r.denda?.detail_peminjaman?.eksemplar?.koleksi?.judul || '-',
          }))
        : [],
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/pengembalian/pembayaran/:id_pembayaran/verifikasi
 * Pustakawan memverifikasi (TERVERIFIKASI) atau menolak (DITOLAK) bukti pembayaran denda.
 */
export const verifikasiPembayaranDenda = async (req, res, next) => {
  try {
    const idPembayaran = Number(req.params.id_pembayaran);
    const {
      status: rawStatus,
      alasan_penolakan: rawAlasan,
      id_pustakawan,
      pengenal_pustakawan,
    } = req.body || {};

    if (!Number.isInteger(idPembayaran) || idPembayaran <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter id_pembayaran tidak valid.',
      });
    }

    const decision = String(rawStatus || 'TERVERIFIKASI').toUpperCase();
    if (decision !== 'TERVERIFIKASI' && decision !== 'DITOLAK') {
      return res.status(400).json({
        success: false,
        message: 'Status verifikasi harus TERVERIFIKASI atau DITOLAK.',
      });
    }

    const alasanPenolakan = typeof rawAlasan === 'string' ? rawAlasan.trim() : '';
    if (decision === 'DITOLAK' && !alasanPenolakan) {
      return res.status(400).json({
        success: false,
        message: 'Alasan penolakan wajib diisi apabila bukti pembayaran ditolak.',
      });
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.pembayaranDenda.findUnique({
        where: { id_pembayaran: idPembayaran },
        include: {
          rincian_pembayaran: {
            include: { denda: true },
          },
        },
      });

      if (!payment) {
        throw createHttpError(404, 'Data pembayaran denda tidak ditemukan.');
      }

      if (payment.status === 'TERVERIFIKASI') {
        throw createHttpError(400, 'Pembayaran denda ini sudah diverifikasi sebelumnya.');
      }

      const resolvedPustakawanId = await resolvePustakawanId(
        tx,
        { id_pustakawan, pengenal_pustakawan },
        true
      );

      const updatedPayment = await tx.pembayaranDenda.update({
        where: { id_pembayaran: idPembayaran },
        data: {
          status: decision,
          ...(resolvedPustakawanId ? { id_pemverifikasi: resolvedPustakawanId } : {}),
          alasan_penolakan: decision === 'DITOLAK' ? alasanPenolakan : null,
          waktu_verifikasi: now,
        },
      });

      if (decision === 'TERVERIFIKASI' && Array.isArray(payment.rincian_pembayaran)) {
        for (const rincian of payment.rincian_pembayaran) {
          if (!rincian.denda) continue;
          const prevPaid = Number(rincian.denda.total_terbayar || 0);
          const allocated = Number(
            rincian.nominal_dialokasikan ?? payment.nominal_bayar ?? 0
          );
          const newTotalPaid = prevPaid + allocated;
          const targetNominal = Number(rincian.denda.nominal || 0);

          await tx.denda.update({
            where: { id_denda: rincian.id_denda },
            data: {
              total_terbayar: newTotalPaid,
              status: newTotalPaid >= targetNominal ? 'LUNAS' : 'BELUM_LUNAS',
            },
          });
        }
      }

      return {
        id_pembayaran: updatedPayment.id_pembayaran,
        status: updatedPayment.status,
        alasan_penolakan: updatedPayment.alasan_penolakan,
        waktu_verifikasi: now.toISOString(),
      };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
