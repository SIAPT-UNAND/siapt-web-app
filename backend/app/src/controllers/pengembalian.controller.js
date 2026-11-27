import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../lib/prisma.js';
import { ROLE } from '../constants/status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const DENDA_UPLOAD_DIR = path.join(PUBLIC_DIR, 'denda');
const QRIS_PUBLIC_DIR = path.join(PUBLIC_DIR, 'qris');
const QRIS_LEGACY_DIR = path.resolve(__dirname, '../../qris');

const DEFAULT_TARIF_DENDA = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_BUKTI_BYTES = 100 * 1024; // Maksimal 100 KB
const BASE_POLL_INTERVAL_MS = 2000;
const BASE_RETRY_BACKOFF_MS = 2000;
const MAX_RETRY_BACKOFF_MS = 60 * 1000;

let lastSyncedDateKey = null;
let midnightTimer = null;
let activeSchedulerToken = 0;

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

/**
 * Membaca waktu sistem operasi saat ini secara real-time melalui MySQL `NOW()`
 * untuk melewati jeda cache `Win32Time` pada V8/Node.js di Windows ketika
 * tanggal/jam sistem operasi diubah secara manual.
 */
async function getCurrentSystemDate(dbClient = prisma) {
  if (typeof dbClient?.$queryRawUnsafe === 'function') {
    try {
      const rows = await dbClient.$queryRawUnsafe(
        "SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS now_str"
      );
      const rawStr = Array.isArray(rows) && rows[0]?.now_str ? String(rows[0].now_str) : '';
      const match = rawStr
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
      if (match) {
        return new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6])
        );
      }
    } catch {
      // Fallback ke new Date() apabila query raw tidak tersedia (mis. saat unit test)
    }
  }
  return new Date();
}

async function getTarifDendaSchedule(dbClient = prisma) {
  const config = await dbClient.konfigurasiSistem.findUnique({
    where: { kunci_parameter: 'tarif_denda_per_hari' },
  });
  const parsed = Number(config?.nilai);
  const currentTarif =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TARIF_DENDA;

  const targetConfigId = Number(config?.id_konfigurasi) || 2;
  let rawLogs = [];

  if (dbClient.logKonfigurasi?.findMany) {
    const foundLogs = await dbClient.logKonfigurasi.findMany({
      where: {
        id_konfigurasi: targetConfigId,
      },
      orderBy: [{ waktu: 'asc' }, { id_log: 'asc' }],
    });
    if (Array.isArray(foundLogs)) {
      rawLogs = foundLogs;
    }
  }

  const logs = rawLogs
    .filter((l) => l && l.waktu)
    .map((l) => {
      // Gunakan dbDateToUtcMidnightMs karena Prisma membaca kolom DATETIME MySQL sebagai UTC
      const logDateMs = dbDateToUtcMidnightMs(l.waktu);
      const nilaiLama = Number(l.nilai_lama);
      const nilaiBaru = Number(l.nilai_baru);
      return {
        id_log: l.id_log,
        waktu_ms: new Date(l.waktu).getTime(),
        log_date_ms: logDateMs,
        // Konfigurasi baru untuk denda baru digunakan di keesokan harinya (logDateMs + 1 hari)
        effective_date_ms: logDateMs !== null ? logDateMs + MS_PER_DAY : null,
        nilai_lama: Number.isFinite(nilaiLama) && nilaiLama > 0 ? nilaiLama : null,
        nilai_baru: Number.isFinite(nilaiBaru) && nilaiBaru > 0 ? nilaiBaru : null,
      };
    })
    .filter((l) => l.effective_date_ms !== null && l.nilai_baru !== null)
    .sort((a, b) => a.waktu_ms - b.waktu_ms || (a.id_log || 0) - (b.id_log || 0));

  return {
    currentTarif,
    logs,
  };
}

/**
 * Menentukan tarif denda per hari yang berlaku pada suatu tanggal (`dayMs` UTC midnight)
 * berdasarkan riwayat `log_konfigurasi` (id_konfigurasi = 2).
 * Setiap perubahan nilai tarif pada `log_konfigurasi` baru mulai digunakan di keesokan harinya.
 */
export function resolveTarifForDayMs(dayMs, tarifOrSchedule) {
  if (typeof tarifOrSchedule === 'number') {
    return Number.isFinite(tarifOrSchedule) && tarifOrSchedule > 0
      ? tarifOrSchedule
      : DEFAULT_TARIF_DENDA;
  }

  const currentTarif =
    Number.isFinite(Number(tarifOrSchedule?.currentTarif)) &&
    Number(tarifOrSchedule?.currentTarif) > 0
      ? Number(tarifOrSchedule.currentTarif)
      : DEFAULT_TARIF_DENDA;
  const logs = tarifOrSchedule?.logs;

  if (!Array.isArray(logs) || logs.length === 0 || dayMs === null) {
    return currentTarif;
  }

  // Sebelum log pertama berlaku, gunakan nilai_lama dari log paling awal
  let activeTarif = logs[0].nilai_lama ?? currentTarif;

  for (const log of logs) {
    // Nilai baru pada log baru mulai berlaku di keesokan harinya (dayMs >= log.effective_date_ms)
    if (dayMs >= log.effective_date_ms) {
      activeTarif = log.nilai_baru ?? activeTarif;
    } else {
      break;
    }
  }

  return activeTarif;
}

function requireAuthenticatedPustakawanId(req) {
  const staffId = req.pengguna?.id_pengguna;
  if (!staffId || req.pengguna?.role?.nama_role !== ROLE.PUSTAKAWAN) {
    throw createHttpError(401, 'Silakan login sebagai pustakawan terlebih dahulu.');
  }
  return staffId;
}

/**
 * Menghitung selisih hari keterlambatan antara tanggal jatuh tempo dan tanggal referensi
 * dengan mengecualikan hari Minggu (getUTCDay() === 0).
 * Otomatis menyesuaikan jumlah hari tiap bulan (28, 29, 30, atau 31 hari).
 */
export function countOverdueDaysDifference(dueDate, referenceDate, isDbRefDate = false) {
  const dueMs = dbDateToUtcMidnightMs(dueDate);
  const refMs = isDbRefDate
    ? dbDateToUtcMidnightMs(referenceDate)
    : localDateToUtcMidnightMs(referenceDate);

  if (dueMs === null || refMs === null || refMs <= dueMs) {
    return 0;
  }

  let overdueDays = 0;
  for (let curMs = dueMs + MS_PER_DAY; curMs <= refMs; curMs += MS_PER_DAY) {
    const dayOfWeek = new Date(curMs).getUTCDay();
    if (dayOfWeek !== 0) {
      overdueDays++;
    }
  }

  return overdueDays;
}

