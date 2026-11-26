import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    pembayaran_terakhir: {
      id_pembayaran: 55,
      nominal_bayar: 2000,
      path_bukti: '/api/public/denda/bukti-lama.webp',
      tipe_berkas: 'image/webp',
      status: 'DITOLAK',
      alasan_penolakan: 'Nominal kurang jelas',
      waktu_unggah: '2026-10-11T08:00:00.000Z',
    },
  },
  {
    id_detail: 2,
    id_peminjaman: 2,
    id_denda: 12,
    nomor_transaksi: 'TRX-202611-002',
    kode_eksemplar: 'EKS-003-A',
    judul: 'Bumi Manusia',
    status: 'SELESAI',
    tanggal_pinjam: '2026-09-01',
    tanggal_jatuh_tempo: '2026-09-08',
    tanggal_kembali: '2026-09-10',
    hari_terlambat: 2,
    denda: 2000,
    sisa_denda: 0,
    status_denda: 'LUNAS',
    riwayat_koreksi: [],
    pembayaran_terakhir: {
      id_pembayaran: 56,
      nominal_bayar: 2000,
      path_bukti: '/api/public/denda/bukti-lunas.webp',
      tipe_berkas: 'image/webp',
      status: 'TERVERIFIKASI',
      alasan_penolakan: null,
      waktu_unggah: '2026-09-11T08:00:00.000Z',
    },
  },
  {
    id_detail: 3,
    id_peminjaman: 3,
    id_denda: null,
    nomor_transaksi: 'TRX-202611-003',
    kode_eksemplar: 'EKS-004-A',
    judul: 'Filosofi Teras',
    status: 'SEDANG_DIPINJAM',
    tanggal_pinjam: '11/15/2026',
    tanggal_jatuh_tempo: '-',
    tanggal_kembali: null,
    hari_terlambat: 0,
    denda: 0,
    sisa_denda: 0,
    status_denda: 'TIDAK_ADA',
    riwayat_koreksi: [],
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
  it('menampilkan ringkasan, riwayat koreksi, penolakan bukti, dan pratinjau bukti lunas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ success: true, data: sampleLoans })
    );

    render(<InformasiPeminjaman currentUser={currentUser} />);

    expect(await screen.findByText('TRX-202611-008')).toBeInTheDocument();
    expect(screen.getByText('Refactoring')).toBeInTheDocument();
    expect(screen.getByText('Clean Code')).toBeInTheDocument();
    expect(screen.getByText(/Koreksi Pustakawan \(10-10-2026\):/)).toBeInTheDocument();
    expect(screen.getByText(/Bukti pembayaran ditolak:/)).toBeInTheDocument();
    expect(screen.getByText(/Nominal kurang jelas/)).toBeInTheDocument();
    expect(screen.getByText(/Kembalikan buku untuk membayar denda/)).toBeInTheDocument();

    // Buka modal Lihat Bukti untuk denda yang sudah LUNAS
    fireEvent.click(screen.getByRole('button', { name: /Lihat Bukti/i }));
    expect(await screen.findByText('Bukti Pembayaran Denda Terverifikasi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tutup Modal' }));
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

    fireEvent.click(screen.getByRole('button', { name: /Semua Riwayat/i }));
    expect(screen.getByText('TRX-202611-001')).toBeInTheDocument();
  });

  it('mengonversi gambar ke WebP dan mengirim bukti pembayaran denda via QRIS', async () => {
    // Stub FileReader, Image, dan Canvas 2D untuk kompresi WebP
    const origFileReader = globalThis.FileReader;
    const origImage = globalThis.Image;
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;

    class MockFileReader {
      readAsDataURL() {
        this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        if (this.onload) this.onload();
      }
    }
    class MockImage {
      constructor() {
        this.naturalWidth = 1600;
        this.naturalHeight = 1200;
      }
      set src(_val) {
        if (this.onload) this.onload();
      }
    }

    globalThis.FileReader = MockFileReader;
    globalThis.Image = MockImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v3AgAA='
    );

    try {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [sampleLoans[1]] }))
        .mockResolvedValueOnce(
          mockJsonResponse({
            success: true,
            data: { filename: 'images.png', url: '/api/public/qris/images.png' },
          })
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            success: true,
            data: { id_pembayaran: 55, is_updated: true },
          })
        )
        .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [sampleLoans[1]] }));

      render(<InformasiPeminjaman currentUser={currentUser} />);
      const payBtn = await screen.findByRole('button', { name: /Upload Ulang Bukti/i });
      fireEvent.click(payBtn);

      expect(await screen.findByText(/Scan QRIS Perpustakaan UNAND/i)).toBeInTheDocument();
      expect(screen.getByText(/Bukti Pembayaran Sebelumnya/i)).toBeInTheDocument();

      const fileInput = screen.getByLabelText(/Unggah Gambar Bukti Pembayaran/i);
      const fakeFile = new File(['dummy'], 'bukti.png', { type: 'image/png' });
      Object.defineProperty(fileInput, 'files', {
        value: [fakeFile],
        configurable: true,
      });
      fireEvent.change(fileInput);

      expect(await screen.findByText(/Pratinjau Bukti Baru/i)).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /Ganti & Simpan Bukti Baru/i });
      fireEvent.submit(submitBtn.closest('form'));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/pengembalian/pembayaran',
          expect.objectContaining({ method: 'POST' })
        );
      });

      expect(
        await screen.findByText(/Bukti pembayaran denda berhasil diperbarui/i)
      ).toBeInTheDocument();
    } finally {
      globalThis.FileReader = origFileReader;
      globalThis.Image = origImage;
      HTMLCanvasElement.prototype.getContext = origGetContext;
      HTMLCanvasElement.prototype.toDataURL = origToDataURL;
    }
  });

  it('menampilkan pesan error dan tombol Coba Lagi jika gagal memuat data atau respons kosong', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => '',
      })
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }));

    render(<InformasiPeminjaman />);
    expect(await screen.findByText(/Server API backend/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Coba Lagi/i }));
    expect(
      await screen.findByText(/Tidak ada data peminjaman pada filter ini/i)
    ).toBeInTheDocument();
  });

  it('menangani status menunggu verifikasi, kegagalan muat QRIS, dan pembatalan modal', async () => {
    const pendingLoan = {
      ...sampleLoans[1],
      id_detail: 99,
      riwayat_koreksi: [
        {
          id_koreksi: 2,
          nominal_lama: 4000,
          nominal_baru: 2000,
          alasan: 'Koreksi tanggal invalid',
          waktu: 'invalid-date',
        },
      ],
      pembayaran_terakhir: {
        id_pembayaran: 77,
        nominal_bayar: 2000,
        path_bukti: '/api/public/denda/bukti-pending.webp',
        tipe_berkas: 'image/webp',
        status: 'MENUNGGU_VERIFIKASI',
        alasan_penolakan: null,
        waktu_unggah: '2026-10-12T08:00:00.000Z',
      },
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [pendingLoan] }))
      .mockResolvedValueOnce(
        mockJsonResponse({ success: false, message: 'QRIS tidak ditemukan' }, 404)
      );

    render(<InformasiPeminjaman currentUser={currentUser} />);
    expect(
      await screen.findByText(/Menunggu Verifikasi Pustakawan/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ganti Bukti Bayar/i }));
    expect(await screen.findByText('QRIS tidak ditemukan')).toBeInTheDocument();

    // Submit tanpa memilih file -> tampilkan pesan error
    fireEvent.submit(
      screen.getByRole('button', { name: /Ganti & Simpan Bukti Baru/i }).closest('form')
    );
    expect(
      screen.getByText(/Silakan pilih dan unggah gambar bukti pembayaran/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
  });
});
