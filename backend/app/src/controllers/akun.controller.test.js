import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ default: {}, prisma: {} }));

const {
  bacaBody,
  parseId,
  parseQueryDaftar,
  validasiAlasan,
  validasiKataSandi,
  validasiNama,
  validasiPengenal,
  validasiPeran,
} = await import('./akun.controller.js');

function kodeError(fn) {
  try {
    fn();
  } catch (err) {
    return err.statusCode;
  }
  return null;
}

describe('validasi input akun', () => {
  it('parseId menerima bilangan bulat positif dan menolak selainnya', () => {
    expect(parseId('12')).toBe(12);
    for (const salah of ['0', '-1', 'abc', '1.5', '01', '2147483648', undefined]) {
      expect(kodeError(() => parseId(salah))).toBe(400);
    }
  });

  it('validasiPengenal memangkas spasi dan memeriksa panjang serta pola', () => {
    expect(validasiPengenal('  ADM-001 ')).toBe('ADM-001');
    expect(validasiPengenal('nama.user_01')).toBe('nama.user_01');
    for (const salah of ['', 'ab', 'a'.repeat(51), 'ada spasi', 'ad@min', 123, null]) {
      expect(kodeError(() => validasiPengenal(salah))).toBe(400);
    }
  });

  it('validasiNama 2–255 karakter', () => {
    expect(validasiNama(' Rafi ')).toBe('Rafi');
    for (const salah of ['', ' a ', 'a'.repeat(256), undefined]) {
      expect(kodeError(() => validasiNama(salah))).toBe(400);
    }
  });

  it('validasiPeran wajib teks', () => {
    expect(validasiPeran(' Pustakawan ')).toBe('Pustakawan');
    for (const salah of ['', '   ', 'x'.repeat(256), 5, undefined]) {
      expect(kodeError(() => validasiPeran(salah))).toBe(400);
    }
  });

  it('validasiKataSandi 8–72 byte', () => {
    expect(validasiKataSandi('rahasia1')).toBe('rahasia1');
    expect(validasiKataSandi('a'.repeat(72))).toHaveLength(72);
    expect(kodeError(() => validasiKataSandi('a'.repeat(7)))).toBe(400);
    expect(kodeError(() => validasiKataSandi('a'.repeat(73)))).toBe(400);
    // 36 karakter × 3 byte = 108 byte, melewati batas bcrypt walaupun < 72 karakter
    expect(kodeError(() => validasiKataSandi('€'.repeat(36)))).toBe(400);
    expect(kodeError(() => validasiKataSandi(12345678))).toBe(400);
  });

  it('validasiAlasan 3–255 karakter', () => {
    expect(validasiAlasan('  Lulus  ')).toBe('Lulus');
    for (const salah of ['', 'ab', 'a'.repeat(256), undefined]) {
      expect(kodeError(() => validasiAlasan(salah))).toBe(400);
    }
  });

  it('bacaBody hanya menerima objek biasa', () => {
    expect(bacaBody({ body: { a: 1 } })).toEqual({ a: 1 });
    expect(bacaBody({ body: undefined })).toEqual({});
    expect(bacaBody({ body: [1, 2] })).toEqual({});
    expect(bacaBody({ body: 'teks' })).toEqual({});
  });
});

describe('parseQueryDaftar', () => {
  it('memakai nilai default', () => {
    expect(parseQueryDaftar()).toEqual({
      q: undefined,
      role: undefined,
      status: undefined,
      halaman: 1,
      perHalaman: 20,
    });
  });

  it('membaca semua filter dan mengabaikan nilai kosong', () => {
    expect(
      parseQueryDaftar({ q: ' rafi ', role: 'Anggota', status: 'nonaktif', halaman: '3', per_halaman: '50' }),
    ).toEqual({ q: 'rafi', role: 'Anggota', status: 'nonaktif', halaman: 3, perHalaman: 50 });
    expect(parseQueryDaftar({ q: '  ', role: '', status: '' }).q).toBeUndefined();
  });

  it.each([
    [{ q: 'a'.repeat(101) }],
    [{ q: ['a', 'b'] }],
    [{ role: 'x'.repeat(256) }],
    [{ status: 'xyz' }],
    [{ halaman: '0' }],
    [{ halaman: 'dua' }],
    [{ per_halaman: '0' }],
    [{ per_halaman: '500' }],
    [{ per_halaman: 'abc' }],
  ])('menolak query tidak valid %j', (query) => {
    expect(kodeError(() => parseQueryDaftar(query))).toBe(400);
  });
});
