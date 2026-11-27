import { useEffect, useState } from 'react';
import '../admin/admin.css';
import './dashboard.css';
import { ambilRingkasan } from '../../services/dashboardService.js';
import { DaftarBar, IkonMuatUlang, KartuKpi } from './DashboardUI.jsx';
import {
  daftarPerhatian,
  formatAngka,
  formatJamWib,
  formatRupiah,
  formatTanggalAcuan,
  permintaanTerbuka,
  persen,
  semuaNol,
  totalPermintaan,
} from './dashboardUtils.js';

const PESAN_GAGAL_UMUM = 'Terjadi kesalahan. Silakan coba lagi.';

function IkonPeringatan() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
}

function IsiDashboard({ data }) {
  const terbuka = permintaanTerbuka(data);
  const semuaPermintaan = totalPermintaan(data);
  const perhatian = daftarPerhatian(data);
  const denda = data.denda_belum_lunas;
  const rincianDenda = denda.rincian ?? {};
  const keterlambatan = data.keterlambatan ?? { hari_1_7: 0, hari_8_30: 0, lebih_30: 0 };

  const barisDenda = [
    { label: 'Belum dibayar', nilai: rincianDenda.belum_dibayar?.jumlah ?? 0, tambahan: formatRupiah(rincianDenda.belum_dibayar?.total_nominal) },
    { label: 'Menunggu verifikasi', nilai: rincianDenda.menunggu_verifikasi?.jumlah ?? 0, tambahan: formatRupiah(rincianDenda.menunggu_verifikasi?.total_nominal) },
  ];
  if (rincianDenda.lainnya?.jumlah > 0) {
    barisDenda.push({ label: 'Status lain', nilai: rincianDenda.lainnya.jumlah, tambahan: formatRupiah(rincianDenda.lainnya.total_nominal) });
  }

  const barisPermintaan = ['Baru', 'Diproses', 'Selesai', 'Ditolak'].map((s) => ({
    label: s,
    nilai: data.permintaan_layanan[s] ?? 0,
  }));
  if (data.permintaan_layanan.Lainnya > 0) {
    barisPermintaan.push({ label: 'Lainnya', nilai: data.permintaan_layanan.Lainnya });
  }

  return (
    <>
      {semuaNol(data) && (
        <div className="dsb-note" role="note">Belum ada data operasional. Semua indikator masih 0.</div>
      )}

      <section className="dsb-attention" aria-labelledby="judul-perhatian">
        <h3 id="judul-perhatian" className="dsb-attention-title">Perlu perhatian</h3>
        {perhatian.length === 0 ? (
          <p className="dsb-attention-empty">Tidak ada yang perlu ditindaklanjuti saat ini.</p>
        ) : (
          <ul className="dsb-attention-list">
            {perhatian.map((teks) => (
              <li key={teks}>
                <IkonPeringatan />
                <span>{teks}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="dsb-kpis">
        <KartuKpi
          label="Koleksi aktif"
          nilai={formatAngka(data.koleksi_aktif)}
          meter={persen(data.koleksi_aktif, data.koleksi_total)}
          konteks={`dari ${formatAngka(data.koleksi_total)} koleksi (${persen(data.koleksi_aktif, data.koleksi_total)}%)`}
          caraHitung="Koleksi berstatus aktif."
        />
        <KartuKpi
          label="Sedang dipinjam"
          nilai={formatAngka(data.peminjaman_dipinjam)}
          konteks={`${formatAngka(data.peminjaman_terlambat)} di antaranya terlambat (${persen(data.peminjaman_terlambat, data.peminjaman_dipinjam)}%)`}
          caraHitung="Eksemplar yang belum dikembalikan."
        />
        <KartuKpi
          label="Terlambat"
          nilai={formatAngka(data.peminjaman_terlambat)}
          konteks="melewati jatuh tempo"
          caraHitung="Jatuh tempo sebelum hari ini (WIB)."
        />
        <KartuKpi
          label="Denda belum lunas"
          nilai={formatAngka(denda.jumlah)}
          konteks={`total ${formatRupiah(denda.total_nominal)}`}
          caraHitung="Semua status selain Lunas."
        />
        <KartuKpi
          label="Permintaan terbuka"
          nilai={formatAngka(terbuka)}
          konteks={`dari ${formatAngka(semuaPermintaan)} permintaan`}
          caraHitung="Berstatus Baru atau Diproses."
        />
      </div>

      <div className="dsb-panels">
        <DaftarBar
          judul="Lama keterlambatan"
          keterangan={`${formatAngka(data.peminjaman_terlambat)} peminjaman terlambat`}
          total={data.peminjaman_terlambat}
          baris={[
            { label: '1–7 hari', nilai: keterlambatan.hari_1_7 },
            { label: '8–30 hari', nilai: keterlambatan.hari_8_30 },
            { label: '> 30 hari', nilai: keterlambatan.lebih_30 },
          ]}
        />
        <DaftarBar
          judul="Denda belum lunas"
          keterangan={`${formatAngka(denda.jumlah)} denda, ${formatRupiah(denda.total_nominal)}`}
          total={denda.jumlah}
          baris={barisDenda}
        />
        <DaftarBar
          judul="Permintaan layanan per status"
          keterangan={`${formatAngka(semuaPermintaan)} permintaan`}
          total={semuaPermintaan}
          baris={barisPermintaan}
        />
      </div>
    </>
  );
}

export default function DashboardAnalitik() {
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState({ versi: -1, data: null, error: '' });
  const memuat = hasil.versi !== versi;

  useEffect(() => {
    let batal = false;
    ambilRingkasan().then(
      (data) => {
        if (!batal) setHasil({ versi, data, error: '' });
      },
      (err) => {
        if (!batal) setHasil({ versi, data: null, error: err?.message || PESAN_GAGAL_UMUM });
      },
    );
    return () => {
      batal = true;
    };
  }, [versi]);

  const muatUlang = () => setVersi((v) => v + 1);
  const data = hasil.data;

  return (
    <section className="adm-page dsb-page">
      <div className="adm-header">
        <div>
          <h2 className="page-title">Dashboard Analitik</h2>
          <p className="page-subtitle">
            {data
              ? `Data per ${formatTanggalAcuan(data.tanggal_acuan)}, dihitung pukul ${formatJamWib(data.dihitung_pada)}`
              : 'Ringkasan operasional perpustakaan'}
          </p>
        </div>
        <button type="button" className="adm-btn dsb-reload" onClick={muatUlang} disabled={memuat}>
          <IkonMuatUlang />
          <span>{memuat ? 'Memuat...' : 'Muat ulang'}</span>
        </button>
      </div>

      {memuat && !data && (
        <div className="adm-state" role="status">
          <span className="adm-spinner" aria-hidden="true"></span>
          <span>Menghitung indikator...</span>
        </div>
      )}

      {!memuat && hasil.error && (
        <div className="adm-card adm-state is-error" role="alert">
          <span className="adm-state-text">{hasil.error}</span>
          <button type="button" className="adm-btn" onClick={muatUlang}>Coba lagi</button>
        </div>
      )}

      {data && <IsiDashboard data={data} />}
    </section>
  );
}
