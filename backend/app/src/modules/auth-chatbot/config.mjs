import 'dotenv/config';

export const COOKIE_NAME = 'siapt_token';
export const SESSION_HOURS = 2;

// Kunci parameter pada tabel konfigurasi_sistem
export const KUNCI_CHATBOT_AKTIF = 'chatbot_aktif';
export const KUNCI_CHATBOT_PANJANG = 'chatbot_panjang_maks';
export const PANJANG_PESAN_DEFAULT = 300;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET belum diatur atau kurang dari 32 karakter di backend/app/.env');
  }
  return secret;
}

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

// Nomor WhatsApp Pustakawan, hanya digit dengan kode negara. Default: +62 823-6950-2005
export function getWhatsAppNumber() {
  return String(process.env.WA_NUMBER || '6282369502005').replace(/\D/g, '');
}

export function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  };
}