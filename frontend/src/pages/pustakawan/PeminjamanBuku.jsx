import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ambilKetentuanPeminjaman,
  ambilTransaksiTerbaru,
  cariAnggotaUntukPustakawan,
  infoBukuUntukPustakawan,
  pinjamViaPustakawan,
} from '../../api/peminjaman.js';
import Modal from '../../components/Modal.jsx';
import PeringatanPinjam from '../anggota/PeringatanPinjam.jsx';
import { Ikon } from '../anggota/ikonPeminjaman.jsx';
import SampulBuku from '../anggota/SampulBuku.jsx';
import BuktiCetak from '../anggota/BuktiCetak.jsx';
import { cetakBukti } from '../anggota/cetakBukti.js';
import '../anggota/peminjaman.css';
import './peminjaman-buku.css';

const formatTanggal = (tanggal, bulan = 'short') =>
  tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: bulan, year: 'numeric' })
    : '-';

const formatRupiah = (angka) => `Rp ${Number(angka || 0).toLocaleString('id-ID')}`;

/**
 * Mencari ke backend setelah pengguna berhenti mengetik sebentar.
 * status: 'kosong' | 'memuat' | 'siap'
 */
function usePencarianTertunda(teks, cari, pemicu = 0, jeda = 400) {
  const [aktif, setAktif] = useState('');
  const [hasil, setHasil] = useState({ kunci: null, data: null, galat: '' });

  useEffect(() => {
    const t = setTimeout(() => setAktif(teks.trim()), jeda);
    return () => clearTimeout(t);
  }, [teks, jeda]);

  const kunci = aktif ? `${aktif}|${pemicu}` : null;
  useEffect(() => {
    if (!kunci) return undefined;
    let berlaku = true;
    cari(aktif)
      .then((data) => berlaku && setHasil({ kunci, data, galat: '' }))
      .catch((err) => berlaku && setHasil({ kunci, data: null, galat: err.message }));
    return () => {
      berlaku = false;
    };
  }, [kunci, aktif, cari]);

  const status = !teks.trim() ? 'kosong' : teks.trim() !== aktif || hasil.kunci !== kunci ? 'memuat' : 'siap';
  return {
    status,
    data: status === 'siap' ? hasil.data : null,
    galat: status === 'siap' ? hasil.galat : '',
  };
}

/** Satu baris ringkasan (anggota atau buku) di panel samping. */
function Ringkasan({ label, pencarian, judul, keterangan, bahaya, sampul }) {
  let isi;
  if (pencarian.status === 'kosong') isi = <span className="pb-sum-empty">—</span>;
  else if (pencarian.status === 'memuat') isi = <span className="pb-sum-empty">Mencari…</span>;
  else if (pencarian.galat) isi = <span className="pb-sum-error">{pencarian.galat}</span>;
  else {
    const teks = (
      <>
        <strong>{judul}</strong>
        <span className={bahaya ? 'pb-sum-meta bahaya' : 'pb-sum-meta'}>{keterangan}</span>
      </>
    );
    // Baris buku menampilkan sampul di sampingnya
    isi =
      sampul !== undefined ? (
        <div className="pb-sum-book">
          <SampulBuku judul={judul} src={sampul} />
          <div className="pb-sum-text">{teks}</div>
        </div>
      ) : (
        teks
      );
  }

  return (
    <div className="pb-sum-row">
      <span className="pb-sum-label">{label}</span>
      <div className="pb-sum-body">{isi}</div>
    </div>
  );
}

