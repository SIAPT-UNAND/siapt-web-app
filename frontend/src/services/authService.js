import { apiRequest } from './apiClient.js';

export function login(pengenal, kataSandi) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { pengenal, kata_sandi: kataSandi },
  });
}

export function logout() {
  return apiRequest('/auth/logout', { method: 'POST', body: {} });
}

export function getSession() {
  return apiRequest('/auth/me');
}

export function getBantuan() {
  return apiRequest('/auth/bantuan');
}