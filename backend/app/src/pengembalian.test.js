import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DENDA_DIR = path.resolve(__dirname, '../public/denda');

const createdFiles = [];

const mockPrisma = vi.hoisted(() => ({
  konfigurasiSistem: {
    findUnique: vi.fn(),
  },
  logKonfigurasi: {
    findMany: vi.fn(),
  },
  detailPeminjaman: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  eksemplar: {
    update: vi.fn(),
  },
  denda: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  koreksiDenda: {
    create: vi.fn(),
  },
  pembayaranDenda: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  rincianPembayaran: {
    create: vi.fn(),
    update: vi.fn(),
  },
  peminjaman: {
    update: vi.fn(),
  },
  pengguna: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('./lib/prisma.js', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}));

import app from './app.js';
import {
  countOverdueDaysDifference,
  resolveTarifForDayMs,
  startMidnightDendaScheduler,
} from './controllers/pengembalian.controller.js';

function createValidWebpDataUrl(payloadSize = 64) {
  const buf = Buffer.alloc(Math.max(16, payloadSize));
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

describe('Pengembalian & Denda API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.konfigurasiSistem.findUnique.mockResolvedValue({
      id_konfigurasi: 2,
      kunci_parameter: 'tarif_denda_per_hari',
      nilai: '1000',
    });
    mockPrisma.logKonfigurasi.findMany.mockResolvedValue([]);
    mockPrisma.detailPeminjaman.findMany.mockResolvedValue([]);
    mockPrisma.pembayaranDenda.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
  });

  afterEach(async () => {
    while (createdFiles.length > 0) {
      const filePath = createdFiles.pop();
      await fs.unlink(filePath).catch(() => {});
    }
  });

  it('GET /api/pengembalian returns active loans formatted from database', async () => {
    const now = new Date();
    const duePast = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 3));
    const pinjamPast = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 10));
    const expectedOverdueDays = countOverdueDaysDifference(duePast, now);
    const expectedDenda = expectedOverdueDays * 1000;

    mockPrisma.detailPeminjaman.findMany.mockResolvedValue([
      {
        id_detail: 11,
        id_peminjaman: 1,
        id_eksemplar: 101,
        tanggal_kembali: null,
        status: 'DIPINJAM',
        peminjaman: {
          nomor_transaksi: 'TRX-202611-101',
          jalur: 'MANDIRI',
          tanggal_pinjam: pinjamPast,
          tanggal_jatuh_tempo: duePast,
          status: 'TERLAMBAT',
          anggota: {
            id_pengguna: 3,
            pengenal: '2211521001',
            nama: 'Ahmad Fauzan',
          },
        },
        eksemplar: {
          kode_eksemplar: 'EKS-001-A',
          lokasi_rak: 'RAK-KOM-01',
          koleksi: {
            id_koleksi: 1,
            kode_koleksi: 'KOL-001',
            judul: 'Clean Code',
          },
        },
        denda: {
          id_denda: 5,
          hari_terlambat: expectedOverdueDays,
          tarif_per_hari: '1000.00',
          nominal: `${expectedDenda}.00`,
          total_terbayar: '0.00',
          status: 'BELUM_LUNAS',
          koreksi_denda: [],
          rincian_pembayaran: [],
        },
      },
    ]);

    const response = await request(app).get('/api/pengembalian');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        id_detail: 11,
        id_peminjaman: 1,
        id_denda: 5,
        nomor_transaksi: 'TRX-202611-101',
        kode_eksemplar: 'EKS-001-A',
        judul: 'Clean Code',
        status: 'TERLAMBAT',
        hari_terlambat: expectedOverdueDays,
        denda: expectedDenda,
        status_denda: 'BELUM_LUNAS',
      })
    );
  });

  it('POST /api/pengembalian/sync-denda calculates exact date difference excluding Sundays across days and variable month lengths', async () => {
    // 1. Uji perhitungan selisih tanggal dengan mengecualikan hari Minggu:
    // 20 Nov 2026 (Jumat) -> 22 Nov 2026 (Minggu) = 1 hari kerja (Sabtu 21 Nov; Minggu 22 Nov tidak dihitung)
    expect(countOverdueDaysDifference('2026-11-20', '2026-11-22')).toBe(1);
    // 20 Nov 2026 (Jumat) -> 1 Des 2026 (Selasa) = 11 hari kalender dikurangi 2 hari Minggu (22 & 29 Nov) = 9 hari
    expect(countOverdueDaysDifference('2026-11-20', '2026-12-01')).toBe(9);
    // Februari non-kabisat (28 hari): 25 Feb 2026 -> 2 Mar 2026 = 5 hari kalender dikurangi 1 Minggu (1 Mar) = 4 hari
    expect(countOverdueDaysDifference('2026-02-25', '2026-03-02')).toBe(4);
    // Februari kabisat (29 hari): 25 Feb 2028 -> 2 Mar 2028 = 6 hari kalender dikurangi 1 Minggu (27 Feb) = 5 hari
    expect(countOverdueDaysDifference('2028-02-25', '2028-03-02')).toBe(5);

    // 1b. Uji jadwal tarif dari log_konfigurasi (id_konfigurasi = 2): nilai baru baru berlaku di keesokan harinya
    const sampleSchedule = {
      currentTarif: 2000,
      logs: [
        {
          id_log: 1,
          waktu_ms: Date.UTC(2026, 10, 24, 7, 0, 0),
          log_date_ms: Date.UTC(2026, 10, 24),
          effective_date_ms: Date.UTC(2026, 10, 25), // Baru berlaku keesokan harinya (25 Nov 2026)
          nilai_lama: 1000,
          nilai_baru: 2000,
        },
      ],
    };
    // Pada tanggal 23 Nov dan 24 Nov (hari saat log dibuat), tarif masih 1000
    expect(resolveTarifForDayMs(Date.UTC(2026, 10, 23), sampleSchedule)).toBe(1000);
    expect(resolveTarifForDayMs(Date.UTC(2026, 10, 24), sampleSchedule)).toBe(1000);
    // Mulai keesokan harinya (25 Nov), tarif menjadi 2000
    expect(resolveTarifForDayMs(Date.UTC(2026, 10, 25), sampleSchedule)).toBe(2000);

    const now = new Date();
    const duePast = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 8)
    );
    const yesterdayLogTime = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 0, 0)
    );
    const expectedOverdueDays = countOverdueDaysDifference(duePast, now);
    const newTarifPerHari = 2000;
    const isTodaySunday =
      new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).getUTCDay() === 0;
    const expectedRecalculatedNominal = isTodaySunday
      ? expectedOverdueDays * 1000
      : (expectedOverdueDays - 1) * 1000 + 2000;

    mockPrisma.konfigurasiSistem.findUnique.mockResolvedValueOnce({
      id_konfigurasi: 2,
      kunci_parameter: 'tarif_denda_per_hari',
      nilai: String(newTarifPerHari),
    });
    mockPrisma.logKonfigurasi.findMany.mockResolvedValueOnce([
      {
        id_log: 2,
        id_konfigurasi: 2,
        nilai_lama: '1000',
        nilai_baru: '2000',
        waktu: yesterdayLogTime,
      },
    ]);
    mockPrisma.detailPeminjaman.findMany.mockResolvedValue([
      {
        id_detail: 15,
        id_peminjaman: 3,
        status: 'DIPINJAM',
        peminjaman: {
          id_peminjaman: 3,
          tanggal_jatuh_tempo: duePast,
          status: 'TERLAMBAT',
        },
        denda: {
          id_denda: 9,
          hari_terlambat: 2,
          tarif_per_hari: '1000.00',
          nominal: '2000.00',
          total_terbayar: '0.00',
          status: 'BELUM_LUNAS',
          koreksi_denda: [],
        },
      },
    ]);

    const response = await request(app).post('/api/pengembalian/sync-denda');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockPrisma.denda.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_denda: 9 },
        data: expect.objectContaining({
          hari_terlambat: expectedOverdueDays,
          nominal: expectedRecalculatedNominal,
        }),
      })
    );
  });

  it('POST /api/pengembalian/proses processes return by id_detail and closes loan when last item returned', async () => {
    const pinjamDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const dueDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

    const activeDetail = {
      id_detail: 22,
      id_peminjaman: 2,
      id_eksemplar: 102,
      tanggal_kembali: null,
      status: 'DIPINJAM',
      peminjaman: {
        nomor_transaksi: 'TRX-202611-109',
        jalur: 'MANDIRI',
        tanggal_pinjam: pinjamDate,
        tanggal_jatuh_tempo: dueDate,
        status: 'SEDANG_DIPINJAM',
        anggota: {
          id_pengguna: 9,
          pengenal: '2211521009',
          nama: 'Kevin Mahendra',
        },
      },
      eksemplar: {
        kode_eksemplar: 'EKS-001-C',
        lokasi_rak: 'RAK-KOM-01',
        koleksi: {
          id_koleksi: 1,
          kode_koleksi: 'KOL-001',
          judul: 'Clean Code',
        },
      },
      denda: null,
    };

    const returnedDetail = {
      ...activeDetail,
      status: 'KEMBALI',
      tanggal_kembali: new Date(),
    };

    mockPrisma.detailPeminjaman.findUnique
      .mockResolvedValueOnce(activeDetail)
      .mockResolvedValueOnce(returnedDetail);
    mockPrisma.pengguna.findUnique.mockResolvedValue({ id_pengguna: 2 });
    mockPrisma.detailPeminjaman.count.mockResolvedValue(0);

    const response = await request(app)
      .post('/api/pengembalian/proses')
      .send({ id_detail: 22, pengenal_pustakawan: '198805122014042001' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.item).toEqual(
      expect.objectContaining({
        id_detail: 22,
        status: 'SELESAI',
        status_detail: 'KEMBALI',
        denda: 0,
      })
    );
  });

  it('POST /api/pengembalian/denda/koreksi records fine correction and updates denda nominal', async () => {
    const duePast = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mockPrisma.denda.findUnique.mockResolvedValue({
      id_denda: 7,
      id_detail: 11,
      hari_terlambat: 5,
      nominal: '5000.00',
      total_terbayar: '0.00',
      status: 'BELUM_LUNAS',
    });
    mockPrisma.pengguna.findUnique.mockResolvedValue({ id_pengguna: 2 });
    mockPrisma.koreksiDenda.create.mockResolvedValue({
      id_koreksi: 1,
      id_denda: 7,
      nominal_lama: 5000,
      nominal_baru: 2000,
      alasan: 'Hari libur fakultas',
    });
    mockPrisma.detailPeminjaman.findUnique.mockResolvedValue({
      id_detail: 11,
      id_peminjaman: 1,
      id_eksemplar: 101,
      status: 'DIPINJAM',
      peminjaman: {
        nomor_transaksi: 'TRX-202611-101',
        tanggal_jatuh_tempo: duePast,
        status: 'TERLAMBAT',
        anggota: { id_pengguna: 3, pengenal: '2211521001', nama: 'Ahmad Fauzan' },
      },
      eksemplar: {
        kode_eksemplar: 'EKS-001-A',
        lokasi_rak: 'RAK-KOM-01',
        koleksi: { id_koleksi: 1, kode_koleksi: 'KOL-001', judul: 'Clean Code' },
      },
      denda: {
        id_denda: 7,
        hari_terlambat: 5,
        tarif_per_hari: '1000.00',
        nominal: '2000.00',
        total_terbayar: '0.00',
        status: 'BELUM_LUNAS',
        koreksi_denda: [],
        rincian_pembayaran: [],
      },
    });

    const response = await request(app).post('/api/pengembalian/denda/koreksi').send({
      id_denda: 7,
      nominal_baru: 2000,
      alasan: 'Hari libur fakultas',
      pengenal_pustakawan: '198805122014042001',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockPrisma.koreksiDenda.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id_denda: 7,
          nominal_lama: 5000,
          nominal_baru: 2000,
          alasan: 'Hari libur fakultas',
        }),
      })
    );
    expect(mockPrisma.denda.update).toHaveBeenCalledWith({
      where: { id_denda: 7 },
      data: { nominal: 2000, status: 'BELUM_LUNAS' },
    });
  });

  it('GET /api/pengembalian/qris returns QRIS image URL from public/qris', async () => {
    const response = await request(app).get('/api/pengembalian/qris');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.url).toMatch(/^\/api\/public\/qris\//);
  });

  it('POST /api/pengembalian/pembayaran saves WebP file <= 100KB to public/denda and rejects > 100KB', async () => {
    // 1. Uji penolakan ukuran > 100 KB
    const oversizedWebp = createValidWebpDataUrl(105 * 1024);
    const failRes = await request(app).post('/api/pengembalian/pembayaran').send({
      id_denda: 7,
      file_base64: oversizedWebp,
    });
    expect(failRes.status).toBe(400);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.message).toMatch(/100 KB/);

    // 1b. Uji penolakan pembayaran denda jika buku belum dikembalikan (status DIPINJAM)
    mockPrisma.denda.findUnique.mockResolvedValueOnce({
      id_denda: 7,
      id_detail: 11,
      nominal: '5000.00',
      total_terbayar: '0.00',
      status: 'BELUM_LUNAS',
      detail_peminjaman: {
        id_detail: 11,
        status: 'DIPINJAM',
        peminjaman: {
          id_anggota: 3,
        },
      },
    });
    const unreturnedRes = await request(app).post('/api/pengembalian/pembayaran').send({
      id_denda: 7,
      nominal_bayar: 5000,
      file_base64: createValidWebpDataUrl(256),
    });
    expect(unreturnedRes.status).toBe(400);
    expect(unreturnedRes.body.success).toBe(false);
    expect(unreturnedRes.body.message).toMatch(/setelah buku dikembalikan/i);

    // 2. Uji unggah WebP valid <= 100 KB (setelah buku dikembalikan)
    mockPrisma.denda.findUnique.mockResolvedValue({
      id_denda: 7,
      id_detail: 11,
      nominal: '5000.00',
      total_terbayar: '0.00',
      status: 'BELUM_LUNAS',
      detail_peminjaman: {
        id_detail: 11,
        status: 'KEMBALI',
        peminjaman: {
          id_anggota: 3,
        },
      },
    });
    mockPrisma.pembayaranDenda.create.mockResolvedValue({
      id_pembayaran: 99,
      status: 'MENUNGGU VERIFIKASI',
    });
    mockPrisma.rincianPembayaran.create.mockResolvedValue({
      id_rincian: 1,
    });

    const validWebp = createValidWebpDataUrl(512);
    const okRes = await request(app).post('/api/pengembalian/pembayaran').send({
      id_denda: 7,
      nominal_bayar: 5000,
      file_base64: validWebp,
    });

    expect(okRes.status).toBe(201);
    expect(okRes.body.success).toBe(true);
    expect(okRes.body.data.tipe_berkas).toBe('image/webp');
    expect(okRes.body.data.path_bukti).toMatch(/^\/api\/public\/denda\/bukti-denda-3-7-\d+\.webp$/);

    const savedFileName = path.basename(okRes.body.data.path_bukti);
    const savedFilePath = path.join(DENDA_DIR, savedFileName);
    createdFiles.push(savedFilePath);

    const stat = await fs.stat(savedFilePath);
    expect(stat.size).toBeLessThanOrEqual(100 * 1024);

    // 3. Uji ganti bukti pembayaran: file lama dihapus & record pembayaran_denda diupdate (bukan buat baru)
    mockPrisma.pembayaranDenda.create.mockClear();
    mockPrisma.denda.findUnique.mockResolvedValue({
      id_denda: 7,
      id_detail: 11,
      nominal: '5000.00',
      total_terbayar: '0.00',
      status: 'BELUM_LUNAS',
      detail_peminjaman: {
        id_detail: 11,
        peminjaman: {
          id_anggota: 3,
        },
      },
      rincian_pembayaran: [
        {
          id_rincian: 1,
          id_pembayaran: 99,
          id_denda: 7,
          pembayaran: {
            id_pembayaran: 99,
            path_bukti: okRes.body.data.path_bukti,
            status: 'MENUNGGU VERIFIKASI',
          },
        },
      ],
    });
    mockPrisma.pembayaranDenda.update.mockResolvedValue({
      id_pembayaran: 99,
      status: 'MENUNGGU VERIFIKASI',
    });

    await new Promise((r) => setTimeout(r, 5));
    const replacementRes = await request(app).post('/api/pengembalian/pembayaran').send({
      id_pembayaran: 99,
      id_denda: 7,
      nominal_bayar: 5000,
      file_base64: createValidWebpDataUrl(256),
    });

    expect(replacementRes.status).toBe(200);
    expect(replacementRes.body.success).toBe(true);
    expect(replacementRes.body.data.is_updated).toBe(true);
    expect(replacementRes.body.data.id_pembayaran).toBe(99);
    expect(mockPrisma.pembayaranDenda.create).not.toHaveBeenCalled();
    expect(mockPrisma.pembayaranDenda.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_pembayaran: 99 },
        data: expect.objectContaining({
          path_bukti: replacementRes.body.data.path_bukti,
          status: 'MENUNGGU VERIFIKASI',
        }),
      })
    );

    const newFileName = path.basename(replacementRes.body.data.path_bukti);
    const newFilePath = path.join(DENDA_DIR, newFileName);
    createdFiles.push(newFilePath);

    // Pastikan file lama sudah terhapus dari public/denda dan file baru tersedia
    await expect(fs.access(savedFilePath)).rejects.toThrow();
    const newStat = await fs.stat(newFilePath);
    expect(newStat.size).toBeLessThanOrEqual(100 * 1024);
  });

  it('POST /api/pengembalian/pembayaran/:id_pembayaran/verifikasi verifies payment and marks denda LUNAS', async () => {
    mockPrisma.pembayaranDenda.findUnique.mockResolvedValue({
      id_pembayaran: 99,
      nominal_bayar: '5000.00',
      status: 'MENUNGGU VERIFIKASI',
      rincian_pembayaran: [
        {
          id_rincian: 1,
          id_denda: 7,
          nominal_dialokasikan: '5000.00',
          denda: {
            id_denda: 7,
            nominal: '5000.00',
            total_terbayar: '0.00',
            status: 'BELUM_LUNAS',
          },
        },
      ],
    });
    mockPrisma.pengguna.findUnique.mockResolvedValue({ id_pengguna: 2 });
    mockPrisma.pembayaranDenda.update.mockResolvedValue({
      id_pembayaran: 99,
      status: 'TERVERIFIKASI',
      alasan_penolakan: null,
    });

    const response = await request(app)
      .post('/api/pengembalian/pembayaran/99/verifikasi')
      .send({
        status: 'TERVERIFIKASI',
        pengenal_pustakawan: '198805122014042001',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockPrisma.denda.update).toHaveBeenCalledWith({
      where: { id_denda: 7 },
      data: {
        total_terbayar: 5000,
        status: 'LUNAS',
      },
    });

    // Uji penolakan bukti pembayaran (DITOLAK) dan validasi alasan penolakan
    const missingReasonRes = await request(app)
      .post('/api/pengembalian/pembayaran/99/verifikasi')
      .send({ status: 'DITOLAK' });
    expect(missingReasonRes.status).toBe(400);

    mockPrisma.pembayaranDenda.update.mockResolvedValueOnce({
      id_pembayaran: 99,
      status: 'DITOLAK',
      alasan_penolakan: 'Bukti tidak valid',
    });
    const rejectRes = await request(app)
      .post('/api/pengembalian/pembayaran/99/verifikasi')
      .send({
        status: 'DITOLAK',
        alasan_penolakan: 'Bukti tidak valid',
        id_pustakawan: 2,
      });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('DITOLAK');
  });

  it('POST /api/pengembalian/denda/koreksi-massal and GET /api/pengembalian/pembayaran handle bulk adjustments and filters', async () => {
    // 1. Validasi operator tidak valid dan alasan kosong
    const badOpRes = await request(app)
      .post('/api/pengembalian/denda/koreksi-massal')
      .send({ operator: 'INVALID', nilai_koreksi: 1000, alasan: 'Tes' });
    expect(badOpRes.status).toBe(400);

    const noReasonRes = await request(app)
      .post('/api/pengembalian/denda/koreksi-massal')
      .send({ operator: 'KURANG', nilai_koreksi: 1000, alasan: '  ' });
    expect(noReasonRes.status).toBe(400);

    // 2. Uji koreksi massal KURANG dan LUNASI_SEMUA
    const duePast = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    mockPrisma.pengguna.findUnique.mockResolvedValue({ id_pengguna: 2 });
    mockPrisma.detailPeminjaman.findMany.mockResolvedValue([
      {
        id_detail: 11,
        status: 'DIPINJAM',
        peminjaman: { tanggal_jatuh_tempo: duePast },
        denda: {
          id_denda: 7,
          nominal: '5000.00',
          total_terbayar: '0.00',
          status: 'BELUM_LUNAS',
          koreksi_denda: [],
        },
      },
      {
        id_detail: 12,
        status: 'KEMBALI',
        peminjaman: { tanggal_jatuh_tempo: duePast },
        denda: {
          id_denda: 8,
          nominal: '2000.00',
          total_terbayar: '2000.00',
          status: 'LUNAS',
          koreksi_denda: [],
        },
      },
    ]);

    const bulkRes = await request(app)
      .post('/api/pengembalian/denda/koreksi-massal')
      .send({
        operator: 'KURANG',
        nilai_koreksi: 1000,
        target_status_buku: 'BELUM_KEMBALI',
        alasan: 'Dispensasi massal',
        pengenal_pustakawan: '198805122014042001',
      });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.data.updated_count).toBe(1);

    const lunasiRes = await request(app)
      .post('/api/pengembalian/denda/koreksi-massal')
      .send({
        operator: 'LUNASI_SEMUA',
        target_status_buku: 'SEMUA',
        alasan: 'Pemutihan akhir tahun',
        id_pustakawan: 2,
      });
    expect(lunasiRes.status).toBe(200);
    expect(lunasiRes.body.data.operator).toBe('LUNASI_SEMUA');

    // 3. Uji GET /api/pengembalian/pembayaran dan filter GET /api/pengembalian
    mockPrisma.pembayaranDenda.findMany.mockResolvedValueOnce([
      {
        id_pembayaran: 10,
        nominal_bayar: '3000.00',
        path_bukti: '/public/denda/bukti.webp',
        tipe_berkas: 'image/webp',
        status: 'MENUNGGU_VERIFIKASI',
        alasan_penolakan: null,
        waktu_unggah: new Date(),
        waktu_verifikasi: null,
        anggota: { id_pengguna: 3, pengenal: '2211521001', nama: 'Ahmad Fauzan' },
        pemverifikasi: null,
        rincian_pembayaran: [],
      },
    ]);
    const listPayRes = await request(app).get(
      '/api/pengembalian/pembayaran?status=MENUNGGU_VERIFIKASI'
    );
    expect(listPayRes.status).toBe(200);
    expect(listPayRes.body.data).toHaveLength(1);

    const filterReturnsRes = await request(app).get(
      '/api/pengembalian?status=selesai&pengenal_anggota=2211521001&search=Clean'
    );
    expect(filterReturnsRes.status).toBe(200);
  });

  it('covers edge cases and validation branches across pengembalian.controller.js', async () => {
    // 1. Helper unit branches
    expect(resolveTarifForDayMs(Date.now(), 1500)).toBe(1500);
    expect(resolveTarifForDayMs(Date.now(), -10)).toBe(1000);
    expect(resolveTarifForDayMs(null, { currentTarif: 0, logs: [] })).toBe(1000);
    expect(countOverdueDaysDifference(null, new Date())).toBe(0);
    expect(countOverdueDaysDifference('2026-11-25', '2026-11-20', true)).toBe(0);
    expect(countOverdueDaysDifference(new Date('invalid'), new Date())).toBe(0);

    startMidnightDendaScheduler();
    startMidnightDendaScheduler();

    const duePast = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const dueFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    // 2. syncDendaHarian edge cases: missing dueDate, not overdue with existing denda, overdue without denda, overdue with koreksi_denda, and LUNAS
    mockPrisma.detailPeminjaman.findMany.mockResolvedValueOnce([
      { id_detail: 1, status: 'DIPINJAM', peminjaman: null, denda: null },
      {
        id_detail: 2,
        status: 'DIPINJAM',
        peminjaman: { id_peminjaman: 2, tanggal_jatuh_tempo: dueFuture, status: 'SEDANG_DIPINJAM' },
        denda: { id_denda: 20, hari_terlambat: 2, nominal: '2000.00', status: 'BELUM_LUNAS' },
      },
      {
        id_detail: 3,
        id_peminjaman: 3,
        status: 'DIPINJAM',
        peminjaman: { id_peminjaman: 3, tanggal_jatuh_tempo: duePast, status: 'SEDANG_DIPINJAM' },
        denda: null,
      },
      {
        id_detail: 4,
        id_peminjaman: 4,
        status: 'DIPINJAM',
        peminjaman: { id_peminjaman: 4, tanggal_jatuh_tempo: duePast, status: 'TERLAMBAT' },
        denda: {
          id_denda: 40,
          hari_terlambat: 1,
          tarif_per_hari: '1000.00',
          nominal: '0.00',
          total_terbayar: '0.00',
          status: 'BELUM_LUNAS',
          koreksi_denda: [{ nominal_lama: '2000.00', nominal_baru: '0.00' }],
        },
      },
      {
        id_detail: 5,
        id_peminjaman: 5,
        status: 'DIPINJAM',
        peminjaman: { id_peminjaman: 5, tanggal_jatuh_tempo: duePast, status: 'TERLAMBAT' },
        denda: {
          id_denda: 50,
          hari_terlambat: 1,
          tarif_per_hari: '1000.00',
          nominal: '1000.00',
          total_terbayar: '99999.00',
          status: 'LUNAS',
          koreksi_denda: [],
        },
      },
    ]);
    const syncEdgeRes = await request(app).post('/api/pengembalian/sync-denda');
    expect(syncEdgeRes.status).toBe(200);

    // 3. prosesPengembalian validation & kode branches
    expect((await request(app).post('/api/pengembalian/proses').send({})).status).toBe(400);
    expect(
      (await request(app).post('/api/pengembalian/proses').send({ id_detail: -1 })).status
    ).toBe(400);

    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce(null);
    expect(
      (await request(app).post('/api/pengembalian/proses').send({ id_detail: 999 })).status
    ).toBe(404);

    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce({
      id_detail: 22,
      status: 'KEMBALI',
    });
    expect(
      (await request(app).post('/api/pengembalian/proses').send({ id_detail: 22 })).status
    ).toBe(400);

    mockPrisma.detailPeminjaman.findFirst.mockResolvedValueOnce(null);
    expect(
      (await request(app).post('/api/pengembalian/proses').send({ kode: 'EKS-404' })).status
    ).toBe(404);

    // Return by kode with overdue fine (creating denda when none exists & updating when exists)
    const overdueDetailNoDenda = {
      id_detail: 33,
      id_peminjaman: 3,
      id_eksemplar: 103,
      status: 'DIPINJAM',
      peminjaman: { tanggal_jatuh_tempo: duePast, status: 'TERLAMBAT' },
      eksemplar: { kode_eksemplar: 'EKS-003-A' },
      denda: null,
    };
    mockPrisma.detailPeminjaman.findFirst.mockResolvedValueOnce(overdueDetailNoDenda);
    mockPrisma.detailPeminjaman.count.mockResolvedValueOnce(1);
    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce({
      ...overdueDetailNoDenda,
      status: 'KEMBALI',
      tanggal_kembali: new Date(),
    });
    const kodeReturnRes = await request(app)
      .post('/api/pengembalian/proses')
      .send({ kode: 'EKS-003-A', id_pustakawan: 2 });
    expect(kodeReturnRes.status).toBe(200);

    const overdueDetailWithDenda = {
      ...overdueDetailNoDenda,
      denda: { id_denda: 77, status: 'BELUM_LUNAS', koreksi_denda: [] },
    };
    mockPrisma.detailPeminjaman.findFirst.mockResolvedValueOnce(overdueDetailWithDenda);
    mockPrisma.detailPeminjaman.count.mockResolvedValueOnce(1);
    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce({
      ...overdueDetailWithDenda,
      status: 'KEMBALI',
      tanggal_kembali: new Date(),
    });
    expect(
      (await request(app).post('/api/pengembalian/proses').send({ kode: 'EKS-003-A' })).status
    ).toBe(200);

    // 4. koreksiDenda validation & auto-create denda branches
    expect((await request(app).post('/api/pengembalian/denda/koreksi').send({})).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/denda/koreksi')
          .send({ id_denda: 1, nominal_baru: -5, alasan: 'x' })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/denda/koreksi')
          .send({ id_denda: 1, nominal_baru: 0, alasan: '  ' })
      ).status
    ).toBe(400);

    mockPrisma.denda.findUnique.mockResolvedValueOnce(null);
    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce(null);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/denda/koreksi')
          .send({ id_detail: 404, nominal_baru: 0, alasan: 'Tes' })
      ).status
    ).toBe(404);

    mockPrisma.denda.findUnique.mockResolvedValueOnce({
      id_denda: 88,
      id_detail: 11,
      status: 'LUNAS',
    });
    expect(
      (
        await request(app)
          .post('/api/pengembalian/denda/koreksi')
          .send({ id_denda: 88, nominal_baru: 0, alasan: 'Tes' })
      ).status
    ).toBe(400);

    // Auto-create denda on koreksiDenda by id_detail + fallback staff findFirst
    mockPrisma.denda.findUnique.mockResolvedValueOnce(null);
    mockPrisma.detailPeminjaman.findUnique
      .mockResolvedValueOnce({
        id_detail: 55,
        peminjaman: { tanggal_jatuh_tempo: duePast },
      })
      .mockResolvedValueOnce({
        id_detail: 55,
        status: 'KEMBALI',
        tanggal_kembali: new Date(),
        peminjaman: { tanggal_jatuh_tempo: duePast },
        denda: { id_denda: 550, nominal: '0.00', total_terbayar: '0.00', status: 'LUNAS' },
      });
    mockPrisma.denda.create.mockResolvedValueOnce({
      id_denda: 550,
      id_detail: 55,
      nominal: '3000.00',
      total_terbayar: '0.00',
      status: 'BELUM_LUNAS',
    });
    mockPrisma.pengguna.findUnique.mockResolvedValueOnce(null);
    mockPrisma.pengguna.findFirst.mockResolvedValueOnce({ id_pengguna: 2 });
    mockPrisma.koreksiDenda.create.mockResolvedValueOnce({
      id_koreksi: 99,
      id_denda: 550,
    });
    expect(
      (
        await request(app)
          .post('/api/pengembalian/denda/koreksi')
          .send({ id_detail: 55, nominal_baru: 0, alasan: 'Bebas denda' })
      ).status
    ).toBe(200);

    // 5. koreksiDendaMassal additional branches (invalid nilai, invalid target, SUDAH_KEMBALI + TAMBAH creating denda)
    expect(
      (
        await request(app)
          .post('/api/pengembalian/denda/koreksi-massal')
          .send({ operator: 'TAMBAH', nilai_koreksi: 0, alasan: 'Tes' })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/denda/koreksi-massal')
          .send({
            operator: 'TAMBAH',
            nilai_koreksi: 1000,
            target_status_buku: 'INVALID',
            alasan: 'Tes',
          })
      ).status
    ).toBe(400);

    mockPrisma.pengguna.findFirst.mockResolvedValueOnce({ id_pengguna: 2 });
    mockPrisma.detailPeminjaman.findMany.mockResolvedValueOnce([
      {
        id_detail: 61,
        status: 'KEMBALI',
        tanggal_kembali: new Date(),
        peminjaman: { tanggal_jatuh_tempo: duePast },
        denda: null,
      },
      {
        id_detail: 62,
        status: 'KEMBALI',
        tanggal_kembali: new Date(),
        peminjaman: { tanggal_jatuh_tempo: dueFuture },
        denda: null,
      },
    ]);
    mockPrisma.denda.create.mockResolvedValueOnce({
      id_denda: 610,
      id_detail: 61,
      nominal: '3000.00',
      total_terbayar: '0.00',
      status: 'BELUM_LUNAS',
    });
    expect(
      (
        await request(app).post('/api/pengembalian/denda/koreksi-massal').send({
          operator: 'TAMBAH',
          nilai_koreksi: 1000,
          target_status_buku: 'SUDAH_KEMBALI',
          alasan: 'Tambahan denda',
        })
      ).status
    ).toBe(200);

    // 6. uploadBuktiPembayaranDenda & verifikasiPembayaranDenda validation branches
    expect((await request(app).post('/api/pengembalian/pembayaran').send({})).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_denda: 1, file_base64: '' })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_denda: 1, file_base64: 'data:image/png;base64,AAAA' })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_denda: 1, file_base64: 'data:image/webp;base64,AAAA' })
      ).status
    ).toBe(400);

    expect(
      (await request(app).post('/api/pengembalian/pembayaran/abc/verifikasi').send({})).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran/99/verifikasi')
          .send({ status: 'SALAH' })
      ).status
    ).toBe(400);

    mockPrisma.pembayaranDenda.findUnique.mockResolvedValueOnce(null);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran/999/verifikasi')
          .send({ status: 'TERVERIFIKASI' })
      ).status
    ).toBe(404);

    mockPrisma.pembayaranDenda.findUnique.mockResolvedValueOnce({
      id_pembayaran: 99,
      status: 'TERVERIFIKASI',
    });
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran/99/verifikasi')
          .send({ status: 'TERVERIFIKASI' })
      ).status
    ).toBe(400);

    // 7. Additional uploadBuktiPembayaranDenda branches (by id_detail: 404, not KEMBALI, no fine, LUNAS, missing anggota)
    const validSmallWebp = createValidWebpDataUrl(128);

    mockPrisma.denda.findUnique.mockResolvedValueOnce(null);
    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce(null);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_detail: 404, file_base64: validSmallWebp })
      ).status
    ).toBe(404);

    mockPrisma.denda.findUnique.mockResolvedValueOnce(null);
    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce({
      id_detail: 405,
      status: 'DIPINJAM',
    });
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_detail: 405, file_base64: validSmallWebp })
      ).status
    ).toBe(400);

    mockPrisma.denda.findUnique.mockResolvedValueOnce(null);
    mockPrisma.detailPeminjaman.findUnique.mockResolvedValueOnce({
      id_detail: 406,
      status: 'KEMBALI',
      tanggal_kembali: new Date(),
      peminjaman: { tanggal_jatuh_tempo: dueFuture },
    });
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_detail: 406, file_base64: validSmallWebp })
      ).status
    ).toBe(400);

    mockPrisma.denda.findUnique.mockResolvedValueOnce(null);
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_denda: 404, file_base64: validSmallWebp })
      ).status
    ).toBe(404);

    mockPrisma.denda.findUnique.mockResolvedValueOnce({
      id_denda: 407,
      status: 'LUNAS',
      detail_peminjaman: { status: 'KEMBALI' },
    });
    expect(
      (
        await request(app)
          .post('/api/pengembalian/pembayaran')
          .send({ id_denda: 407, file_base64: validSmallWebp })
      ).status
    ).toBe(400);

    mockPrisma.denda.findUnique.mockResolvedValueOnce({
      id_denda: 408,
      status: 'BELUM_LUNAS',
      detail_peminjaman: { status: 'KEMBALI', peminjaman: {} },
    });
    mockPrisma.pengguna.findUnique.mockResolvedValueOnce(null);
    expect(
      (
        await request(app).post('/api/pengembalian/pembayaran').send({
          id_denda: 408,
          pengenal_anggota: 'UNKNOWN',
          file_base64: validSmallWebp,
        })
      ).status
    ).toBe(400);

    // 8. formatDetailPengembalian nested koreksi_denda & rincian_pembayaran formatting
    mockPrisma.detailPeminjaman.findMany.mockResolvedValueOnce([
      {
        id_detail: 99,
        id_peminjaman: 9,
        id_eksemplar: 109,
        status: 'KEMBALI',
        tanggal_kembali: new Date(),
        peminjaman: {
          nomor_transaksi: 'TRX-FULL',
          tanggal_pinjam: duePast,
          tanggal_jatuh_tempo: duePast,
          status: 'SELESAI',
          anggota: { id_pengguna: 3, pengenal: '2211521001', nama: 'Ahmad' },
        },
        eksemplar: {
          kode_eksemplar: 'EKS-FULL',
          lokasi_rak: 'RAK-1',
          koleksi: { id_koleksi: 1, kode_koleksi: 'KOL-1', judul: 'Buku Full' },
        },
        denda: {
          id_denda: 90,
          hari_terlambat: 3,
          tarif_per_hari: '1000.00',
          nominal: '2000.00',
          total_terbayar: '2000.00',
          status: 'LUNAS',
          koreksi_denda: [
            {
              id_koreksi: 1,
              nominal_lama: '3000.00',
              nominal_baru: '2000.00',
              alasan: 'Potongan',
              waktu: new Date(),
              pustakawan: { id_pengguna: 2, pengenal: 'P-1', nama: 'Siti' },
            },
          ],
          rincian_pembayaran: [
            {
              id_rincian: 1,
              nominal_dialokasikan: '2000.00',
              pembayaran: {
                id_pembayaran: 1,
                nominal_bayar: '2000.00',
                path_bukti: '/api/public/denda/a.webp',
                tipe_berkas: 'image/webp',
                status: 'TERVERIFIKASI',
                alasan_penolakan: null,
                waktu_unggah: new Date(),
                waktu_verifikasi: new Date(),
                pemverifikasi: { id_pengguna: 2, pengenal: 'P-1', nama: 'Siti' },
              },
            },
          ],
        },
      },
    ]);
    const fullFormatRes = await request(app).get('/api/pengembalian?status=denda');
    expect(fullFormatRes.status).toBe(200);
    expect(fullFormatRes.body.data[0].riwayat_koreksi).toHaveLength(1);
    expect(fullFormatRes.body.data[0].pembayaran_terakhir.status).toBe('TERVERIFIKASI');
  });
});
