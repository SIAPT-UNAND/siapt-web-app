import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import InformasiPeminjaman from './InformasiPeminjaman.jsx';

const currentUser = { pengenal: '2211521001', role: 'Anggota' };

const sampleLoans = [
  {
    id_detail: 8,
    id_peminjaman: 8,
    id_denda: 10,
    nomor_transaksi: 'TRX-202611-008',
    kode_eksemplar: 'EKS-002-A',
    judul: 'Refactoring',
    status: 'TERLAMBAT',
    tanggal_pinjam: '2026-11-01',
    tanggal_jatuh_tempo: '2026-11-08',
    tanggal_kembali: null,
    hari_terlambat: 3,
    denda: 3000,
    sisa_denda: 3000,
    status_denda: 'BELUM_LUNAS',
    riwayat_koreksi: [],
    pembayaran_terakhir: null,
  },
  {
    id_detail: 1,
    id_peminjaman: 1,
    id_denda: 11,
    nomor_transaksi: 'TRX-202611-001',
    kode_eksemplar: 'EKS-001-A',
    judul: 'Clean Code',
    status: 'SELESAI',
    tanggal_pinjam: '2026-10-01',
    tanggal_jatuh_tempo: '2026-10-08',
    tanggal_kembali: '2026-10-10',
    hari_terlambat: 2,
    denda: 2000,
    sisa_denda: 2000,
    status_denda: 'BELUM_LUNAS',
    riwayat_koreksi: [
      {
        id_koreksi: 1,
        nominal_lama: 3000,
        nominal_baru: 2000,
        alasan: 'Dispensasi',
        waktu: '2026-10-10T10:00:00.000Z',
      },
    ],
    pembayaran_terakhir: null,
  },
];

function mockJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Informasi Peminjaman', () => {
  it('menampilkan ringkasan, riwayat koreksi beserta tanggal, dan daftar peminjaman anggota', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ success: true, data: sampleLoans })
    );

    render(<InformasiPeminjaman currentUser={currentUser} />);

    expect(await screen.findByText('TRX-202611-008')).toBeInTheDocument();
    expect(screen.getByText('Refactoring')).toBeInTheDocument();
    expect(screen.getByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText(/Koreksi Pustakawan \(10-10-2026\):/)).toBeInTheDocument();
    expect(screen.getByText(/Kembalikan buku untuk membayar denda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bayar Denda \(QRIS\)/i })).toBeInTheDocument();
  });

  it('memfilter daftar berdasarkan tab Sedang Dipinjam dan Sudah Dikembalikan', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ success: true, data: sampleLoans })
    );

    render(<InformasiPeminjaman currentUser={currentUser} />);
    expect(await screen.findByText('TRX-202611-008')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sudah Dikembalikan/i }));
    expect(screen.queryByText('TRX-202611-008')).not.toBeInTheDocument();
    expect(screen.getByText('TRX-202611-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sedang Dipinjam/i }));
    expect(screen.getByText('TRX-202611-008')).toBeInTheDocument();
    expect(screen.queryByText('TRX-202611-001')).not.toBeInTheDocument();
  });

  it('membuka modal pembayaran QRIS untuk buku yang sudah dikembalikan', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [sampleLoans[1]] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: { filename: 'images.png', url: '/api/public/qris/images.png' },
        })
      );

    render(<InformasiPeminjaman currentUser={currentUser} />);
    const payBtn = await screen.findByRole('button', { name: /Bayar Denda \(QRIS\)/i });
    fireEvent.click(payBtn);

    expect(await screen.findByText(/Scan QRIS Perpustakaan UNAND/i)).toBeInTheDocument();
  });

  it('menampilkan pesan error dan tombol Coba Lagi jika gagal memuat data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ success: false, message: 'Gagal memuat data.' }, 500)
    );

    render(<InformasiPeminjaman currentUser={currentUser} />);
    expect(await screen.findByText('Gagal memuat data.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Coba Lagi/i })).toBeInTheDocument();
  });
});
