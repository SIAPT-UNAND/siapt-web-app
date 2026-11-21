import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient.js', () => ({ apiRequest: vi.fn() }));

const { apiRequest } = await import('./apiClient.js');
const svc = await import('./konfigurasiService.js');

describe('konfigurasiService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiRequest.mockResolvedValue('ok');
  });

  it.each([
    ['daftarKonfigurasi', () => svc.daftarKonfigurasi(), ['/admin/konfigurasi']],
    [
      'ubahKonfigurasi',
      () => svc.ubahKonfigurasi('durasi_pinjam_hari', '14'),
      ['/admin/konfigurasi/durasi_pinjam_hari', { method: 'PATCH', body: { nilai: '14' } }],
    ],
    ['riwayat tanpa filter', () => svc.riwayatKonfigurasi(), ['/admin/konfigurasi/riwayat']],
    [
      'riwayat dengan filter',
      () => svc.riwayatKonfigurasi({ kunci: 'tarif_denda_per_hari', batas: 20 }),
      ['/admin/konfigurasi/riwayat?kunci=tarif_denda_per_hari&batas=20'],
    ],
  ])('%s memanggil apiRequest dengan benar', async (_nama, panggil, argumen) => {
    await expect(panggil()).resolves.toBe('ok');
    expect(apiRequest).toHaveBeenCalledWith(...argumen);
  });
});
