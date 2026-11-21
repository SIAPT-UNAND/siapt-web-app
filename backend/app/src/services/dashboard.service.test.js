import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ default: {}, prisma: {} }));

const {
  kelompokDenda,
  kelompokPermintaan,
  keAngka,
  mundurHari,
  ringkasDenda,
  ringkasPermintaan,
  tanggalAcuan,
} = await import('./dashboard.service.js');

describe('tanggalAcuan (DB-05)', () => {
  it('memakai zona Asia/Jakarta: 20 Nov 18.30 UTC = 21 Nov 01.30 WIB', () => {
    expect(tanggalAcuan(new Date('2026-11-20T18:30:00Z')).toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });

  it('sebelum tengah malam WIB tetap tanggal yang sama', () => {
    expect(tanggalAcuan(new Date('2026-11-20T16:59:59Z')).toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('mundurHari mengurangi hari penuh', () => {
    expect(mundurHari(new Date('2026-11-21T00:00:00Z'), 7).toISOString()).toBe('2026-11-14T00:00:00.000Z');
  });
});

describe('keAngka (DB-06)', () => {
  it.each([
    [{ toString: () => '42000.00' }, 42000],
    ['42000.00', 42000],
    [1500.5, 1500.5],
    [null, 0],
    [undefined, 0],
    ['bukan angka', 0],
  ])('%j -> %d', (masukan, hasil) => {
    expect(keAngka(masukan)).toBe(hasil);
  });
});

describe('normalisasi status', () => {
  it.each([
    [null, 'Baru'],
    ['', 'Baru'],
    ['Baru', 'Baru'],
    ['BARU', 'Baru'],
    ['diproses', 'Diproses'],
    ['Selesai', 'Selesai'],
    [' Ditolak ', 'Ditolak'],
    ['DISETUJUI', 'Lainnya'],
  ])('permintaan %j -> %s (DB-04)', (status, kelompok) => {
    expect(kelompokPermintaan(status)).toBe(kelompok);
  });

  it.each([
    [null, 'belum_dibayar'],
    ['BELUM_DIBAYAR', 'belum_dibayar'],
    ['BELUM_LUNAS', 'belum_dibayar'],
    ['Belum dibayar', 'belum_dibayar'],
    ['MENUNGGU_VERIFIKASI', 'menunggu_verifikasi'],
    ['MENUNGGU VERIFIKASI', 'menunggu_verifikasi'],
    ['Menunggu verifikasi', 'menunggu_verifikasi'],
    ['DIBATALKAN', 'lainnya'],
  ])('denda %j -> %s', (status, kelompok) => {
    expect(kelompokDenda(status)).toBe(kelompok);
  });

  it('ringkasPermintaan menjumlahkan ejaan berbeda ke kelompok yang sama', () => {
    expect(
      ringkasPermintaan([
        { status: null, _count: { _all: 1 } },
        { status: 'Baru', _count: { _all: 2 } },
        { status: 'BARU', _count: { _all: 1 } },
        { status: 'diproses', _count: { _all: 3 } },
        { status: 'DISETUJUI', _count: { _all: 4 } },
      ]),
    ).toEqual({ Baru: 4, Diproses: 3, Selesai: 0, Ditolak: 0, Lainnya: 4 });
  });

  it('ringkasDenda memisahkan belum dibayar dan menunggu verifikasi', () => {
    expect(
      ringkasDenda([
        { status: 'BELUM_DIBAYAR', _count: { _all: 2 }, _sum: { nominal: '8000.00' } },
        { status: null, _count: { _all: 1 }, _sum: { nominal: null } },
        { status: 'MENUNGGU VERIFIKASI', _count: { _all: 1 }, _sum: { nominal: { toString: () => '2000.00' } } },
        { status: 'ANEH', _count: { _all: 1 }, _sum: {} },
      ]),
    ).toEqual({
      belum_dibayar: { jumlah: 3, total_nominal: 8000 },
      menunggu_verifikasi: { jumlah: 1, total_nominal: 2000 },
      lainnya: { jumlah: 1, total_nominal: 0 },
    });
  });
});
