/**
 * SEMENTARA: antarmuka disalin dari apiClient.js milik Clara (feat/clara-auth-chatbot):
 * `apiRequest(path, { method, body })` dan `ApiError`. Saat PR Clara masuk staging,
 * pakai file milik Clara dan hapus bagian "bypass auth" di bawah.
 *
 * Bypass auth (hanya untuk uji lokal, default MATI):
 * - frontend/.env.local   VITE_AUTH_SEMENTARA=true
 * - backend/app/.env      AUTH_SEMENTARA=true
 * Header `x-pengenal` diambil dari akun yang dipilih di halaman login mock.
 * VITE_PENGENAL_SEMENTARA hanya dipakai sebelum ada login/logout; setelah logout tidak ada header.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// undefined = belum pernah diatur (boleh pakai cadangan env); null = sudah logout (tanpa identitas).
let pengenalSementara;

export function aturPengenalSementara(pengenal) {
  pengenalSementara = (pengenal ? String(pengenal).trim() : '') || null;
}

/** Hanya untuk tes: kembali ke keadaan awal "belum pernah diatur". */
export function resetPengenalSementara() {
  pengenalSementara = undefined;
}

export function headerBypass(env = import.meta.env) {
  if (env.VITE_AUTH_SEMENTARA !== 'true') return {};
  const pengenal =
    pengenalSementara === undefined ? String(env.VITE_PENGENAL_SEMENTARA ?? '').trim() : pengenalSementara;
  return pengenal ? { 'x-pengenal': pengenal } : {};
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { ...headerBypass() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Tidak dapat terhubung ke server. Periksa koneksi atau pastikan backend sedang berjalan.',
      0,
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // respons bukan JSON
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.message || 'Terjadi kesalahan pada server.', response.status);
  }
  return payload.data;
}
