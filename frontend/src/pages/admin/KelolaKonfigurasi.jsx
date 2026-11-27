import { useEffect, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import { ErrorKolom, KeadaanData, Notifikasi } from './AdminUI.jsx';
import { keadaanMuat, pesanDari } from './adminUtils.js';
import { formatNilai, formatRentang, formatWaktu, jenisTipe, validasiKlien } from './konfigurasiUtils.js';
import { daftarKonfigurasi, riwayatKonfigurasi, ubahKonfigurasi } from '../../services/konfigurasiService.js';

const BATAS_RIWAYAT = 20;

function KolomNilai({ parameter, nilai, onUbah, error }) {
  const jenis = jenisTipe(parameter.tipe_data);
  const props = {
    id: 'nilai-baru',
    className: 'form-control',
    value: nilai,
    onChange: (e) => onUbah(e.target.value),
    required: true,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? 'nilai-baru-error nilai-baru-bantuan' : 'nilai-baru-bantuan',
  };

  if (jenis === 'boolean') {
    return (
      <select {...props}>
        <option value="true">Aktif</option>
        <option value="false">Nonaktif</option>
      </select>
    );
  }
  if (jenis === 'teks') {
    return <input {...props} type="text" maxLength={255} />;
  }
  return (
    <input
      {...props}
      type="number"
      inputMode={jenis === 'bulat' ? 'numeric' : 'decimal'}
      step={jenis === 'bulat' ? 1 : 0.01}
      min={parameter.nilai_min ?? undefined}
      max={parameter.nilai_maks ?? undefined}
    />
  );
}

function FormNilai({ parameter, onSimpan, onBatal }) {
  const [nilai, setNilai] = useState(parameter.nilai ?? '');
  const [errorKolom, setErrorKolom] = useState('');
  const [errorServer, setErrorServer] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pesan = validasiKlien(parameter, nilai);
    setErrorKolom(pesan);
    if (pesan) return;

    setMenyimpan(true);
    setErrorServer('');
    try {
      await onSimpan(String(nilai).trim());
    } catch (err) {
      setErrorServer(pesanDari(err));
      setMenyimpan(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form adm-modal-form" noValidate>
      <div className="adm-modal-summary">
        <span className="adm-user">
          <span className="adm-user-name">{parameter.label}</span>
          <span className="adm-user-id">{parameter.kunci_parameter}</span>
        </span>
        <span className="adm-muted">Saat ini: {formatNilai(parameter, parameter.nilai)}</span>
      </div>
      {errorServer && <div className="alert-error" role="alert">{errorServer}</div>}
      <div className="form-group">
        <label className="form-label" htmlFor="nilai-baru">
          Nilai baru{parameter.satuan ? ` (${parameter.satuan})` : ''} *
        </label>
        <KolomNilai parameter={parameter} nilai={nilai} onUbah={setNilai} error={errorKolom} />
        <span id="nilai-baru-bantuan" className="form-hint">Rentang valid: {formatRentang(parameter)}</span>
        <ErrorKolom id="nilai-baru-error" pesan={errorKolom} />
      </div>
      <p className="form-hint">
        Perubahan berlaku untuk transaksi baru. Jatuh tempo dan denda yang sudah ada tidak dihitung ulang.
      </p>
      <div className="modal-actions-row">
        <button type="button" className="btn-outline-sm" onClick={onBatal}>Batal</button>
        <button type="submit" className="btn-primary" disabled={menyimpan}>
          {menyimpan ? 'Menyimpan...' : 'Simpan Nilai'}
        </button>
      </div>
    </form>
  );
}

function useMuat(muat, deps) {
  const [hasil, setHasil] = useState({ kunci: null, data: [], error: '' });
  const kunci = JSON.stringify(deps);

  useEffect(() => {
    let batal = false;
    muat().then(
      (data) => {
        if (!batal) setHasil({ kunci, data, error: '' });
      },
      (err) => {
        if (!batal) setHasil({ kunci, data: [], error: pesanDari(err) });
      },
    );
    return () => {
      batal = true;
    };
    // `muat` dibuat ulang tiap render; perubahan permintaan ditandai oleh `kunci`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);

  return { ...hasil, keadaan: keadaanMuat(hasil, kunci) };
}

export default function KelolaKonfigurasi() {
  const [versi, setVersi] = useState(0);
  const [filterKunci, setFilterKunci] = useState('');
  // { parameter } baru setiap kali modal dibuka: penyimpanan yang selesai belakangan
  // hanya menutup modal yang memulainya, bukan modal yang dibuka sesudahnya.
  const [dipilih, setDipilih] = useState(null);
  const [notifikasi, setNotifikasi] = useState('');

  const daftar = useMuat(() => daftarKonfigurasi(), ['daftar', versi]);
  const riwayat = useMuat(
    () => riwayatKonfigurasi({ kunci: filterKunci, batas: BATAS_RIWAYAT }),
    ['riwayat', filterKunci, versi],
  );

  const parameterPerKunci = Object.fromEntries(daftar.data.map((p) => [p.kunci_parameter, p]));
  const adaParameter = daftar.keadaan === 'siap' && daftar.data.length > 0;
  const adaRiwayat = riwayat.keadaan === 'siap' && riwayat.data.length > 0;

  return (
    <section className="adm-page">
      <div className="adm-header">
        <div>
          <h2 className="page-title">Konfigurasi Sistem</h2>
          <p className="page-subtitle">
            Atur batas pinjam, durasi peminjaman, dan tarif denda. Setiap perubahan dicatat di riwayat.
          </p>
        </div>
      </div>

      <div className="table-responsive-wrapper adm-table-wrap">
        {!adaParameter && (
          <KeadaanData
            keadaan={daftar.keadaan}
            pesanMemuat="Memuat parameter..."
            pesanError={daftar.error}
            pesanKosong="Belum ada parameter konfigurasi."
            onCobaLagi={() => setVersi((v) => v + 1)}
          />
        )}
        {adaParameter && (
          <table className="custom-table adm-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Nilai saat ini</th>
                <th>Rentang valid</th>
                <th>Keterangan</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftar.data.map((p) => (
                <tr key={p.kunci_parameter}>
                  <td className="adm-cell-user">
                    <span className="adm-user">
                      <span className="adm-user-name">{p.label}</span>
                      <span className="adm-user-id">{p.kunci_parameter}</span>
                    </span>
                  </td>
                  <td data-label="Nilai saat ini">
                    <strong className="config-value-badge">{formatNilai(p, p.nilai)}</strong>
                  </td>
                  <td data-label="Rentang valid" className="adm-muted">{formatRentang(p)}</td>
                  <td data-label="Keterangan" className="adm-desc">{p.deskripsi || '-'}</td>
                  <td className="adm-cell-actions">
                    <div className="adm-actions">
                      <button
                        type="button"
                        className="btn-action-primary-sm"
                        onClick={() => setDipilih({ parameter: p })}
                        aria-label={`Ubah nilai ${p.label}`}
                      >
                        Ubah nilai
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section aria-labelledby="judul-riwayat" className="adm-page">
        <div className="adm-section-head">
          <h3 id="judul-riwayat" className="adm-section-title">Riwayat perubahan</h3>
          <div>
            <label className="adm-sr-only" htmlFor="filter-riwayat">Filter parameter</label>
            <select
              id="filter-riwayat"
              className="adm-select adm-select-sm"
              value={filterKunci}
              onChange={(e) => setFilterKunci(e.target.value)}
            >
              <option value="">Semua parameter</option>
              {daftar.data.map((p) => (
                <option key={p.kunci_parameter} value={p.kunci_parameter}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive-wrapper adm-table-wrap">
          {!adaRiwayat && (
            <KeadaanData
              keadaan={riwayat.keadaan}
              pesanMemuat="Memuat riwayat..."
              pesanError={riwayat.error}
              pesanKosong="Belum ada perubahan yang tercatat."
              onCobaLagi={() => setVersi((v) => v + 1)}
            />
          )}
          {adaRiwayat && (
            <table className="custom-table adm-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Parameter</th>
                  <th>Perubahan</th>
                  <th>Diubah oleh</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.data.map((log) => {
                  const p = parameterPerKunci[log.kunci_parameter] ?? { tipe_data: null };
                  return (
                    <tr key={log.id_log}>
                      <td className="adm-cell-user adm-muted">{formatWaktu(log.waktu)}</td>
                      <td data-label="Parameter">{log.label}</td>
                      <td data-label="Perubahan">
                        <span className="adm-change">
                          <span className="adm-muted">{formatNilai(p, log.nilai_lama)}</span>
                          <span aria-hidden="true">→</span>
                          <span className="adm-sr-only">menjadi</span>
                          <strong>{formatNilai(p, log.nilai_baru)}</strong>
                        </span>
                      </td>
                      <td data-label="Diubah oleh">
                        <span className="adm-user">
                          <span>{log.pengubah?.nama || '-'}</span>
                          <span className="adm-user-id">{log.pengubah?.pengenal}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Notifikasi pesan={notifikasi} onTutup={setNotifikasi} />

      <Modal isOpen={dipilih !== null} title="Ubah Nilai Parameter" onClose={() => setDipilih(null)}>
        {dipilih && (
          <FormNilai
            parameter={dipilih.parameter}
            onBatal={() => setDipilih(null)}
            onSimpan={async (nilaiBaru) => {
              const asal = dipilih;
              const hasil = await ubahKonfigurasi(asal.parameter.kunci_parameter, nilaiBaru);
              setDipilih((sekarang) => (sekarang === asal ? null : sekarang));
              setNotifikasi(
                hasil.berubah
                  ? `${asal.parameter.label} diubah menjadi ${formatNilai(hasil.parameter, hasil.parameter.nilai)}.`
                  : 'Nilai sama dengan sebelumnya, tidak ada perubahan.',
              );
              setVersi((v) => v + 1);
            }}
          />
        )}
      </Modal>
    </section>
  );
}
