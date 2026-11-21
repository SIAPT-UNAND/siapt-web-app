import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, aturPengenalSementara, headerBypass } from './apiClient.js';

function responsJson(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

describe('headerBypass', () => {
  afterEach(() => {
    aturPengenalSementara(null);
  });

  it('mati jika VITE_AUTH_SEMENTARA bukan "true"', () => {
    aturPengenalSementara('ADM-001');
    expect(headerBypass({})).toEqual({});
    expect(headerBypass({ VITE_AUTH_SEMENTARA: 'false', VITE_PENGENAL_SEMENTARA: 'ADM-001' })).toEqual({});
  });

  it('memakai pengenal dari login mock jika ada', () => {
    aturPengenalSementara(' 2211521001 ');
    expect(headerBypass({ VITE_AUTH_SEMENTARA: 'true', VITE_PENGENAL_SEMENTARA: 'ADM-001' })).toEqual({
      'x-pengenal': '2211521001',
    });
  });

  it('memakai VITE_PENGENAL_SEMENTARA jika belum login', () => {
    expect(headerBypass({ VITE_AUTH_SEMENTARA: 'true', VITE_PENGENAL_SEMENTARA: 'ADM-001' })).toEqual({
      'x-pengenal': 'ADM-001',
    });
  });

  it('tidak mengirim header jika pengenal kosong', () => {
    expect(headerBypass({ VITE_AUTH_SEMENTARA: 'true' })).toEqual({});
  });
});

describe('apiRequest', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    aturPengenalSementara(null);
  });

  it('GET mengembalikan data dan memakai cookie sesi', async () => {
    // Netral terhadap frontend/.env.local milik pengembang
    vi.stubEnv('VITE_AUTH_SEMENTARA', 'false');
    fetchMock.mockResolvedValue(responsJson(200, { success: true, data: [1, 2] }));

    await expect(apiRequest('/admin/peran')).resolves.toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/peran', {
      method: 'GET',
      credentials: 'include',
      headers: {},
      body: undefined,
    });
  });

  it('mengirim body JSON dan header bypass saat aktif', async () => {
    vi.stubEnv('VITE_AUTH_SEMENTARA', 'true');
    aturPengenalSementara('ADM-001');
    fetchMock.mockResolvedValue(responsJson(201, { success: true, data: { id: 1 } }));

    await apiRequest('/admin/akun', { method: 'POST', body: { nama: 'A' } });

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/akun', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-pengenal': 'ADM-001', 'Content-Type': 'application/json' },
      body: '{"nama":"A"}',
    });
  });

  it('melempar ApiError dengan pesan dari server', async () => {
    fetchMock.mockResolvedValue(responsJson(409, { success: false, message: 'Pengenal sudah digunakan.' }));

    const err = await apiRequest('/admin/akun').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Pengenal sudah digunakan.');
    expect(err.status).toBe(409);
  });

  it('pesan umum jika respons bukan JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('bukan json'); } });

    const err = await apiRequest('/admin/akun').catch((e) => e);
    expect(err.message).toBe('Terjadi kesalahan pada server.');
    expect(err.status).toBe(502);
  });

  it('pesan koneksi jika server tidak dapat dihubungi', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const err = await apiRequest('/admin/akun').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Tidak dapat terhubung/);
  });
});