function calculateLateInfo(
  dueDate,
  referenceDate,
  existingDenda,
  tarifOrSchedule,
  isDbRefDate = false
) {
  const refMs = isDbRefDate
    ? dbDateToUtcMidnightMs(referenceDate)
    : localDateToUtcMidnightMs(referenceDate);
  const activeTarifOnRef = resolveTarifForDayMs(refMs, tarifOrSchedule);

  if (!dueDate) {
    return {
      hari_terlambat: 0,
      nominal_denda: existingDenda ? Number(existingDenda.nominal || 0) : 0,
      tarif_per_hari: activeTarifOnRef,
      is_terlambat: false,
    };
  }

  const dueMs = dbDateToUtcMidnightMs(dueDate);

  let daysLate = 0;
  let scheduleNominal = 0;
  let latestDayTarif = activeTarifOnRef;

  if (dueMs !== null && refMs !== null && refMs > dueMs) {
    for (let curMs = dueMs + MS_PER_DAY; curMs <= refMs; curMs += MS_PER_DAY) {
      const dayOfWeek = new Date(curMs).getUTCDay();
      if (dayOfWeek !== 0) {
        daysLate++;
        const dayTarif = resolveTarifForDayMs(curMs, tarifOrSchedule);
        scheduleNominal += dayTarif;
        latestDayTarif = dayTarif;
      }
    }
  }

  if (existingDenda) {
    const hasManualKoreksi =
      Array.isArray(existingDenda.koreksi_denda) && existingDenda.koreksi_denda.length > 0;

    if (hasManualKoreksi) {
      const totalSelisihKoreksi = existingDenda.koreksi_denda.reduce((acc, koreksi) => {
        const nominalLamaKoreksi = Number(koreksi?.nominal_lama ?? 0);
        const nominalBaruKoreksi = Number(koreksi?.nominal_baru ?? nominalLamaKoreksi);
        return acc + (nominalBaruKoreksi - nominalLamaKoreksi);
      }, 0);

      return {
        hari_terlambat: daysLate,
        nominal_denda: Math.max(0, scheduleNominal + totalSelisihKoreksi),
        tarif_per_hari: latestDayTarif,
        is_terlambat: daysLate > 0,
      };
    }

    if (existingDenda.status === 'LUNAS') {
      const existingDays = daysLate > 0 ? daysLate : existingDenda.hari_terlambat ?? 0;
      return {
        hari_terlambat: existingDays,
        nominal_denda: Number(existingDenda.nominal || 0),
        tarif_per_hari: Number(existingDenda.tarif_per_hari || latestDayTarif),
        is_terlambat: existingDays > 0,
      };
    }
  }

  return {
    hari_terlambat: daysLate,
    nominal_denda: scheduleNominal,
    tarif_per_hari: latestDayTarif,
    is_terlambat: daysLate > 0,
  };
}

function buildExistingDendaSyncPatch({
  dendaRecord,
  dueDate,
  effectiveRefDate,
  tarifSchedule,
  isReturned,
  hasReturnDate,
  precomputedLateInfo = null,
}) {
  const lateInfo =
    precomputedLateInfo ||
    calculateLateInfo(dueDate, effectiveRefDate, dendaRecord, tarifSchedule, hasReturnDate);

  if ((!lateInfo.is_terlambat || lateInfo.hari_terlambat <= 0) && lateInfo.nominal_denda <= 0) {
    if (
      dendaRecord.status !== 'LUNAS' &&
      ((dendaRecord.hari_terlambat ?? 0) !== 0 || Number(dendaRecord.nominal ?? 0) !== 0)
    ) {
      return {
        hari_terlambat: 0,
        tarif_per_hari: lateInfo.tarif_per_hari,
        nominal: 0,
      };
    }
    return null;
  }

  const totalTerbayar = Number(dendaRecord.total_terbayar || 0);
  const expectedStatus = lateInfo.nominal_denda <= totalTerbayar ? 'LUNAS' : 'BELUM_LUNAS';

  // Jika buku sudah dikembalikan dan sudah dibayar lunas (tanpa sisa tagihan baru), lewati
  if (dendaRecord.status === 'LUNAS' && expectedStatus === 'LUNAS') {
    const currentDaysLunas = dendaRecord.hari_terlambat ?? 0;
    if (!isReturned && lateInfo.hari_terlambat !== currentDaysLunas) {
      return {
        hari_terlambat: lateInfo.hari_terlambat,
        tarif_per_hari: lateInfo.tarif_per_hari,
      };
    }
    return null;
  }

  const currentDays = dendaRecord.hari_terlambat ?? 0;
  const currentNominal = Number(dendaRecord.nominal ?? 0);
  const currentTarif = Number(dendaRecord.tarif_per_hari ?? 0);
  const currentStatus = dendaRecord.status;

  if (
    lateInfo.hari_terlambat !== currentDays ||
    lateInfo.nominal_denda !== currentNominal ||
    lateInfo.tarif_per_hari !== currentTarif ||
    expectedStatus !== currentStatus
  ) {
    return {
      hari_terlambat: lateInfo.hari_terlambat,
      tarif_per_hari: lateInfo.tarif_per_hari,
      nominal: lateInfo.nominal_denda,
      status: expectedStatus,
    };
  }

  return null;
}

