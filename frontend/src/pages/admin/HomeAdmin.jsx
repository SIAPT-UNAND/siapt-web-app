export default function HomeAdmin({ users, configurations }) {
  return (
    <section className="admin-home-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Beranda Administrator Sistem</h2>
          <p className="page-subtitle">
            Monitoring status infrastruktur SIAPT UNAND, integritas database MySQL, dan ringkasan audit sistem
          </p>
        </div>
        <span className="badge-system-ok">● Server Status: Normal</span>
      </div>

      <div className="admin-status-cards-grid">
        <div className="status-kpi-card">
          <span className="lbl">Database Engine</span>
          <strong className="val">MySQL 8.0</strong>
          <span className="sub text-green">Prisma ORM Terhubung</span>
        </div>
        <div className="status-kpi-card">
          <span className="lbl">Total Akun Terdaftar</span>
          <strong className="val">{users.length} Akun</strong>
          <span className="sub">
            {users.filter((u) => u.status_aktif).length} Pengguna Aktif
          </span>
        </div>
        <div className="status-kpi-card">
          <span className="lbl">Parameter Konfigurasi</span>
          <strong className="val">{configurations.length} Item</strong>
          <span className="sub text-green">Semua valid &amp; sinkron</span>
        </div>
        <div className="status-kpi-card">
          <span className="lbl">Keamanan &amp; Sesi</span>
          <strong className="val">Aman</strong>
          <span className="sub">Proteksi Idempotensi Aktif</span>
        </div>
      </div>

      {/* Log Aktivitas Sistem Terbaru */}
      <div className="recent-activity-card mt-8">
        <h3 className="card-heading">Log Audit Aktivitas Sistem Terkini</h3>
        <div className="activity-timeline">
          <div className="timeline-item">
            <span className="timeline-dot green"></span>
            <div className="timeline-body">
              <strong>Pembaruan Konfigurasi Sistem</strong>
              <p>
                Admin mengubah parameter <code>tarif_denda_per_hari</code> menjadi{' '}
                <strong>1000 rupiah</strong>.
              </p>
              <span className="timeline-time">Hari ini, 15:45 WIB</span>
            </div>
          </div>

          <div className="timeline-item">
            <span className="timeline-dot blue"></span>
            <div className="timeline-body">
              <strong>Migrasi Skema Database Berhasil</strong>
              <p>
                Prisma Migrate menerapkan versi skema <code>20261113085803_init</code> dengan 20 tabel.
              </p>
              <span className="timeline-time">Hari ini, 15:58 WIB</span>
            </div>
          </div>

          <div className="timeline-item">
            <span className="timeline-dot gray"></span>
            <div className="timeline-body">
              <strong>Autentikasi Akun Pustakawan</strong>
              <p>
                Pustakawan <code>198805122014042001</code> berhasil masuk ke loket sirkulasi.
              </p>
              <span className="timeline-time">Hari ini, 14:20 WIB</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

