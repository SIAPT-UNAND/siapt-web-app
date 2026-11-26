import { useEffect, useState } from 'react';
import BerandaKoleksi from './BerandaKoleksi.jsx';
import PeminjamanMandiri from './PeminjamanMandiri.jsx';
import PeringatanPinjam from './PeringatanPinjam.jsx';
import InformasiPeminjaman from './InformasiPeminjaman.jsx';
import {
  ambilKetentuanPeminjaman,
  cekKelayakanPinjam,
  pinjamMandiri,
} from '../../api/peminjaman.js';

export default function AnggotaPage({
  activeMenu,
  currentUser,
  collections,
  dbCategories,
  isLoadingCollections,
  collectionError,
  onRefreshCollections,
  loans,
}) {
  const [cart, setCart] = useState([]);
  const [ketentuan, setKetentuan] = useState(null);
  const [hasilPinjam, setHasilPinjam] = useState([]);
  const [sedangMemproses, setSedangMemproses] = useState(false);
  const [sedangMengecek, setSedangMengecek] = useState(false);
  const [peringatan, setPeringatan] = useState(null);

  // Ketentuan peminjaman diambil dari konfigurasi sistem (backend)
  useEffect(() => {
    let aktif = true;
    ambilKetentuanPeminjaman(currentUser?.pengenal)
      .then((data) => aktif && setKetentuan(data))
      .catch(() => aktif && setKetentuan(null));
    return () => {
      aktif = false;
    };
  }, [currentUser?.pengenal]);

  /**
   * Memasukkan buku ke keranjang setelah dicek ke database
   * (akun, denda, stok, dan sisa kuota). Jika tidak bisa, tampilkan popup.
   * Mengembalikan judul buku jika berhasil, atau null jika gagal.
   */
  const tambahKeKeranjang = async (kodeKoleksi, judulDiketahui) => {
    const kode = kodeKoleksi?.trim();
    if (!kode || sedangMengecek || sedangMemproses) return null;

    if (cart.some((item) => item.kode_koleksi.toLowerCase() === kode.toLowerCase())) {
      setPeringatan({ judul: judulDiketahui, pesan: 'Buku ini sudah ada di keranjang.' });
      return null;
    }

    setSedangMengecek(true);
    try {
      const data = await cekKelayakanPinjam(currentUser?.pengenal, kode);

      if (cart.length >= data.sisa_kuota) {
        const dipinjam = data.maks_pinjam - data.sisa_kuota;
        setPeringatan({
          judul: data.koleksi.judul,
          pesan:
            data.sisa_kuota > 0
              ? `Kuota peminjaman kamu tinggal ${data.sisa_kuota} buku (sedang meminjam ${dipinjam} dari maksimal ${data.maks_pinjam}), dan keranjang sudah terisi ${cart.length} buku.`
              : `Kuota peminjaman kamu sudah penuh (${dipinjam} dari maksimal ${data.maks_pinjam}).`,
        });
        return null;
      }

      setCart((sebelum) => [
        ...sebelum,
        {
          id_koleksi: data.koleksi.id_koleksi,
          kode_koleksi: data.koleksi.kode_koleksi,
          judul: data.koleksi.judul,
          sampul: data.koleksi.sampul,
          lokasi_rak: data.lokasi_rak,
          kunci_idempotensi: crypto.randomUUID(),
        },
      ]);
      return data.koleksi.judul;
    } catch (err) {
      setPeringatan({ judul: judulDiketahui, pesan: err.message });
      return null;
    } finally {
      setSedangMengecek(false);
    }
  };

  // Tombol "Pinjam Mandiri" di katalog memakai pengecekan yang sama
  const handleAddToCartDariKatalog = (koleksi) => {
    tambahKeKeranjang(koleksi.kode_koleksi, koleksi.judul);
  };

  const handleRemoveFromCart = (id_koleksi) => {
    setCart(cart.filter((c) => c.id_koleksi !== id_koleksi));
  };

  // Setiap buku di keranjang dicatat sebagai satu transaksi (BR-02).
  // Backend tetap memeriksa ulang, misalnya jika stok keburu dipinjam orang lain.
  const handleConfirmCheckout = async () => {
    if (cart.length === 0 || sedangMemproses) return;
    setSedangMemproses(true);
    setHasilPinjam([]);

    const hasil = [];
    const hasilTidakDiketahui = [];
    for (const item of cart) {
      try {
        const data = await pinjamMandiri(currentUser?.pengenal, {
          kodeKoleksi: item.kode_koleksi,
          kunciIdempotensi: item.kunci_idempotensi,
        });
        hasil.push({ judul: item.judul, berhasil: true, data });
      } catch (err) {
        hasil.push({ judul: item.judul, berhasil: false, pesan: err.message });
        if (err.hasilPermintaanTidakDiketahui) {
          hasilTidakDiketahui.push(item);
        }
      }
    }

    setHasilPinjam(hasil);
    setCart(hasilTidakDiketahui);
    setSedangMemproses(false);
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
          onAddToCart={handleAddToCartDariKatalog}
        />
      )}

      {activeMenu === 'peminjaman-mandiri' && (
        <PeminjamanMandiri
          cart={cart}
          ketentuan={ketentuan}
          hasilPinjam={hasilPinjam}
          sedangMemproses={sedangMemproses}
          sedangMengecek={sedangMengecek}
          onAddToCart={tambahKeKeranjang}
          onRemoveFromCart={handleRemoveFromCart}
          onConfirmCheckout={handleConfirmCheckout}
          onTutupHasil={() => setHasilPinjam([])}
        />
      )}

      {activeMenu === 'informasi-peminjaman' && (
        <InformasiPeminjaman currentUser={currentUser} />
      )}

      <PeringatanPinjam peringatan={peringatan} onClose={() => setPeringatan(null)} />
    </div>
  );
}
