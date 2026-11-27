/**
 * Komponen bersama dashboard Pengelola.
 * Grafik mengikuti skill dataviz: satu seri satu warna (--green-accent, lolos validator),
 * label angka langsung, grid samar, tooltip saat hover/fokus, dan tabel sebagai alternatif.
 */
import { useEffect, useId, useRef, useState } from 'react';
import {
  PILIHAN_PERIODE,
  batasAtas,
  formatAngka,
  geserTooltip,
  formatJamWib,
  labelTanggal,
  persen,
} from './dashboardUtils.js';

export function IkonMuatUlang() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polyline points="23 4 23 10 17 10"></polyline>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
    </svg>
  );
}

export function PemilihPeriode({ nilai, onGanti, disabled = false }) {
  return (
    <div className="dsb-periode" role="group" aria-label="Periode">
      {PILIHAN_PERIODE.map((p) => (
        <button
          key={p.kode}
          type="button"
          className={`dsb-periode-btn${nilai === p.kode ? ' is-aktif' : ''}`}
          aria-pressed={nilai === p.kode}
          onClick={() => onGanti(p.kode)}
          disabled={disabled}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Judul halaman, keterangan periode/waktu hitung, pemilih periode (opsional), dan tombol Muat ulang. */
export function KepalaDashboard({ judul, keterangan, data, memuat, onMuatUlang, periode, onGantiPeriode }) {
  let subjudul = keterangan;
  if (data?.periode) {
    subjudul = `${data.periode.label} (${data.periode.mulai} s.d. ${data.periode.akhir}), dihitung pukul ${formatJamWib(data.dihitung_pada)}`;
  } else if (data?.dihitung_pada) {
    subjudul = `Kondisi saat ini, dihitung pukul ${formatJamWib(data.dihitung_pada)}`;
  }

  return (
    <div className="adm-header dsb-head">
      <div>
        <h2 className="page-title">{judul}</h2>
        <p className="page-subtitle">{subjudul}</p>
      </div>
      <div className="dsb-head-actions">
        {periode && <PemilihPeriode nilai={periode} onGanti={onGantiPeriode} disabled={memuat} />}
        <button type="button" className="adm-btn dsb-reload" onClick={onMuatUlang} disabled={memuat}>
          <IkonMuatUlang />
          <span>{memuat ? 'Memuat...' : 'Muat ulang'}</span>
        </button>
      </div>
    </div>
  );
}

/** Keadaan memuat pertama kali atau error (data lama tetap tampil jika ada). */
export function StatusMuat({ memuat, error, adaData, onCobaLagi }) {
  if (memuat && !adaData) {
    return (
      <div className="adm-state" role="status">
        <span className="adm-spinner" aria-hidden="true"></span>
        <span>Menghitung indikator...</span>
      </div>
    );
  }
  if (!memuat && error) {
    return (
      <div className="adm-card adm-state is-error" role="alert">
        <span className="adm-state-text">{error}</span>
        <button type="button" className="adm-btn" onClick={onCobaLagi}>Coba lagi</button>
      </div>
    );
  }
  return null;
}

const PANAH = { naik: '▲', turun: '▼', sama: '■' };

export function KartuKpi({ label, nilai, konteks, caraHitung, meter, perubahan }) {
  return (
    <div className="dsb-kpi">
      <span className="dsb-kpi-label">{label}</span>
      <strong className="dsb-kpi-value">{nilai}</strong>
      {meter !== undefined && (
        <span className="dsb-meter" aria-hidden="true">
          <span className="dsb-meter-fill" style={{ width: `${meter}%` }}></span>
        </span>
      )}
      {konteks && <span className="dsb-kpi-context">{konteks}</span>}
      {perubahan && (
        <span className={`dsb-kpi-delta is-${perubahan.arah}`}>
          <span aria-hidden="true">{PANAH[perubahan.arah]}</span> {perubahan.teks}
        </span>
      )}
      {caraHitung && <span className="dsb-kpi-hint">{caraHitung}</span>}
    </div>
  );
}

export function Panel({ judul, keterangan, lebar = false, children }) {
  const idJudul = useId();
  return (
    <section className={`adm-card dsb-panel${lebar ? ' dsb-panel-lebar' : ''}`} aria-labelledby={idJudul}>
      <div className="dsb-panel-head">
        <h3 id={idJudul} className="adm-section-title">{judul}</h3>
        {keterangan && <p className="dsb-panel-note">{keterangan}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Bar horizontal satu warna dengan label langsung (satu seri, tanpa legenda),
 * disajikan sebagai tabel agar terbaca pembaca layar.
 */
export function DaftarBar({ judul, keterangan, baris, total, kosong = 'Belum ada data.' }) {
  const totalPakai = total ?? baris.reduce((n, b) => n + b.nilai, 0);
  return (
    <Panel judul={judul} keterangan={keterangan}>
      {baris.length === 0 ? (
        <p className="dsb-kosong">{kosong}</p>
      ) : (
        <table className="dsb-bars">
          <thead className="adm-sr-only">
            <tr>
              <th scope="col">Kategori</th>
              <th scope="col">Proporsi</th>
              <th scope="col">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const bagian = persen(b.nilai, totalPakai);
              return (
                <tr key={b.label} title={`${b.label}: ${formatAngka(b.nilai)} (${bagian}%)`}>
                  <th scope="row" className="dsb-bar-label">{b.label}</th>
                  <td className="dsb-bar-cell">
                    <span className="dsb-bar-track" aria-hidden="true">
                      <span className="dsb-bar-fill" style={{ width: `${bagian}%` }}></span>
                    </span>
                    <span className="adm-sr-only">{bagian}%</span>
                  </td>
                  <td className="dsb-bar-value">
                    <strong>{formatAngka(b.nilai)}</strong>
                    {b.tambahan && <span className="dsb-bar-extra">{b.tambahan}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/** Peringkat (top 5): nomor, nama yang boleh panjang, bar relatif terhadap peringkat pertama, dan jumlah. */
export function DaftarPeringkat({ judul, keterangan, baris, kosong }) {
  const maks = Math.max(1, ...baris.map((b) => b.nilai));
  return (
    <Panel judul={judul} keterangan={keterangan}>
      {baris.length === 0 ? (
        <p className="dsb-kosong">{kosong}</p>
      ) : (
        <ol className="dsb-rank">
          {baris.map((b, i) => (
            <li key={b.kunci ?? b.label} className="dsb-rank-item">
              <span className="dsb-rank-no" aria-hidden="true">{i + 1}</span>
              <span className="dsb-rank-body">
                <span className="dsb-rank-label">{b.label}</span>
                <span className="dsb-bar-track" aria-hidden="true">
                  <span className="dsb-bar-fill" style={{ width: `${persen(b.nilai, maks)}%` }}></span>
                </span>
              </span>
              <strong className="dsb-rank-value">{formatAngka(b.nilai)}</strong>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/**
 * Grafik kolom satu seri untuk pola waktu (hari dalam seminggu, jam). Angka langsung di atas kolom
 * hanya jika kolom sedikit; untuk banyak kolom hanya kolom tertinggi, sisanya lewat tooltip/tabel.
 */
export function GrafikKolom({ judul, keterangan, baris, namaNilai, labelSetiap = 1, lebar = false }) {
  const maks = Math.max(0, ...baris.map((b) => b.jumlah));
  const tampilSemua = baris.length <= 12;
  const total = baris.reduce((n, b) => n + b.jumlah, 0);
  return (
    <Panel judul={judul} keterangan={keterangan} lebar={lebar}>
      <div
        className="dsb-kolom"
        role="img"
        aria-label={`${judul}: total ${formatAngka(total)} ${namaNilai}${maks > 0 ? `, tertinggi ${formatAngka(maks)} pada ${baris.find((b) => b.jumlah === maks).label}` : ''}.`}
      >
        {baris.map((b, i) => {
          const tinggi = maks > 0 ? Math.max(b.jumlah > 0 ? 3 : 0, (b.jumlah / maks) * 100) : 0;
          const tampilAngka = b.jumlah > 0 && (tampilSemua || b.jumlah === maks);
          return (
            <div key={b.label} className="dsb-kolom-item" title={`${b.label}: ${formatAngka(b.jumlah)} ${namaNilai}`}>
              <span className="dsb-kolom-plot">
                {tampilAngka && <span className="dsb-kolom-angka">{formatAngka(b.jumlah)}</span>}
                <span className="dsb-kolom-batang" style={{ height: `${tinggi}%` }}></span>
              </span>
              <span className="dsb-kolom-label">{i % labelSetiap === 0 ? b.label : ''}</span>
            </div>
          );
        })}
      </div>
      {total === 0 && <p className="dsb-kosong">Belum ada data pada periode ini.</p>}
      {/* Tabel yang bisa dibuka (seperti GrafikTren): angka tiap kolom terbaca tanpa harus hover. */}
      <details className="dsb-tabel-alt">
        <summary>Lihat sebagai tabel</summary>
        <table className="custom-table">
          <caption className="adm-sr-only">{judul}</caption>
          <thead>
            <tr>
              <th scope="col">Label</th>
              <th scope="col" className="text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.label}>
                <th scope="row">{b.label}</th>
                <td className="text-right">{formatAngka(b.jumlah)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Panel>
  );
}

/**
 * Komposisi (bagian dari satu keseluruhan) dengan gaya yang sama seperti panel lain:
 * bar hijau per bagian, jumlah, dan persentasenya (ditambah keterangan, mis. Rupiah).
 */
export function BarKomposisi({ judul, keterangan, bagian, formatTambahan }) {
  const total = bagian.reduce((n, b) => n + b.nilai, 0);
  return (
    <DaftarBar
      judul={judul}
      keterangan={keterangan}
      total={total}
      kosong="Belum ada data."
      baris={bagian.map((b) => ({
        label: b.label,
        nilai: b.nilai,
        tambahan: `${persen(b.nilai, total)}%${formatTambahan ? ` · ${formatTambahan(b)}` : ''}`,
      }))}
    />
  );
}

// ---------------------------------------------------------------------------
// Grafik tren (garis satu seri)
// ---------------------------------------------------------------------------
const LEBAR_AWAL = 640;
const TINGGI = 200;
const KIRI = 36;
const KANAN = 12;
const ATAS = 12;
const BAWAH = 28;

/**
 * Lebar elemen dalam piksel (ResizeObserver), agar grafik digambar 1:1 dan teks sumbu tetap 11px
 * di layar lebar maupun HP. Tanpa ResizeObserver (mis. jsdom) memakai lebar awal.
 */
function useLebarElemen(awal) {
  const [lebar, setLebar] = useState(awal);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const pengamat = new ResizeObserver(([entri]) => {
      const baru = Math.round(entri.contentRect.width);
      if (baru > 0) setLebar(baru);
    });
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, []);
  return [ref, lebar];
}

export function GrafikTren({ judul, keterangan, titik, satuan, namaNilai, formatTambahan }) {
  const [aktif, setAktif] = useState(null);
  const [refWadah, LEBAR] = useLebarElemen(LEBAR_AWAL);
  const maks = batasAtas(Math.max(0, ...titik.map((t) => t.jumlah)));
  // Data berupa jumlah (bilangan bulat): garis bantu hanya di nilai bulat.
  const garisBantu = Number.isInteger(maks / 2) ? [0, maks / 2, maks] : [0, maks];
  const lebarPlot = LEBAR - KIRI - KANAN;
  const tinggiPlot = TINGGI - ATAS - BAWAH;
  const n = titik.length;
  const x = (i) => KIRI + (n <= 1 ? lebarPlot / 2 : (i / (n - 1)) * lebarPlot);
  const y = (v) => ATAS + tinggiPlot - (v / maks) * tinggiPlot;
  const garis = titik.map((t, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(t.jumlah).toFixed(1)}`).join(' ');
  const area = n > 0 ? `${garis} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
  const indeksLabel = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : titik.map((_, i) => i);
  const semuaNol = titik.every((t) => t.jumlah === 0);
  const lebarSentuh = n > 0 ? lebarPlot / Math.max(1, n - 1) : 0;
  const titikAktif = aktif !== null ? titik[aktif] : null;

  const tekan = (e) => {
    if (n === 0) return;
    if (e.key === 'ArrowRight') setAktif((a) => (a === null ? 0 : Math.min(n - 1, a + 1)));
    else if (e.key === 'ArrowLeft') setAktif((a) => (a === null ? n - 1 : Math.max(0, a - 1)));
    else if (e.key === 'Escape') setAktif(null);
    else return;
    e.preventDefault();
  };

  const total = titik.reduce((s, t) => s + t.jumlah, 0);

  return (
    <Panel judul={judul} keterangan={keterangan} lebar>
      <div className="dsb-tren" ref={refWadah}>
        <svg
          viewBox={`0 0 ${LEBAR} ${TINGGI}`}
          width={LEBAR}
          height={TINGGI}
          className="dsb-tren-svg"
          role="img"
          tabIndex={0}
          aria-label={`${judul}: total ${formatAngka(total)} ${namaNilai} dalam ${n} ${satuan}. Gunakan panah kiri/kanan untuk melihat tiap titik.`}
          onKeyDown={tekan}
          onMouseLeave={() => setAktif(null)}
          onBlur={() => setAktif(null)}
        >
          {garisBantu.map((v) => (
            <g key={v}>
              <line className="dsb-tren-grid" x1={KIRI} x2={LEBAR - KANAN} y1={y(v)} y2={y(v)} />
              <text className="dsb-tren-axis" x={KIRI - 6} y={y(v) + 4} textAnchor="end">
                {formatAngka(v)}
              </text>
            </g>
          ))}
          {indeksLabel.map((i) => (
            <text key={i} className="dsb-tren-axis" x={x(i)} y={TINGGI - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {labelTanggal(titik[i].tanggal, satuan)}
            </text>
          ))}
          <path className="dsb-tren-area" d={area} />
          <path className="dsb-tren-line" d={garis} />
          {/* Satu titik tidak membentuk garis (path hanya "M"), jadi tandai dengan lingkaran. */}
          {n === 1 && <circle className="dsb-tren-dot dsb-tren-tunggal" cx={x(0)} cy={y(titik[0].jumlah)} r="4" />}
          {titikAktif && (
            <g>
              <line className="dsb-tren-cross" x1={x(aktif)} x2={x(aktif)} y1={ATAS} y2={ATAS + tinggiPlot} />
              <circle className="dsb-tren-dot" cx={x(aktif)} cy={y(titikAktif.jumlah)} r="5" />
            </g>
          )}
          {titik.map((t, i) => (
            <rect
              key={t.tanggal}
              className="dsb-tren-hit"
              x={x(i) - lebarSentuh / 2}
              y={ATAS}
              width={Math.max(lebarSentuh, 8)}
              height={tinggiPlot}
              onMouseEnter={() => setAktif(i)}
            />
          ))}
        </svg>
        {titikAktif && (
          <div
            className="dsb-tooltip"
            role="status"
            style={{ left: `${x(aktif)}px`, transform: `translateX(${geserTooltip(x(aktif) / LEBAR)})` }}
          >
            <span className="dsb-tooltip-label">{labelTanggal(titikAktif.tanggal, satuan)}</span>
            <strong>
              {formatAngka(titikAktif.jumlah)} {namaNilai}
            </strong>
            {formatTambahan && <span>{formatTambahan(titikAktif)}</span>}
          </div>
        )}
      </div>
      {semuaNol && <p className="dsb-kosong">Belum ada data pada periode ini.</p>}
      <details className="dsb-tabel-alt">
        <summary>Lihat sebagai tabel</summary>
        <table className="custom-table">
          <thead>
            <tr>
              <th scope="col">{satuan === 'minggu' ? 'Minggu mulai' : 'Tanggal'}</th>
              <th scope="col" className="text-right">Jumlah</th>
              {formatTambahan && <th scope="col" className="text-right">Keterangan</th>}
            </tr>
          </thead>
          <tbody>
            {titik.map((t) => (
              <tr key={t.tanggal}>
                <td>{labelTanggal(t.tanggal)}</td>
                <td className="text-right">{formatAngka(t.jumlah)}</td>
                {formatTambahan && <td className="text-right">{formatTambahan(t)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Panel>
  );
}
