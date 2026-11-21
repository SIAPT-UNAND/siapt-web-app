/**
 * Pemanggilan API modul peminjaman.
 * SEMENTARA: identitas dikirim lewat header `x-pengenal` sampai modul login selesai.
 */

const panggil = async (url, pengenal, options = {}) => {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-pengenal': pengenal ?? '',
        ...options.headers,
      },
    });
  } catch {
    const error = new Error('Tidak dapat terhubung ke server. Coba lagi nanti.');
    error.hasilPermintaanTidakDiketahui = true;
    throw error;
  }

  const body = await res.json().catch(() => null);
  if (body === null || res.status >= 500) {
    const error = new Error(body?.message || 'Respons server tidak dapat dipastikan. Coba lagi.');
    error.hasilPermintaanTidakDiketahui = true;
    throw error;
  }
  if (!res.ok || !body?.success) {
    throw new Error(body?.message || 'Terjadi kesalahan. Coba lagi nanti.');
  }
  return body.data;
};

export const ambilKetentuanPeminjaman = (pengenal) =>
  panggil('/api/peminjaman/ketentuan', pengenal);

export const ambilRiwayatSaya = (pengenal, { status = 'semua', kataKunci = '' } = {}) => {
  const params = new URLSearchParams({ status });
  if (kataKunci.trim()) params.set('q', kataKunci.trim());
  return panggil(`/api/peminjaman/saya?${params}`, pengenal);
};

export const cekKelayakanPinjam = (pengenal, kodeKoleksi) =>
  panggil(`/api/peminjaman/cek?kode_koleksi=${encodeURIComponent(kodeKoleksi)}`, pengenal);

export const pinjamMandiri = (pengenal, { kodeKoleksi, kunciIdempotensi }) =>
  panggil('/api/peminjaman/mandiri', pengenal, {
    method: 'POST',
    body: JSON.stringify({ kode_koleksi: kodeKoleksi, kunci_idempotensi: kunciIdempotensi }),
  });

// ---------- Pustakawan (UC-09) ----------

export const cariAnggotaUntukPustakawan = (pengenalPustakawan, nim) =>
  panggil(`/api/peminjaman/pustakawan/anggota/${encodeURIComponent(nim)}`, pengenalPustakawan);

export const pinjamViaPustakawan = (pengenalPustakawan, { nim, kode, kunciIdempotensi }) =>
  panggil('/api/peminjaman/pustakawan', pengenalPustakawan, {
    method: 'POST',
    body: JSON.stringify({ pengenal_anggota: nim, kode, kunci_idempotensi: kunciIdempotensi }),
  });

export const ambilTransaksiTerbaru = (pengenalPustakawan) =>
  panggil('/api/peminjaman/terbaru', pengenalPustakawan);

export const infoBukuUntukPustakawan = (pengenalPustakawan, kode) =>
  panggil(`/api/peminjaman/pustakawan/buku/${encodeURIComponent(kode)}`, pengenalPustakawan);
