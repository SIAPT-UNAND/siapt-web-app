import { useState } from 'react';
import '../admin/admin.css';
import './dashboard.css';
import { ambilSirkulasi } from '../../services/dashboardService.js';
import { useDashboard } from './dashboardHooks.js';
import {
  DaftarBar,
  DaftarPeringkat,
  GrafikKolom,
  GrafikTren,
  KartuKpi,
  KepalaDashboard,
  StatusMuat,
} from './DashboardUI.jsx';
import { formatAngka, hitungPerubahan, persen } from './dashboardUtils.js';

function Isi({ data }) {
  const k = data.keterlambatan;
  const terlambat = k.hari_1_7 + k.hari_8_30 + k.lebih_30;
  const mandiri = data.per_jalur.find((j) => j.label === 'Mandiri')?.jumlah ?? 0;
  const rataRata = data.rata_lama_pinjam_hari;

  return (
    <>
      <div className="dsb-kpis dsb-kpis-4">
        <KartuKpi
          label="Transaksi peminjaman"
          nilai={formatAngka(data.total_peminjaman)}
          konteks={data.periode.label.toLowerCase()}
          perubahan={
            data.pembanding
              ? hitungPerubahan(data.total_peminjaman, data.pembanding.total_peminjaman, data.pembanding.label)
              : undefined
          }
          caraHitung="Berdasarkan tanggal pinjam."
        />
        <KartuKpi
          label="Rata-rata lama pinjam"
          nilai={rataRata === null ? '-' : `${rataRata.toLocaleString('id-ID')} hari`}
          konteks={`dari ${formatAngka(data.jumlah_dikembalikan)} eksemplar yang dikembalikan`}
          caraHitung="Tanggal kembali dikurangi tanggal pinjam."
        />
        <KartuKpi
          label="Peminjaman mandiri"
          nilai={`${persen(mandiri, data.total_peminjaman)}%`}
          meter={persen(mandiri, data.total_peminjaman)}
          konteks={`${formatAngka(mandiri)} dari ${formatAngka(data.total_peminjaman)} transaksi`}
          caraHitung="Jalur pinjam mandiri oleh Anggota."
        />
        <KartuKpi
          label="Terlambat saat ini"
          nilai={formatAngka(terlambat)}
          konteks={`${formatAngka(k.lebih_30)} lebih dari 30 hari`}
          caraHitung="Belum kembali, jatuh tempo sebelum hari ini (WIB)."
        />
      </div>

      <GrafikTren
        judul="Tren peminjaman"
        keterangan={`Jumlah transaksi per ${data.periode.satuan}`}
        titik={data.tren_peminjaman}
        satuan={data.periode.satuan}
        namaNilai="transaksi"
      />

      <div className="dsb-panels">
        <GrafikKolom
          judul="Peminjaman per hari dalam seminggu"
          keterangan="Hari apa perpustakaan paling ramai"
          baris={data.per_hari_minggu ?? []}
          namaNilai="transaksi"
        />
        <DaftarBar
          judul="Peminjaman per jalur"
          keterangan={`${formatAngka(data.total_peminjaman)} transaksi`}
          kosong="Belum ada peminjaman pada periode ini."
          baris={data.per_jalur.map((j) => ({ label: j.label, nilai: j.jumlah }))}
        />
        <DaftarBar
          judul="Lama keterlambatan"
          keterangan={`${formatAngka(terlambat)} peminjaman terlambat saat ini`}
          total={terlambat}
          baris={[
            { label: '1–7 hari', nilai: k.hari_1_7 },
            { label: '8–30 hari', nilai: k.hari_8_30 },
            { label: '> 30 hari', nilai: k.lebih_30 },
          ]}
        />
      </div>

      <div className="dsb-stack">
        <DaftarPeringkat
          judul="5 koleksi paling sering dipinjam"
          keterangan={data.periode.label}
          kosong="Belum ada peminjaman pada periode ini."
          baris={data.top_koleksi.map((t) => ({ kunci: t.id_koleksi, label: t.judul, nilai: t.jumlah }))}
        />
      </div>
    </>
  );
}

export default function DashboardSirkulasi() {
  const [periode, setPeriode] = useState('30h');
  const { data, error, memuat, muatUlang } = useDashboard(() => ambilSirkulasi(periode), periode);

  return (
    <section className="adm-page dsb-page">
      <KepalaDashboard
        judul="Sirkulasi"
        keterangan="Aktivitas peminjaman dan pengembalian"
        data={data}
        memuat={memuat}
        onMuatUlang={muatUlang}
        periode={periode}
        onGantiPeriode={setPeriode}
      />
      <StatusMuat memuat={memuat} error={error} adaData={Boolean(data)} onCobaLagi={muatUlang} />
      {data && <Isi data={data} />}
    </section>
  );
}
