import { useState } from 'react';
import BerandaKoleksi from './BerandaKoleksi.jsx';
import PeminjamanMandiri from './PeminjamanMandiri.jsx';
import InformasiPeminjaman from './InformasiPeminjaman.jsx';

export default function AnggotaPage({
  activeMenu,
  collections,
  dbCategories,
  isLoadingCollections,
  collectionError,
  onRefreshCollections,
  loans,
  onAddLoan,
}) {
  const [cart, setCart] = useState([]);

  const handleAddToCart = (koleksi) => {
    if (koleksi.stok_tersedia <= 0) {
      alert('Maaf, stok eksemplar buku ini sedang habis dipinjam.');
      return;
    }
    if (cart.some((item) => item.id_koleksi === koleksi.id_koleksi)) {
      alert('Buku ini sudah ada di daftar peminjaman Anda.');
      return;
    }
    if (cart.length >= 3) {
      alert('Batas maksimal peminjaman mandiri adalah 3 buku.');
      return;
    }
    setCart([...cart, koleksi]);
  };

  const handleRemoveFromCart = (id_koleksi) => {
    setCart(cart.filter((c) => c.id_koleksi !== id_koleksi));
  };

  const handleConfirmCheckout = () => {
    if (cart.length === 0) return;

    cart.forEach((item, index) => {
      onAddLoan({
        id_peminjaman: Date.now() + index,
        nomor_transaksi: `TRX-${Date.now().toString().slice(-6)}-${index + 1}`,
        kode_eksemplar: `EKS-${item.id_koleksi}-01`,
        judul: item.judul,
        tanggal_pinjam: new Date().toISOString().split('T')[0],
        tanggal_jatuh_tempo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        status: 'SEDANG_DIPINJAM',
        denda: 0,
        status_denda: 'TIDAK_ADA',
      });
    });

    setCart([]);
  };

  return (
    <div className="page-container">
      {activeMenu === 'beranda' && (
        <BerandaKoleksi
          collections={collections}
          dbCategories={dbCategories}
          isLoadingCollections={isLoadingCollections}
          collectionError={collectionError}
          onRefreshCollections={onRefreshCollections}
          loans={loans}
          onAddToCart={handleAddToCart}
        />
      )}

      {activeMenu === 'peminjaman-mandiri' && (
        <PeminjamanMandiri
          collections={collections}
          cart={cart}
          onAddToCart={handleAddToCart}
          onRemoveFromCart={handleRemoveFromCart}
          onConfirmCheckout={handleConfirmCheckout}
        />
      )}

      {activeMenu === 'informasi-peminjaman' && (
        <InformasiPeminjaman loans={loans} />
      )}
    </div>
  );
}
