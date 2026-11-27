import { apiRequest } from './apiClient.js';

// Empat peran resmi A2 §3.1, dalam urutan tampilan.
export const PERAN_RESMI = ['Anggota', 'Pustakawan', 'Pengelola', 'Admin'];

export function buatQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [kunci, nilai] of Object.entries(params)) {
    if (nilai !== undefined && nilai !== null && nilai !== '') {
      query.set(kunci, String(nilai));
    }
  }
  const teks = query.toString();
  return teks ? `?${teks}` : '';
}

export function daftarAkun({ q, role, status, halaman, per_halaman } = {}) {
  return apiRequest(`/admin/akun${buatQuery({ q, role, status, halaman, per_halaman })}`);
}

export function ambilAkun(id) {
  return apiRequest(`/admin/akun/${id}`);
}

export function tambahAkun({ pengenal, nama, role, kata_sandi }) {
  return apiRequest('/admin/akun', {
    method: 'POST',
    body: { pengenal, nama, role, kata_sandi },
  });
}

export function ubahAkun(id, { nama, pengenal }) {
  return apiRequest(`/admin/akun/${id}`, { method: 'PATCH', body: { nama, pengenal } });
}

export function ubahStatusAkun(id, statusAktif, alasan) {
  const body = statusAktif ? { status_aktif: true } : { status_aktif: false, alasan };
  return apiRequest(`/admin/akun/${id}/status`, { method: 'PATCH', body });
}

export function resetKataSandi(id, kataSandiBaru) {
  return apiRequest(`/admin/akun/${id}/kata-sandi`, {
    method: 'PATCH',
    body: { kata_sandi_baru: kataSandiBaru },
  });
}

export function daftarPeran() {
  return apiRequest('/admin/peran');
}

export function ubahPeran(id, role) {
  return apiRequest(`/admin/akun/${id}/peran`, { method: 'PATCH', body: { role } });
}
