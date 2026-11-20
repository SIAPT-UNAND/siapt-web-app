const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
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