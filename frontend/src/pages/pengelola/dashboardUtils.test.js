import { describe, expect, it } from 'vitest';
import {
  daftarPerhatian,
  formatAngka,
  formatJamWib,
  formatRupiah,
  formatTanggalAcuan,
  permintaanTerbuka,
  persen,
  semuaNol,
  totalPermintaan,
} from './dashboardUtils.js';

const rapikan = (t) => t.replace(/\s/g, ' ');

describe('dashboardUtils', () => {
  it('format angka dan Rupiah', () => {
    expect(formatAngka(12345)).toBe('12.345');
    expect(formatAngka(undefined)).toBe('0');
    expect(rapikan(formatRupiah(42000))).toBe('Rp 42.000');
    expect(rapikan(formatRupiah(1500.5))).toBe('Rp 1.500,5');
    expect(rapikan(formatRupiah(null))).toBe('Rp 0');
  });

  it('persen aman untuk total 0', () => {
    expect(persen(1, 3)).toBe(33);
    expect(persen(0, 0)).toBe(0);
    expect(persen(5, undefined)).toBe(0);
  });

  it('format tanggal acuan dan jam WIB', () => {
    expect(formatTanggalAcuan('2026-11-21')).toBe('21 November 2026');
    expect(formatTanggalAcuan(null)).toBe('-');
    expect(formatTanggalAcuan('bukan')).toBe('-');
    expect(formatJamWib('2026-11-21T08:49:00.000Z')).toBe('15.49 WIB');
    expect(formatJamWib(undefined)).toBe('-');
    expect(formatJamWib('bukan')).toBe('-');
  });

  it('permintaan terbuka, total, dan semua nol', () => {
    const data = { permintaan_layanan: { Baru: 2, Diproses: 1, Selesai: 3, Ditolak: 1, Lainnya: 1 } };
    expect(permintaanTerbuka(data)).toBe(3);
    expect(totalPermintaan(data)).toBe(8);
    expect(permintaanTerbuka({})).toBe(0);
    expect(totalPermintaan({})).toBe(0);
    expect(semuaNol({ permintaan_layanan: {} })).toBe(true);
    expect(semuaNol({ koleksi_aktif: 1, permintaan_layanan: {} })).toBe(false);
    expect(semuaNol({ permintaan_layanan: { Baru: 1 } })).toBe(false);
  });

  it('daftarPerhatian hanya memuat yang > 0', () => {
    expect(daftarPerhatian({})).toEqual([]);
    expect(
      daftarPerhatian({ peminjaman_terlambat: 3, keterlambatan: { lebih_30: 3 }, permintaan_layanan: { Baru: 0 } }),
    ).toEqual(['3 peminjaman terlambat lebih dari 30 hari']);
  });
});