export default function PeminjamanBuku({ currentUser }) {
  const pengenal = currentUser?.pengenal;

  const [loanMemberId, setLoanMemberId] = useState('');
  const [loanBookCode, setLoanBookCode] = useState('');
  // Anggota yang sedang dilayani (antrean: satu anggota diselesaikan dulu)
  const [anggotaAktif, setAnggotaAktif] = useState(null);
  const [memuatAnggota, setMemuatAnggota] = useState(false);
  const [muatUlang, setMuatUlang] = useState(0);
  const [ketentuan, setKetentuan] = useState(null);
  const [terbaru, setTerbaru] = useState({ kunci: null, daftar: [], galat: '' });
  const [mengecek, setMengecek] = useState(0); // jumlah pengecekan buku yang sedang berjalan
  const [memproses, setMemproses] = useState(false);
  // Daftar buku yang akan dipinjam (belum tercatat) dan transaksi yang sudah tercatat
  const [daftarBuku, setDaftarBukuState] = useState([]);
  const [tercatat, setTercatat] = useState([]);
  // Salinan terbaru daftar, agar beberapa scan cepat yang dicek bersamaan tidak saling menimpa
  const daftarTerbaru = useRef([]);
  const setDaftarBuku = (nilai) => {
    daftarTerbaru.current = nilai;
    setDaftarBukuState(nilai);
  };
  const [mintaFokus, setMintaFokus] = useState({ kolom: 'nim', n: 0 });
  const [peringatan, setPeringatan] = useState(null);
  const [konfirmasiGanti, setKonfirmasiGanti] = useState(false);
  const inputNim = useRef(null);
  const inputKode = useRef(null);

  const cariBuku = useCallback((kode) => infoBukuUntukPustakawan(pengenal, kode), [pengenal]);
  const buku = usePencarianTertunda(loanBookCode, cariBuku, muatUlang);

  const fokus = (kolom) => setMintaFokus((lama) => ({ kolom, n: lama.n + 1 }));

  // Fokus kursor dipindahkan setelah tampilan diperbarui
  useEffect(() => {
    (mintaFokus.kolom === 'kode' ? inputKode : inputNim).current?.focus();
  }, [mintaFokus]);


  // Ketentuan dari konfigurasi sistem
  useEffect(() => {
    let aktif = true;
    ambilKetentuanPeminjaman(pengenal)
      .then((data) => aktif && setKetentuan(data))
      .catch(() => aktif && setKetentuan(null));
    return () => {
      aktif = false;
    };
  }, [pengenal]);

  // Tabel transaksi terbaru dari database
  useEffect(() => {
    let aktif = true;
    ambilTransaksiTerbaru(pengenal)
      .then((daftar) => aktif && setTerbaru({ kunci: muatUlang, daftar, galat: '' }))
      .catch((err) => aktif && setTerbaru((lama) => ({ ...lama, kunci: muatUlang, galat: err.message })));
    return () => {
      aktif = false;
    };
  }, [pengenal, muatUlang]);

  const a = anggotaAktif;
  const b = buku.data;
  const anggotaTerhalang = a && !a.boleh_meminjam; // mis. kuota penuh setelah diproses
  const bukuDitolak = b && !b.bisa_dipinjam;
  const alasanDitolak = (anggotaTerhalang && a.alasan) || (bukuDitolak && b.alasan) || null;
  const sisaKuota = a ? Math.max(a.maks_pinjam - a.pinjaman_aktif, 0) : 0;
  const idTerbaru = new Set(tercatat.map((t) => t.id_peminjaman));

  // ---------- Tahap 1: pilih anggota ----------
  const pilihAnggota = async () => {
    const nim = loanMemberId.trim();
    if (!nim) {
      setPeringatan({ pesan: 'Isi NIM/ID anggota terlebih dahulu.' });
      return;
    }
    if (memuatAnggota) return;

    setMemuatAnggota(true);
    try {
      const data = await cariAnggotaUntukPustakawan(pengenal, nim);
      if (!data.boleh_meminjam) {
        setPeringatan({ judul: data.nama, pesan: data.alasan });
        return;
      }
      setAnggotaAktif(data);
      setDaftarBuku([]);
      setTercatat([]);
      fokus('kode');
    } catch (err) {
      setPeringatan({ pesan: err.message });
    } finally {
      setMemuatAnggota(false);
    }
  };

  // Selesai / ganti anggota: kosongkan semuanya untuk antrean berikutnya
  const selesai = () => {
    setAnggotaAktif(null);
    setLoanMemberId('');
    setLoanBookCode('');
    setDaftarBuku([]);
    setTercatat([]);
    setKonfirmasiGanti(false);
    fokus('nim');
  };

  // Jika masih ada buku yang belum diproses, minta konfirmasi dulu agar tidak terhapus tanpa sengaja
  const mintaGanti = () => {
    if (daftarTerbaru.current.length > 0) setKonfirmasiGanti(true);
    else selesai();
  };

  const batalGanti = () => {
    setKonfirmasiGanti(false);
    fokus('kode');
  };

  // ---------- Tahap 2: tambah / hapus buku ----------
  const tambahBuku = async () => {
    const kode = loanBookCode.trim();
    if (!a || !kode) return;
    if (anggotaTerhalang) {
      setPeringatan({ judul: a.nama, pesan: a.alasan });
      return;
    }

    // Kolom langsung dikosongkan agar scan berikutnya bisa segera masuk
    setLoanBookCode('');
    fokus('kode');
    setMengecek((n) => n + 1);
    const tolak = (judul, pesan) => {
      setPeringatan({ judul, pesan });
      // Kode yang ditolak dikembalikan ke kolom agar bisa diperbaiki
      setLoanBookCode((sekarang) => (sekarang.trim() ? sekarang : kode));
    };
    try {
      const info = await infoBukuUntukPustakawan(pengenal, kode);
      if (!info.bisa_dipinjam) {
        tolak(info.koleksi.judul, info.alasan);
        return;
      }
      const daftarSaatIni = daftarTerbaru.current;
      const kodeEksemplar = info.eksemplar.kode_eksemplar;
      if (daftarSaatIni.some((x) => x.kode_eksemplar === kodeEksemplar)) {
        tolak(
          info.koleksi.judul,
          info.jenis === 'koleksi'
            ? `Eksemplar ${kodeEksemplar} sudah ada di daftar. Pindai kode eksemplar lainnya.`
            : `Eksemplar ${kodeEksemplar} sudah ada di daftar.`,
        );
        return;
      }
      if (daftarSaatIni.length >= sisaKuota) {
        tolak(a.nama, `Kuota peminjaman anggota ini tersisa ${sisaKuota} buku.`);
        return;
      }

      setDaftarBuku([
        ...daftarSaatIni,
        {
          kode_eksemplar: kodeEksemplar,
          lokasi_rak: info.eksemplar.lokasi_rak,
          judul: info.koleksi.judul,
          sampul: info.koleksi.sampul,
          // Kunci per buku: proses ulang tidak membuat transaksi ganda
          kunci: crypto.randomUUID(),
        },
      ]);
    } catch (err) {
      tolak(null, `${kode}: ${err.message}`);
    } finally {
      setMengecek((n) => n - 1);
    }
  };

  const hapusBuku = (kodeEksemplar) => {
    setDaftarBuku(daftarTerbaru.current.filter((x) => x.kode_eksemplar !== kodeEksemplar));
    fokus('kode');
  };

  // Enter di kolom NIM memilih anggota; Enter di kolom kode menambahkan buku
  const enterDiNim = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      pilihAnggota();
    }
  };

  const enterDiKode = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tambahBuku();
    }
  };

  // ---------- Proses: semua buku dicatat (satu transaksi per buku, BR-02), lalu bukti dicetak ----------
  const handleProcessLoan = async (e) => {
    e.preventDefault();
    if (!a || daftarBuku.length === 0 || memproses || mengecek > 0) return;

    setMemproses(true);
    const berhasil = [];
    const gagal = [];
    for (const item of daftarBuku) {
      try {
        const data = await pinjamViaPustakawan(pengenal, {
          nim: a.pengenal,
          kode: item.kode_eksemplar,
          kunciIdempotensi: item.kunci,
        });
        berhasil.push(data);
      } catch (err) {
        gagal.push({ item, pesan: err.message });
      }
    }

    // Data anggota diperbarui (jumlah pinjaman aktif bertambah)
    try {
      setAnggotaAktif(await cariAnggotaUntukPustakawan(pengenal, a.pengenal));
    } catch {
      // ringkasan lama tetap ditampilkan
    }
    setMemproses(false);

    setDaftarBuku(gagal.map((g) => g.item));
    setTercatat((lama) => [...lama, ...berhasil]);
    setMuatUlang((n) => n + 1); // perbarui tabel
    if (gagal.length > 0) {
      setPeringatan({ pesan: gagal.map((g) => `${g.item.judul}: ${g.pesan}`).join(' ') });
    }
  };

  const tutupPeringatan = () => {
    setPeringatan(null);
    fokus(a ? 'kode' : 'nim');
  };

  return (
    <section className="pustakawan-loan-section pb">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Pelayanan Peminjaman Buku</h2>
          <p className="page-subtitle">
            Proses pencatatan peminjaman sirkulasi di loket perpustakaan
          </p>
        </div>
      </div>

      <div className="circulation-card pb-card">
        <div className="pb-main">
          <form onSubmit={handleProcessLoan} className="circulation-form" noValidate>
            <h3 className="card-heading">Form Peminjaman Sirkulasi</h3>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="pb-nim">
                  NIM / NIP / ID Anggota:
                </label>
                <div className="pb-input-row">
                  <input
                    id="pb-nim"
                    ref={inputNim}
                    type="text"
                    className="form-control"
                    placeholder="Contoh: 2211521001"
                    autoComplete="off"
                    value={loanMemberId}
                    onChange={(e) => setLoanMemberId(e.target.value)}
                    onKeyDown={enterDiNim}
                    readOnly={Boolean(a)}
                    required
                  />
                  {a ? (
                    <button type="button" className="pb-btn-ghost" onClick={mintaGanti} disabled={memproses}>
                      Ganti
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pb-btn-ghost"
                      onClick={pilihAnggota}
                      disabled={memuatAnggota || !loanMemberId.trim()}
                    >
                      {memuatAnggota && <span className="pm-spinner pb-spinner" aria-hidden="true" />}
                      Pilih
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pb-kode">
                  Kode Eksemplar / Koleksi:
                </label>
                <div className="pb-input-row">
                  <input
                    id="pb-kode"
                    ref={inputKode}
                    type="text"
                    className="form-control"
                    placeholder={a ? 'Contoh: EKS-001-A' : 'Pilih anggota terlebih dahulu'}
                    autoComplete="off"
                    value={loanBookCode}
                    onChange={(e) => setLoanBookCode(e.target.value)}
                    onKeyDown={enterDiKode}
                    disabled={!a || memproses}
                  />
                  <button
                    type="button"
                    className="pb-btn-ghost"
                    onClick={tambahBuku}
                    disabled={!a || memproses || !loanBookCode.trim() || Boolean(alasanDitolak)}
                  >
                    <Ikon nama="plus" ukuran={16} />
                    Tambah
                  </button>
                </div>
                {mengecek > 0 && (
                  <span className="pb-checking" aria-live="polite">
                    <span className="pm-spinner pb-spinner" aria-hidden="true" />
                    Memeriksa buku…
                  </span>
                )}
              </div>
            </div>

            {daftarBuku.length > 0 && (
              <div className="pb-list">
                <span className="pb-list-head">
                  Daftar buku ({daftarBuku.length} dari {sisaKuota})
                </span>
                <ul>
                  {daftarBuku.map((x) => (
                    <li key={x.kode_eksemplar} className="pb-list-buku">
                      <SampulBuku judul={x.judul} src={x.sampul} />
                      <span className="pb-list-info">
                        <span className="pb-list-title">{x.judul}</span>
                        <span className="pb-list-code">
                          {x.kode_eksemplar}
                          {x.lokasi_rak && ` · Rak ${x.lokasi_rak}`}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="pb-remove"
                        onClick={() => hapusBuku(x.kode_eksemplar)}
                        aria-label={`Hapus ${x.judul} dari daftar`}
                        disabled={memproses}
                      >
                        <Ikon nama="x" ukuran={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pb-actions">
              <button
                type="submit"
                className="btn-primary pm-btn"
                disabled={!a || memproses || mengecek > 0 || daftarBuku.length === 0}
              >
                {memproses ? (
                  <>
                    <span className="pm-spinner" aria-hidden="true" />
                    Memproses…
                  </>
                ) : (
                  'Proses peminjaman'
                )}
              </button>

              <p className="loan-rules-preview">
                <span className="dot-green"></span>
                Masa pinjam {ketentuan ? `${ketentuan.durasi_hari} hari` : '-'} · Periksa kondisi fisik buku
                sebelum diserahkan.
              </p>
            </div>
          </form>

          {tercatat.length > 0 && (
            <div className="pb-done" role="status">
              <div className="pb-done-head">
                <strong>
                  <Ikon nama="check" ukuran={16} />
                  {tercatat.length} peminjaman tercatat
                </strong>
                <div className="pb-done-actions">
                  <button type="button" className="pb-btn-ghost" onClick={cetakBukti}>
                    <Ikon nama="printer" ukuran={16} />
                    Cetak
                  </button>
                  <button type="button" className="pb-btn-ghost" onClick={mintaGanti}>
                    Selesai
                  </button>
                </div>
              </div>
              <ul>
                {tercatat.map((t) => (
                  <li key={t.id_peminjaman}>
                    <span className="pb-list-code">{t.nomor_transaksi}</span>
                    <span className="pb-list-title">{t.koleksi?.judul}</span>
                    <span className="pb-list-code">{t.eksemplar?.kode_eksemplar}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="pb-summary" aria-label="Ringkasan peminjaman">
          <Ringkasan
            label="Anggota"
            pencarian={{ status: a ? 'siap' : memuatAnggota ? 'memuat' : 'kosong', galat: '' }}
            judul={a?.nama}
            keterangan={
              a &&
              [
                a.status_aktif ? 'Aktif' : 'Nonaktif',
                `${a.pinjaman_aktif}/${a.maks_pinjam} buku dipinjam`,
                a.denda_belum_lunas.jumlah ? `Denda ${formatRupiah(a.denda_belum_lunas.total)}` : 'Tanpa denda',
              ].join(' · ')
            }
            bahaya={anggotaTerhalang}
          />
          <Ringkasan
            label="Buku"
            pencarian={buku}
            judul={b?.koleksi.judul}
            sampul={b?.koleksi.sampul ?? null}
            keterangan={
              b &&
              (b.eksemplar
                ? [b.eksemplar.kode_eksemplar, b.eksemplar.lokasi_rak && `Rak ${b.eksemplar.lokasi_rak}`]
                    .filter(Boolean)
                    .join(' · ')
                : 'Tidak ada eksemplar tersedia')
            }
            bahaya={bukuDitolak}
          />

          {alasanDitolak && (
            <p className="pb-verdict ditolak" role="status">
              <Ikon nama="x" ukuran={16} />
              {alasanDitolak}
            </p>
          )}
        </aside>
      </div>

      {/* Riwayat Peminjaman Aktif */}
      <div className="mt-8">
        <h3 className="section-sub-title">Transaksi Sirkulasi Terbaru</h3>
        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Transaksi</th>
                <th>Judul Buku</th>
                <th>Anggota</th>
                <th>Eksemplar</th>
                <th>Tgl Pinjam</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {terbaru.daftar.length === 0 ? (
                <tr>
                  <td colSpan={7} className="pb-table-empty">
                    {terbaru.kunci === null
                      ? 'Memuat transaksi…'
                      : terbaru.galat
                        ? 'Transaksi belum dapat dimuat.'
                        : 'Belum ada transaksi peminjaman.'}
                  </td>
                </tr>
              ) : (
                terbaru.daftar.map((l) => (
                  <tr key={l.id_peminjaman} className={idTerbaru.has(l.id_peminjaman) ? 'pb-row-baru' : ''}>
                    <td>
                      <strong>{l.nomor_transaksi}</strong>
                    </td>
                    <td>{l.koleksi?.judul}</td>
                    <td>{l.anggota?.nama ?? '-'}</td>
                    <td>
                      <code>{l.eksemplar?.kode_eksemplar}</code>
                    </td>
                    <td>{formatTanggal(l.tanggal_pinjam)}</td>
                    <td>{formatTanggal(l.tanggal_jatuh_tempo)}</td>
                    <td>
                      <span className={`status-pill ${l.status === 'SELESAI' ? 'status-done' : 'status-active'}`}>
                        {l.status === 'SELESAI' ? 'Dikembalikan' : 'Dipinjam'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BuktiCetak daftar={tercatat} />
      <PeringatanPinjam peringatan={peringatan} onClose={tutupPeringatan} />

      <Modal isOpen={konfirmasiGanti} title="Ganti anggota?" onClose={batalGanti}>
        <p className="pb-confirm-text">
          {daftarBuku.length} buku di daftar belum diproses dan akan dihapus dari daftar.
        </p>
        <div className="pb-confirm-actions">
          <button type="button" className="pb-btn-ghost" onClick={batalGanti} autoFocus>
            Batal
          </button>
          <button type="button" className="btn-primary pm-btn" onClick={selesai}>
            Ganti anggota
          </button>
        </div>
      </Modal>
    </section>
  );
}
