import { useEffect, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import Paginasi from './Paginasi.jsx';
import { IkonCari, KeadaanData, Notifikasi, SelPengguna } from './AdminUI.jsx';
import {
  DESKRIPSI_PERAN,
  hitungTotalHalaman,
  keadaanMuat,
  kelasPeran,
  pesanDari,
  susunPilihanPeran,
} from './adminUtils.js';
import { daftarAkun, daftarPeran, ubahPeran } from '../../services/akunService.js';

const PER_HALAMAN = 10;

function FormPeran({ akun, pilihanPeran, onSimpan, onBatal }) {
  const [peranBaru, setPeranBaru] = useState(akun.role);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState('');

  const simpan = async () => {
    setMenyimpan(true);
    setError('');
    try {
      await onSimpan(peranBaru);
    } catch (err) {
      setError(pesanDari(err));
      setMenyimpan(false);
      setKonfirmasi(false);
    }
  };

  const nama = akun.nama || akun.pengenal;

  if (konfirmasi) {
    return (
      <div className="modal-form">
        <div className="adm-role-change" aria-hidden="true">
          <span className={kelasPeran(akun.role)}>{akun.role}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
          <span className={kelasPeran(peranBaru)}>{peranBaru}</span>
        </div>
        <p>
          Ubah peran <strong>{nama}</strong> dari <strong>{akun.role}</strong> menjadi <strong>{peranBaru}</strong>?
        </p>
        <p className="form-hint">Akses akun ini langsung mengikuti peran baru pada permintaan berikutnya.</p>
        <div className="modal-actions-row">
          <button type="button" className="btn-outline-sm" onClick={() => setKonfirmasi(false)} disabled={menyimpan}>
            Kembali
          </button>
          <button type="button" className="btn-primary" onClick={simpan} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan...' : 'Ya, ubah peran'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="modal-form"
      onSubmit={(e) => {
        e.preventDefault();
        setKonfirmasi(true);
      }}
    >
      <div className="adm-modal-summary">
        <SelPengguna akun={akun} milikSendiri={false} />
        <span className={kelasPeran(akun.role)}>{akun.role}</span>
      </div>
      {error && <div className="alert-error" role="alert">{error}</div>}
      <fieldset className="adm-role-group">
        <legend className="form-label">Pilih peran baru</legend>
        {pilihanPeran.map(({ nama: peran, tersedia }) => {
          const terpilih = peranBaru === peran;
          const kelas = ['adm-role-option', terpilih && 'is-selected', !tersedia && 'is-disabled']
            .filter(Boolean)
            .join(' ');
          return (
            <label key={peran} className={kelas}>
              <input
                type="radio"
                name="peran-baru"
                value={peran}
                aria-label={peran}
                checked={terpilih}
                disabled={!tersedia}
                onChange={() => setPeranBaru(peran)}
              />
              <span className="adm-role-option-text">
                <span className="adm-role-option-name">
                  {peran}
                  {peran === akun.role && <span className="adm-you">Saat ini</span>}
                </span>
                <span className="adm-role-option-desc">
                  {tersedia ? DESKRIPSI_PERAN[peran] ?? '' : 'Belum tersedia di database. Hubungi pengelola sistem.'}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="modal-actions-row">
        <button type="button" className="btn-outline-sm" onClick={onBatal}>Batal</button>
        <button type="submit" className="btn-primary" disabled={peranBaru === akun.role}>
          Simpan
        </button>
      </div>
    </form>
  );
}

export default function KelolaHakAkses({ currentUser }) {
  const [inputCari, setInputCari] = useState('');
  const [q, setQ] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState({
    kunci: null,
    data: { items: [], total: 0 },
    peran: susunPilihanPeran([]),
    error: '',
  });
  const [notifikasi, setNotifikasi] = useState('');
  // { akun } baru setiap kali modal dibuka: identitas pembukaan, bukan sekadar id_pengguna,
  // agar penyimpanan yang selesai belakangan tidak menutup modal yang dibuka sesudahnya.
  const [modalPeran, setModalPeran] = useState(null);

  const kunci = JSON.stringify({ q, halaman, versi });
  const keadaan = keadaanMuat(hasil, kunci);
  const { data, peran: pilihanPeran } = hasil;

  useEffect(() => {
    const kunciIni = JSON.stringify({ q, halaman, versi });
    let batal = false;
    Promise.all([daftarAkun({ q, halaman, per_halaman: PER_HALAMAN }), daftarPeran()]).then(
      ([dataBaru, peran]) => {
        if (batal) return;
        // Halaman jadi kosong (mis. akun di halaman terakhir berubah dan keluar dari pencarian):
        // pindah ke halaman terakhir yang masih berisi data (minimal halaman 1).
        const halamanTerakhir = hitungTotalHalaman(dataBaru.total, PER_HALAMAN);
        if (dataBaru.items.length === 0 && halaman > halamanTerakhir) {
          setHalaman(halamanTerakhir);
          return;
        }
        setHasil({ kunci: kunciIni, data: dataBaru, peran: susunPilihanPeran(peran), error: '' });
      },
      (err) => {
        if (!batal) setHasil((lama) => ({ ...lama, kunci: kunciIni, error: pesanDari(err) }));
      },
    );
    return () => {
      batal = true;
    };
  }, [q, halaman, versi]);

  const handleCari = (e) => {
    e.preventDefault();
    setQ(inputCari.trim());
    setHalaman(1);
  };

  const hapusPencarian = () => {
    setInputCari('');
    setQ('');
    setHalaman(1);
  };

  const akunSendiri = (akun) => Boolean(currentUser) && akun.pengenal === currentUser.pengenal;
  const adaData = keadaan === 'siap' && data.items.length > 0;

  return (
    <section className="adm-page">
      <div className="adm-header">
        <div>
          <h2 className="page-title">Pengaturan Hak Akses</h2>
          <p className="page-subtitle">
            Tetapkan peran setiap akun. Kewenangan tiap peran mengikuti matriks hak akses dan tidak dapat diubah di aplikasi.
          </p>
        </div>
      </div>

      <form className="adm-toolbar is-simple" onSubmit={handleCari} role="search">
        <div className="adm-search">
          <IkonCari />
          <label className="adm-sr-only" htmlFor="cari-hak-akses">Cari pengenal atau nama</label>
          <input
            id="cari-hak-akses"
            type="search"
            className="search-input"
            placeholder="Cari pengenal atau nama..."
            value={inputCari}
            maxLength={100}
            onChange={(e) => setInputCari(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary">Cari</button>
      </form>

      {adaData && <p className="adm-meta">{data.total} akun</p>}

      <div className="table-responsive-wrapper adm-table-wrap">
        {!adaData && (
          <KeadaanData
            keadaan={keadaan}
            pesanError={hasil.error}
            pesanKosong={q ? 'Tidak ada akun yang cocok dengan pencarian.' : 'Belum ada akun.'}
            onCobaLagi={() => setVersi((v) => v + 1)}
            aksiKosong={q ? { label: 'Hapus pencarian', onClick: hapusPencarian } : null}
          />
        )}

        {adaData && (
          <table className="custom-table adm-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Peran saat ini</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((akun) => {
                const milikSendiri = akunSendiri(akun);
                return (
                  <tr key={akun.id_pengguna}>
                    <td className="adm-cell-user">
                      <SelPengguna akun={akun} milikSendiri={milikSendiri} />
                      {!akun.status_aktif && <span className="adm-reason">Nonaktif</span>}
                    </td>
                    <td data-label="Peran saat ini">
                      <span className={kelasPeran(akun.role)}>{akun.role ?? '-'}</span>
                    </td>
                    <td className="adm-cell-actions">
                      <div className="adm-actions">
                        <button
                          type="button"
                          className="btn-action-primary-sm"
                          onClick={() => setModalPeran({ akun })}
                          disabled={milikSendiri}
                          title={milikSendiri ? 'Peran akunmu sendiri tidak dapat diubah.' : undefined}
                          aria-label={`Ubah peran ${akun.pengenal}`}
                          aria-describedby={milikSendiri ? `catatan-${akun.id_pengguna}` : undefined}
                        >
                          Ubah peran
                        </button>
                      </div>
                      {milikSendiri && (
                        <span id={`catatan-${akun.id_pengguna}`} className="adm-sr-only">
                          Peran akunmu sendiri tidak dapat diubah.
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {adaData && (
        <Paginasi halaman={halaman} totalHalaman={hitungTotalHalaman(data.total, PER_HALAMAN)} onGanti={setHalaman} />
      )}

      <Notifikasi pesan={notifikasi} onTutup={setNotifikasi} />

      <Modal isOpen={modalPeran !== null} title="Ubah Peran Pengguna" onClose={() => setModalPeran(null)}>
        {modalPeran && (
          <FormPeran
            akun={modalPeran.akun}
            pilihanPeran={pilihanPeran}
            onBatal={() => setModalPeran(null)}
            onSimpan={async (peranBaru) => {
              const asal = modalPeran;
              await ubahPeran(asal.akun.id_pengguna, peranBaru);
              // Tutup hanya jika modal yang terbuka masih pembukaan yang sama
              setModalPeran((sekarang) => (sekarang === asal ? null : sekarang));
              setNotifikasi(`Peran ${asal.akun.pengenal} berhasil diubah menjadi ${peranBaru}.`);
              setVersi((v) => v + 1);
            }}
          />
        )}
      </Modal>
    </section>
  );
}
