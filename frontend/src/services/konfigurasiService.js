import { apiRequest } from './apiClient.js';
import { buatQuery } from './akunService.js';

export function daftarKonfigurasi() {
  return apiRequest('/admin/konfigurasi');
}

export function ubahKonfigurasi(kunci, nilai) {
  return apiRequest(`/admin/konfigurasi/${encodeURIComponent(kunci)}`, {
    method: 'PATCH',
    body: { nilai },
  });
}

export function riwayatKonfigurasi({ kunci, batas } = {}) {
  return apiRequest(`/admin/konfigurasi/riwayat${buatQuery({ kunci, batas })}`);
}
