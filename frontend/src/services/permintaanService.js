import { apiRequest } from './apiClient.js';

// Anggota
export function ajukanPermintaan(idPesan, isi) {
  return apiRequest('/permintaan', {
    method: 'POST',
    body: { id_pesan: idPesan, isi_permintaan: isi },
  });
}

export function getPermintaanSaya() {
  return apiRequest('/permintaan/saya');
}

// Pustakawan
export function getDaftarPermintaan(status) {
  const query = status && status !== 'Semua' ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/pustakawan/permintaan${query}`);
}

export function getDetailPermintaan(id) {
  return apiRequest(`/pustakawan/permintaan/${id}`);
}

export function tanggapiPermintaan(id, payload) {
  return apiRequest(`/pustakawan/permintaan/${id}/tanggapan`, {
    method: 'POST',
    body: payload,
  });
}