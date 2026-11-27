import { useState } from 'react';
import '../admin/admin.css';
import './dashboard.css';
import { ambilLayanan } from '../../services/dashboardService.js';
import { useDashboard } from './dashboardHooks.js';
import {
  BarKomposisi,
  DaftarBar,
  DaftarPeringkat,
  GrafikKolom,
  GrafikTren,
  KartuKpi,
  KepalaDashboard,
  StatusMuat,
} from './DashboardUI.jsx';
import { formatAngka, hitungPerubahan } from './dashboardUtils.js';

const STATUS = ['Baru', 'Diproses', 'Selesai', 'Ditolak'];

function Isi({ data }) {
  const ps = data.permintaan_per_status;
  const terbuka = ps.Baru + ps.Diproses;
  const totalStatus = STATUS.reduce((n, s) => n + ps[s], 0) + ps.Lainnya;
  const totalUsulan = data.usulan_per_status.reduce((n, u) => n + u.jumlah, 0);
  const chatbot = data.chatbot;
  const pembanding = data.pembanding;

  const bagianStatus = STATUS.map((s) => ({ label: s, nilai: ps[s] }));
  if (ps.Lainnya > 0) bagianStatus.push({ label: 'Lainnya', nilai: ps.Lainnya });

  return (
    <>
      <div className="dsb-kpis">
        <KartuKpi
          label="Permintaan masuk"
          nilai={formatAngka(totalStatus)}
          konteks={data.periode.label.toLowerCase()}
          perubahan={pembanding ? hitungPerubahan(totalStatus, pembanding.total_permintaan, pembanding.label) : undefined}
          caraHitung="Berdasarkan tanggal permintaan dibuat."
        />
        <KartuKpi
          label="Permintaan terbuka"
          nilai={formatAngka(terbuka)}
          konteks={`${formatAngka(ps.Baru)} baru, ${formatAngka(ps.Diproses)} diproses`}
          caraHitung="Berstatus Baru atau Diproses."
        />
        <KartuKpi
          label="Pertanyaan chatbot"
          nilai={formatAngka(chatbot.total_pertanyaan)}
          konteks={data.periode.label.toLowerCase()}
          perubahan={
            pembanding
              ? hitungPerubahan(chatbot.total_pertanyaan, pembanding.total_pertanyaan_chatbot, pembanding.label)
              : undefined
          }
          caraHitung="Semua pertanyaan Anggota ke chatbot."
        />
        <KartuKpi
          label="Chatbot gagal menjawab"
          nilai={`${chatbot.persen_gagal.toLocaleString('id-ID')}%`}
          meter={chatbot.persen_gagal}
          konteks={`${formatAngka(chatbot.gagal_dijawab)} pertanyaan`}
          caraHitung="Tidak cocok dengan FAQ (fallback)."
        />
        <KartuKpi
          label="Usulan koleksi"
          nilai={formatAngka(totalUsulan)}
          konteks="semua status pengadaan"
          caraHitung="Usulan dari permintaan layanan."
        />
      </div>

      <GrafikTren
        judul="Tren permintaan layanan"
        keterangan={`Jumlah permintaan per ${data.periode.satuan}`}
        titik={data.tren_permintaan}
        satuan={data.periode.satuan}
        namaNilai="permintaan"
      />

      <div className="dsb-panels dsb-panels-2">
        <BarKomposisi
          judul="Komposisi status permintaan"
          keterangan={`${formatAngka(totalStatus)} permintaan`}
          bagian={bagianStatus}
        />
        <BarKomposisi
          judul="Jawaban chatbot"
          keterangan={`${formatAngka(chatbot.total_pertanyaan)} pertanyaan`}
          bagian={[
            { label: 'Terjawab dari FAQ', nilai: chatbot.total_pertanyaan - chatbot.gagal_dijawab },
            { label: 'Gagal dijawab', nilai: chatbot.gagal_dijawab },
          ]}
        />
      </div>

      <GrafikKolom
        judul="Pertanyaan chatbot per jam"
        keterangan="Jam berapa Anggota paling sering bertanya (WIB)"
        baris={data.pertanyaan_per_jam ?? []}
        namaNilai="pertanyaan"
        labelSetiap={3}
        lebar
      />

      <div className="dsb-panels dsb-panels-2">
        <DaftarBar
          judul="Permintaan per jenis"
          keterangan={data.periode.label}
          kosong="Belum ada permintaan pada periode ini."
          baris={data.permintaan_per_jenis.map((j) => ({ label: j.label, nilai: j.jumlah }))}
        />
        <DaftarBar
          judul="Usulan koleksi per status"
          keterangan={`${formatAngka(totalUsulan)} usulan`}
          kosong="Belum ada usulan koleksi."
          baris={data.usulan_per_status.map((u) => ({ label: u.label, nilai: u.jumlah }))}
        />
      </div>

      <DaftarPeringkat
        judul="5 FAQ yang paling sering dipakai chatbot"
        keterangan={data.periode.label}
        kosong="Belum ada pertanyaan yang cocok dengan FAQ pada periode ini."
        baris={data.top_faq.map((f) => ({ kunci: f.id_faq, label: f.pertanyaan, nilai: f.jumlah }))}
      />
    </>
  );
}

export default function DashboardLayanan() {
  const [periode, setPeriode] = useState('30h');
  const { data, error, memuat, muatUlang } = useDashboard(() => ambilLayanan(periode), periode);

  return (
    <section className="adm-page dsb-page">
      <KepalaDashboard
        judul="Layanan & Chatbot"
        keterangan="Permintaan layanan, chatbot, dan usulan koleksi"
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
