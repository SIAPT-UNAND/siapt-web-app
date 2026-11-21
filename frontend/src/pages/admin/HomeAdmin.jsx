import { useEffect, useState } from 'react';
import { daftarAkun } from '../../services/akunService.js';
import { SelPengguna } from './AdminUI.jsx';
import { formatTanggal, kelasPeran } from './adminUtils.js';

const JUMLAH_DAFTAR = 5;

// Satu kali muat: 5 akun terbaru (sekaligus total), jumlah aktif, dan 5 akun nonaktif.
function useRingkasanAkun() {
  const [ringkasan, setRingkasan] = useState(null);

  useEffect(() => {
    let batal = false;
    Promise.all([
      daftarAkun({ per_halaman: JUMLAH_DAFTAR }),
      daftarAkun({ status: 'aktif', per_halaman: 1 }),
      daftarAkun({ status: 'nonaktif', per_halaman: JUMLAH_DAFTAR }),
    ]).then(
      ([terbaru, aktif, nonaktif]) => {
        if (batal) return;
        setRingkasan({
          total: terbaru.total,
          aktif: aktif.total,
          nonaktif: nonaktif.total,
          terbaru: terbaru.items,
          daftarNonaktif: nonaktif.items,
        });
      },
      () => {
        if (!batal) setRingkasan({ gagal: true });
      },
    );
    return () => {
      batal = true;
    };
  }, []);

  return ringkasan;
}

const STATISTIK = [
  { kunci: 'total', label: 'Total akun' },
  { kunci: 'aktif', label: 'Aktif' },
  { kunci: 'nonaktif', label: 'Nonaktif' },
];

function PesanDaftar({ ringkasan, kosong }) {
  let pesan = kosong;
  if (!ringkasan) pesan = 'Memuat...';
  else if (ringkasan.gagal) pesan = 'Data tidak dapat dimuat. Coba buka ulang halaman ini.';
  return <div className="adm-state">{pesan}</div>;
}

export default function HomeAdmin({ onSelectMenu }) {
  const ringkasan = useRingkasanAkun();
  const terbaru = ringkasan?.terbaru ?? [];
  const daftarNonaktif = ringkasan?.daftarNonaktif ?? [];

  return (
    <section className="adm-page">
      <div className="adm-header">
        <div>
          <h2 className="page-title">Beranda Administrator</h2>
          <p className="page-subtitle">Ringkasan akun pengguna SIAPT</p>
        </div>
      </div>

      <div className="adm-stats">
        {STATISTIK.map((s) => {
          let nilai = '…';
          if (ringkasan) nilai = ringkasan[s.kunci] ?? '-';
          return (
            <div key={s.kunci} className="adm-stat">
              <span className="adm-stat-label">{s.label}</span>
              <strong className="adm-stat-value" aria-label={`${s.label}: ${nilai}`}>{nilai}</strong>
            </div>
          );
        })}
      </div>

      <div className="adm-home-grid">
        <section aria-labelledby="judul-akun-terbaru">
          <div className="adm-section-head">
            <h3 id="judul-akun-terbaru" className="adm-section-title">Akun terbaru</h3>
            <button type="button" className="adm-text-btn" onClick={() => onSelectMenu?.('kelola-akun')}>
              Kelola akun
            </button>
          </div>
          <div className="table-responsive-wrapper adm-table-wrap">
            {terbaru.length === 0 ? (
              <PesanDaftar ringkasan={ringkasan} kosong="Belum ada akun." />
            ) : (
              <table className="custom-table adm-table">
                <thead>
                  <tr>
                    <th>Pengguna</th>
                    <th>Peran</th>
                    <th>Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {terbaru.map((akun) => (
                    <tr key={akun.id_pengguna}>
                      <td className="adm-cell-user">
                        <SelPengguna akun={akun} milikSendiri={false} />
                      </td>
                      <td data-label="Peran">
                        <span className={kelasPeran(akun.role)}>{akun.role ?? '-'}</span>
                      </td>
                      <td data-label="Dibuat" className="adm-muted">{formatTanggal(akun.dibuat_pada)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section aria-labelledby="judul-akun-nonaktif">
          <div className="adm-section-head">
            <h3 id="judul-akun-nonaktif" className="adm-section-title">Akun nonaktif</h3>
          </div>
          <div className="table-responsive-wrapper adm-table-wrap">
            {daftarNonaktif.length === 0 ? (
              <PesanDaftar ringkasan={ringkasan} kosong="Tidak ada akun nonaktif." />
            ) : (
              <table className="custom-table adm-table">
                <thead>
                  <tr>
                    <th>Pengguna</th>
                    <th>Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {daftarNonaktif.map((akun) => (
                    <tr key={akun.id_pengguna}>
                      <td className="adm-cell-user">
                        <SelPengguna akun={akun} milikSendiri={false} />
                      </td>
                      <td data-label="Alasan" className="adm-muted">{akun.alasan_nonaktif || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
