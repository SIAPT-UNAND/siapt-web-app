import prisma from '../lib/prisma.js';

/**
 * SEMENTARA: pengganti login sampai modul autentikasi (UC-01) selesai.
 * Identitas diambil dari header `x-id-pengguna`.
 * Ganti middleware ini dengan middleware autentikasi asli nanti;
 * route cukup membutuhkan `req.pengguna` berisi data pengguna + role.
 */
export const penggunaSementara = async (req, res, next) => {
  try {
    const id = Number(req.get('x-id-pengguna'));
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: { id_pengguna: id },
      include: { role: true },
    });
    if (!pengguna) {
      return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
    }

    req.pengguna = pengguna;
    next();
  } catch (err) {
    next(err);
  }
};

/** Hanya izinkan peran tertentu. */
export const hanyaPeran = (...peran) => (req, res, next) => {
  if (!req.pengguna || !peran.includes(req.pengguna.role?.nama_role)) {
    return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke fitur ini.' });
  }
  next();
};
