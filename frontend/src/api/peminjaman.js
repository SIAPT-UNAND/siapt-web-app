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
    throw new Error('Tidak dapat terhubung ke server. Coba lagi nanti.');
  }

  const body = await res.json().catch(() => null);
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

export const cekKelayakanPinjam =(pengenal, kodeKoleksi) =>
  panggil(`/api/peminjaman/cek?kode_koleksi=${encodeURIComponent(kodeKoleksi)}`, pengenal);

export const pinjamMandiri =(pengenal, { kodeKoleksi, kunciIdempotensi }) =>
  panggil('/api/peminjaman/mandiri', pengenal, {
    method: 'POST',
    body: JSON.stringify({ kode_koleksi: kodeKoleksi, kunci_idempotensi: kunciIdempotensi }),
  });