async function syncExistingDendaWithVersionCheck({
  detailSnapshot,
  dendaSnapshot,
  initialPatch,
  dueDate,
  resolvedRefDate,
  tarifSchedule,
}) {
  return prisma.$transaction(async (tx) => {
    const attemptPatch = async (dendaState, detailState, patch) =>
      tx.denda.updateMany({
        where: {
          id_denda: dendaState.id_denda,
          hari_terlambat: dendaState.hari_terlambat,
          tarif_per_hari: dendaState.tarif_per_hari,
          nominal: dendaState.nominal,
          total_terbayar: dendaState.total_terbayar,
          status: dendaState.status,
          detail_peminjaman: {
            is: {
              status: detailState.status,
              tanggal_kembali: detailState.tanggal_kembali ?? null,
            },
          },
        },
        data: patch,
      });

    const firstAttempt = await attemptPatch(dendaSnapshot, detailSnapshot, initialPatch);
    if (firstAttempt?.count > 0) {
      return { updated: true, dateAdvanced: false };
    }

    // Denda atau detail pengembalian berubah secara konkuren: muat ulang keduanya sebelum menghitung ulang
    const freshDenda = await tx.denda.findUnique({
      where: { id_denda: dendaSnapshot.id_denda },
      include: {
        detail_peminjaman: {
          include: {
            peminjaman: true,
          },
        },
        koreksi_denda: {
          orderBy: { waktu: 'desc' },
        },
      },
    });
    if (!freshDenda) {
      return { updated: false, dateAdvanced: false };
    }

    const freshDetail = freshDenda.detail_peminjaman || detailSnapshot;
    const freshDueDate = freshDetail.peminjaman?.tanggal_jatuh_tempo ?? dueDate;
    if (!freshDueDate) {
      return { updated: false, dateAdvanced: false };
    }

    const freshIsReturned = freshDetail.status === 'KEMBALI';
    const freshHasReturnDate = Boolean(freshIsReturned && freshDetail.tanggal_kembali);
    if (freshIsReturned && !freshHasReturnDate) {
      return { updated: false, dateAdvanced: false };
    }

    let freshEffectiveRefDate;
    if (freshIsReturned) {
      // Pertahankan tanggal pengembalian buku sebagai tanggal referensi denda
      freshEffectiveRefDate = freshDetail.tanggal_kembali;
    } else {
      // Deteksi bila tanggal bisnis sudah berganti selama eksekusi sync: buang patch lama dan ulangi sync untuk tanggal terbaru
      const currentDate = await getCurrentSystemDate(tx);
      const runDayMs = localDateToUtcMidnightMs(resolvedRefDate);
      const currentDayMs = localDateToUtcMidnightMs(currentDate);
      if (runDayMs !== null && currentDayMs !== null && currentDayMs > runDayMs) {
        return { updated: false, dateAdvanced: true, currentDate };
      }
      freshEffectiveRefDate = resolvedRefDate;
    }

    const retryPatch = buildExistingDendaSyncPatch({
      dendaRecord: freshDenda,
      dueDate: freshDueDate,
      effectiveRefDate: freshEffectiveRefDate,
      tarifSchedule,
      isReturned: freshIsReturned,
      hasReturnDate: freshHasReturnDate,
    });
    if (!retryPatch) {
      return { updated: false, dateAdvanced: false };
    }

    const retryAttempt = await attemptPatch(freshDenda, freshDetail, retryPatch);
    return { updated: (retryAttempt?.count || 0) > 0, dateAdvanced: false };
  });
}

/**
 * Sinkronisasi otomatis denda harian ke database berdasarkan selisih hari kalender
 * dari tanggal jatuh tempo ke tanggal hari ini serta riwayat `log_konfigurasi`.
 */
export async function syncDendaHarian(referenceDate, rolloverDepth = 0) {
  const resolvedRefDate =
    referenceDate instanceof Date ? referenceDate : await getCurrentSystemDate(prisma);
  const tarifSchedule = await getTarifDendaSchedule(prisma);
  const activeTarifToday = resolveTarifForDayMs(
    localDateToUtcMidnightMs(resolvedRefDate),
    tarifSchedule
  );
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
          koreksi_denda: {
            orderBy: { waktu: 'desc' },
          },
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
    const effectiveRefDate = hasReturnDate ? detail.tanggal_kembali : resolvedRefDate;

    const lateInfo = calculateLateInfo(
      dueDate,
      effectiveRefDate,
      detail.denda,
      tarifSchedule,
      hasReturnDate
    );
    if ((!lateInfo.is_terlambat || lateInfo.hari_terlambat <= 0) && lateInfo.nominal_denda <= 0) {
      if (detail.denda) {
        const zeroPatch = buildExistingDendaSyncPatch({
          dendaRecord: detail.denda,
          dueDate,
          effectiveRefDate,
          tarifSchedule,
          isReturned,
          hasReturnDate,
          precomputedLateInfo: lateInfo,
        });
        if (zeroPatch) {
          const syncOutcome = await syncExistingDendaWithVersionCheck({
            detailSnapshot: detail,
            dendaSnapshot: detail.denda,
            initialPatch: zeroPatch,
            dueDate,
            resolvedRefDate,
            tarifSchedule,
          });
          if (syncOutcome.dateAdvanced) {
            if (rolloverDepth < 2) {
              return syncDendaHarian(syncOutcome.currentDate, rolloverDepth + 1);
            }
            return {
              date_key: lastSyncedDateKey,
              synced_at: resolvedRefDate.toISOString(),
              tarif_per_hari: activeTarifToday,
              updated_count: updatedCount,
            };
          }
          if (syncOutcome.updated) {
            updatedCount++;
          }
        }
      }
      continue;
    }

    if (
      lateInfo.is_terlambat &&
      lateInfo.hari_terlambat > 0 &&
      !isReturned &&
      detail.peminjaman &&
      detail.peminjaman.status !== 'TERLAMBAT' &&
      detail.peminjaman.status !== 'SELESAI'
    ) {
      await prisma.peminjaman.updateMany({
        where: {
          id_peminjaman: detail.id_peminjaman,
          OR: [
            { status: null },
            { status: { notIn: ['TERLAMBAT', 'SELESAI'] } },
          ],
          detail_peminjaman: {
            some: {
              id_detail: detail.id_detail,
              status: { not: 'KEMBALI' },
            },
          },
        },
        data: { status: 'TERLAMBAT' },
      });
    }

    if (!detail.denda) {
      await prisma.denda.create({
        data: {
          id_detail: detail.id_detail,
          hari_terlambat: lateInfo.hari_terlambat,
          tarif_per_hari: lateInfo.tarif_per_hari,
          nominal: lateInfo.nominal_denda,
          total_terbayar: 0,
          status: 'BELUM_LUNAS',
          dibuat_pada: resolvedRefDate,
        },
      });
      updatedCount++;
    } else {
      const existingPatch = buildExistingDendaSyncPatch({
        dendaRecord: detail.denda,
        dueDate,
        effectiveRefDate,
        tarifSchedule,
        isReturned,
        hasReturnDate,
        precomputedLateInfo: lateInfo,
      });
      if (existingPatch) {
        const syncOutcome = await syncExistingDendaWithVersionCheck({
          detailSnapshot: detail,
          dendaSnapshot: detail.denda,
          initialPatch: existingPatch,
          dueDate,
          resolvedRefDate,
          tarifSchedule,
        });
        if (syncOutcome.dateAdvanced) {
          if (rolloverDepth < 2) {
            return syncDendaHarian(syncOutcome.currentDate, rolloverDepth + 1);
          }
          return {
            date_key: lastSyncedDateKey,
            synced_at: resolvedRefDate.toISOString(),
            tarif_per_hari: activeTarifToday,
            updated_count: updatedCount,
          };
        }
        if (syncOutcome.updated) {
          updatedCount++;
        }
      }
    }
  }

  lastSyncedDateKey = getLocalDateKey(resolvedRefDate);

  return {
    date_key: lastSyncedDateKey,
    synced_at: resolvedRefDate.toISOString(),
    tarif_per_hari: activeTarifToday,
    updated_count: updatedCount,
  };
}

