/**
 * Error yang diharapkan (validasi, tidak ditemukan, konflik).
 * middleware/errorHandler.js membaca `statusCode` dan `message`,
 * jadi pesan di sini harus ramah pengguna tanpa detail teknis.
 */
export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export default AppError;
