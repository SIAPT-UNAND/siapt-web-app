import DashboardAnalitik from './DashboardAnalitik.jsx';
import DashboardKoleksi from './DashboardKoleksi.jsx';
import DashboardSirkulasi from './DashboardSirkulasi.jsx';
import DashboardDenda from './DashboardDenda.jsx';
import DashboardLayanan from './DashboardLayanan.jsx';

const HALAMAN = {
  'dashboard-koleksi': DashboardKoleksi,
  'dashboard-sirkulasi': DashboardSirkulasi,
  'dashboard-denda': DashboardDenda,
  'dashboard-layanan': DashboardLayanan,
};

export default function PengelolaPage({ activeMenu }) {
  // Menu tidak dikenal (atau 'dashboard-analitik') menampilkan Ringkasan.
  const Halaman = HALAMAN[activeMenu] ?? DashboardAnalitik;
  return (
    <div className="page-container">
      <Halaman />
    </div>
  );
}
