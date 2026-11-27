import { useState } from 'react';
import { Ikon } from './ikonPeminjaman.jsx';
import SampulBuku from './SampulBuku.jsx';
import BuktiCetak from './BuktiCetak.jsx';
import { cetakBukti } from './cetakBukti.js';
import './peminjaman.css';

const formatTanggal = (tanggal) => {
  if (!tanggal) return '-';
  const bagian = typeof tanggal === 'string' && /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
  if (bagian) {
    const dateOnly = new Date(Date.UTC(
      Number(bagian[1]),
      Number(bagian[2]) - 1,
      Number(bagian[3]),
    ));
    return dateOnly.toLocaleDateString('id-ID', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return new Date(tanggal).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** Hasil setelah konfirmasi: nomor transaksi tiap buku dan yang ditolak. */
function HasilPinjam({ hasil, onTutup }) {
  const berhasil = hasil.filter((h) => h.berhasil);
  const gagal = hasil.filter((h) => !h.berhasil);

  return (
    <div className="pm-card pm-hasil" role="status">
      <strong className={`pm-hasil-head ${berhasil.length ? '' : 'gagal'}`}>
        <Ikon nama={berhasil.length ? 'check' : 'alert'} ukuran={18} />
        {berhasil.length
          ? `${berhasil.length} peminjaman tercatat`
          : 'Peminjaman belum dapat diproses'}
      </strong>

      {berhasil.length > 0 && (
        <>
          <ul className="pm-list">
            {berhasil.map(({ judul, data }) => (
              <li key={data.nomor_transaksi} className="pm-list-item">
                <SampulBuku judul={judul} src={data.koleksi?.sampul} />
                <span className="pm-list-info">
                  <span className="pm-list-title">{judul}</span>
                  <span className="pm-list-meta">Jatuh tempo {formatTanggal(data.tanggal_jatuh_tempo)}</span>
                </span>
                <span className="pm-mono">{data.nomor_transaksi}</span>
              </li>
            ))}
          </ul>
          <p className="pm-muted">
            Cetak atau simpan bukti ini, lalu tunjukkan di meja sirkulasi untuk mengambil buku.
          </p>
        </>
      )}

      {gagal.length > 0 && (
        <ul className="pm-list pm-list-gagal">
          {gagal.map((h) => (
            <li key={h.judul}>
              <span className="pm-list-title">{h.judul}</span>
              <span className="pm-list-meta">{h.pesan}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pm-hasil-actions">
        {berhasil.length > 0 && (
          <button type="button" className="btn-primary pm-btn" onClick={cetakBukti}>
            <Ikon nama="printer" ukuran={16} />
            Cetak bukti
          </button>
        )}
        <button
          type="button"
          className={berhasil.length > 0 ? 'pm-btn-ghost' : 'btn-primary pm-btn'}
          onClick={onTutup}
        >
          Selesai
        </button>
      </div>

      <BuktiCetak daftar={berhasil.map((h) => h.data)} />
    </div>
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
  const [hariIni] = useState(() => Date.now());

  const jatuhTempo = ketentuan && hariIni + ketentuan.durasi_hari * 24 * 60 * 60 * 1000;

  // Dicek ke database; jika tidak bisa dipinjam, popup peringatan muncul dari halaman induk
  const handleTambah = async (e) => {
    e.preventDefault();
    const kode = kodeInput.trim();
    if (!kode || sedangMemproses || sedangMengecek) return;
    const judul = await onAddToCart(kode);
    if (judul) setKodeInput('');
  };

  return (
    <section className="self-loan-section pm">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Peminjaman Mandiri</h2>
          <p className="page-subtitle">
            Masukkan kode koleksi untuk memproses peminjaman secara mandiri
          </p>
        </div>
      </div>

      {hasilPinjam.length > 0 ? (
        <HasilPinjam hasil={hasilPinjam} onTutup={onTutupHasil} />
      ) : (
        <div className="self-loan-grid pm-grid">
          <div className="scan-card pm-card">
            <h3 className="card-heading">Input Kode Koleksi</h3>
            <form onSubmit={handleTambah} className="pm-form" noValidate>
              <input
                type="text"
                className="form-control"
                aria-label="Kode koleksi"
                placeholder="Contoh: KOL-CS-001"
                autoComplete="off"
                value={kodeInput}
                onChange={(e) => setKodeInput(e.target.value)}
                disabled={sedangMemproses || sedangMengecek}
              />
              <button
                type="submit"
                className="btn-primary pm-btn"
                disabled={sedangMemproses || sedangMengecek || !kodeInput.trim()}
              >
                {sedangMengecek && <span className="pm-spinner" aria-hidden="true" />}
                Tambahkan
              </button>
            </form>

            <p className="pm-rules">
              {ketentuan
                ? [
                    `Maks. ${ketentuan.maks_pinjam} buku`,
                    `Masa pinjam ${ketentuan.durasi_hari} hari`,
                    ketentuan.tarif_denda_per_hari !== null &&
                      `Denda Rp${ketentuan.tarif_denda_per_hari.toLocaleString('id-ID')}/hari`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Ketentuan peminjaman belum dapat dimuat.'}
            </p>
          </div>

          <div className="cart-card pm-card">
            <h3 className="card-heading">
              Keranjang ({cart.length}
              {ketentuan ? ` dari ${ketentuan.maks_pinjam}` : ''})
            </h3>

            {cart.length === 0 ? (
              <p className="pm-muted pm-empty">Keranjang masih kosong.</p>
            ) : (
              <>
                <ul className="pm-list">
                  {cart.map((item) => (
                    <li key={item.id_koleksi} className="pm-list-item">
                      <SampulBuku judul={item.judul} src={item.sampul} />
                      <span className="pm-list-info">
                        <span className="pm-list-title">{item.judul}</span>
                        <span className="pm-list-meta">
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

                {jatuhTempo && <p className="pm-muted">Jatuh tempo {formatTanggal(jatuhTempo)}</p>}

                <button
                  type="button"
                  className="btn-primary pm-btn pm-btn-block"
                  onClick={onConfirmCheckout}
                  disabled={sedangMemproses || sedangMengecek}
                >
                  {sedangMemproses && <span className="pm-spinner" aria-hidden="true" />}
                  {sedangMemproses ? 'Memproses…' : 'Konfirmasi peminjaman'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
