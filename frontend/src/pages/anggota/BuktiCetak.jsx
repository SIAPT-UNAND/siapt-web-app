const formatTanggal = (tanggal) =>
  tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

/**
 * Bukti peminjaman untuk dicetak, dipakai peminjaman mandiri (UC-03)
 * dan peminjaman melalui pustakawan (UC-09). Satu lembar berisi semua buku.
 * Tidak tampil di layar; hanya muncul saat dicetak (lihat cetakBukti.js).
 */
export default function BuktiCetak({ daftar }) {
  if (daftar.length === 0) return null;
  const pertama = daftar[0];

  return (
    <article className="bukti-cetak" aria-hidden="true">
      <header className="bukti-cetak-head">
        <strong>Bukti Peminjaman</strong>
        <span>Perpustakaan Universitas Andalas</span>
      </header>
      <dl className="bukti-cetak-meta">
        <div>
          <dt>Anggota</dt>
          <dd>
            {pertama.anggota?.nama} ({pertama.anggota?.pengenal})
          </dd>
        </div>
        {pertama.pustakawan ? (
          <div>
            <dt>Petugas</dt>
            <dd>{pertama.pustakawan.nama}</dd>
          </div>
        ) : (
          <div>
            <dt>Jalur</dt>
            <dd>Peminjaman mandiri</dd>
          </div>
        )}
        <div>
          <dt>Tanggal pinjam</dt>
          <dd>{formatTanggal(pertama.tanggal_pinjam)}</dd>
        </div>
      </dl>
      <table className="bukti-cetak-table">
        <thead>
          <tr>
            <th>No. Transaksi</th>
            <th>Judul</th>
            <th>Eksemplar</th>
            <th>Jatuh Tempo</th>
          </tr>
        </thead>
        <tbody>
          {daftar.map((t) => (
            <tr key={t.id_peminjaman}>
              <td>{t.nomor_transaksi}</td>
              <td>{t.koleksi?.judul}</td>
              <td>{t.eksemplar?.kode_eksemplar}</td>
              <td>{formatTanggal(t.tanggal_jatuh_tempo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="bukti-cetak-foot">
        {daftar.length} buku · Kembalikan sebelum tanggal jatuh tempo untuk menghindari denda.
      </p>
    </article>
  );
}
