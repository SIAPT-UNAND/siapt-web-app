import { useEffect, useState } from 'react';
import { ambilRiwayatSaya } from '../../api/peminjaman.js';
import { Ikon } from './ikonPeminjaman.jsx';
import SampulBuku from './SampulBuku.jsx';
import './peminjaman.css';
import './informasi-peminjaman.css';

const FILTER = [
  { id: 'semua', label: 'Semua Riwayat' },
  { id: 'dipinjam', label: 'Sedang Dipinjam' },
  { id: 'dikembalikan', label: 'Sudah Dikembalikan' },
];

const LABEL_DENDA = {
  BELUM_DIBAYAR: 'Belum Lunas',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  LUNAS: 'Lunas',
};

const SATU_HARI = 86400000;

const parseTanggalKalender = (tanggal) => {
  if (!tanggal) return null;
  const bagian = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
  if (!bagian) return new Date(tanggal);
  return new Date(Date.UTC(Number(bagian[1]), Number(bagian[2]) - 1, Number(bagian[3])));
};

const formatTanggal = (tanggal, bulan = 'short') =>
  tanggal
    ? parseTanggalKalender(tanggal).toLocaleDateString('id-ID', {
        timeZone: 'UTC',
        day: 'numeric',
        month: bulan,
        year: 'numeric',
      })
    : '-';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;

// Tanggal hari ini (zona lokal) dalam format YYYY-MM-DD, sama dengan format dari backend
const hariIniISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const selisihHari = (dari, sampai) => Math.round((Date.parse(sampai) - Date.parse(dari)) / SATU_HARI);

const kalimatTenggat = (sisaHari) => {
  if (sisaHari < 0) return `terlambat ${-sisaHari} hari`;
  if (sisaHari === 0) return 'hari ini';
  if (sisaHari === 1) return 'besok';
  return `${sisaHari} hari lagi`;
};

/**
 * Isi blok tanggal di sisi kanan kartu.
 * Masih dipinjam: jatuh tempo + sisa hari. Sudah kembali: tanggal kembali + tepat waktu/terlambat.
 * tingkat menentukan warna: aman (hijau), dekat (oranye), lewat (merah), kembali (abu-abu).
 */
const blokTanggal = (item, hariIni) => {
  if (item.status === 'SELESAI') {
    return {
      label: 'Dikembalikan',
      tanggal: item.tanggal_kembali,
      keterangan: item.terlambat ? `Terlambat ${item.hari_terlambat} hari` : 'Tepat waktu',
      tingkat: 'kembali',
    };
  }
  if (item.terlambat) {
    return {
      label: 'Jatuh tempo',
      tanggal: item.tanggal_jatuh_tempo,
      keterangan: `Terlambat ${item.hari_terlambat} hari`,
      tingkat: 'lewat',
    };
  }
  const sisa = selisihHari(hariIni, item.tanggal_jatuh_tempo);
  return {
    label: 'Jatuh tempo',
    tanggal: item.tanggal_jatuh_tempo,
    keterangan: sisa === 0 ? 'Hari ini' : `Sisa ${sisa} hari`,
    tingkat: sisa <= 2 ? 'dekat' : 'aman',
  };
};

const tanggalBesar = (tanggal) => {
  if (!tanggal) return { hari: '–', bulan: '' };
  const d = parseTanggalKalender(tanggal);
  return {
    hari: d.toLocaleDateString('id-ID', { timeZone: 'UTC', day: 'numeric' }),
    bulan: d.toLocaleDateString('id-ID', { timeZone: 'UTC', month: 'short', year: 'numeric' }),
  };
};

