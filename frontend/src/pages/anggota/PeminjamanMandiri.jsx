import { useState } from 'react';

export default function PeminjamanMandiri({
  collections,
  cart,
  onAddToCart,
  onRemoveFromCart,
  onConfirmCheckout,
}) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loanSuccessMsg, setLoanSuccessMsg] = useState('');

  const handleAddByBarcode = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const found = collections.find(
      (c) =>
        c.kode_koleksi.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        c.isbn.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (found) {
      onAddToCart(found);
      setBarcodeInput('');
    } else {
      alert(`Eksemplar dengan kode/ISBN "${barcodeInput}" tidak ditemukan.`);
    }
  };

  const handleCheckout = () => {
    onConfirmCheckout();
    setLoanSuccessMsg(
      'Peminjaman mandiri berhasil diproses! Silakan ambil fisik buku di meja sirkulasi.'
    );
    setTimeout(() => setLoanSuccessMsg(''), 5000);
  };

  return (
    <section className="self-loan-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Peminjaman Mandiri</h2>
          <p className="page-subtitle">
            Scan kode barcode eksemplar atau masukkan kode buku untuk memproses peminjaman instan
          </p>
        </div>
      </div>

      {loanSuccessMsg && <div className="alert-success">{loanSuccessMsg}</div>}

      <div className="self-loan-grid">
        <div className="scan-card">
          <h3 className="card-heading">Input Kode Eksemplar / ISBN</h3>
          <form onSubmit={handleAddByBarcode} className="barcode-form">
            <input
              type="text"
              className="form-control"
              placeholder="Ketik kode (misal: KOL-CS-001 atau 9780132350884)..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Tambahkan ke Keranjang
            </button>
          </form>

          <div className="rule-box">
            <h4>Ketentuan Peminjaman Mandiri:</h4>
            <ul>
              <li>Maksimal 3 eksemplar buku per anggota.</li>
              <li>Masa pinjam standar 7 hari kalender.</li>
              <li>Denda keterlambatan Rp1.000 / hari per eksemplar.</li>
            </ul>
          </div>
        </div>

        <div className="cart-card">
          <h3 className="card-heading">
            Keranjang Peminjaman ({cart.length}/3)
          </h3>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <p>Keranjang peminjaman masih kosong.</p>
              <span className="sub-text">
                Gunakan input di samping atau klik tombol &quot;Pinjam Mandiri&quot; pada katalog koleksi.
              </span>
            </div>
          ) : (
            <div className="cart-list">
              {cart.map((item) => (
                <div key={item.id_koleksi} className="cart-item">
                  <div className="cart-item-info">
                    <strong>{item.judul}</strong>
                    <span className="cart-item-code">
                      {item.kode_koleksi} • {item.lokasi_rak}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-cart"
                    onClick={() => onRemoveFromCart(item.id_koleksi)}
                    title="Hapus dari keranjang"
                  >
                    &times;
                  </button>
                </div>
              ))}

              <div className="cart-summary">
                <div className="summary-row">
                  <span>Durasi Peminjaman:</span>
                  <strong>7 Hari</strong>
                </div>
                <div className="summary-row">
                  <span>Jatuh Tempo:</span>
                  <strong>
                    7 hari setelah peminjaman
                  </strong>
                </div>

                <button
                  type="button"
                  className="btn-primary btn-block btn-checkout"
                  onClick={handleCheckout}
                >
                  Konfirmasi &amp; Selesaikan Peminjaman
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

