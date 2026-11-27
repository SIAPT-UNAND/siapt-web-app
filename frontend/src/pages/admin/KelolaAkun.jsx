import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import Paginasi from './Paginasi.jsx';
import {
  ErrorKolom,
  IkonCari,
  IkonDaya,
  IkonKunci,
  IkonTambah,
  IkonUbah,
  KeadaanData,
  Notifikasi,
  SelPengguna,
} from './AdminUI.jsx';
import { formatTanggal, hitungTotalHalaman, keadaanMuat, kelasPeran, pesanDari } from './adminUtils.js';
import {
  PERAN_RESMI,
  daftarAkun,
  resetKataSandi,
  tambahAkun,
  ubahAkun,
  ubahStatusAkun,
} from '../../services/akunService.js';

const PER_HALAMAN = 10;

// Pembungkus form modal: menangani status menyimpan dan pesan error dari server.
function useKirimForm(onSimpan) {
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState('');

  const kirim = async (data) => {
    setMenyimpan(true);
    setError('');
    try {
      await onSimpan(data);
    } catch (err) {
      setError(pesanDari(err));
      setMenyimpan(false);
    }
  };

  return { menyimpan, error, setError, kirim };
}

function PesanErrorForm({ pesan }) {
  if (!pesan) return null;
  return (
    <div className="alert-error adm-form-error" role="alert">
      {pesan}
    </div>
  );
}

function RingkasanAkun({ akun }) {
  return (
    <div className="adm-modal-summary">
      <SelPengguna akun={akun} milikSendiri={false} />
      <span className={kelasPeran(akun.role)}>{akun.role}</span>
    </div>
  );
}

function TombolModal({ onBatal, menyimpan, labelSimpan, kelas = 'btn-primary', disabled = false }) {
  return (
    <div className="modal-actions-row">
      <button type="button" className="btn-outline-sm" onClick={onBatal}>
        Batal
      </button>
      <button type="submit" className={kelas} disabled={menyimpan || disabled}>
        {menyimpan ? 'Menyimpan...' : labelSimpan}
      </button>
    </div>
  );
}

const PESAN_SANDI_BEDA = 'Ulangi kata sandi tidak sama.';

