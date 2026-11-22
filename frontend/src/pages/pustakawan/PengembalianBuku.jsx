import { useEffect, useRef, useState } from 'react';
import { ambilPeminjamanAktif } from '../../api/peminjaman.js';

const normalisasiPeminjaman = (data) => ({
  id_peminjaman: data.id_peminjaman,
  nomor_transaksi: data.nomor_transaksi,
  kode_eksemplar: data.eksemplar?.kode_eksemplar,
  judul: data.koleksi?.judul,
  tanggal_pinjam: data.tanggal_pinjam,
  tanggal_jatuh_tempo: data.tanggal_jatuh_tempo,
  status: data.status,
  denda: data.denda?.nominal ?? null,
  status_denda: data.denda?.status ?? data.status_denda ?? null,
});

export default function PengembalianBuku({
  loans,
  onReturnLoan,
  currentUser,
}) {
  const [returnCode, setReturnCode] = useState('');
  const [returnFeedback, setReturnFeedback] = useState('');
  const [loansDatabase, setLoansDatabase] = useState(loans);
  const [halaman, setHalaman] = useState(1);
  const [pagination, setPagination] = useState({ halaman: 1, halaman_total: 1 });
  const [returnError, setReturnError] = useState('');
  const [muatUlang, setMuatUlang] = useState(0);
  const returnVersion = useRef(0);

  useEffect(() => {
    let aktif = true;
    const capturedReturnVersion = returnVersion.current;
    ambilPeminjamanAktif(currentUser?.pengenal, { halaman })
      .then((hasil) => {
        if (!aktif || capturedReturnVersion !== returnVersion.current) return;
        setLoansDatabase(hasil.transaksi.map(normalisasiPeminjaman));
        setPagination(hasil.pagination);
        const halamanTotal = hasil.pagination?.halaman_total ?? 1;
        if (halaman > halamanTotal) {
          setHalaman(Math.max(1, halamanTotal));
        }
      })
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, [currentUser?.pengenal, halaman, muatUlang]);

  const processLoan = async (loan) => {
    setReturnError('');
    try {
      if (typeof onReturnLoan !== 'function') {
        throw new Error('Alur pengembalian tidak tersedia.');
      }
      await onReturnLoan(loan.id_peminjaman);
      returnVersion.current += 1;
      setMuatUlang((nilai) => nilai + 1);
      setLoansDatabase((sebelum) =>
        sebelum.filter((item) => item.id_peminjaman !== loan.id_peminjaman),
      );
      setReturnFeedback(
        `Buku "${loan.judul}" (${loan.kode_eksemplar}) berhasil dikembalikan dan status diperbarui.`
      );
      setReturnCode('');
      setTimeout(() => setReturnFeedback(''), 5000);
    } catch (err) {
      setReturnError(err.message || 'Pengembalian gagal diproses.');
    }
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    const kode = returnCode.trim();
    if (!kode) return;

    let loan = null;
    try {
      const hasil = await ambilPeminjamanAktif(currentUser?.pengenal, { kataKunci: kode, limit: 100 });
      loan = hasil.transaksi
        .map(normalisasiPeminjaman)
        .find((item) =>
          item.nomor_transaksi.toLowerCase() === kode.toLowerCase() ||
          item.kode_eksemplar?.toLowerCase() === kode.toLowerCase(),
        );
    } catch {
      loan = loansDatabase.find((item) =>
        item.nomor_transaksi.toLowerCase() === kode.toLowerCase() ||
        item.kode_eksemplar?.toLowerCase() === kode.toLowerCase(),
      );
    }

    if (!loan) {
      alert(`Transaksi atau eksemplar aktif "${returnCode}" tidak ditemukan.`);
      return;
    }

    await processLoan(loan);
  };

  return (
    <section className="pustakawan-return-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Pelayanan Pengembalian Buku</h2>
          <p className="page-subtitle">
            Proses pengembalian buku, verifikasi kondisi fisik, dan kalkulasi tagihan denda
          </p>
        </div>
      </div>

      {returnFeedback && <div className="alert-success">{returnFeedback}</div>}
      {returnError && <div className="alert-danger" role="alert">{returnError}</div>}

      <div className="circulation-card">
        <h3 className="card-heading">Verifikasi Pengembalian</h3>
        <form onSubmit={handleProcessReturn} className="circulation-form">
          <div className="form-group">
            <label className="form-label">
              Masukkan No. Transaksi atau Kode Eksemplar:
            </label>
            <div className="input-group-btn">
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: TRX-202611-001 atau EKS-001-A"
                value={returnCode}
                onChange={(e) => setReturnCode(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary">
                Verifikasi &amp; Kembalikan
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Daftar Buku yang Perlu Dikembalikan */}
      <div className="mt-8">
        <h3 className="section-sub-title">Daftar Buku Belum Kembali (Aktif)</h3>
        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>No. Transaksi</th>
                <th>Judul &amp; Eksemplar</th>
                <th>Jatuh Tempo</th>
                <th>Keterlambatan / Denda</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loansDatabase
                .filter((l) => l.status !== 'SELESAI')
                .map((item) => (
                  <tr key={item.id_peminjaman}>
                    <td>
                      <strong>{item.nomor_transaksi}</strong>
                    </td>
                    <td>
                      <div>{item.judul}</div>
                      <span className="table-sub-text">
                        {item.kode_eksemplar}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          item.status === 'TERLAMBAT' ? 'text-red font-bold' : ''
                        }
                      >
                        {item.tanggal_jatuh_tempo}
                      </span>
                    </td>
                    <td>
                      {item.denda != null && item.denda > 0 ? (
                        <span className="text-red font-bold">
                          Rp {item.denda.toLocaleString('id-ID')}
                        </span>
                      ) : item.status === 'TERLAMBAT' ? (
                        <span className="text-red font-bold">Terlambat</span>
                      ) : (
                        <span className="text-green">Tepat Waktu</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-action-primary-sm"
                        onClick={() => processLoan(item)}
                      >
                        Proses Kembali
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {pagination.halaman_total > 1 && (
            <div className="mt-4" aria-label="Navigasi halaman peminjaman aktif">
              <button
                type="button"
                className="pm-btn-ghost"
                disabled={halaman <= 1}
                onClick={() => setHalaman((lama) => Math.max(1, lama - 1))}
              >
                Sebelumnya
              </button>
              <span className="mx-2">
                Halaman {pagination.halaman} dari {pagination.halaman_total}
              </span>
              <button
                type="button"
                className="pm-btn-ghost"
                disabled={halaman >= pagination.halaman_total}
                onClick={() => setHalaman((lama) => lama + 1)}
              >
                Berikutnya
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