/**
 * Menghentikan penjadwal sinkronisasi denda aktif beserta timer yang menunggu.
 */
export function stopMidnightDendaScheduler() {
  activeSchedulerToken += 1;
  if (midnightTimer) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
}

/**
 * Menjadwalkan pembaruan denda otomatis berbasis tanggal yang belum diselesaikan.
 * Memeriksa tanggal saat startup maupun polling berkala via `getCurrentSystemDate`,
 * hanya menandai tanggal selesai setelah `syncDendaHarian` berhasil, serta mengulang
 * dengan exponential backoff apabila terjadi kegagalan.
 */
export function startMidnightDendaScheduler() {
  stopMidnightDendaScheduler();
  const schedulerToken = activeSchedulerToken;

  let isRunningSync = false;
  let consecutiveFailures = 0;

  const scheduleNext = (delayMs) => {
    if (schedulerToken !== activeSchedulerToken) return;
    midnightTimer = setTimeout(checkClock, delayMs);
    if (typeof midnightTimer.unref === 'function') {
      midnightTimer.unref();
    }
  };

  const checkClock = async () => {
    if (schedulerToken !== activeSchedulerToken) return;

    let nextDelayMs = BASE_POLL_INTERVAL_MS;

    if (!isRunningSync) {
      isRunningSync = true;
      try {
        const now = await getCurrentSystemDate(prisma);
        if (schedulerToken !== activeSchedulerToken) return;

        const currentDateKey = getLocalDateKey(now);
        if (currentDateKey !== lastSyncedDateKey) {
          const res = await syncDendaHarian(now);
          console.log(
            `🕛 [Denda Scheduler] Sinkronisasi denda selesai (${res.date_key}): ${res.updated_count} denda diperbarui.`
          );
        }
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures += 1;
        nextDelayMs = Math.min(
          MAX_RETRY_BACKOFF_MS,
          BASE_RETRY_BACKOFF_MS * 2 ** Math.min(consecutiveFailures, 10)
        );
        console.error('❌ [Denda Scheduler] Gagal sinkronisasi denda:', err.message);
      } finally {
        isRunningSync = false;
      }
    }

    scheduleNext(nextDelayMs);
  };

  scheduleNext(0);
}

function buildBuktiEndpointUrl(idPembayaran, rawPath) {
  if (!rawPath) return null;
  if (idPembayaran) {
    return `/api/pengembalian/pembayaran/${idPembayaran}/bukti`;
  }
  return rawPath;
}