export default function InformasiPeminjaman({ currentUser }) {
  const [loanFilter, setLoanFilter] = useState('semua');
  const [kataKunci, setKataKunci] = useState('');
  const [kataKunciAktif, setKataKunciAktif] = useState('');
  const [muatUlang, setMuatUlang] = useState(0);
  const [hariIni, setHariIni] = useState(hariIniISO);
  // Hasil permintaan terakhir; `kunci` menandai permintaan mana yang sudah selesai
  const [hasil, setHasil] = useState({ kunci: null, data: null, galat: '' });

  const pengenal = currentUser?.pengenal;
  const kunci = [pengenal, loanFilter, kataKunciAktif, muatUlang].join('|');
  const memuat = hasil.kunci !== kunci;
  const { data, galat } = hasil;

  // Pencarian dijalankan setelah pengguna berhenti mengetik sebentar
  useEffect(() => {
    const t = setTimeout(() => setKataKunciAktif(kataKunci.trim()), 350);
    return () => clearTimeout(t);
  }, [kataKunci]);

  // Tanggal referensi harus tetap berubah meskipun halaman tetap terbuka melewati tengah malam.
  useEffect(() => {
    let timeoutId;
    const jadwalkanTenggatHari = () => {
      const sekarang = new Date();
      const tengahMalam = new Date(sekarang);
      tengahMalam.setHours(24, 0, 0, 50);
      timeoutId = setTimeout(() => {
        setHariIni(hariIniISO());
        jadwalkanTenggatHari();
      }, tengahMalam.getTime() - sekarang.getTime());
    };
    jadwalkanTenggatHari();
    return () => clearTimeout(timeoutId);
  }, []);

  // Data selalu diambil dari database setiap halaman dibuka atau filter berubah
  useEffect(() => {
    let aktif = true;
    ambilRiwayatSaya(pengenal, { status: loanFilter, kataKunci: kataKunciAktif })
      .then((baru) => {
        if (aktif) {
          setHariIni(hariIniISO());
          setHasil({ kunci, data: baru, galat: '' });
        }
      })
      .catch((err) => aktif && setHasil((lama) => ({ kunci, data: lama.data, galat: err.message })));
    return () => {
      aktif = false;
    };
  }, [kunci, pengenal, loanFilter, kataKunciAktif]);

  const ringkasan = data?.ringkasan;
  const transaksi = data?.transaksi ?? [];
  const sedangMenyaring = loanFilter !== 'semua' || kataKunciAktif;
  const terdekat = ringkasan?.jatuh_tempo_terdekat;
  const jumlahTab = ringkasan && {
    semua: ringkasan.sedang_dipinjam + ringkasan.dikembalikan,
    dipinjam: ringkasan.sedang_dipinjam,
    dikembalikan: ringkasan.dikembalikan,
  };

  return (
    <section className="loan-info-section ip">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Informasi Peminjaman Saya</h2>
          <p className="page-subtitle">
            Pantau status sirkulasi buku yang sedang Anda pinjam, riwayat pengembalian, dan tagihan denda
          </p>
        </div>
      </div>

      {/* Ringkasan; dua kotak pertama bisa diklik untuk memfilter */}
      <div className="metrics-row ip-metrics">
        <button
          type="button"
          className={`metric-box ip-metric biru ${loanFilter === 'dipinjam' ? 'aktif' : ''}`}
          onClick={() => setLoanFilter('dipinjam')}
        >
          <span className="metric-label">Buku Sedang Dipinjam</span>
          <strong className="metric-value">{ringkasan ? ringkasan.sedang_dipinjam : '–'}</strong>
        </button>

        <button
          type="button"
          className={`metric-box ip-metric ${ringkasan?.terlambat ? 'merah' : 'oranye'}`}
          onClick={() => setLoanFilter('dipinjam')}
        >
          <span className="metric-label">Buku Terlambat</span>
          <strong className="metric-value">{ringkasan ? ringkasan.terlambat : '–'}</strong>
        </button>

        <div className={`metric-box ip-metric ${ringkasan?.total_denda_belum_lunas ? 'merah' : 'hijau'}`}>
          <span className="metric-label">Total Denda Aktif</span>
          <strong className="metric-value">
            {ringkasan ? formatRupiah(ringkasan.total_denda_belum_lunas) : '–'}
          </strong>
        </div>
      </div>

      {/* Jatuh tempo terdekat (mengikuti rancangan UI A3) */}
      {terdekat && (
        <p className={`ip-notice ${terdekat.sisa_hari < 0 ? 'bahaya' : ''}`} role="status">
          <strong>Jatuh tempo terdekat:</strong> {terdekat.judul},{' '}
          {formatTanggal(terdekat.tanggal_jatuh_tempo, 'long')} ({kalimatTenggat(terdekat.sisa_hari)})
        </p>
      )}

      {/* Pencarian & Filter */}
      <div className="ip-toolbar">
        <label className="pm-input-wrap ip-search">
          <span className="pm-input-icon">
            <Ikon nama="search" />
          </span>
          <input
            type="search"
            className="pm-input"
            aria-label="Cari judul atau nomor transaksi"
            placeholder="Cari judul atau nomor transaksi"
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
          />
        </label>

        <div className="tab-filters" role="tablist" aria-label="Filter status">
          {FILTER.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={loanFilter === f.id}
              className={`tab-btn ${loanFilter === f.id ? 'active' : ''}`}
              onClick={() => setLoanFilter(f.id)}
            >
              {f.label}
              {jumlahTab && <span className="ip-tab-count">{jumlahTab[f.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar transaksi */}
      {memuat && !data ? (
        <div className="empty-state-card">
          <p>Memuat riwayat peminjaman…</p>
        </div>
      ) : galat && !memuat ? (
        <div className="empty-state-card ip-state">
          <p>Riwayat peminjaman belum dapat dimuat.</p>
          <button type="button" className="btn-primary pm-btn" onClick={() => setMuatUlang((n) => n + 1)}>
            Coba lagi
          </button>
        </div>
      ) : transaksi.length === 0 ? (
        <div className="empty-state-card ip-state">
          <p>{sedangMenyaring ? 'Tidak ada transaksi yang cocok.' : 'Riwayat peminjaman belum tersedia.'}</p>
        </div>
      ) : (
        <div className={`loan-cards-list ${memuat ? 'ip-refreshing' : ''}`}>
          {transaksi.map((item) => {
            const isReturned = item.status === 'SELESAI';
            const isOverdue = !isReturned && item.terlambat;
            const denda = item.denda;
            const blok = blokTanggal(item, hariIni);
            const tgl = tanggalBesar(blok.tanggal);

            return (
              <article key={item.id_peminjaman} className={`loan-record-card ip-card ${blok.tingkat}`}>
                <div className="loan-card-main ip-card-main">
                  <SampulBuku judul={item.koleksi?.judul} src={item.koleksi?.sampul} ukuran="md" />
                  <div className="ip-card-content">
                    <div className="loan-badge-line">
                      <span className="loan-trx-num">{item.nomor_transaksi}</span>
                      <span
                        className={`status-pill ${
                          isReturned ? 'status-done' : isOverdue ? 'status-danger' : 'status-active'
                        }`}
                      >
                        {isReturned ? 'Dikembalikan' : isOverdue ? 'Terlambat' : 'Aktif'}
                      </span>
                    </div>

                    <h4 className="loan-book-title">{item.koleksi?.judul}</h4>
                    <div className="loan-meta-grid">
                      <div>
                        <span className="lbl">Kode Eksemplar:</span>{' '}
                        <strong>{item.eksemplar?.kode_eksemplar}</strong>
                      </div>
                      <div>
                        <span className="lbl">Tanggal Pinjam:</span>{' '}
                        <span>{formatTanggal(item.tanggal_pinjam)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="loan-card-side ip-side">
                  {/* Blok tanggal: jatuh tempo (atau tanggal kembali) ditampilkan besar */}
                  <div className={`ip-date ${blok.tingkat}`}>
                    <span className="ip-date-label">{blok.label}</span>
                    <strong className="ip-date-day">{tgl.hari}</strong>
                    <span className="ip-date-month">{tgl.bulan}</span>
                    <span className="ip-date-note">{blok.keterangan}</span>
                  </div>

                  <div className="denda-box">
                    <span className="denda-lbl">Denda Keterlambatan</span>
                    <strong className="denda-val">{formatRupiah(denda?.nominal)}</strong>
                    <span className={`denda-status ${denda && denda.status !== 'LUNAS' ? 'unpaid' : 'paid'}`}>
                      {denda ? LABEL_DENDA[denda.status] ?? denda.status : 'Tidak Ada'}
                    </span>
                  </div>

                  {/* Tombol dari layout bersama; alurnya milik modul Pembayaran Denda */}
                  {denda?.status === 'BELUM_DIBAYAR' && (
                    <button
                      type="button"
                      className="btn-pay-denda"
                      onClick={() =>
                        alert(
                          `Silakan transfer Rp ${Number(denda.nominal).toLocaleString(
                            'id-ID'
                          )} ke Rekening Mandiri 111-00-998877 a.n. Perpustakaan UNAND dan serahkan bukti ke meja loket sirkulasi.`
                        )
                      }
                    >
                      Bayar Denda
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
