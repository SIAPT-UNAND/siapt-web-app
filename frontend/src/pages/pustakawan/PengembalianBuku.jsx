import { useEffect, useState } from 'react';
import { ambilTransaksiTerbaru } from '../../api/peminjaman.js';

const normalisasiPeminjaman = (data) => ({
  id_peminjaman: data.id_peminjaman,
  nomor_transaksi: data.nomor_transaksi,
  kode_eksemplar: data.eksemplar?.kode_eksemplar,
  judul: data.koleksi?.judul,
  tanggal_pinjam: data.tanggal_pinjam,
  tanggal_jatuh_tempo: data.tanggal_jatuh_tempo,
  status: data.status,
  denda: data.denda?.nominal ?? 0,
  status_denda: data.denda?.status ?? 'TIDAK_ADA',
});

export default function PengembalianBuku({
  loans,
  onReturnLoan,
  currentUser,
}) {
  const [returnCode, setReturnCode] = useState('');
  const [returnFeedback, setReturnFeedback] = useState('');
  const [loansDatabase, setLoansDatabase] = useState(loans);

  useEffect(() => {
    let aktif = true;
    ambilTransaksiTerbaru(currentUser?.pengenal)
      .then((daftar) => aktif && setLoansDatabase(daftar.map(normalisasiPeminjaman)))
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, [currentUser?.pengenal]);

  const handleProcessReturn = (e) => {
    e.preventDefault();
    if (!returnCode.trim()) return;

    const loan = loansDatabase.find(
      (l) =>
        (l.nomor_transaksi.toLowerCase() === returnCode.trim().toLowerCase() ||
          l.kode_eksemplar.toLowerCase() === returnCode.trim().toLowerCase()) &&
        l.status !== 'SELESAI'
    );

    if (!loan) {
      alert(`Transaksi atau eksemplar aktif "${returnCode}" tidak ditemukan.`);
      return;
    }

    onReturnLoan?.(loan.id_peminjaman);
    setLoansDatabase((sebelum) =>
      sebelum.map((item) =>
        item.id_peminjaman === loan.id_peminjaman
          ? { ...item, status: 'SELESAI', denda: 0, status_denda: 'LUNAS' }
          : item,
      ),
    );
    setReturnFeedback(
      `Buku "${loan.judul}" (${loan.kode_eksemplar}) berhasil dikembalikan dan status diperbarui.`
    );
    setReturnCode('');
    setTimeout(() => setReturnFeedback(''), 5000);
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
                      {item.denda > 0 ? (
                        <span className="text-red font-bold">
                          Rp {item.denda.toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-green">Tepat Waktu</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-action-primary-sm"
                        onClick={() => onReturnLoan(item.id_peminjaman)}
                      >
                        Proses Kembali
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

