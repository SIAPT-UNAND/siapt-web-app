import Modal from '../../components/Modal.jsx';
import { Ikon } from './ikonPeminjaman.jsx';
import './peminjaman.css';

/**
 * Popup saat buku atau anggota belum bisa meminjam (memakai komponen Modal bersama).
 * Dipakai halaman Peminjaman Mandiri dan Pelayanan Peminjaman Buku (pustakawan).
 */
export default function PeringatanPinjam({ peringatan, onClose }) {
  return (
    <Modal isOpen={Boolean(peringatan)} title="Buku belum bisa dipinjam" onClose={onClose}>
      {peringatan && (
        <div className="pm-alert">
          <span className="pm-alert-icon">
            <Ikon nama="alert" ukuran={28} />
          </span>
          {peringatan.judul && <strong className="pm-alert-book">{peringatan.judul}</strong>}
          <p className="pm-alert-text">{peringatan.pesan}</p>
          <button type="button" className="btn-primary pm-btn pm-btn-block" onClick={onClose} autoFocus>
            Mengerti
          </button>
        </div>
      )}
    </Modal>
  );
}
