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
import { countOverdueDaysDifference } from './controllers/pengembalian.controller.js';

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
      kunci_parameter: 'tarif_denda_per_hari',
      nilai: '1000',
    });
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
          hari_terlambat: 3,
          tarif_per_hari: '1000.00',
          nominal: '3000.00',
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
        hari_terlambat: 3,
        denda: 3000,
        status_denda: 'BELUM_LUNAS',
      })
    );
  });

  it('POST /api/pengembalian/sync-denda calculates exact date difference across days and variable month lengths', async () => {
    // 1. Uji perhitungan selisih tanggal langsung (20 Nov -> 22 Nov = 2 hari, 20 Nov -> 1 Des = 11 hari)
    expect(countOverdueDaysDifference('2026-11-20', '2026-11-22')).toBe(2);
    expect(countOverdueDaysDifference('2026-11-20', '2026-12-01')).toBe(11);
    // Februari non-kabisat (28 hari): 25 Feb 2026 -> 2 Mar 2026 = 5 hari
    expect(countOverdueDaysDifference('2026-02-25', '2026-03-02')).toBe(5);
    // Februari kabisat (29 hari): 25 Feb 2028 -> 2 Mar 2028 = 6 hari
    expect(countOverdueDaysDifference('2028-02-25', '2028-03-02')).toBe(6);

    const now = new Date();
    const duePast = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 8)
    );
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
          hari_terlambat: 6,
          nominal: '6000.00',
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
          hari_terlambat: 8,
          nominal: 8000,
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

    // 2. Uji unggah WebP valid <= 100 KB
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
  });
});
