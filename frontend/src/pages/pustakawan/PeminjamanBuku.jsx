import { useState } from 'react';

export default function PeminjamanBuku({
  collections,
  loans,
  onAddLoan,
}) {
  const [loanMemberId, setLoanMemberId] = useState('');
  const [loanBookCode, setLoanBookCode] = useState('');
  const [loanFeedback, setLoanFeedback] = useState('');

  const handleProcessLoan = (e) => {
    e.preventDefault();
    if (!loanMemberId.trim() || !loanBookCode.trim()) {
      alert('Mohon isi NIM/ID Anggota dan Kode Buku.');
      return;
    }

    const book = collections.find(
      (c) =>
        c.kode_koleksi.toLowerCase() === loanBookCode.trim().toLowerCase() ||
        c.isbn.toLowerCase() === loanBookCode.trim().toLowerCase()
    );

    if (!book) {
      alert('Koleksi buku tidak ditemukan dalam sistem.');
      return;
    }

    onAddLoan({
      id_peminjaman: Date.now(),
      nomor_transaksi: `TRX-${Date.now().toString().slice(-6)}`,
      kode_eksemplar: `EKS-${book.id_koleksi}-01`,
      judul: book.judul,
      tanggal_pinjam: new Date().toISOString().split('T')[0],
      tanggal_jatuh_tempo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      status: 'SEDANG_DIPINJAM',
      denda: 0,
      status_denda: 'TIDAK_ADA',
    });

    setLoanFeedback(
      `Berhasil mencatat peminjaman buku "${book.judul}" untuk anggota ${loanMemberId}!`
    );
    setLoanMemberId('');
    setLoanBookCode('');
    setTimeout(() => setLoanFeedback(''), 5000);
  };

  return (
    <section className="pustakawan-loan-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Pelayanan Peminjaman Buku</h2>
          <p className="page-subtitle">
            Proses pencatatan peminjaman sirkulasi di loket perpustakaan
          </p>
        </div>
      </div>

      {loanFeedback && <div className="alert-success">{loanFeedback}</div>}

      <div className="circulation-card">
        <h3 className="card-heading">Form Peminjaman Sirkulasi</h3>
        <form onSubmit={handleProcessLoan} className="circulation-form">
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">NIM / NIP / ID Anggota:</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: 2211521001"
                value={loanMemberId}
                onChange={(e) => setLoanMemberId(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kode Koleksi / ISBN:</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: KOL-CS-001"
                value={loanBookCode}
                onChange={(e) => setLoanBookCode(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="loan-rules-preview">
            <span className="dot-green"></span>
            <span>
              Durasi: <strong>7 hari</strong> kalender • Petugas bertanggung jawab
              memeriksa kondisi fisik buku sebelum diserahkan.
            </span>
          </div>

          <button type="submit" className="btn-primary">
            Proses &amp; Cetak Bukti Peminjaman
          </button>
        </form>
      </div>

      {/* Riwayat Peminjaman Aktif */}
      <div className="mt-8">
        <h3 className="section-sub-title">Transaksi Sirkulasi Terbaru</h3>
        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Transaksi</th>
                <th>Judul Buku</th>
                <th>Eksemplar</th>
                <th>Tgl Pinjam</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.slice(0, 5).map((l) => (
                <tr key={l.id_peminjaman}>
                  <td>
                    <strong>{l.nomor_transaksi}</strong>
                  </td>
                  <td>{l.judul}</td>
                  <td>
                    <code>{l.kode_eksemplar}</code>
                  </td>
                  <td>{l.tanggal_pinjam}</td>
                  <td>{l.tanggal_jatuh_tempo}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        l.status === 'SELESAI' ? 'status-done' : 'status-active'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