function FormTambah({ onSimpan, onBatal }) {
  const [form, setForm] = useState({ role: 'Anggota', pengenal: '', nama: '', kata_sandi: '', ulangi: '' });
  const [errorUlangi, setErrorUlangi] = useState('');
  const { menyimpan, error, kirim } = useKirimForm(onSimpan);
  const ubah = (kunci) => (e) => setForm({ ...form, [kunci]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.kata_sandi !== form.ulangi) {
      setErrorUlangi(PESAN_SANDI_BEDA);
      return;
    }
    setErrorUlangi('');
    kirim({ pengenal: form.pengenal, nama: form.nama, role: form.role, kata_sandi: form.kata_sandi });
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form adm-modal-form" noValidate>
      <PesanErrorForm pesan={error} />
      <div className="form-group">
        <label className="form-label" htmlFor="tambah-nama">Nama lengkap *</label>
        <input id="tambah-nama" className="form-control" placeholder="Contoh: Siti Rahmawati" value={form.nama} onChange={ubah('nama')} />
      </div>
      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label" htmlFor="tambah-pengenal">Pengenal (NIM / NIP / username) *</label>
          <input id="tambah-pengenal" className="form-control" placeholder="Contoh: 2211521001" value={form.pengenal} onChange={ubah('pengenal')} />
          <span className="form-hint">3–50 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.</span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tambah-role">Peran *</label>
          <select id="tambah-role" className="form-control" value={form.role} onChange={ubah('role')}>
            {PERAN_RESMI.map((peran) => (
              <option key={peran} value={peran}>{peran}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label" htmlFor="tambah-sandi">Kata sandi awal *</label>
          <input id="tambah-sandi" type="password" className="form-control" autoComplete="new-password" value={form.kata_sandi} onChange={ubah('kata_sandi')} />
          <span className="form-hint">Minimal 8 karakter.</span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="tambah-ulangi">Ulangi kata sandi *</label>
          <input
            id="tambah-ulangi"
            type="password"
            className="form-control"
            autoComplete="new-password"
            value={form.ulangi}
            onChange={ubah('ulangi')}
            aria-invalid={errorUlangi ? 'true' : undefined}
            aria-describedby={errorUlangi ? 'tambah-ulangi-error' : undefined}
          />
          <ErrorKolom id="tambah-ulangi-error" pesan={errorUlangi} />
        </div>
      </div>
      <TombolModal onBatal={onBatal} menyimpan={menyimpan} labelSimpan="Simpan Pengguna" />
    </form>
  );
}

function FormUbah({ akun, onSimpan, onBatal }) {
  const [form, setForm] = useState({ nama: akun.nama ?? '', pengenal: akun.pengenal });
  const { menyimpan, error, kirim } = useKirimForm(onSimpan);

  const handleSubmit = (e) => {
    e.preventDefault();
    kirim(form);
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form" noValidate>
      <PesanErrorForm pesan={error} />
      <div className="form-group">
        <label className="form-label" htmlFor="ubah-nama">Nama lengkap *</label>
        <input id="ubah-nama" className="form-control" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="ubah-pengenal">Pengenal *</label>
        <input id="ubah-pengenal" className="form-control" value={form.pengenal} onChange={(e) => setForm({ ...form, pengenal: e.target.value })} />
        <span className="form-hint">Pengenal dipakai untuk masuk dan harus unik.</span>
      </div>
      <TombolModal onBatal={onBatal} menyimpan={menyimpan} labelSimpan="Simpan Perubahan" />
    </form>
  );
}

function FormKataSandi({ akun, onSimpan, onBatal }) {
  const [sandi, setSandi] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [errorUlangi, setErrorUlangi] = useState('');
  const { menyimpan, error, kirim } = useKirimForm(onSimpan);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (sandi !== ulangi) {
      setErrorUlangi(PESAN_SANDI_BEDA);
      return;
    }
    setErrorUlangi('');
    kirim(sandi);
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form adm-modal-form" noValidate>
      <RingkasanAkun akun={akun} />
      <PesanErrorForm pesan={error} />
      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label" htmlFor="sandi-baru">Kata sandi baru *</label>
          <input id="sandi-baru" type="password" className="form-control" autoComplete="new-password" value={sandi} onChange={(e) => setSandi(e.target.value)} />
          <span className="form-hint">Minimal 8 karakter.</span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="sandi-ulangi">Ulangi kata sandi baru *</label>
          <input
            id="sandi-ulangi"
            type="password"
            className="form-control"
            autoComplete="new-password"
            value={ulangi}
            onChange={(e) => setUlangi(e.target.value)}
            aria-invalid={errorUlangi ? 'true' : undefined}
            aria-describedby={errorUlangi ? 'sandi-ulangi-error' : undefined}
          />
          <ErrorKolom id="sandi-ulangi-error" pesan={errorUlangi} />
        </div>
      </div>
      <p className="form-hint">Sampaikan kata sandi baru kepada pemilik akun secara langsung.</p>
      <TombolModal onBatal={onBatal} menyimpan={menyimpan} labelSimpan="Simpan Kata Sandi" />
    </form>
  );
}

function FormStatus({ akun, onSimpan, onBatal }) {
  const [alasan, setAlasan] = useState('');
  const { menyimpan, error, kirim } = useKirimForm(onSimpan);
  const akanNonaktif = akun.status_aktif;
  const alasanCukup = alasan.trim().length >= 3;

  const handleSubmit = (e) => {
    e.preventDefault();
    kirim(akanNonaktif ? alasan.trim() : null);
  };

  return (
    <form onSubmit={handleSubmit} className="modal-form" noValidate>
      <RingkasanAkun akun={akun} />
      <PesanErrorForm pesan={error} />
      {akanNonaktif ? (
        <div className="form-group">
          <label className="form-label" htmlFor="alasan-nonaktif">Alasan penonaktifan *</label>
          <textarea
            id="alasan-nonaktif"
            className="form-control"
            rows={3}
            placeholder="Contoh: Lulus, keanggotaan berakhir"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
          />
          <span className="form-hint">Ditampilkan saat pemilik akun mencoba masuk. Minimal 3 karakter.</span>
        </div>
      ) : (
        <p className="form-hint">Setelah diaktifkan, pemilik akun dapat masuk kembali dan alasan penonaktifan dihapus.</p>
      )}
      <TombolModal
        onBatal={onBatal}
        menyimpan={menyimpan}
        labelSimpan={akanNonaktif ? 'Nonaktifkan' : 'Aktifkan'}
        kelas={akanNonaktif ? 'btn-danger' : 'btn-primary'}
        disabled={akanNonaktif && !alasanCukup}
      />
    </form>
  );
}

const JUDUL_MODAL = {
  tambah: 'Tambah Akun Pengguna',
  ubah: 'Ubah Data Akun',
  sandi: 'Reset Kata Sandi',
  status: 'Ubah Status Akun',
};

const PESAN_SIMPAN_SENDIRI_BERJALAN = 'Perubahan akunmu sebelumnya masih diproses. Tunggu sebentar lalu coba lagi.';

export default function KelolaAkun({ currentUser, onAkunSendiriBerubah }) {
  const [inputCari, setInputCari] = useState('');
  const [filter, setFilter] = useState({ q: '', role: '', status: '' });
  const [halaman, setHalaman] = useState(1);
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState({ kunci: null, data: { items: [], total: 0 }, error: '' });
  const [notifikasi, setNotifikasi] = useState('');
  const [modal, setModal] = useState(null);
  // Penyimpanan akun sendiri yang masih berjalan. Dua penyimpanan yang tumpang tindih bisa membuat
  // identitas sesi mengikuti balasan yang datang belakangan, jadi yang kedua ditolak.
  const simpanSendiriBerjalan = useRef(false);

  const kunci = JSON.stringify({ filter, halaman, versi });
  const keadaan = keadaanMuat(hasil, kunci);
  const data = hasil.data;

  useEffect(() => {
    const kunciIni = JSON.stringify({ filter, halaman, versi });
    let batal = false;
    daftarAkun({ ...filter, halaman, per_halaman: PER_HALAMAN }).then(
      (dataBaru) => {
        if (batal) return;
        // Halaman jadi kosong (mis. akun terakhir di halaman ini keluar dari filter setelah diubah):
        // pindah ke halaman terakhir yang masih berisi data, bukan terjebak di halaman kosong.
        const halamanTerakhir = hitungTotalHalaman(dataBaru.total, PER_HALAMAN);
        if (dataBaru.items.length === 0 && halaman > halamanTerakhir) {
          setHalaman(halamanTerakhir);
          return;
        }
        setHasil({ kunci: kunciIni, data: dataBaru, error: '' });
      },
      (err) => {
        if (!batal) setHasil({ kunci: kunciIni, data: { items: [], total: 0 }, error: pesanDari(err) });
      },
    );
    return () => {
      batal = true;
    };
  }, [filter, halaman, versi]);

  /**
   * Setelah simpan: muat ulang daftar dan tampilkan notifikasi. Modal hanya ditutup jika masih
   * modal asal penyimpanan, agar form lain yang sempat dibuka (beserta isiannya) tidak hilang.
   */
  const muatUlang = (pesan, modalAsal, keHalamanPertama = false) => {
    setModal((sekarang) => (sekarang === modalAsal ? null : sekarang));
    setNotifikasi(pesan);
    if (keHalamanPertama) setHalaman(1);
    setVersi((v) => v + 1);
  };

  const gantiFilter = (perubahan) => {
    setFilter((lama) => ({ ...lama, ...perubahan }));
    setHalaman(1);
  };

  const handleCari = (e) => {
    e.preventDefault();
    gantiFilter({ q: inputCari.trim() });
  };

  const adaFilter = Boolean(filter.q || filter.role || filter.status);
  const hapusFilter = () => {
    setInputCari('');
    gantiFilter({ q: '', role: '', status: '' });
  };

  // Akun yang sedang dipakai dikenali dari id_pengguna (tetap walau pengenal diganti), bukan dari
  // salinan pengenal di modal yang bisa basi. Pengenal hanya dipakai jika ID belum diketahui.
  const idSendiri =
    currentUser?.id_pengguna ?? data.items.find((a) => a.pengenal === currentUser?.pengenal)?.id_pengguna ?? null;
  const akunSendiri = (akun) =>
    Boolean(currentUser) && (idSendiri !== null ? akun.id_pengguna === idSendiri : akun.pengenal === currentUser.pengenal);
  const tutupModal = () => setModal(null);
  const adaData = keadaan === 'siap' && data.items.length > 0;

  return (
    <section className="adm-page">
      <div className="adm-header">
        <div>
          <h2 className="page-title">Kelola Akun Pengguna</h2>
          <p className="page-subtitle">Tambah, cari, ubah, dan atur status aktif akun pengguna SIAPT</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setModal({ jenis: 'tambah' })}>
          <IkonTambah />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      <form className="adm-toolbar" onSubmit={handleCari} role="search">
        <div className="adm-search">
          <IkonCari />
          <label className="adm-sr-only" htmlFor="cari-akun">Cari pengenal atau nama</label>
          <input
            id="cari-akun"
            type="search"
            className="search-input"
            placeholder="Cari pengenal atau nama..."
            value={inputCari}
            maxLength={100}
            onChange={(e) => setInputCari(e.target.value)}
          />
        </div>
        <div className="adm-filters">
          <label className="adm-sr-only" htmlFor="filter-peran">Peran</label>
          <select id="filter-peran" className="adm-select" value={filter.role} onChange={(e) => gantiFilter({ role: e.target.value })}>
            <option value="">Semua peran</option>
            {PERAN_RESMI.map((peran) => (
              <option key={peran} value={peran}>{peran}</option>
            ))}
          </select>
          <label className="adm-sr-only" htmlFor="filter-status">Status</label>
          <select id="filter-status" className="adm-select" value={filter.status} onChange={(e) => gantiFilter({ status: e.target.value })}>
            <option value="">Semua status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Cari</button>
      </form>

      {keadaan === 'siap' && data.items.length > 0 && (
        <p className="adm-meta">{data.total} akun{adaFilter ? ' sesuai filter' : ''}</p>
      )}

      <div className="table-responsive-wrapper adm-table-wrap">
        {!adaData && (
          <KeadaanData
            keadaan={keadaan}
            pesanError={hasil.error}
            pesanKosong={adaFilter ? 'Tidak ada akun yang cocok dengan pencarian atau filter.' : 'Belum ada akun.'}
            onCobaLagi={() => setVersi((v) => v + 1)}
            aksiKosong={adaFilter ? { label: 'Hapus filter', onClick: hapusFilter } : null}
          />
        )}

        {adaData && (
          <table className="custom-table adm-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Peran</th>
                <th>Status</th>
                <th>Dibuat</th>
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
                    </td>
                    <td data-label="Peran">
                      <span className={kelasPeran(akun.role)}>{akun.role ?? '-'}</span>
                    </td>
                    <td data-label="Status">
                      <span>
                        <span className={`status-pill ${akun.status_aktif ? 'status-active' : 'status-danger'}`}>
                          {akun.status_aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                        {!akun.status_aktif && akun.alasan_nonaktif && (
                          <span className="adm-reason" title="Alasan penonaktifan">{akun.alasan_nonaktif}</span>
                        )}
                      </span>
                    </td>
                    <td data-label="Dibuat" className="adm-muted">{formatTanggal(akun.dibuat_pada)}</td>
                    <td className="adm-cell-actions">
                      <div className="adm-actions">
                        <button type="button" className="btn-action-edit" onClick={() => setModal({ jenis: 'ubah', akun })} aria-label={`Ubah ${akun.pengenal}`}>
                          <IkonUbah />
                          <span>Ubah</span>
                        </button>
                        <button type="button" className="btn-action-edit" onClick={() => setModal({ jenis: 'sandi', akun })} aria-label={`Reset kata sandi ${akun.pengenal}`}>
                          <IkonKunci />
                          <span>Sandi</span>
                        </button>
                        <button
                          type="button"
                          className={`btn-action-edit${akun.status_aktif ? ' is-danger' : ''}`}
                          onClick={() => setModal({ jenis: 'status', akun })}
                          disabled={milikSendiri && akun.status_aktif}
                          title={milikSendiri ? 'Akun yang sedang dipakai tidak dapat dinonaktifkan.' : undefined}
                          aria-label={`${akun.status_aktif ? 'Nonaktifkan' : 'Aktifkan'} ${akun.pengenal}`}
                        >
                          <IkonDaya />
                          <span>{akun.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}</span>
                        </button>
                      </div>
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

      <Modal isOpen={modal !== null} title={modal ? JUDUL_MODAL[modal.jenis] : ''} onClose={tutupModal}>
        {modal?.jenis === 'tambah' && (
          <FormTambah
            onBatal={tutupModal}
            onSimpan={async (form) => {
              const asal = modal;
              await tambahAkun(form);
              muatUlang('Akun berhasil ditambahkan.', asal, true);
            }}
          />
        )}
        {modal?.jenis === 'ubah' && (
          <FormUbah
            akun={modal.akun}
            onBatal={tutupModal}
            onSimpan={async (form) => {
              const asal = modal;
              const milikSendiri = akunSendiri(asal.akun);
              if (milikSendiri && simpanSendiriBerjalan.current) {
                throw new Error(PESAN_SIMPAN_SENDIRI_BERJALAN);
              }
              if (milikSendiri) simpanSendiriBerjalan.current = true;
              let tersimpan;
              try {
                tersimpan = await ubahAkun(asal.akun.id_pengguna, form);
              } finally {
                if (milikSendiri) simpanSendiriBerjalan.current = false;
              }
              // Akun yang sedang dipakai diubah: perbarui identitas sesi (nama/pengenal)
              if (milikSendiri && tersimpan) onAkunSendiriBerubah?.(tersimpan);
              muatUlang('Data akun berhasil diperbarui.', asal);
            }}
          />
        )}
        {modal?.jenis === 'sandi' && (
          <FormKataSandi
            akun={modal.akun}
            onBatal={tutupModal}
            onSimpan={async (sandi) => {
              const asal = modal;
              await resetKataSandi(asal.akun.id_pengguna, sandi);
              muatUlang('Kata sandi berhasil diubah.', asal);
            }}
          />
        )}
        {modal?.jenis === 'status' && (
          <FormStatus
            akun={modal.akun}
            onBatal={tutupModal}
            onSimpan={async (alasan) => {
              const asal = modal;
              const aktifkan = !asal.akun.status_aktif;
              await ubahStatusAkun(asal.akun.id_pengguna, aktifkan, alasan);
              muatUlang(aktifkan ? 'Akun berhasil diaktifkan.' : 'Akun berhasil dinonaktifkan.', asal);
            }}
          />
        )}
      </Modal>
    </section>
  );
}
