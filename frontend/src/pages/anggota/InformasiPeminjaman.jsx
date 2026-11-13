import { useState } from 'react';

export default function InformasiPeminjaman({ loans }) {
  const [loanFilter, setLoanFilter] = useState('SEMUA');

  const filteredLoans = loans.filter((loan) => {
    if (loanFilter === 'SEDANG_DIPINJAM') {
      return loan.status === 'SEDANG_DIPINJAM' || loan.status === 'TERLAMBAT';
    }
    if (loanFilter === 'SELESAI') return loan.status === 'SELESAI';
    return true;
  });

  return (
    <section className="loan-info-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Informasi Peminjaman Saya</h2>
          <p className="page-subtitle">
            Pantau status sirkulasi buku yang sedang Anda pinjam, riwayat pengembalian, dan tagihan denda
          </p>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="metrics-row">
        <div className="metric-box">
          <span className="metric-label">Buku Sedang Dipinjam</span>
          <strong className="metric-value">
            {
              loans.filter(
                (l) => l.status === 'SEDANG_DIPINJAM' || l.status === 'TERLAMBAT'
              ).length
            }
          </strong>
        </div>

        <div className="metric-box">
          <span className="metric-label">Buku Terlambat</span>
          <strong className="metric-value text-red">
            {loans.filter((l) => l.status === 'TERLAMBAT').length}
          </strong>
        </div>

        <div className="metric-box">
          <span className="metric-label">Total Denda Aktif</span>
          <strong className="metric-value text-green">
            Rp{' '}
            {loans
              .filter((l) => l.status_denda === 'BELUM_LUNAS')
              .reduce((acc, curr) => acc + curr.denda, 0)
              .toLocaleString('id-ID')}
          </strong>
        </div>
      </div>

      {/* Filter Tab */}
      <div className="tab-filters">
        <button
          type="button"
          className={`tab-btn ${loanFilter === 'SEMUA' ? 'active' : ''}`}
          onClick={() => setLoanFilter('SEMUA')}
        >
          Semua Riwayat
        </button>
        <button
          type="button"
          className={`tab-btn ${loanFilter === 'SEDANG_DIPINJAM' ? 'active' : ''}`}
          onClick={() => setLoanFilter('SEDANG_DIPINJAM')}
        >
          Sedang Dipinjam
        </button>
        <button
          type="button"
          className={`tab-btn ${loanFilter === 'SELESAI' ? 'active' : ''}`}
          onClick={() => setLoanFilter('SELESAI')}
        >
          Sudah Dikembalikan
        </button>
      </div>

      {/* List Kartu Peminjaman */}
      <div className="loan-cards-list">
        {filteredLoans.length === 0 ? (
          <div className="empty-state-card">
            <p>Tidak ada data peminjaman pada filter ini.</p>
          </div>
        ) : (
          filteredLoans.map((item) => {
            const isOverdue = item.status === 'TERLAMBAT';
            const isReturned = item.status === 'SELESAI';

            return (
              <div key={item.id_peminjaman} className="loan-record-card">
                <div className="loan-card-main">
                  <div className="loan-badge-line">
                    <span className="loan-trx-num">{item.nomor_transaksi}</span>
                    <span
                      className={`status-pill ${
                        isReturned
                          ? 'status-done'
                          : isOverdue
                          ? 'status-danger'
                          : 'status-active'
                      }`}
                    >
                      {isReturned
                        ? 'Dikembalikan'
                        : isOverdue
                        ? 'Terlambat'
                        : 'Aktif'}
                    </span>
                  </div>

                  <h4 className="loan-book-title">{item.judul}</h4>
                  <div className="loan-meta-grid">
                    <div>
                      <span className="lbl">Kode Eksemplar:</span>{' '}
                      <strong>{item.kode_eksemplar}</strong>
                    </div>
                    <div>
                      <span className="lbl">Tanggal Pinjam:</span>{' '}
                      <span>{item.tanggal_pinjam}</span>
                    </div>
                    <div>
                      <span className="lbl">Jatuh Tempo:</span>{' '}
                      <span className={isOverdue ? 'text-red font-bold' : ''}>
                        {item.tanggal_jatuh_tempo}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="loan-card-side">
                  <div className="denda-box">
                    <span className="denda-lbl">Denda Keterlambatan</span>
                    <strong className="denda-val">
                      Rp {item.denda.toLocaleString('id-ID')}
                    </strong>
                    <span
                      className={`denda-status ${
                        item.status_denda === 'BELUM_LUNAS' ? 'unpaid' : 'paid'
                      }`}
                    >
                      {item.status_denda === 'BELUM_LUNAS'
                        ? 'Belum Lunas'
                        : item.status_denda === 'LUNAS'
                        ? 'Lunas'
                        : 'Tidak Ada'}
                    </span>
                  </div>

                  {item.status_denda === 'BELUM_LUNAS' && (
                    <button
                      type="button"
                      className="btn-pay-denda"
                      onClick={() =>
                        alert(
                          `Silakan transfer Rp ${item.denda.toLocaleString(
                            'id-ID'
                          )} ke Rekening Mandiri 111-00-998877 a.n. Perpustakaan UNAND dan serahkan bukti ke meja loket sirkulasi.`
                        )
                      }
                    >
                      Bayar Denda
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

