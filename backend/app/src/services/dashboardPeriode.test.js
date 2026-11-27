import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ default: {}, prisma: {} }));

const { gabungPerLabel, hitungPeriode, labelKode, normalisasiYmd, parsePeriode, periodePublik, susunTren } =
  await import('./dashboardPeriode.js');
const { kelompokPembayaran } = await import('./dashboardRinci.service.js');

// 21 Nov 2026, 10.00 WIB
const SEKARANG = new Date('2026-11-21T03:00:00.000Z');

describe('parsePeriode', () => {
  it('bawaan 30 hari, menerima pilihan yang sah', () => {
    expect(parsePeriode(undefined)).toBe('30h');
    expect(parsePeriode('')).toBe('30h');
    for (const kode of ['7h', '30h', '90h', 'bulan']) expect(parsePeriode(kode)).toBe(kode);
  });

  it.each(['1h', 'toString', '__proto__', ['7h'], 30])('menolak %j dengan 400', (nilai) => {
    let status;
    try {
      parsePeriode(nilai);
    } catch (err) {
      status = err.statusCode;
    }
    expect(status).toBe(400);
  });
});

describe('hitungPeriode', () => {
  it('7 hari: 15–21 Nov inklusif, batas waktu UTC mundur 7 jam', () => {
    const p = hitungPeriode('7h', SEKARANG);
    expect(periodePublik(p)).toEqual({ kode: '7h', label: '7 hari terakhir', satuan: 'hari', mulai: '2026-11-15', akhir: '2026-11-21' });
    expect(p.rentangTanggal).toEqual({ gte: new Date('2026-11-15T00:00:00Z'), lt: new Date('2026-11-22T00:00:00Z') });
    expect(p.rentangWaktu).toEqual({ gte: new Date('2026-11-14T17:00:00Z'), lt: new Date('2026-11-21T17:00:00Z') });
  });

  it('90 hari memakai satuan minggu', () => {
    expect(hitungPeriode('90h', SEKARANG)).toMatchObject({ satuan: 'minggu' });
  });

  it('bulan ini dimulai tanggal 1 bulan WIB berjalan', () => {
    expect(periodePublik(hitungPeriode('bulan', SEKARANG))).toMatchObject({ mulai: '2026-11-01', akhir: '2026-11-21' });
    // 30 Nov 20.00 UTC = 1 Des 03.00 WIB -> sudah bulan Desember
    expect(periodePublik(hitungPeriode('bulan', new Date('2026-11-30T20:00:00Z')))).toMatchObject({
      mulai: '2026-12-01',
      akhir: '2026-12-01',
    });
  });
});

describe('susunTren', () => {
  it('hari tanpa data tetap muncul sebagai 0', () => {
    const p = hitungPeriode('7h', SEKARANG);
    const tren = susunTren(p, [
      { t: new Date('2026-11-15T00:00:00Z'), n: 2n },
      { t: '2026-11-21', n: 1 },
    ]);
    expect(tren).toHaveLength(7);
    expect(tren[0]).toEqual({ tanggal: '2026-11-15', jumlah: 2 });
    expect(tren[3]).toEqual({ tanggal: '2026-11-18', jumlah: 0 });
    expect(tren[6]).toEqual({ tanggal: '2026-11-21', jumlah: 1 });
  });

  it('per minggu menjumlahkan 7 hari dan bisa membawa total nominal', () => {
    const p = hitungPeriode('90h', SEKARANG);
    const tren = susunTren(
      p,
      [
        { t: '2026-08-24', n: 1, total: '1000.00' },
        { t: '2026-08-30', n: 2, total: 500 },
        { t: '2026-08-31', n: 4, total: null },
      ],
      true,
    );
    expect(tren).toHaveLength(13);
    expect(tren[0]).toEqual({ tanggal: '2026-08-24', jumlah: 3, total_nominal: 1500 });
    expect(tren[1]).toEqual({ tanggal: '2026-08-31', jumlah: 4, total_nominal: 0 });
    expect(tren.reduce((n, t) => n + t.jumlah, 0)).toBe(7);
  });

  it('nilai n kosong dianggap 0', () => {
    const tren = susunTren(hitungPeriode('7h', SEKARANG), [{ t: '2026-11-15' }]);
    expect(tren[0].jumlah).toBe(0);
  });
});

describe('label dan pengelompokan', () => {
  it('labelKode', () => {
    expect(labelKode('USULAN_KOLEKSI')).toBe('Usulan koleksi');
    expect(labelKode('rencana-pengadaan')).toBe('Rencana pengadaan');
    expect(labelKode(null)).toBe('Tidak tercatat');
    expect(labelKode('  ', 'Kosong')).toBe('Kosong');
  });

  it('normalisasiYmd', () => {
    expect(normalisasiYmd(new Date('2026-11-01T00:00:00Z'))).toBe('2026-11-01');
    expect(normalisasiYmd('2026-11-01T00:00:00')).toBe('2026-11-01');
  });

  it('gabungPerLabel menyatukan ejaan berbeda dan mengurutkan dari terbesar', () => {
    expect(
      gabungPerLabel(
        [
          { jalur: 'MANDIRI', _count: { _all: 2 } },
          { jalur: 'mandiri', _count: { _all: 1 } },
          { jalur: 'LOKET', _count: { _all: 3 } },
          { jalur: null, _count: {} },
        ],
        (b) => b.jalur,
      ),
    ).toEqual([
      { label: 'Loket', jumlah: 3 },
      { label: 'Mandiri', jumlah: 3 },
      { label: 'Tidak tercatat', jumlah: 0 },
    ]);
  });

  it.each([
    [null, 'Menunggu verifikasi'],
    ['MENUNGGU VERIFIKASI', 'Menunggu verifikasi'],
    ['TERVERIFIKASI', 'Terverifikasi'],
    ['diterima', 'Terverifikasi'],
    ['DITOLAK', 'Ditolak'],
    ['BATAL', 'Lainnya'],
  ])('kelompokPembayaran(%j) -> %s', (status, hasil) => {
    expect(kelompokPembayaran(status)).toBe(hasil);
  });
});
