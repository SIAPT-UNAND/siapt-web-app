import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const db = vi.hoisted(() => ({
  koleksi: { count: vi.fn() },
  detailPeminjaman: { count: vi.fn() },
  denda: { count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  permintaanLayanan: { groupBy: vi.fn() },
}));
vi.mock('../lib/prisma.js', () => ({ default: db, prisma: db }));

const sesi = vi.hoisted(() => ({ user: null }));
vi.mock('../middleware/auth.js', async (importOriginal) => {
  const asli = await importOriginal();
  return {
    requireRole: asli.requireRole,
    requireAuth: (req, res, next) => {
      if (!sesi.user) {
        return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
      }
      req.user = sesi.user;
      return next();
    },
  };
});

const { default: app } = await import('../app.js');
const { FILTER_AKTIF, FILTER_BELUM_LUNAS } = await import('../services/dashboard.service.js');

const PENGELOLA = { id: 4, nama: 'Pengelola Demo', pengenal: 'pengelola01', role: 'Pengelola' };
// 21 Nov 2026 pukul 10.00 WIB
const SEKARANG = new Date('2026-11-21T03:00:00.000Z');
const ACUAN = new Date('2026-11-21T00:00:00.000Z');

function isiDataUji() {
  // Data uji PRD 04 §5.2: 5 koleksi (4 aktif), 6 aktif dipinjam (2 terlambat),
  // denda 2 belum dibayar (5.000 + 3.000) + 1 menunggu verifikasi (2.000),
  // permintaan 2 Baru (1 null), 1 Diproses, 3 Selesai, 1 Ditolak.
  db.koleksi.count.mockResolvedValueOnce(4).mockResolvedValueOnce(5);
  db.detailPeminjaman.count
    .mockResolvedValueOnce(6) // dipinjam
    .mockResolvedValueOnce(2) // terlambat
    .mockResolvedValueOnce(1) // 1-7 hari
    .mockResolvedValueOnce(0) // 8-30 hari
    .mockResolvedValueOnce(1); // > 30 hari
  db.denda.count.mockResolvedValue(3);
  db.denda.aggregate.mockResolvedValue({ _sum: { nominal: { toString: () => '10000.00' } } });
  db.denda.groupBy.mockResolvedValue([
    { status: 'BELUM_DIBAYAR', _count: { _all: 2 }, _sum: { nominal: '8000.00' } },
    { status: 'MENUNGGU_VERIFIKASI', _count: { _all: 1 }, _sum: { nominal: '2000.00' } },
  ]);
  db.permintaanLayanan.groupBy.mockResolvedValue([
    { status: null, _count: { _all: 1 } },
    { status: 'Baru', _count: { _all: 1 } },
    { status: 'Diproses', _count: { _all: 1 } },
    { status: 'Selesai', _count: { _all: 3 } },
    { status: 'Ditolak', _count: { _all: 1 } },
  ]);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SEKARANG);
  sesi.user = PENGELOLA;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hak akses /api/dashboard/ringkasan', () => {
  it('tanpa login ditolak 401', async () => {
    sesi.user = null;
    const res = await request(app).get('/api/dashboard/ringkasan');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(db.koleksi.count).not.toHaveBeenCalled();
  });

  it.each(['Admin', 'Anggota', 'Pustakawan'])('peran %s ditolak 403', async (role) => {
    sesi.user = { id: 9, nama: 'X', pengenal: 'x01', role };
    const res = await request(app).get('/api/dashboard/ringkasan');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Kamu tidak memiliki izin untuk mengakses fungsi ini.' });
    expect(db.koleksi.count).not.toHaveBeenCalled();
  });

  it('dashboard read-only: tidak ada endpoint tulis', async () => {
    const res = await request(app).post('/api/dashboard/ringkasan').send({});
    expect(res.status).toBe(404);
  });
});

