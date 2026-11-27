import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient.js', () => ({ apiRequest: vi.fn() }));

const { apiRequest } = await import('./apiClient.js');
const akun = await import('./akunService.js');

describe('akunService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiRequest.mockResolvedValue('ok');
  });

  it('buatQuery mengabaikan nilai kosong', () => {
    expect(akun.buatQuery()).toBe('');
    expect(akun.buatQuery({ q: 'siti ani', role: '', status: undefined, halaman: 2, x: null })).toBe(
      '?q=siti+ani&halaman=2',
    );
  });

  it.each([
    ['daftarAkun tanpa filter', () => akun.daftarAkun(), ['/admin/akun']],
    [
      'daftarAkun dengan filter',
      () => akun.daftarAkun({ q: 'rafi', role: 'Admin', status: 'aktif', halaman: 3, per_halaman: 10 }),
      ['/admin/akun?q=rafi&role=Admin&status=aktif&halaman=3&per_halaman=10'],
    ],
    ['ambilAkun', () => akun.ambilAkun(12), ['/admin/akun/12']],
    [
      'tambahAkun',
      () => akun.tambahAkun({ pengenal: 'p01', nama: 'N', role: 'Anggota', kata_sandi: 'rahasia123', ulangi: 'x' }),
      ['/admin/akun', { method: 'POST', body: { pengenal: 'p01', nama: 'N', role: 'Anggota', kata_sandi: 'rahasia123' } }],
    ],
    [
      'ubahAkun',
      () => akun.ubahAkun(12, { nama: 'N', pengenal: 'p01' }),
      ['/admin/akun/12', { method: 'PATCH', body: { nama: 'N', pengenal: 'p01' } }],
    ],
    [
      'ubahStatusAkun nonaktif',
      () => akun.ubahStatusAkun(12, false, 'Lulus'),
      ['/admin/akun/12/status', { method: 'PATCH', body: { status_aktif: false, alasan: 'Lulus' } }],
    ],
    [
      'ubahStatusAkun aktif',
      () => akun.ubahStatusAkun(12, true, 'diabaikan'),
      ['/admin/akun/12/status', { method: 'PATCH', body: { status_aktif: true } }],
    ],
    [
      'resetKataSandi',
      () => akun.resetKataSandi(12, 'sandiBaru1'),
      ['/admin/akun/12/kata-sandi', { method: 'PATCH', body: { kata_sandi_baru: 'sandiBaru1' } }],
    ],
    ['daftarPeran', () => akun.daftarPeran(), ['/admin/peran']],
    [
      'ubahPeran',
      () => akun.ubahPeran(12, 'Pustakawan'),
      ['/admin/akun/12/peran', { method: 'PATCH', body: { role: 'Pustakawan' } }],
    ],
  ])('%s memanggil apiRequest dengan path, method, dan body yang benar', async (_nama, panggil, argumen) => {
    await expect(panggil()).resolves.toBe('ok');
    expect(apiRequest).toHaveBeenCalledWith(...argumen);
  });
});
