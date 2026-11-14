import { JALUR_PEMINJAMAN } from '../constants/status.js';
import {
  ambilKetentuan,
  buatPeminjaman,
  formatPeminjaman,
} from '../services/peminjaman.service.js';

/** GET /api/peminjaman/ketentuan */
export const getKetentuan = async (req, res, next) => {
  try {
    const ketentuan = await ambilKetentuan();
    res.status(200).json({ success: true, data: ketentuan });
  } catch (err) {
    next(err);
  }
};

/** POST /api/peminjaman/mandiri  (UC-03) */
export const postPeminjamanMandiri = async (req, res, next) => {
  try {
    const idKoleksi = Number(req.body?.id_koleksi);
    if (!Number.isInteger(idKoleksi) || idKoleksi <= 0) {
      return res.status(400).json({ success: false, message: 'Pilih koleksi yang akan dipinjam.' });
    }

    const kunci = req.body?.kunci_idempotensi;
    if (kunci !== undefined && (typeof kunci !== 'string' || !kunci.trim() || kunci.length > 255)) {
      return res.status(400).json({ success: false, message: 'Kunci transaksi tidak valid.' });
    }

    const { peminjaman, baru } = await buatPeminjaman({
      idAnggota: req.pengguna.id_pengguna, // anggota hanya bisa meminjam atas namanya sendiri
      idKoleksi,
      jalur: JALUR_PEMINJAMAN.MANDIRI,
      kunciIdempotensi: kunci?.trim() || null,
    });

    res.status(baru ? 201 : 200).json({ success: true, data: formatPeminjaman(peminjaman) });
  } catch (err) {
    next(err);
  }
};