function buildBuktiToken(payment) {
  if (!payment?.path_bukti) return null;
  const raw = `${payment.path_bukti}|${
    payment.waktu_unggah ? new Date(payment.waktu_unggah).toISOString() : ''
  }`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function normalizePaymentStatus(rawStatus) {
  if (!rawStatus) return 'MENUNGGU VERIFIKASI';
  return String(rawStatus).replace(/_/g, ' ');
}

function formatDetailPengembalian(
  detail,
  tarifPerHari,
  referenceDate = new Date(),
  useStoredDenda = false
) {
  const isReturned = detail.status === 'KEMBALI';
  const hasReturnDate = Boolean(isReturned && detail.tanggal_kembali);
  const effectiveRefDate = hasReturnDate ? detail.tanggal_kembali : referenceDate;
  const storedHariTerlambat = Number(detail.denda?.hari_terlambat ?? 0);
  const storedNominalDenda = Number(detail.denda?.nominal ?? 0);
  const storedTarifPerHari =
    detail.denda?.tarif_per_hari != null
      ? Number(detail.denda.tarif_per_hari)
      : DEFAULT_TARIF_DENDA;
  const lateInfo = useStoredDenda
    ? {
        hari_terlambat: storedHariTerlambat,
        nominal_denda: storedNominalDenda,
        tarif_per_hari: storedTarifPerHari,
        is_terlambat: storedHariTerlambat > 0 || storedNominalDenda > 0,
      }
    : calculateLateInfo(
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
    nominalDenda > totalTerbayar
      ? 'BELUM_LUNAS'
      : detail.denda?.status || (nominalDenda > 0 ? 'BELUM_LUNAS' : 'TIDAK_ADA');

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
        path_bukti: buildBuktiEndpointUrl(
          latestRincian.pembayaran.id_pembayaran,
          latestRincian.pembayaran.path_bukti
        ),
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
      lateInfo.tarif_per_hari != null
        ? Number(lateInfo.tarif_per_hari)
        : detail.denda?.tarif_per_hari != null
        ? Number(detail.denda.tarif_per_hari)
        : DEFAULT_TARIF_DENDA,
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
    const requester = req.pengguna;
    if (!requester?.id_pengguna) {
      return res.status(401).json({
        success: false,
        message: 'Silakan login terlebih dahulu.',
      });
    }

    const roleName = requester.role?.nama_role;
    const isLibrarian = roleName === ROLE.PUSTAKAWAN;
    const isMember = roleName === ROLE.ANGGOTA;
    if (!isLibrarian && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke fitur ini.',
      });
    }

    const statusParam = String(req.query.status || 'aktif').toLowerCase();
    const searchQuery = String(req.query.search || '').trim().toLowerCase();
    const requestedPengenal = String(req.query.pengenal_anggota || '').trim();

    if (!isLibrarian && requestedPengenal && requestedPengenal !== requester.pengenal) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk melihat data peminjaman anggota lain.',
      });
    }

    const effectivePengenalAnggota = isLibrarian ? requestedPengenal : requester.pengenal;
    if (!isLibrarian && !effectivePengenalAnggota) {
      return res.status(403).json({
        success: false,
        message: 'Identitas anggota tidak valid.',
      });
    }

    const whereClause = {};
    if (statusParam === 'aktif') {
      whereClause.status = { not: 'KEMBALI' };
    } else if (statusParam === 'selesai') {
      whereClause.status = 'KEMBALI';
    } else if (statusParam === 'denda') {
      whereClause.denda = { isNot: null };
    }

    if (effectivePengenalAnggota) {
      whereClause.peminjaman = {
        anggota: {
          pengenal: effectivePengenalAnggota,
        },
      };
    }

    const details = await prisma.detailPeminjaman.findMany({
      where: whereClause,
      include: detailInclude,
      orderBy: [
        { peminjaman: { tanggal_pinjam: 'desc' } },
        { id_detail: 'desc' },
      ],
    });

    let items = details.map((detail) =>
      formatDetailPengembalian(detail, null, new Date(), true)
    );

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

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
    requireAuthenticatedPustakawanId(req);
    const now = await getCurrentSystemDate(prisma);
    const syncResult = await syncDendaHarian(now);
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
    const resolvedPustakawanId = requireAuthenticatedPustakawanId(req);
    const { id_detail: rawIdDetail, kode: rawKode } = req.body || {};

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

      const now = await getCurrentSystemDate(tx);
      const todayUtc = toUtcDate(now);
      const tarifSchedule = await getTarifDendaSchedule(tx);
      const lateInfo = calculateLateInfo(
        targetDetail.peminjaman?.tanggal_jatuh_tempo,
        now,
        targetDetail.denda,
        tarifSchedule
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
                tarif_per_hari: lateInfo.tarif_per_hari,
                nominal: lateInfo.nominal_denda,
              },
            });
          }
        } else {
          await tx.denda.create({
            data: {
              id_detail: targetDetail.id_detail,
              hari_terlambat: lateInfo.hari_terlambat,
              tarif_per_hari: lateInfo.tarif_per_hari,
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
        item: formatDetailPengembalian(updatedDetail, tarifSchedule, now),
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
    const resolvedPustakawanId = requireAuthenticatedPustakawanId(req);
    const {
      id_denda: rawIdDenda,
      id_detail: rawIdDetail,
      nominal_baru: rawNominalBaru,
      alasan: rawAlasan,
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
      const tarifSchedule = await getTarifDendaSchedule(tx);
      const now = await getCurrentSystemDate(tx);
      let detail = null;
      let dendaRecord = null;
      let detailId = rawIdDetail ? Number(rawIdDetail) : null;

      if (rawIdDenda) {
        dendaRecord = await tx.denda.findUnique({
          where: { id_denda: Number(rawIdDenda) },
          include: { koreksi_denda: true },
        });
        if (dendaRecord) {
          detailId = dendaRecord.id_detail;
        }
      } else if (detailId) {
        dendaRecord = await tx.denda.findUnique({
          where: { id_detail: detailId },
          include: { koreksi_denda: true },
        });
      }

      if (!dendaRecord && detailId) {
        detail = await tx.detailPeminjaman.findUnique({
          where: { id_detail: detailId },
          include: { peminjaman: true },
        });
        if (!detail) {
          throw createHttpError(404, 'Data detail peminjaman tidak ditemukan.');
        }
      }

      if (!dendaRecord && !detail) {
        throw createHttpError(404, 'Data denda tidak ditemukan.');
      }

      if (dendaRecord?.status === 'LUNAS') {
        throw createHttpError(400, 'Denda yang sudah berstatus LUNAS tidak dapat dikoreksi.');
      }

      if (!detail && dendaRecord?.id_detail) {
        detail = await tx.detailPeminjaman.findUnique({
          where: { id_detail: dendaRecord.id_detail },
          include: { peminjaman: true },
        });
      }

      const isReturned = detail?.status === 'KEMBALI';
      const hasReturnDate = Boolean(isReturned && detail?.tanggal_kembali);
      const effectiveRefDate = hasReturnDate ? detail.tanggal_kembali : now;
      const dendaForReconcile = dendaRecord
        ? {
            ...dendaRecord,
            koreksi_denda: Array.isArray(dendaRecord.koreksi_denda)
              ? dendaRecord.koreksi_denda
              : [],
          }
        : null;
      const lateInfo = detail
        ? calculateLateInfo(
            detail.peminjaman?.tanggal_jatuh_tempo,
            effectiveRefDate,
            dendaForReconcile,
            tarifSchedule,
            hasReturnDate
          )
        : null;

      if (!dendaRecord && detail) {
        dendaRecord = await tx.denda.create({
          data: {
            id_detail: detail.id_detail,
            hari_terlambat: lateInfo.hari_terlambat,
            tarif_per_hari: lateInfo.tarif_per_hari,
            nominal: lateInfo.nominal_denda,
            total_terbayar: 0,
            status: 'BELUM_LUNAS',
            dibuat_pada: now,
          },
        });
      }

      const nominalLama = lateInfo
        ? lateInfo.nominal_denda
        : Number(dendaRecord.nominal || 0);
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
          ...(lateInfo
            ? {
                hari_terlambat: lateInfo.hari_terlambat,
                tarif_per_hari: lateInfo.tarif_per_hari,
              }
            : {}),
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
        item: formatDetailPengembalian(updatedDetail, tarifSchedule, now),
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
 * POST /api/pengembalian/denda/koreksi-massal
 * Melakukan koreksi denda secara massal dengan operator penambahan ('TAMBAH' / '+')
 * atau pengurangan ('KURANG' / '-') berdasarkan target status pengembalian buku:
 * - 'BELUM_KEMBALI': hanya buku yang belum dikembalikan dan memiliki denda belum lunas
 * - 'SUDAH_KEMBALI': hanya buku yang sudah dikembalikan tetapi dendanya belum lunas
 * - 'SEMUA': keduanya (seluruh tagihan denda yang belum lunas)
 * Buku yang sudah dikembalikan dan dendanya sudah LUNAS tidak diubah.
 */
export const koreksiDendaMassal = async (req, res, next) => {
  try {
    const resolvedPustakawanId = requireAuthenticatedPustakawanId(req);
    const {
      operator: rawOperator,
      nilai_koreksi: rawNilaiKoreksi,
      target_status_buku: rawTargetStatus,
      alasan: rawAlasan,
    } = req.body || {};

    const normalizedOp = String(rawOperator || '')
      .trim()
      .toUpperCase();
    const isTambah = normalizedOp === 'TAMBAH' || normalizedOp === '+' || normalizedOp === 'PLUS';
    const isKurang = normalizedOp === 'KURANG' || normalizedOp === '-' || normalizedOp === 'MINUS';
    const isLunasiSemua =
      normalizedOp === 'LUNASI_SEMUA' ||
      normalizedOp === 'LUNAS_SEMUA' ||
      normalizedOp === 'LUNAS';

    if (!isTambah && !isKurang && !isLunasiSemua) {
      return res.status(400).json({
        success: false,
        message:
          'Operator koreksi massal harus berupa penambahan (TAMBAH), pengurangan (KURANG), atau pelunasan (LUNASI_SEMUA).',
      });
    }

    const nilaiKoreksi = isLunasiSemua ? 0 : Number(rawNilaiKoreksi);
    if (!isLunasiSemua && (!Number.isFinite(nilaiKoreksi) || nilaiKoreksi <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Nilai koreksi denda massal harus berupa angka lebih dari 0.',
      });
    }

    const targetStatus = String(rawTargetStatus || 'SEMUA')
      .trim()
      .toUpperCase();
    if (!['BELUM_KEMBALI', 'SUDAH_KEMBALI', 'SEMUA'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message:
          'Target sasaran buku harus berupa BELUM_KEMBALI, SUDAH_KEMBALI, atau SEMUA.',
      });
    }

    const alasan = typeof rawAlasan === 'string' ? rawAlasan.trim() : '';
    if (!alasan) {
      return res.status(400).json({
        success: false,
        message: 'Alasan koreksi denda massal wajib diisi.',
      });
    }

    const now = await getCurrentSystemDate(prisma);

    const result = await prisma.$transaction(async (tx) => {
      const tarifSchedule = await getTarifDendaSchedule(tx);
      const whereClause = {};

      if (targetStatus === 'BELUM_KEMBALI') {
        whereClause.status = { not: 'KEMBALI' };
      } else if (targetStatus === 'SUDAH_KEMBALI') {
        whereClause.status = 'KEMBALI';
      }

      const candidateDetails = await tx.detailPeminjaman.findMany({
        where: whereClause,
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
      const updatedIds = [];

      for (const detail of candidateDetails) {
        // Jangan ubah buku yang dendanya sudah berstatus LUNAS
        if (detail.denda?.status === 'LUNAS') {
          continue;
        }

        const isReturned = detail.status === 'KEMBALI';
        const hasReturnDate = Boolean(isReturned && detail.tanggal_kembali);
        const effectiveRefDate = hasReturnDate ? detail.tanggal_kembali : now;

        const lateInfo = calculateLateInfo(
          detail.peminjaman?.tanggal_jatuh_tempo,
          effectiveRefDate,
          detail.denda,
          tarifSchedule,
          hasReturnDate
        );

        const hasOverdueOrDenda =
          Boolean(detail.denda) || lateInfo.hari_terlambat > 0 || lateInfo.nominal_denda > 0;
        if (!hasOverdueOrDenda) {
          continue;
        }

        let dendaRecord = detail.denda;
        if (!dendaRecord) {
          if (lateInfo.hari_terlambat <= 0 && lateInfo.nominal_denda <= 0) {
            continue;
          }
          dendaRecord = await tx.denda.create({
            data: {
              id_detail: detail.id_detail,
              hari_terlambat: lateInfo.hari_terlambat,
              tarif_per_hari: lateInfo.tarif_per_hari,
              nominal: lateInfo.nominal_denda,
              total_terbayar: 0,
              status: 'BELUM_LUNAS',
              dibuat_pada: now,
            },
          });
        }

        const nominalLama = Number(lateInfo.nominal_denda ?? dendaRecord.nominal ?? 0);
        // Jika denda saat ini sudah 0 dan operator adalah KURANG, lewati karena tidak bisa dikurangi lagi
        if (isKurang && nominalLama <= 0) {
          continue;
        }

        const nominalBaru = isLunasiSemua
          ? 0
          : isTambah
          ? nominalLama + nilaiKoreksi
          : Math.max(0, nominalLama - nilaiKoreksi);

        const totalTerbayar = Number(dendaRecord.total_terbayar || 0);
        // Jika LUNASI_SEMUA dipilih, atau buku sudah kembali dan nominal baru <= total terbayar, tandai LUNAS
        const newStatus =
          isLunasiSemua ||
          (isReturned && nominalBaru <= totalTerbayar) ||
          (totalTerbayar > 0 && nominalBaru <= totalTerbayar)
            ? 'LUNAS'
            : 'BELUM_LUNAS';

        await tx.koreksiDenda.create({
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
            hari_terlambat: lateInfo.hari_terlambat,
            tarif_per_hari: lateInfo.tarif_per_hari,
            nominal: nominalBaru,
            status: newStatus,
          },
        });

        updatedCount++;
        updatedIds.push(detail.id_detail);
      }

      return {
        updated_count: updatedCount,
        updated_detail_ids: updatedIds,
        operator: isLunasiSemua ? 'LUNASI_SEMUA' : isTambah ? 'TAMBAH' : 'KURANG',
        nilai_koreksi: nilaiKoreksi,
        target_status_buku: targetStatus,
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
    const requester = req.pengguna;
    const requesterId = requester?.id_pengguna;
    if (!requesterId) {
      return res.status(401).json({
        success: false,
        message: 'Silakan login terlebih dahulu.',
      });
    }
    const isLibrarian = requester?.role?.nama_role === ROLE.PUSTAKAWAN;

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
    const writtenFilePaths = [];
    let previousFileToDelete = null;
    let result;

    try {
      result = await prisma.$transaction(async (tx) => {
        previousFileToDelete = null;
        const tarifSchedule = await getTarifDendaSchedule(tx);
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
          const detailOwnerId = detail.peminjaman?.id_anggota;
          if (!isLibrarian && (!detailOwnerId || detailOwnerId !== requesterId)) {
            throw createHttpError(
              403,
              'Anda tidak memiliki akses untuk mengunggah bukti pembayaran tagihan denda ini.'
            );
          }
          if (detail.status !== 'KEMBALI') {
            throw createHttpError(
              400,
              'Pembayaran denda hanya dapat dilakukan setelah buku dikembalikan.'
            );
          }
          const lateInfo = calculateLateInfo(
            detail.peminjaman?.tanggal_jatuh_tempo,
            detail.tanggal_kembali || now,
            null,
            tarifSchedule,
            Boolean(detail.tanggal_kembali)
          );
          if (lateInfo.nominal_denda <= 0) {
            throw createHttpError(400, 'Peminjaman ini tidak memiliki tagihan denda.');
          }
          dendaRecord = await tx.denda.create({
            data: {
              id_detail: detail.id_detail,
              hari_terlambat: lateInfo.hari_terlambat,
              tarif_per_hari: lateInfo.tarif_per_hari,
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

      const loanOwnerId = dendaRecord.detail_peminjaman?.peminjaman?.id_anggota;
      if (!isLibrarian && (!loanOwnerId || loanOwnerId !== requesterId)) {
        throw createHttpError(
          403,
          'Anda tidak memiliki akses untuk mengunggah bukti pembayaran tagihan denda ini.'
        );
      }

      if (
        dendaRecord.detail_peminjaman?.status &&
        dendaRecord.detail_peminjaman.status !== 'KEMBALI'
      ) {
        throw createHttpError(
          400,
          'Pembayaran denda hanya dapat dilakukan setelah buku dikembalikan.'
        );
      }

      if (dendaRecord.status === 'LUNAS') {
        throw createHttpError(400, 'Tagihan denda ini sudah berstatus LUNAS.');
      }

      let resolvedAnggotaId = isLibrarian
        ? loanOwnerId || (rawIdAnggota ? Number(rawIdAnggota) : null)
        : loanOwnerId;

      if (
        isLibrarian &&
        !resolvedAnggotaId &&
        typeof pengenal_anggota === 'string' &&
        pengenal_anggota.trim()
      ) {
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
      const hasRequestedPaymentId =
        rawIdPembayaran !== undefined && rawIdPembayaran !== null && rawIdPembayaran !== '';

      let existingRincian = null;
      if (hasRequestedPaymentId) {
        const requestedPaymentId = Number(rawIdPembayaran);
        if (!Number.isInteger(requestedPaymentId) || requestedPaymentId <= 0) {
          throw createHttpError(400, 'ID pembayaran tidak valid.');
        }

        const matchedRincian = rincianList.find(
          (r) =>
            (!r.id_denda || r.id_denda === dendaRecord.id_denda) &&
            (r.id_pembayaran === requestedPaymentId ||
              r.pembayaran?.id_pembayaran === requestedPaymentId)
        );
        if (
          !matchedRincian?.pembayaran ||
          matchedRincian.pembayaran.status === 'TERVERIFIKASI'
        ) {
          throw createHttpError(
            400,
            'Pembayaran yang dipilih tidak tersedia untuk diperbarui pada tagihan denda ini.'
          );
        }
        existingRincian = matchedRincian;
      } else {
        existingRincian = rincianList.find(
          (r) =>
            (!r.id_denda || r.id_denda === dendaRecord.id_denda) &&
            r.pembayaran &&
            r.pembayaran.status !== 'TERVERIFIKASI'
        );
      }

      const existingPembayaran = existingRincian?.pembayaran || null;

      const MAX_STAGE_ATTEMPTS = 5;
      let fileName = '';
      for (let attempt = 0; attempt < MAX_STAGE_ATTEMPTS; attempt++) {
        const uniqueSuffix = `${Date.now()}${crypto.randomInt(1000, 10000)}`;
        const candidateName = `bukti-denda-${resolvedAnggotaId}-${dendaRecord.id_denda}-${uniqueSuffix}.webp`;
        const candidatePath = path.join(DENDA_UPLOAD_DIR, candidateName);
        try {
          await fs.writeFile(candidatePath, webpBuffer, { flag: 'wx' });
          fileName = candidateName;
          writtenFilePaths.push(candidatePath);
          break;
        } catch (writeErr) {
          if (writeErr?.code === 'EEXIST' && attempt < MAX_STAGE_ATTEMPTS - 1) {
            continue;
          }
          throw writeErr;
        }
      }

      const storedBuktiPath = `denda/${fileName}`;

      if (existingPembayaran) {
        // Jadwalkan penghapusan file bukti lama HANYA setelah commit transaksi DB berhasil
        if (existingPembayaran.path_bukti) {
          const oldFileName = path.basename(existingPembayaran.path_bukti);
          if (
            oldFileName &&
            oldFileName !== fileName &&
            oldFileName !== '.gitkeep' &&
            oldFileName !== '.gitignore'
          ) {
            previousFileToDelete = path.join(DENDA_UPLOAD_DIR, oldFileName);
          }
        }

        // Update record pembayaran_denda hanya jika status layak yang terbaca (termasuk null) serta path_bukti & waktu_unggah belum berubah
        const observedStatus = existingPembayaran.status ?? null;
        if (observedStatus === 'TERVERIFIKASI') {
          throw createHttpError(
            409,
            'Data pembayaran telah berubah (mungkin sudah diverifikasi atau bukti telah diganti). Muat ulang halaman dan coba lagi.'
          );
        }
        const replacementStatus = 'MENUNGGU VERIFIKASI';
        const updateResult = await tx.pembayaranDenda.updateMany({
          where: {
            id_pembayaran: existingPembayaran.id_pembayaran,
            status: observedStatus,
            path_bukti: existingPembayaran.path_bukti ?? null,
            waktu_unggah: existingPembayaran.waktu_unggah ?? null,
          },
          data: {
            nominal_bayar: nominalBayar,
            path_bukti: storedBuktiPath,
            tipe_berkas: 'image/webp',
            status: replacementStatus,
            alasan_penolakan: null,
            id_pemverifikasi: null,
            waktu_unggah: now,
            waktu_verifikasi: null,
          },
        });

        if (!updateResult || updateResult.count === 0) {
          throw createHttpError(
            409,
            'Data pembayaran telah berubah (mungkin sudah diverifikasi atau bukti telah diganti). Muat ulang halaman dan coba lagi.'
          );
        }

        if (existingRincian?.id_rincian && tx.rincianPembayaran.update) {
          await tx.rincianPembayaran.update({
            where: { id_rincian: existingRincian.id_rincian },
            data: { nominal_dialokasikan: nominalBayar },
          });
        }

        return {
          id_pembayaran: existingPembayaran.id_pembayaran,
          id_denda: dendaRecord.id_denda,
          id_anggota: resolvedAnggotaId,
          nominal_bayar: nominalBayar,
          path_bukti: buildBuktiEndpointUrl(existingPembayaran.id_pembayaran, storedBuktiPath),
          tipe_berkas: 'image/webp',
          ukuran_bytes: webpBuffer.length,
          status: replacementStatus,
          waktu_unggah: now.toISOString(),
          is_updated: true,
        };
      }

      const createdPembayaran = await tx.pembayaranDenda.create({
        data: {
          id_anggota: resolvedAnggotaId,
          id_pemverifikasi: null,
          nominal_bayar: nominalBayar,
          path_bukti: storedBuktiPath,
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
        path_bukti: buildBuktiEndpointUrl(createdPembayaran.id_pembayaran, storedBuktiPath),
        tipe_berkas: 'image/webp',
        ukuran_bytes: webpBuffer.length,
        status: createdPembayaran.status,
        waktu_unggah: now.toISOString(),
        is_updated: false,
      };
      });
    } catch (txError) {
      await Promise.all(writtenFilePaths.map((filePath) => fs.unlink(filePath).catch(() => {})));
      throw txError;
    }

    if (previousFileToDelete) {
      await fs.unlink(previousFileToDelete).catch(() => {});
    }

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
      path_bukti: buildBuktiEndpointUrl(p.id_pembayaran, p.path_bukti),
      bukti_token: buildBuktiToken(p),
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
 * GET /api/pengembalian/pembayaran/:id_pembayaran/bukti
 * Mengembalikan berkas gambar bukti pembayaran denda hanya kepada pemilik denda atau pustakawan.
 */
export const getBuktiPembayaranDenda = async (req, res, next) => {
  try {
    const idPembayaran = Number(req.params.id_pembayaran);
    if (!Number.isInteger(idPembayaran) || idPembayaran <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Parameter id_pembayaran tidak valid.',
      });
    }

    const payment = await prisma.pembayaranDenda.findUnique({
      where: { id_pembayaran: idPembayaran },
      include: {
        rincian_pembayaran: {
          include: {
            denda: {
              include: {
                detail_peminjaman: {
                  include: {
                    peminjaman: {
                      select: { id_anggota: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment || !payment.path_bukti) {
      return res.status(404).json({
        success: false,
        message: 'Berkas bukti pembayaran tidak ditemukan.',
      });
    }

    const requester = req.pengguna;
    const isLibrarian = requester?.role?.nama_role === ROLE.PUSTAKAWAN;
    const requesterId = requester?.id_pengguna;
    const isOwner =
      Boolean(requesterId) &&
      (payment.id_anggota === requesterId ||
        (Array.isArray(payment.rincian_pembayaran) &&
          payment.rincian_pembayaran.some(
            (r) => r.denda?.detail_peminjaman?.peminjaman?.id_anggota === requesterId
          )));

    if (!isLibrarian && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk melihat bukti pembayaran ini.',
      });
    }

    const fileName = path.basename(String(payment.path_bukti));
    if (
      !fileName ||
      fileName === '.' ||
      fileName === '..' ||
      fileName === '.gitkeep' ||
      fileName === '.gitignore'
    ) {
      return res.status(404).json({
        success: false,
        message: 'Berkas bukti pembayaran tidak ditemukan.',
      });
    }

    const resolvedPath = path.resolve(DENDA_UPLOAD_DIR, fileName);
    const relativePath = path.relative(DENDA_UPLOAD_DIR, resolvedPath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return res.status(404).json({
        success: false,
        message: 'Berkas bukti pembayaran tidak ditemukan.',
      });
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Berkas bukti pembayaran tidak ditemukan di server.',
      });
    }

    res.set('Cache-Control', 'private, no-store');
    res.type(payment.tipe_berkas || 'image/webp');
    return res.sendFile(resolvedPath);
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
    const resolvedPustakawanId = requireAuthenticatedPustakawanId(req);
    const idPembayaran = Number(req.params.id_pembayaran);
    const {
      status: rawStatus,
      alasan_penolakan: rawAlasan,
      reviewed_bukti_token: rawReviewedToken,
      reviewed_waktu_unggah: rawReviewedWaktu,
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

    const reviewedToken = typeof rawReviewedToken === 'string' ? rawReviewedToken.trim() : '';
    const reviewedWaktuStr = typeof rawReviewedWaktu === 'string' ? rawReviewedWaktu.trim() : '';

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

      const isPending =
        payment.status === 'MENUNGGU VERIFIKASI' || payment.status === 'MENUNGGU_VERIFIKASI';
      if (!isPending) {
        throw createHttpError(
          409,
          'Status pembayaran sudah berubah dan tidak lagi menunggu verifikasi.'
        );
      }

      const expectedToken = buildBuktiToken(payment);
      if (!reviewedToken && !reviewedWaktuStr) {
        throw createHttpError(400, 'Identitas bukti pembayaran yang ditinjau wajib disertakan.');
      }

      if (expectedToken && !reviewedToken) {
        throw createHttpError(400, 'Token bukti pembayaran yang ditinjau wajib disertakan.');
      }

      if (expectedToken && reviewedToken !== expectedToken) {
        throw createHttpError(
          409,
          'Bukti pembayaran telah diganti sejak terakhir ditinjau. Muat ulang dan periksa bukti terbaru.'
        );
      }

      if (reviewedWaktuStr) {
        const reviewedWaktuMs = new Date(reviewedWaktuStr).getTime();
        const currentWaktuMs = payment.waktu_unggah
          ? new Date(payment.waktu_unggah).getTime()
          : null;
        if (
          Number.isNaN(reviewedWaktuMs) ||
          currentWaktuMs === null ||
          reviewedWaktuMs !== currentWaktuMs
        ) {
          throw createHttpError(
            409,
            'Bukti pembayaran telah diganti sejak terakhir ditinjau. Muat ulang dan periksa bukti terbaru.'
          );
        }
      }

      const updateResult = await tx.pembayaranDenda.updateMany({
        where: {
          id_pembayaran: idPembayaran,
          status: { in: ['MENUNGGU VERIFIKASI', 'MENUNGGU_VERIFIKASI'] },
          ...(payment.path_bukti !== undefined ? { path_bukti: payment.path_bukti } : {}),
          ...(payment.waktu_unggah !== undefined ? { waktu_unggah: payment.waktu_unggah } : {}),
        },
        data: {
          status: decision,
          id_pemverifikasi: resolvedPustakawanId,
          alasan_penolakan: decision === 'DITOLAK' ? alasanPenolakan : null,
          waktu_verifikasi: now,
        },
      });

      if (!updateResult || updateResult.count === 0) {
        throw createHttpError(
          409,
          'Bukti pembayaran telah diperbarui atau statusnya sudah berubah. Muat ulang dan tinjau kembali.'
        );
      }

      if (decision === 'TERVERIFIKASI' && Array.isArray(payment.rincian_pembayaran)) {
        for (const rincian of payment.rincian_pembayaran) {
          if (!rincian.denda) continue;
          const prevPaid = Number(rincian.denda.total_terbayar || 0);
          const allocated = Number(
            rincian.nominal_dialokasikan ?? payment.nominal_bayar ?? 0
          );
          const newTotalPaid = prevPaid + allocated;
          const targetNominal = Number(rincian.denda.nominal || 0);

          const dendaUpdateResult = await tx.denda.updateMany({
            where: {
              id_denda: rincian.id_denda,
              nominal: rincian.denda.nominal,
              total_terbayar: rincian.denda.total_terbayar,
            },
            data: {
              total_terbayar: newTotalPaid,
              status: newTotalPaid >= targetNominal ? 'LUNAS' : 'BELUM_LUNAS',
            },
          });

          if (!dendaUpdateResult || dendaUpdateResult.count === 0) {
            throw createHttpError(
              409,
              'Nominal atau total pembayaran denda telah berubah secara bersamaan. Muat ulang dan coba verifikasi kembali.'
            );
          }
        }
      }

      return {
        id_pembayaran: idPembayaran,
        status: decision,
        alasan_penolakan: decision === 'DITOLAK' ? alasanPenolakan : null,
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
