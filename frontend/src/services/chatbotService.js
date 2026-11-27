import { apiRequest } from './apiClient.js';

export function getRiwayat() {
  return apiRequest('/chatbot/riwayat');
}

export function kirimPesan(pesan) {
  return apiRequest('/chatbot/pesan', { method: 'POST', body: { pesan } });
}