describe('GET /api/dashboard/ringkasan', () => {
  it('DB-01 + TC-12: lima indikator sama dengan hitungan manual data uji, semua number', async () => {
    isiDataUji();

    const res = await request(app).get('/api/dashboard/ringkasan');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      koleksi_aktif: 4,
      peminjaman_dipinjam: 6,
      peminjaman_terlambat: 2,
      denda_belum_lunas: {
        jumlah: 3,
        total_nominal: 10000,
        rincian: {
          belum_dibayar: { jumlah: 2, total_nominal: 8000 },
          menunggu_verifikasi: { jumlah: 1, total_nominal: 2000 },
          lainnya: { jumlah: 0, total_nominal: 0 },
        },
      },
      permintaan_layanan: { Baru: 2, Diproses: 1, Selesai: 3, Ditolak: 1, Lainnya: 0 },
      koleksi_total: 5,
      keterlambatan: { hari_1_7: 1, hari_8_30: 0, lebih_30: 1 },
      tanggal_acuan: '2026-11-21',
      dihitung_pada: '2026-11-21T03:00:00.000Z',
    });
  });

  it('DB-02 data kosong: semua 0, kelima status permintaan ada', async () => {
    db.koleksi.count.mockResolvedValue(0);
    db.detailPeminjaman.count.mockResolvedValue(0);
    db.denda.count.mockResolvedValue(0);
    db.denda.aggregate.mockResolvedValue({ _sum: { nominal: null } });
    db.denda.groupBy.mockResolvedValue([]);
    db.permintaanLayanan.groupBy.mockResolvedValue([]);

    const res = await request(app).get('/api/dashboard/ringkasan');

    expect(res.status).toBe(200);
    expect(res.body.data.denda_belum_lunas.total_nominal).toBe(0);
    expect(res.body.data.permintaan_layanan).toEqual({ Baru: 0, Diproses: 0, Selesai: 0, Ditolak: 0, Lainnya: 0 });
    expect(res.body.data.keterlambatan).toEqual({ hari_1_7: 0, hari_8_30: 0, lebih_30: 0 });
  });

  it('DB-03 filter memakai pasangan OR status null dan batas tanggal WIB', async () => {
    isiDataUji();
    await request(app).get('/api/dashboard/ringkasan');

    expect(FILTER_AKTIF).toEqual({
      tanggal_kembali: null,
      OR: [{ status: null }, { status: { notIn: ['KEMBALI', 'SELESAI', 'Dikembalikan', 'DIKEMBALIKAN'] } }],
    });
    expect(FILTER_BELUM_LUNAS).toEqual({ OR: [{ status: null }, { status: { notIn: ['LUNAS', 'Lunas'] } }] });

    const panggilan = db.detailPeminjaman.count.mock.calls.map((c) => c[0].where);
    expect(panggilan[0]).toEqual(FILTER_AKTIF);
    expect(panggilan[1]).toEqual({ ...FILTER_AKTIF, peminjaman: { tanggal_jatuh_tempo: { lt: ACUAN } } });
    expect(panggilan[2].peminjaman.tanggal_jatuh_tempo).toEqual({
      gte: new Date('2026-11-14T00:00:00.000Z'),
      lt: ACUAN,
    });
    expect(panggilan[3].peminjaman.tanggal_jatuh_tempo).toEqual({
      gte: new Date('2026-10-22T00:00:00.000Z'),
      lt: new Date('2026-11-14T00:00:00.000Z'),
    });
    expect(panggilan[4].peminjaman.tanggal_jatuh_tempo).toEqual({ lt: new Date('2026-10-22T00:00:00.000Z') });

    expect(db.koleksi.count).toHaveBeenCalledWith({ where: { status_aktif: true } });
    expect(db.denda.count).toHaveBeenCalledWith({ where: FILTER_BELUM_LUNAS });
    expect(db.denda.aggregate).toHaveBeenCalledWith({ where: FILTER_BELUM_LUNAS, _sum: { nominal: true } });
    expect(db.denda.groupBy.mock.calls[0][0]).toMatchObject({ by: ['status'], where: FILTER_BELUM_LUNAS });
    expect(db.permintaanLayanan.groupBy).toHaveBeenCalledWith({ by: ['status'], _count: { _all: true } });
  });

  it('error database diteruskan ke errorHandler (500)', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    isiDataUji();
    db.denda.groupBy.mockRejectedValue(new Error('koneksi putus'));
    const res = await request(app).get('/api/dashboard/ringkasan');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    konsol.mockRestore();
  });
});
