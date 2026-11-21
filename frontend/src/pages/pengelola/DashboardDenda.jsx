import { useState } from 'react';
import '../admin/admin.css';
import './dashboard.css';
import { ambilDenda } from '../../services/dashboardService.js';
import { useDashboard } from './dashboardHooks.js';
import { BarKomposisi, DaftarBar, GrafikTren, KartuKpi, KepalaDashboard, StatusMuat } from './DashboardUI.jsx';
import { formatAngka, formatRupiah, hitungPerubahan } from './dashboardUtils.js';

function Isi({ data }) {
  const bl = data.belum_lunas;
  const jumlahBelumLunas = bl.belum_dibayar.jumlah + bl.menunggu_verifikasi.jumlah + bl.lainnya.jumlah;
  const nominalBelumLunas =
    bl.belum_dibayar.total_nominal + bl.menunggu_verifikasi.total_nominal + bl.lainnya.total_nominal;
  const menunggu = data.pembayaran_per_status.find((p) => p.label === 'Menunggu verifikasi')?.jumlah ?? 0;
  const totalPembayaran = data.pembayaran_per_status.reduce((n, p) => n + p.jumlah, 0);
  const jam = data.rata_waktu_verifikasi_jam;

  const barisBelumLunas = [
    { label: 'Belum dibayar', nilai: bl.belum_dibayar.jumlah, tambahan: formatRupiah(bl.belum_dibayar.total_nominal) },
    { label: 'Menunggu verifikasi', nilai: bl.menunggu_verifikasi.jumlah, tambahan: formatRupiah(bl.menunggu_verifikasi.total_nominal) },
  ];
  if (bl.lainnya.jumlah > 0) {
    barisBelumLunas.push({ label: 'Status lain', nilai: bl.lainnya.jumlah, tambahan: formatRupiah(bl.lainnya.total_nominal) });
  }

  return (
    <>
      <div className="dsb-kpis">
        <KartuKpi
          label="Denda belum lunas"
          nilai={formatAngka(jumlahBelumLunas)}
          konteks={`total ${formatRupiah(nominalBelumLunas)}`}
          caraHitung="Kondisi saat ini, semua status selain Lunas."
        />
        <KartuKpi
          label="Denda terbentuk"
          nilai={formatAngka(data.denda_terbentuk.jumlah)}
          konteks={`total ${formatRupiah(data.denda_terbentuk.total_nominal)}`}
          perubahan={
            data.pembanding
              ? hitungPerubahan(data.denda_terbentuk.jumlah, data.pembanding.denda_terbentuk.jumlah, data.pembanding.label)
              : undefined
          }
          caraHitung={`Denda baru, ${data.periode.label.toLowerCase()}.`}
        />
        <KartuKpi
          label="Pembayaran menunggu"
          nilai={formatAngka(menunggu)}
          konteks={`dari ${formatAngka(totalPembayaran)} bukti diunggah`}
          caraHitung="Bukti bayar yang belum diverifikasi Pustakawan."
        />
        <KartuKpi
          label="Rata-rata waktu verifikasi"
          nilai={jam === null ? '-' : `${jam.toLocaleString('id-ID')} jam`}
          konteks={`dari ${formatAngka(data.jumlah_diverifikasi)} pembayaran`}
          caraHitung="Dari unggah bukti sampai diverifikasi."
        />
        <KartuKpi
          label="Koreksi denda"
          nilai={formatAngka(data.koreksi.jumlah)}
          konteks={`selisih ${formatRupiah(data.koreksi.total_selisih)}`}
          caraHitung="Nominal lama dikurangi nominal baru."
        />
      </div>

      <GrafikTren
        judul="Denda terbentuk"
        keterangan={`Jumlah denda baru per ${data.periode.satuan}`}
        titik={data.tren_denda}
        satuan={data.periode.satuan}
        namaNilai="denda"
        formatTambahan={(t) => formatRupiah(t.total_nominal)}
      />

      <div className="dsb-panels">
        <BarKomposisi
          judul="Komposisi pembayaran"
          keterangan={`${formatAngka(totalPembayaran)} bukti, ${data.periode.label.toLowerCase()}`}
          bagian={data.pembayaran_per_status.map((p) => ({
            label: p.label,
            nilai: p.jumlah,
            nominal: p.total_nominal,
          }))}
          formatTambahan={(b) => formatRupiah(b.nominal)}
        />
        <DaftarBar
          judul="Denda belum lunas per status"
          keterangan={`${formatAngka(jumlahBelumLunas)} denda, ${formatRupiah(nominalBelumLunas)}`}
          total={jumlahBelumLunas}
          baris={barisBelumLunas}
        />
        <DaftarBar
          judul="Denda per lama keterlambatan"
          keterangan={`Denda baru, ${data.periode.label.toLowerCase()}`}
          baris={(data.denda_per_keterlambatan ?? []).map((d) => ({
            label: d.label,
            nilai: d.jumlah,
            tambahan: formatRupiah(d.total_nominal),
          }))}
        />
      </div>
    </>
  );
}

export default function DashboardDenda() {
  const [periode, setPeriode] = useState('30h');
  const { data, error, memuat, muatUlang } = useDashboard(() => ambilDenda(periode), periode);

  return (
    <section className="adm-page dsb-page">
      <KepalaDashboard
        judul="Denda & Pembayaran"
        keterangan="Denda, pembayaran, dan verifikasi"
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
