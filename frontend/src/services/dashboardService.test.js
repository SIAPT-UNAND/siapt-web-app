import { describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient.js', () => ({ apiRequest: vi.fn(async () => 'ok') }));

const { apiRequest } = await import('./apiClient.js');
const svc = await import('./dashboardService.js');

describe('dashboardService', () => {
  it.each([
    ['ambilRingkasan', () => svc.ambilRingkasan(), '/dashboard/ringkasan'],
    ['ambilKoleksi', () => svc.ambilKoleksi(), '/dashboard/koleksi'],
    ['ambilSirkulasi', () => svc.ambilSirkulasi('7h'), '/dashboard/sirkulasi?periode=7h'],
    ['ambilDenda', () => svc.ambilDenda('90h'), '/dashboard/denda?periode=90h'],
    ['ambilLayanan', () => svc.ambilLayanan('bulan'), '/dashboard/layanan?periode=bulan'],
  ])('%s memanggil GET %s', async (_nama, panggil, path) => {
    await expect(panggil()).resolves.toBe('ok');
    expect(apiRequest).toHaveBeenLastCalledWith(path);
  });
});
