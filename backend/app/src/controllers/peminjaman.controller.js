import { JALUR_PEMINJAMAN } from '../constants/status.js';
import {
  ambilKetentuan,
  buatPeminjaman,
  cekKelayakanPinjam,
  formatPeminjaman,
} from '../services/peminjaman.service.js';

/** GET /api/peminjaman/cek?kode_koleksi=KOL-CS-001 */
export const getCekKelayakan = async (req, res, next) => {
  try {
    const kodeKoleksi = typeof req.query.kode_koleksi === 'string' ? req.query.kode_koleksi.trim() : '';
    if (!kodeKoleksi) {
      return res.status(400).json({ success: false, message: 'Masukkan kode koleksi terlebih dahulu.' });
    }
    const data = await cekKelayakanPinjam({ idAnggota: req.pengguna.id_pengguna, kodeKoleksi });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

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
    // Koleksi bisa dipilih lewat kode_koleksi (mis. KOL-CS-001) atau id_koleksi.
    const kodeKoleksi = typeof req.body?.kode_koleksi === 'string' ? req.body.kode_koleksi.trim() : '';
    const idKoleksi = Number(req.body?.id_koleksi);
    const idValid = Number.isInteger(idKoleksi) && idKoleksi > 0;
    if (!kodeKoleksi && !idValid) {
      return res.status(400).json({ success: false, message: 'Pilih koleksi yang akan dipinjam.' });
    }

    const kunci = req.body?.kunci_idempotensi;
    if (kunci !== undefined && (typeof kunci !== 'string' || !kunci.trim() || kunci.length > 255)) {
      return res.status(400).json({ success: false, message: 'Kunci transaksi tidak valid.' });
    }

    const { peminjaman, baru } = await buatPeminjaman({
      idAnggota: req.pengguna.id_pengguna, // anggota hanya bisa meminjam atas namanya sendiri
      idKoleksi: idValid ? idKoleksi : undefined,
      kodeKoleksi: kodeKoleksi || undefined,
      jalur: JALUR_PEMINJAMAN.MANDIRI,
      kunciIdempotensi: kunci?.trim() || null,
    });

    res.status(baru ? 201 : 200).json({ success: true, data: formatPeminjaman(peminjaman) });
  } catch (err) {
    next(err);
  }
};
