import { useEffect, useState } from 'react';
import { ambilRiwayatSaya } from '../../api/peminjaman.js';
import { Ikon } from './ikonPeminjaman.jsx';
import { warnaSampul } from './warnaSampul.js';
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

const formatTanggal = (tanggal, bulan = 'short') =>
  tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: bulan, year: 'numeric' })
    : '-';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;

// Tanggal hari ini (zona lokal) dalam format YYYY-MM-DD, sama dengan format dari backend
const hariIniISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const selisihHari = (dari, sampai) => Math.round((Date.parse(sampai) - Date.parse(dari)) / SATU_HARI);

/** Kalimat tenggat untuk pemberitahuan jatuh tempo terdekat. */
const kalimatTenggat = (sisaHari) => {
  if (sisaHari < 0) return `sudah lewat ${-sisaHari} hari`;
  if (sisaHari === 0) return 'hari ini';
  if (sisaHari === 1) return 'besok';
  return `${sisaHari} hari lagi`;
};

function KerangkaMemuat() {
  return (
    <div className="loan-cards-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="loan-record-card ip-skeleton">
          <span className="ip-bone ip-bone-sm" />
          <span className="ip-bone ip-bone-lg" />
          <span className="ip-bone ip-bone-md" />
        </div>
      ))}
    </div>
  );
}

/** Bar sisa waktu pinjam untuk transaksi yang masih berjalan. */
function SisaWaktu({ item, hariIni }) {
  const total = Math.max(selisihHari(item.tanggal_pinjam, item.tanggal_jatuh_tempo), 1);
  const berjalan = selisihHari(item.tanggal_pinjam, hariIni);
  const sisa = selisihHari(hariIni, item.tanggal_jatuh_tempo);
  const persen = Math.min(Math.max(berjalan / total, 0), 1) * 100;
  const tingkat = item.terlambat ? 'lewat' : sisa <= 2 ? 'dekat' : 'aman';

  return (
    <div className={`ip-progress ${tingkat}`}>
      <div className="ip-progress-label">
        <span>
          {item.terlambat
            ? `Lewat ${item.hari_terlambat} hari dari jatuh tempo`
            : sisa === 0
              ? 'Jatuh tempo hari ini'
              : `Sisa ${sisa} hari`}
        </span>
        <span>{formatTanggal(item.tanggal_jatuh_tempo)}</span>
      </div>
      <div
        className="ip-progress-track"
        role="progressbar"
        aria-label="Waktu pinjam berjalan"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(persen)}
      >
        <span style={{ width: `${persen}%` }} />
      </div>
    </div>
  );
}

/** Linimasa singkat satu transaksi. */
function Linimasa({ item }) {
  const kembali = item.status === 'SELESAI';
  const langkah = [
    {
      judul: 'Dipinjam',
      isi: `${formatTanggal(item.tanggal_pinjam, 'long')} · ${
        item.jalur === 'PUSTAKAWAN' ? 'melalui pustakawan' : 'peminjaman mandiri'
      }`,
      selesai: true,
    },
    {
      judul: 'Jatuh tempo',
      isi: formatTanggal(item.tanggal_jatuh_tempo, 'long'),
      selesai: kembali || item.terlambat,
      bahaya: !kembali && item.terlambat,
    },
    {
      judul: kembali ? 'Dikembalikan' : 'Belum dikembalikan',
      isi: kembali
        ? `${formatTanggal(item.tanggal_kembali, 'long')} · ${
            item.terlambat ? `terlambat ${item.hari_terlambat} hari` : 'tepat waktu'
          }`
        : 'Kembalikan buku ke meja sirkulasi sebelum jatuh tempo.',
      selesai: kembali,
    },
  ];

  return (
    <ol className="ip-timeline">
      {langkah.map((l) => (
        <li key={l.judul} className={`${l.selesai ? 'selesai' : ''} ${l.bahaya ? 'bahaya' : ''}`}>
          <strong>{l.judul}</strong>
          <span>{l.isi}</span>
        </li>
      ))}
      {item.eksemplar?.lokasi_rak && (
        <li className="ip-timeline-note">
          Eksemplar {item.eksemplar.kode_eksemplar} · Rak {item.eksemplar.lokasi_rak}
        </li>
      )}
    </ol>
  );
}

