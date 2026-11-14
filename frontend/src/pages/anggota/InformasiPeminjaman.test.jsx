import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import InformasiPeminjaman from './InformasiPeminjaman.jsx';

const currentUser = { pengenal: '2211521001', role: 'Anggota' };

const transaksi = [
  {
    id_peminjaman: 8,
    nomor_transaksi: 'TRX-202611-008',
    jalur: 'MANDIRI',
    status: 'DIPINJAM',
    tanggal_pinjam: '2026-11-01',
    tanggal_jatuh_tempo: '2026-11-08',
    tanggal_kembali: null,
    terlambat: true,
    hari_terlambat: 3,
    koleksi: { kode_koleksi: 'KOL-CS-002', judul: 'Refactoring' },
    eksemplar: { kode_eksemplar: 'EKS-002-A' },
    denda: null,
  },
  {
    id_peminjaman: 1,
    nomor_transaksi: 'TRX-202611-001',
    jalur: 'PUSTAKAWAN',
    status: 'SELESAI',
    tanggal_pinjam: '2026-10-01',
    tanggal_jatuh_tempo: '2026-10-08',
    tanggal_kembali: '2026-10-10',
    terlambat: true,
    hari_terlambat: 2,
    koleksi: { kode_koleksi: 'KOL-CS-001', judul: 'Clean Code' },
    eksemplar: { kode_eksemplar: 'EKS-001-A' },
    denda: { nominal: 2000, status: 'BELUM_DIBAYAR' },
  },
];

const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });

const ringkasanDasar = {
  sedang_dipinjam: 0,
  dikembalikan: 0,
  terlambat: 0,
  maks_pinjam: 3,
  jumlah_denda_belum_lunas: 0,
  total_denda_belum_lunas: 0,
  jatuh_tempo_terdekat: null,
};

const pasangFetch = (data) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { success: true, data }));

afterEach(() => {
  cleanup(); // vitest tanpa globals: bersihkan tampilan setiap selesai test
  vi.restoreAllMocks();
});

describe('Informasi Peminjaman', () => {
  it('menampilkan ringkasan dan transaksi dari database', async () => {
    pasangFetch({
      ringkasan: {
        ...ringkasanDasar,
        sedang_dipinjam: 1,
        dikembalikan: 1,
        terlambat: 1,
        jumlah_denda_belum_lunas: 1,
        total_denda_belum_lunas: 2000,
        jatuh_tempo_terdekat: {
          nomor_transaksi: 'TRX-202611-008',
          judul: 'Refactoring',
          tanggal_jatuh_tempo: '2026-11-08',
          sisa_hari: -3,
        },
      },
      transaksi,
    });
    render(<InformasiPeminjaman currentUser={currentUser} />);

    expect(await screen.findByText('TRX-202611-008')).toBeInTheDocument();
    expect(screen.getByText('Refactoring')).toBeInTheDocument();
    expect(screen.getByText('Terlambat')).toBeInTheDocument();
    expect(screen.getByText('Lewat 3 hari dari jatuh tempo')).toBeInTheDocument();
    expect(screen.getByText('Perhatian: ada buku yang terlambat')).toBeInTheDocument();
    expect(screen.getByText('dari maksimal 3 buku')).toBeInTheDocument();
    expect(screen.getByText('1 tagihan belum lunas')).toBeInTheDocument();
    expect(screen.getByText('Dikembalikan')).toBeInTheDocument();
    expect(screen.getByText('Via Pustakawan')).toBeInTheDocument();
    expect(screen.getByText('Belum Lunas')).toBeInTheDocument();
    expect(screen.getAllByText('Rp 2.000').length).toBeGreaterThan(0);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/peminjaman/saya?status=semua');
    expect(options.headers['x-pengenal']).toBe('2211521001');
  });

  it('tetap menampilkan tombol Bayar Denda dari layout untuk denda yang belum dibayar', async () => {
    pasangFetch({
      ringkasan: { ...ringkasanDasar, dikembalikan: 1, jumlah_denda_belum_lunas: 1, total_denda_belum_lunas: 2000 },
      transaksi: [transaksi[1]],
    });
    render(<InformasiPeminjaman currentUser={currentUser} />);
    expect(await screen.findByRole('button', { name: 'Bayar Denda' })).toBeInTheDocument();
  });

  it('mengirim filter status ke backend saat tab dipilih', async () => {
    pasangFetch({
      ringkasan: ringkasanDasar,
      transaksi: [],
    });
    render(<InformasiPeminjaman currentUser={currentUser} />);
    await screen.findByText('Riwayat peminjaman belum tersedia.');

    fireEvent.click(screen.getByRole('tab', { name: /Sudah Dikembalikan/ }));

    await screen.findByText('Tidak ada transaksi yang cocok.');
    expect(fetch.mock.calls.at(-1)[0]).toBe('/api/peminjaman/saya?status=dikembalikan');
  });

  it('kotak ringkasan "Buku Sedang Dipinjam" bisa diklik untuk memfilter', async () => {
    pasangFetch({ ringkasan: ringkasanDasar, transaksi: [] });
    render(<InformasiPeminjaman currentUser={currentUser} />);
    await screen.findByText('Riwayat peminjaman belum tersedia.');

    fireEvent.click(screen.getByRole('button', { name: /Buku Sedang Dipinjam/ }));

    await screen.findByText('Tidak ada transaksi yang cocok.');
    expect(fetch.mock.calls.at(-1)[0]).toBe('/api/peminjaman/saya?status=dipinjam');
  });

  it('tombol Lihat detail membuka linimasa transaksi', async () => {
    pasangFetch({ ringkasan: ringkasanDasar, transaksi: [transaksi[1]] });
    render(<InformasiPeminjaman currentUser={currentUser} />);

    const tombol = await screen.findByRole('button', { name: /Lihat detail/ });
    expect(tombol).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(tombol);

    expect(screen.getByRole('button', { name: /Sembunyikan detail/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/melalui pustakawan/)).toBeInTheDocument();
    expect(screen.getByText(/terlambat 2 hari/)).toBeInTheDocument();
  });

  it('menampilkan pesan dan tombol coba lagi jika gagal memuat', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(500, { success: false, message: 'Terjadi kesalahan.' }),
    );
    render(<InformasiPeminjaman currentUser={currentUser} />);
    expect(await screen.findByText('Riwayat peminjaman belum dapat dimuat.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
