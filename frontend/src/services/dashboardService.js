import { apiRequest } from './apiClient.js';

export function ambilRingkasan() {
  return apiRequest('/dashboard/ringkasan');
}

export function ambilKoleksi() {
  return apiRequest('/dashboard/koleksi');
}

export function ambilSirkulasi(periode) {
  return apiRequest(`/dashboard/sirkulasi?periode=${encodeURIComponent(periode)}`);
}

export function ambilDenda(periode) {
  return apiRequest(`/dashboard/denda?periode=${encodeURIComponent(periode)}`);
}

export function ambilLayanan(periode) {
  return apiRequest(`/dashboard/layanan?periode=${encodeURIComponent(periode)}`);
}
