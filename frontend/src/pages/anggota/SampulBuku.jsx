import { useState } from 'react';

// Warna pengganti dipilih tetap berdasarkan judul, agar buku yang sama selalu berwarna sama
const WARNA = ['#0a4435', '#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c'];
const warnaDari = (judul) => WARNA[[...judul].reduce((n, c) => n + c.charCodeAt(0), 0) % WARNA.length];

/**
 * Sampul buku kecil.
 * - Jika `src` (kolom koleksi.sampul) ada dan gambarnya bisa dimuat: tampilkan gambar.
 * - Jika belum ada atau gagal dimuat: kotak berwarna dengan huruf awal judul.
 * Saat modul Kelola Koleksi mulai mengisi gambar sampul, gambar langsung tampil di sini.
 */
export default function SampulBuku({ judul = '', src, ukuran = 'sm' }) {
  // Menyimpan alamat gambar yang gagal dimuat, agar alamat baru dicoba lagi
  const [srcGagal, setSrcGagal] = useState(null);
  const pakaiGambar = Boolean(src) && src !== srcGagal;

  return (
    <span
      className={`sampul-buku sampul-${ukuran}`}
      style={pakaiGambar ? undefined : { background: warnaDari(judul) }}
      aria-hidden="true"
    >
      {pakaiGambar ? (
        <img src={src} alt="" loading="lazy" onError={() => setSrcGagal(src)} />
      ) : (
        judul.charAt(0).toUpperCase()
      )}
    </span>
  );
}
