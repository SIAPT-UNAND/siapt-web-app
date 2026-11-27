import '../admin/admin.css';
import './dashboard.css';
import { ambilKoleksi } from '../../services/dashboardService.js';
import { useDashboard } from './dashboardHooks.js';
import { BarKomposisi, DaftarBar, KartuKpi, KepalaDashboard, StatusMuat } from './DashboardUI.jsx';
import { formatAngka, persen } from './dashboardUtils.js';

function Isi({ data }) {
  const totalKoleksi = data.koleksi_aktif + data.koleksi_nonaktif;
  const tersedia = data.eksemplar_per_status.find((s) => s.label === 'Tersedia')?.jumlah ?? 0;

  return (
    <>
      <div className="dsb-kpis dsb-kpis-4">
        <KartuKpi
          label="Koleksi aktif"
          nilai={formatAngka(data.koleksi_aktif)}
          meter={persen(data.koleksi_aktif, totalKoleksi)}
          konteks={`dari ${formatAngka(totalKoleksi)} judul (${persen(data.koleksi_aktif, totalKoleksi)}%)`}
          caraHitung="Judul berstatus aktif."
        />
        <KartuKpi
          label="Koleksi nonaktif"
          nilai={formatAngka(data.koleksi_nonaktif)}
          konteks="tidak tampil di katalog"
          caraHitung="Judul berstatus nonaktif atau belum diatur."
        />
        <KartuKpi
          label="Eksemplar tersedia"
          nilai={formatAngka(tersedia)}
          meter={persen(tersedia, data.total_eksemplar)}
          konteks={`dari ${formatAngka(data.total_eksemplar)} eksemplar (${persen(tersedia, data.total_eksemplar)}%)`}
          caraHitung="Eksemplar berstatus Tersedia."
        />
        <KartuKpi
          label="Judul tanpa eksemplar tersedia"
          nilai={formatAngka(data.judul_tanpa_eksemplar_tersedia)}
          konteks={
            data.judul_tanpa_eksemplar_tersedia > 0 ? 'Anggota belum bisa meminjam judul ini' : 'Semua judul aktif bisa dipinjam'
          }
          caraHitung="Judul aktif yang tidak punya satu pun eksemplar Tersedia."
        />
      </div>

      <div className="dsb-panels dsb-panels-2">
        <DaftarBar
          judul="Koleksi aktif per kategori"
          keterangan={`${formatAngka(data.per_kategori.length)} kategori`}
          total={data.koleksi_aktif}
          kosong="Belum ada koleksi."
          baris={data.per_kategori.map((k) => ({
            label: k.nama_kategori,
            nilai: k.aktif,
            tambahan: k.nonaktif > 0 ? `${formatAngka(k.nonaktif)} nonaktif` : undefined,
          }))}
        />
        <BarKomposisi
          judul="Komposisi status eksemplar"
          keterangan={`${formatAngka(data.total_eksemplar)} eksemplar`}
          bagian={data.eksemplar_per_status.map((s) => ({ label: s.label, nilai: s.jumlah }))}
        />
      </div>

      <div className="dsb-panels dsb-panels-2">
        <DaftarBar
          judul="Koleksi aktif per tahun terbit"
          keterangan="Dikelompokkan per dekade"
          kosong="Belum ada koleksi aktif."
          baris={(data.per_dekade ?? []).map((d) => ({ label: d.label, nilai: d.jumlah }))}
        />
        <DaftarBar
          judul="Koleksi aktif per bahasa"
          keterangan={`${formatAngka((data.per_bahasa ?? []).length)} bahasa`}
          kosong="Belum ada koleksi aktif."
          baris={(data.per_bahasa ?? []).map((b) => ({ label: b.label, nilai: b.jumlah }))}
        />
      </div>
    </>
  );
}

export default function DashboardKoleksi() {
  const { data, error, memuat, muatUlang } = useDashboard(() => ambilKoleksi(), 'koleksi');

  return (
    <section className="adm-page dsb-page">
      <KepalaDashboard
        judul="Koleksi & Inventaris"
        keterangan="Kondisi koleksi dan eksemplar saat ini"
        data={data}
        memuat={memuat}
        onMuatUlang={muatUlang}
      />
      <StatusMuat memuat={memuat} error={error} adaData={Boolean(data)} onCobaLagi={muatUlang} />
      {data && <Isi data={data} />}
    </section>
  );
}
