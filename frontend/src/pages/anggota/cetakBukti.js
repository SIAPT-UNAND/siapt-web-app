/**
 * Membuka dialog cetak browser untuk bukti peminjaman saja.
 * Kelas di <body> mengaktifkan aturan @media print di peminjaman.css,
 * sehingga bagian lain halaman tidak ikut tercetak.
 */
export const cetakBukti = () => {
  document.body.classList.add('bukti-mencetak');
  const selesai = () => {
    document.body.classList.remove('bukti-mencetak');
    window.removeEventListener('afterprint', selesai);
  };
  window.addEventListener('afterprint', selesai);
  window.print();
};