export default function InformasiPeminjaman({ currentUser }) {
  const [loanFilter, setLoanFilter] = useState('semua');
  const [kataKunci, setKataKunci] = useState('');
  const [kataKunciAktif, setKataKunciAktif] = useState('');
  const [muatUlang, setMuatUlang] = useState(0);
  const [terbuka, setTerbuka] = useState(null);
  const [hariIni] = useState(hariIniISO);
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

  // Data selalu diambil dari database setiap halaman dibuka atau filter berubah
  useEffect(() => {
    let aktif = true;
    ambilRiwayatSaya(pengenal, { status: loanFilter, kataKunci: kataKunciAktif })
      .then((baru) => aktif && setHasil({ kunci, data: baru, galat: '' }))
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

  const pilihFilter = (id) => {
    setLoanFilter(id);
    setTerbuka(null);
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

      {/* Ringkasan */}
      <div className="metrics-row ip-metrics">
        <button
          type="button"
          className={`metric-box ip-metric ${loanFilter === 'dipinjam' ? 'aktif' : ''}`}
          onClick={() => pilihFilter('dipinjam')}
        >
          <span className="ip-metric-icon">
            <Ikon nama="book" ukuran={20} />
          </span>
          <span className="metric-label">Buku Sedang Dipinjam</span>
          <strong className="metric-value">{ringkasan ? ringkasan.sedang_dipinjam : '–'}</strong>
          <span className="ip-metric-note">
            {ringkasan?.maks_pinjam ? `dari maksimal ${ringkasan.maks_pinjam} buku` : 'Lihat daftar'}
          </span>
        </button>

        <button
          type="button"
          className={`metric-box ip-metric ${ringkasan?.terlambat ? 'bahaya' : ''}`}
          onClick={() => pilihFilter('dipinjam')}
        >
          <span className="ip-metric-icon">
            <Ikon nama="clock" ukuran={20} />
          </span>
          <span className="metric-label">Buku Terlambat</span>
          <strong className={`metric-value ${ringkasan?.terlambat ? 'text-red' : ''}`}>
            {ringkasan ? ringkasan.terlambat : '–'}
          </strong>
          <span className="ip-metric-note">
            {ringkasan?.terlambat ? 'Perlu segera dikembalikan' : 'Semua masih tepat waktu'}
          </span>
        </button>

        <div className={`metric-box ip-metric statis ${ringkasan?.total_denda_belum_lunas ? 'bahaya' : ''}`}>
          <span className="ip-metric-icon">
            <Ikon nama="wallet" ukuran={20} />
          </span>
          <span className="metric-label">Total Denda Aktif</span>
          <strong className="metric-value text-green">
            {ringkasan ? formatRupiah(ringkasan.total_denda_belum_lunas) : '–'}
          </strong>
          <span className="ip-metric-note">
            {ringkasan?.jumlah_denda_belum_lunas
              ? `${ringkasan.jumlah_denda_belum_lunas} tagihan belum lunas`
              : 'Tidak ada tagihan'}
          </span>
        </div>
      </div>

      {/* Pemberitahuan jatuh tempo terdekat (mengikuti rancangan UI A3) */}
      {terdekat && (
        <div className={`ip-notice ${terdekat.sisa_hari < 0 ? 'bahaya' : ''}`} role="status">
          <Ikon nama="calendar" ukuran={18} />
          <div>
            <strong>
              {terdekat.sisa_hari < 0 ? 'Perhatian: ada buku yang terlambat' : 'Perhatian: jatuh tempo terdekat'}
            </strong>
            <span>
              {terdekat.judul} perlu dikembalikan paling lambat{' '}
              {formatTanggal(terdekat.tanggal_jatuh_tempo, 'long')} ({kalimatTenggat(terdekat.sisa_hari)}).
            </span>
          </div>
        </div>
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
              onClick={() => pilihFilter(f.id)}
            >
              {f.label}
              {jumlahTab && <span className="ip-tab-count">{jumlahTab[f.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar transaksi */}
      {memuat && !data ? (
        <KerangkaMemuat />
      ) : galat && !memuat ? (
        <div className="empty-state-card ip-state">
          <p>Riwayat peminjaman belum dapat dimuat.</p>
          <span className="pm-muted">{galat}</span>
          <button type="button" className="btn-primary pm-btn" onClick={() => setMuatUlang((n) => n + 1)}>
            Coba lagi
          </button>
        </div>
      ) : transaksi.length === 0 ? (
        <div className="empty-state-card ip-state">
          <span className="pm-empty-icon">
            <Ikon nama={sedangMenyaring ? 'search' : 'book'} ukuran={26} />
          </span>
          <p>{sedangMenyaring ? 'Tidak ada transaksi yang cocok.' : 'Riwayat peminjaman belum tersedia.'}</p>
          <span className="pm-muted">
            {sedangMenyaring
              ? 'Coba kata kunci lain atau pilih filter "Semua Riwayat".'
              : 'Buku yang Anda pinjam akan muncul di sini.'}
          </span>
        </div>
      ) : (
        <div className={`loan-cards-list ${memuat ? 'ip-refreshing' : ''}`}>
          {transaksi.map((item) => {
            const isReturned = item.status === 'SELESAI';
            const isOverdue = !isReturned && item.terlambat;
            const denda = item.denda;
            const tingkat = isReturned ? 'kembali' : isOverdue ? 'terlambat' : 'aktif';
            const detailTerbuka = terbuka === item.id_peminjaman;
            const idDetail = `ip-detail-${item.id_peminjaman}`;

            return (
              <article key={item.id_peminjaman} className={`loan-record-card ip-card ${tingkat}`}>
                <div className="loan-card-main">
                  <div className="ip-card-body">
                    <span className="pm-cover ip-cover" style={{ background: warnaSampul(item.koleksi?.judul) }}>
                      {item.koleksi?.judul?.charAt(0)}
                    </span>

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
                        {item.jalur === 'PUSTAKAWAN' && <span className="ip-chip">Via Pustakawan</span>}
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
                        <div>
                          <span className="lbl">{isReturned ? 'Dikembalikan:' : 'Jatuh Tempo:'}</span>{' '}
                          <span className={isOverdue ? 'text-red font-bold' : ''}>
                            {formatTanggal(isReturned ? item.tanggal_kembali : item.tanggal_jatuh_tempo)}
                          </span>
                        </div>
                      </div>

                      {!isReturned && <SisaWaktu item={item} hariIni={hariIni} />}

                      <button
                        type="button"
                        className={`ip-toggle ${detailTerbuka ? 'terbuka' : ''}`}
                        aria-expanded={detailTerbuka}
                        aria-controls={idDetail}
                        onClick={() => setTerbuka(detailTerbuka ? null : item.id_peminjaman)}
                      >
                        {detailTerbuka ? 'Sembunyikan detail' : 'Lihat detail'}
                        <Ikon nama="chevron" ukuran={16} />
                      </button>

                      {detailTerbuka && (
                        <div id={idDetail} className="ip-detail">
                          <Linimasa item={item} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="loan-card-side">
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
