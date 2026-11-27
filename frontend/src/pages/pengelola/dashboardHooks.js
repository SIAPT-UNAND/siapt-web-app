import { useEffect, useState } from 'react';

const PESAN_GAGAL_UMUM = 'Terjadi kesalahan. Silakan coba lagi.';

/**
 * Memuat data dashboard. `ambil` dipanggil ulang setiap `kunci` berubah atau `muatUlang()` dipanggil.
 * Data lama tetap tersedia selama memuat ulang; hasil yang datang setelah unmount diabaikan.
 */
export function useDashboard(ambil, kunci = '') {
  const [versi, setVersi] = useState(0);
  const [hasil, setHasil] = useState({ penanda: null, data: null, error: '' });
  const penanda = `${kunci}|${versi}`;

  useEffect(() => {
    let batal = false;
    ambil().then(
      (data) => {
        if (!batal) setHasil({ penanda, data, error: '' });
      },
      (err) => {
        if (!batal) setHasil((lama) => ({ penanda, data: lama.data, error: err?.message || PESAN_GAGAL_UMUM }));
      },
    );
    return () => {
      batal = true;
    };
    // `ambil` dibuat ulang setiap render; permintaan baru ditandai oleh `penanda`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penanda]);

  return {
    data: hasil.data,
    error: hasil.penanda === penanda ? hasil.error : '',
    memuat: hasil.penanda !== penanda,
    muatUlang: () => setVersi((v) => v + 1),
  };
}
