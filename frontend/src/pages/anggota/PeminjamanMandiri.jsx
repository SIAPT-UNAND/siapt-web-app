import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { Ikon } from './ikonPeminjaman.jsx';
import { warnaSampul } from './warnaSampul.js';
import './peminjaman.css';

const formatTanggal = (tanggal, bulan = 'long') =>
  new Date(tanggal).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: bulan,
    year: 'numeric',
  });

const LANGKAH = ['Pilih buku', 'Konfirmasi', 'Bukti peminjaman'];

/** Popup saat buku belum bisa dipinjam (memakai komponen Modal bersama). */
export function PeringatanPinjam({ peringatan, onClose }) {
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

export default function PeminjamanMandiri({
  cart,
  ketentuan,
  hasilPinjam = [],
  sedangMemproses = false,
  sedangMengecek = false,
  onAddToCart,
  onRemoveFromCart,
  onConfirmCheckout,
  onTutupHasil,
}) {
  const [kodeInput, setKodeInput] = useState('');
  const [umpanBalik, setUmpanBalik] = useState(null);
  const [hariIni] = useState(() => Date.now());

  const maksPinjam = ketentuan?.maks_pinjam;
  const durasiHari = ketentuan?.durasi_hari;
  const jatuhTempo = durasiHari && hariIni + durasiHari * 24 * 60 * 60 * 1000;
  const berhasil = hasilPinjam.filter((h) => h.berhasil);
  const gagal = hasilPinjam.filter((h) => !h.berhasil);
  const langkahAktif = hasilPinjam.length > 0 ? 3 : cart.length > 0 ? 2 : 1;

  const handleTambah = async (e) => {
    e.preventDefault();
    const kode = kodeInput.trim();
    if (!kode) {
      setUmpanBalik({ jenis: 'error', teks: 'Masukkan kode koleksi terlebih dahulu.' });
      return;
    }

    setUmpanBalik(null);
    // Dicek ke database; jika tidak bisa dipinjam, popup peringatan muncul dari halaman induk
    const judul = await onAddToCart(kode);
    if (judul) {
      setUmpanBalik({ jenis: 'sukses', teks: `"${judul}" ditambahkan ke keranjang.` });
      setKodeInput('');
    }
  };

  return (
    <section className="self-loan-section pm">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Peminjaman Mandiri</h2>
          <p className="page-subtitle">
            Masukkan kode koleksi, periksa keranjang, lalu konfirmasi. Peminjaman yang valid
            langsung tercatat.
          </p>
        </div>
      </div>

      <ol className="pm-steps" aria-label="Tahapan peminjaman">
        {LANGKAH.map((label, i) => {
          const no = i + 1;
          const status = no < langkahAktif ? 'selesai' : no === langkahAktif ? 'aktif' : '';
          return (
            <li key={label} className={`pm-step ${status}`}>
              <span className="pm-step-dot">{no < langkahAktif ? <Ikon nama="check" ukuran={14} /> : no}</span>
              <span className="pm-step-label">{label}</span>
            </li>
          );
        })}
      </ol>

      {hasilPinjam.length > 0 ? (
        <div className="pm-card pm-result">
          {berhasil.length > 0 ? (
            <>
              <div className="pm-result-icon sukses">
                <Ikon nama="check" ukuran={34} />
              </div>
              <h3 className="pm-result-title">
                {berhasil.length === 1
                  ? 'Peminjaman berhasil dicatat'
                  : `${berhasil.length} peminjaman berhasil dicatat`}
              </h3>
              <p className="pm-result-sub">
                Tunjukkan bukti berikut di meja sirkulasi untuk mengambil buku, dan perhatikan
                tanggal jatuh temponya.
              </p>
            </>
          ) : (
            <>
              <div className="pm-result-icon gagal">
                <Ikon nama="alert" ukuran={32} />
              </div>
              <h3 className="pm-result-title">Peminjaman belum dapat diproses</h3>
              <p className="pm-result-sub">Periksa alasan di bawah ini, lalu coba lagi.</p>
            </>
          )}

          <div className="pm-receipts">
            {berhasil.map(({ judul, data }) => (
              <article key={data.nomor_transaksi} className="pm-receipt">
                <div className="pm-receipt-head">
                  <span className="pm-receipt-label">Bukti peminjaman</span>
                  <span className="status-pill status-active">Dipinjam</span>
                </div>
                <strong className="pm-receipt-no">{data.nomor_transaksi}</strong>
                <span className="pm-receipt-title">{judul}</span>
                <span className="pm-receipt-meta">
                  Eksemplar {data.eksemplar?.kode_eksemplar}
                  {data.eksemplar?.lokasi_rak && ` · Rak ${data.eksemplar.lokasi_rak}`}
                </span>
                <div className="pm-receipt-dates">
                  <div>
                    <span>Tanggal pinjam</span>
                    <strong>{formatTanggal(data.tanggal_pinjam, 'short')}</strong>
                  </div>
                  <div>
                    <span>Jatuh tempo</span>
                    <strong className="pm-due">{formatTanggal(data.tanggal_jatuh_tempo, 'short')}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {gagal.length > 0 && (
            <ul className="pm-failed" aria-label="Peminjaman yang ditolak">
              {gagal.map((h) => (
                <li key={h.judul}>
                  <Ikon nama="x" ukuran={16} />
                  <span>
                    <strong>{h.judul}</strong>
                    {h.pesan}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="btn-primary pm-btn" onClick={onTutupHasil}>
            Pinjam buku lain
          </button>
        </div>
      ) : (
        <div className="pm-grid">
          <div className="pm-col">
            <div className="pm-card">
              <h3 className="card-heading">Tambah buku</h3>
              <form onSubmit={handleTambah} className="pm-form" noValidate>
                <label className="pm-input-wrap">
                  <span className="pm-input-icon">
                    <Ikon nama="scan" />
                  </span>
                  <input
                    type="text"
                    className="pm-input"
                    aria-label="Kode koleksi"
                    placeholder="Kode koleksi, misal KOL-CS-001"
                    disabled={sedangMengecek}
                    value={kodeInput}
                    onChange={(e) => {
                      setKodeInput(e.target.value);
                      if (umpanBalik?.jenis === 'error') setUmpanBalik(null);
                    }}
                  />
                </label>
                <button type="submit" className="btn-primary pm-btn" disabled={sedangMengecek}>
                  {sedangMengecek ? (
                    <>
                      <span className="pm-spinner" aria-hidden="true" />
                      Memeriksa…
                    </>
                  ) : (
                    <>
                      <Ikon nama="plus" ukuran={16} />
                      Tambahkan
                    </>
                  )}
                </button>
              </form>
              {umpanBalik && (
                <p className={`pm-feedback ${umpanBalik.jenis}`} role="status">
                  <Ikon nama={umpanBalik.jenis === 'error' ? 'alert' : 'check'} ukuran={16} />
                  {umpanBalik.teks}
                </p>
              )}
            </div>

            <div className="pm-card pm-rules">
              <h3 className="card-heading">Sebelum meminjam</h3>
              {ketentuan ? (
                <ul>
                  <li>
                    <Ikon nama="check" ukuran={15} />
                    Maksimal <strong>{maksPinjam} eksemplar</strong> dipinjam bersamaan
                  </li>
                  <li>
                    <Ikon nama="check" ukuran={15} />
                    Masa pinjam <strong>{durasiHari} hari</strong> kalender
                  </li>
                  {ketentuan.tarif_denda_per_hari !== null && (
                    <li>
                      <Ikon nama="check" ukuran={15} />
                      Denda keterlambatan{' '}
                      <strong>Rp{ketentuan.tarif_denda_per_hari.toLocaleString('id-ID')}/hari</strong>
                    </li>
                  )}
                  <li>
                    <Ikon nama="check" ukuran={15} />
                    Tidak memiliki denda yang belum lunas
                  </li>
                </ul>
              ) : (
                <p className="pm-muted">Ketentuan peminjaman belum dapat dimuat.</p>
              )}
            </div>
          </div>

          <div className="pm-card pm-cart">
            <div className="pm-cart-head">
              <h3 className="card-heading">Keranjang peminjaman</h3>
              <span className="pm-count">
                {cart.length}
                {maksPinjam ? ` / ${maksPinjam}` : ''}
              </span>
            </div>
            {maksPinjam && (
              <div
                className="pm-quota"
                role="progressbar"
                aria-label="Kuota keranjang"
                aria-valuemin={0}
                aria-valuemax={maksPinjam}
                aria-valuenow={cart.length}
              >
                <span style={{ width: `${Math.min(cart.length / maksPinjam, 1) * 100}%` }} />
              </div>
            )}

            {cart.length === 0 ? (
              <div className="pm-empty">
                <span className="pm-empty-icon">
                  <Ikon nama="book" ukuran={28} />
                </span>
                <p>Keranjang masih kosong</p>
                <span className="pm-muted">
                  Masukkan kode koleksi atau pilih &quot;Pinjam Mandiri&quot; dari katalog.
                  Ketersediaan langsung dicek saat buku ditambahkan.
                </span>
              </div>
            ) : (
              <>
                <ul className="pm-cart-list">
                  {cart.map((item) => (
                    <li key={item.id_koleksi} className="pm-cart-item">
                      <span className="pm-cover" style={{ background: warnaSampul(item.judul) }}>
                        {item.judul?.charAt(0)}
                      </span>
                      <span className="pm-cart-info">
                        <strong>{item.judul}</strong>
                        <span>
                          {item.kode_koleksi}
                          {item.lokasi_rak && ` · Rak ${item.lokasi_rak}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="pm-remove"
                        onClick={() => onRemoveFromCart(item.id_koleksi)}
                        aria-label={`Hapus ${item.judul} dari keranjang`}
                        disabled={sedangMemproses}
                      >
                        <Ikon nama="x" ukuran={16} />
                      </button>
                    </li>
                  ))}
                </ul>

                <dl className="pm-summary">
                  <div>
                    <dt>
                      <Ikon nama="clock" ukuran={16} />
                      Durasi
                    </dt>
                    <dd>{durasiHari ? `${durasiHari} hari` : '-'}</dd>
                  </div>
                  <div>
                    <dt>
                      <Ikon nama="calendar" ukuran={16} />
                      Jatuh tempo
                    </dt>
                    <dd>{jatuhTempo ? formatTanggal(jatuhTempo) : '-'}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="btn-primary pm-btn pm-btn-block"
                  onClick={onConfirmCheckout}
                  disabled={sedangMemproses}
                >
                  {sedangMemproses ? (
                    <>
                      <span className="pm-spinner" aria-hidden="true" />
                      Memproses…
                    </>
                  ) : (
                    `Konfirmasi peminjaman (${cart.length})`
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
