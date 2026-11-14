// Warna sampul buku dipilih tetap berdasarkan judul
const WARNA_SAMPUL = ['#0a4435', '#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c'];

export const warnaSampul = (judul = '') =>
  WARNA_SAMPUL[[...judul].reduce((n, c) => n + c.charCodeAt(0), 0) % WARNA_SAMPUL.length];
