import { JALUR_PEMINJAMAN } from '../constants/status.js';
import {
  ambilKetentuan,
  ambilRiwayatAnggota,
  ambilTransaksiTerbaru,
  buatPeminjaman,
  buatPeminjamanViaPustakawan,
  cekKelayakanPinjam,
  formatPeminjaman,
  infoBuku,
  ringkasanAnggota,
  FILTER_STATUS_RIWAYAT,
} from '../services/peminjaman.service.js';

const teks = (nilai) => (typeof nilai === 'string' ? nilai.trim() : '');

const kunciValid = (kunci) =>
  kunci === undefined || (typeof kunci === 'string' && kunci.trim() && kunci.length <= 255);

/** GET /api/peminjaman/pustakawan/anggota/:pengenal  (UC-09) */
export const getAnggotaUntukPustakawan = async (req, res, next) => {
  try {
    const pengenal = teks(req.params.pengenal);
    if (!pengenal) {
      return res.status(400).json({ success: false, message: 'Masukkan NIM/ID anggota.' });
    }
    const data = await ringkasanAnggota(pengenal);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/** GET /api/peminjaman/pustakawan/buku/:kode  (UC-09, pratinjau buku) */
export const getInfoBuku = async (req, res, next) => {
  try {
    const kode = teks(req.params.kode);
    if (!kode) {
      return res.status(400).json({ success: false, message: 'Masukkan kode eksemplar atau koleksi.' });
    }
    const data = await infoBuku(kode);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/** POST /api/peminjaman/pustakawan  (UC-09) */
export const postPeminjamanPustakawan = async (req, res, next) => {
  try {
    const pengenalAnggota = teks(req.body?.pengenal_anggota);
    const kodeBuku = teks(req.body?.kode);
    if (!pengenalAnggota || !kodeBuku) {
      return res
        .status(400)
        .json({ success: false, message: 'Isi NIM/ID anggota dan kode eksemplar atau koleksi.' });
    }
    const kunci = req.body?.kunci_idempotensi;
    if (!kunciValid(kunci)) {
      return res.status(400).json({ success: false, message: 'Kunci transaksi tidak valid.' });
    }

    const { peminjaman, baru } = await buatPeminjamanViaPustakawan({
      pengenalAnggota,
      kodeBuku,
      idPustakawan: req.pengguna.id_pengguna, // pustakawan pencatat (A2 UC-09)
      kunciIdempotensi: kunci?.trim() || null,
    });
    res.status(baru ? 201 : 200).json({ success: true, data: formatPeminjaman(peminjaman) });
  } catch (err) {
    next(err);
  }
};

/** GET /api/peminjaman/terbaru  (tabel transaksi sirkulasi terbaru) */
export const getTransaksiTerbaru = async (req, res, next) => {
  try {
    const data = await ambilTransaksiTerbaru(5);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/** GET /api/peminjaman/saya?status=semua|dipinjam|dikembalikan&q=kata  (UC-04) */
export const getRiwayatSaya = async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'semua';
    if (!Object.hasOwn(FILTER_STATUS_RIWAYAT, status)) {
      return res.status(400).json({ success: false, message: 'Filter status tidak dikenal.' });
    }
    const kataKunci = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';

    const data = await ambilRiwayatAnggota({
      idAnggota: req.pengguna.id_pengguna, // hanya transaksi milik sendiri
      status,
      kataKunci,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

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
    if (!kunciValid(kunci)) {
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
