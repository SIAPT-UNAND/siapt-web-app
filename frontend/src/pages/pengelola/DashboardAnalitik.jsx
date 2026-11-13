export default function DashboardAnalitik({ collections, loans }) {
  const totalCollections = collections.length;
  const totalCopies = collections.reduce((acc, curr) => acc + curr.total_stok, 0);
  const totalBorrowedCopies = collections.reduce(
    (acc, curr) => acc + (curr.total_stok - curr.stok_tersedia),
    0
  );
  const overdueLoans = loans.filter((l) => l.status === 'TERLAMBAT').length;
  const onTimeRatio = Math.round(
    ((loans.length - overdueLoans) / (loans.length || 1)) * 100
  );

  const categoryStats = [
    { name: 'Ilmu Komputer', count: 48, percentage: 40 },
    { name: 'Sastra & Fiksi', count: 28, percentage: 24 },
    { name: 'Sains & Data', count: 22, percentage: 18 },
    { name: 'Sosial & Humaniora', count: 14, percentage: 12 },
    { name: 'Teknik & Rekayasa', count: 8, percentage: 6 },
  ];

  const weeklyTrends = [
    { day: 'Sen', count: 24, height: '70%' },
    { day: 'Sel', count: 32, height: '90%' },
    { day: 'Rab', count: 28, height: '80%' },
    { day: 'Kam', count: 35, height: '100%' },
    { day: 'Jum', count: 18, height: '52%' },
    { day: 'Sab', count: 12, height: '35%' },
  ];

  return (
    <section className="analytics-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Dashboard Analitik Perpustakaan</h2>
          <p className="page-subtitle">
            Laporan kinerja sirkulasi, utilisasi koleksi pustaka, dan ringkasan eksekutif UNAND
          </p>
        </div>

        <div className="analytics-date-badge">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>Bulan Berjalan: November 2026</span>
        </div>
      </div>

      {/* 4 Kartu KPI Utama */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap bg-green-light">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E3B2E" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Total Judul Koleksi</span>
            <strong className="kpi-value">{totalCollections.toLocaleString()}</strong>
            <span className="kpi-trend text-green">↑ +12 judul baru bln ini</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap bg-green-light">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E3B2E" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Total Eksemplar Fisik</span>
            <strong className="kpi-value">{totalCopies.toLocaleString()}</strong>
            <span className="kpi-trend">{totalBorrowedCopies} sedang dipinjam</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap bg-green-light">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E3B2E" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 14 14"></polyline>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Tingkat Kembali Tepat Waktu</span>
            <strong className="kpi-value">{onTimeRatio}%</strong>
            <span className="kpi-trend text-green">Target institusi: &gt;85%</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrap bg-green-light">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0E3B2E" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Penyelesaian Denda</span>
            <strong className="kpi-value">Rp 120.000</strong>
            <span className="kpi-trend">100% dialokasikan PNBP</span>
          </div>
        </div>
      </div>

      {/* Baris Grafik & Distribusi */}
      <div className="charts-grid-2">
        {/* Chart Tren Peminjaman Mingguan */}
        <div className="chart-card">
          <div className="card-top-header">
            <h3 className="card-heading">Tren Sirkulasi Harian (Minggu Ini)</h3>
            <span className="badge-sub">Unit: Peminjaman</span>
          </div>

          <div className="bar-chart-visual">
            {weeklyTrends.map((t) => (
              <div key={t.day} className="bar-col">
                <div className="bar-val-label">{t.count}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ height: t.height }}
                  ></div>
                </div>
                <span className="bar-day">{t.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Distribusi Kategori Subjek */}
        <div className="chart-card">
          <div className="card-top-header">
            <h3 className="card-heading">Proporsi Minat Baca per Kategori</h3>
            <span className="badge-sub">Persentase</span>
          </div>

          <div className="progress-category-list">
            {categoryStats.map((cat) => (
              <div key={cat.name} className="cat-progress-item">
                <div className="cat-progress-meta">
                  <span className="cat-name">{cat.name}</span>
                  <strong className="cat-pct">
                    {cat.percentage}% ({cat.count} buku)
                  </strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar-inner"
                    style={{ width: `${cat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel Koleksi Terpopuler */}
      <div className="top-books-card mt-8">
        <div className="card-top-header">
          <div>
            <h3 className="card-heading">Top 5 Koleksi Terfavorit Dipinjam</h3>
            <p className="card-desc">
              Berdasarkan frekuensi transaksi peminjaman mandiri dan sirkulasi loket
            </p>
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Peringkat</th>
                <th>Judul Buku</th>
                <th>Kategori</th>
                <th>Pengarang</th>
                <th>Frekuensi Pinjam</th>
                <th>Status Rak</th>
              </tr>
            </thead>
            <tbody>
              {collections.slice(0, 5).map((b, idx) => (
                <tr key={b.id_koleksi}>
                  <td>
                    <span className={`rank-pill ${idx === 0 ? 'rank-1' : ''}`}>
                      #{idx + 1}
                    </span>
                  </td>
                  <td>
                    <strong>{b.judul}</strong>
                    <div className="table-sub-text">{b.kode_koleksi}</div>
                  </td>
                  <td>
                    <span className="category-badge">{b.kategori}</span>
                  </td>
                  <td>{b.pengarang}</td>
                  <td>
                    <strong>{24 - idx * 4}x dipinjam</strong>
                  </td>
                  <td>
                    <span className="rak-badge">{b.lokasi_rak}</span>
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

