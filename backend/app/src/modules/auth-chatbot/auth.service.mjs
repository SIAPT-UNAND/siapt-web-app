import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret, SESSION_HOURS } from './config.mjs';

// Hash palsu agar waktu respons sama baik akun ada maupun tidak
const DUMMY_HASH = bcrypt.hashSync('dummy-password-untuk-menyamakan-waktu', 10);

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export function validateLoginInput(body) {
  const pengenal = String(body?.pengenal ?? '').trim();
  const kataSandi = String(body?.kata_sandi ?? '');

  if (!pengenal || !kataSandi) {
    return { error: 'NIM/NIP dan kata sandi wajib diisi.' };
  }
  if (pengenal.length > 100 || kataSandi.length > 200) {
    return { error: 'Masukan terlalu panjang.' };
  }
  return { pengenal, kataSandi };
}

export function toPublicUser(akun) {
  return {
    id: akun.id_pengguna,
    nama: akun.nama || akun.pengenal,
    pengenal: akun.pengenal,
    role: akun.role.nama_role,
  };
}

export async function authenticate(prisma, pengenal, kataSandi) {
  const akun = await prisma.pengguna.findUnique({
    where: { pengenal },
    include: { role: true },
  });

  const hash = akun?.kata_sandi_hash || DUMMY_HASH;
  const cocok = await bcrypt.compare(kataSandi, hash);

  // Pesan umum agar tidak membocorkan apakah akun ada atau tidak
  if (!akun || !akun.kata_sandi_hash || !cocok) {
    throw new AuthError(401, 'NIM/NIP atau kata sandi salah.');
  }
  if (akun.status_aktif !== true) {
    throw new AuthError(403, 'Akun kamu tidak aktif. Silakan hubungi Admin.');
  }
  return akun;
}

export function signSessionToken(akun) {
  return jwt.sign({}, getJwtSecret(), {
    algorithm: 'HS256',
    subject: String(akun.id_pengguna),
    expiresIn: `${SESSION_HOURS}h`,
  });
}

export function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
}