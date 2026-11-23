import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PengembalianBuku from './PengembalianBuku.jsx';

function mockJsonResponse(body, ok = true, status = 200) {
  const serialized = JSON.stringify(body);
  return {
    ok,
    status,
    text: async () => serialized,
    json: async () => body,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PengembalianBuku', () => {
  it('fetches and displays active return items from the API instead of mock data', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_detail: 101,
              id_peminjaman: 10,
              id_denda: 5,
              nomor_transaksi: 'TRX-DB-999',
              kode_eksemplar: 'EKS-DB-01',
              lokasi_rak: 'RAK-KOM-01',
              judul: 'Buku Dari Database',
              tanggal_jatuh_tempo: '2026-11-12',
              status: 'TERLAMBAT',
              hari_terlambat: 5,
              denda: 5000,
              status_denda: 'BELUM_LUNAS',
              anggota: {
                id_pengguna: 3,
                pengenal: '2211521001',
                nama: 'Ahmad Fauzan',
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }));

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    expect(await screen.findByText('TRX-DB-999')).toBeInTheDocument();
    expect(screen.getByText('Buku Dari Database')).toBeInTheDocument();
    expect(screen.getByText(/Ahmad Fauzan/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 5\.000/)).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/pengembalian?status=semua');
  });

  it('processes return via POST /api/pengembalian/proses and updates the list', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_detail: 101,
              id_peminjaman: 10,
              nomor_transaksi: 'TRX-DB-999',
              kode_eksemplar: 'EKS-DB-01',
              lokasi_rak: 'RAK-KOM-01',
              judul: 'Buku Dari Database',
              tanggal_jatuh_tempo: '2026-11-25',
              status: 'SEDANG_DIPINJAM',
              hari_terlambat: 0,
              denda: 0,
              status_denda: 'TIDAK_ADA',
              anggota: {
                id_pengguna: 3,
                pengenal: '2211521001',
                nama: 'Ahmad Fauzan',
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: {
            item: {
              id_detail: 101,
              judul: 'Buku Dari Database',
              kode_eksemplar: 'EKS-DB-01',
              status: 'SELESAI',
              status_detail: 'KEMBALI',
              denda: 0,
            },
          },
        })
      );

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    const returnButton = await screen.findByRole('button', { name: 'Proses Kembali' });
    fireEvent.click(returnButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pengembalian/proses',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    expect(
      await screen.findByText(/Buku "Buku Dari Database" berhasil dikembalikan/)
    ).toBeInTheDocument();
    expect(screen.queryByText('TRX-DB-999')).not.toBeInTheDocument();
  });

  it('filters records by status on Denda, Verifikasi Pembayaran, and Riwayat tabs', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_detail: 101,
              id_peminjaman: 10,
              id_denda: 5,
              nomor_transaksi: 'TRX-LUNAS-01',
              kode_eksemplar: 'EKS-001',
              judul: 'Buku Denda Lunas',
              tanggal_pinjam: '2026-11-01',
              tanggal_jatuh_tempo: '2026-11-08',
              tanggal_kembali: '2026-11-10',
              status: 'SELESAI',
              hari_terlambat: 2,
              denda: 2000,
              status_denda: 'LUNAS',
              anggota: { id_pengguna: 3, pengenal: '2211521001', nama: 'Ahmad Fauzan' },
            },
            {
              id_detail: 102,
              id_peminjaman: 11,
              id_denda: 6,
              nomor_transaksi: 'TRX-BELUM-02',
              kode_eksemplar: 'EKS-002',
              judul: 'Buku Denda Belum Lunas',
              tanggal_pinjam: '2026-11-10',
              tanggal_jatuh_tempo: '2026-11-17',
              tanggal_kembali: null,
              status: 'TERLAMBAT',
              hari_terlambat: 5,
              denda: 5000,
              status_denda: 'BELUM_LUNAS',
              anggota: { id_pengguna: 4, pengenal: '2211521002', nama: 'Budi Santoso' },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_pembayaran: 1,
              nominal_bayar: 2000,
              path_bukti: '/api/public/denda/bukti-1.webp',
              tipe_berkas: 'image/webp',
              status: 'TERVERIFIKASI',
              waktu_unggah: '2026-11-10T10:00:00.000Z',
              anggota: { id_pengguna: 3, pengenal: '2211521001', nama: 'Ahmad Fauzan' },
              rincian: [
                {
                  id_rincian: 1,
                  id_denda: 5,
                  nomor_transaksi: 'TRX-LUNAS-01',
                  kode_eksemplar: 'EKS-001',
                  judul: 'Buku Denda Lunas',
                  hari_terlambat: 2,
                },
              ],
            },
            {
              id_pembayaran: 2,
              nominal_bayar: 5000,
              path_bukti: '/api/public/denda/bukti-2.webp',
              tipe_berkas: 'image/webp',
              status: 'DITOLAK',
              alasan_penolakan: 'Bukti buram',
              waktu_unggah: '2026-11-18T10:00:00.000Z',
              anggota: { id_pengguna: 4, pengenal: '2211521002', nama: 'Budi Santoso' },
              rincian: [
                {
                  id_rincian: 2,
                  id_denda: 6,
                  nomor_transaksi: 'TRX-BELUM-02',
                  kode_eksemplar: 'EKS-002',
                  judul: 'Buku Denda Belum Lunas',
                  hari_terlambat: 5,
                },
              ],
            },
          ],
        })
      );

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    expect(await screen.findByText('TRX-BELUM-02')).toBeInTheDocument();

    // Tab Koreksi & Daftar Denda
    fireEvent.click(screen.getByRole('button', { name: /Koreksi & Daftar Denda/i }));
    const dendaSelect = screen.getByLabelText('Filter status denda');
    fireEvent.change(dendaSelect, { target: { value: 'LUNAS' } });
    expect(screen.getByText('TRX-LUNAS-01')).toBeInTheDocument();
    expect(screen.queryByText('TRX-BELUM-02')).not.toBeInTheDocument();

    // Tab Verifikasi Bukti Pembayaran Denda
    fireEvent.click(screen.getByRole('button', { name: /Verifikasi Bukti Pembayaran Denda/i }));
    const paymentSelect = screen.getByLabelText('Filter status verifikasi pembayaran');
    fireEvent.change(paymentSelect, { target: { value: 'DITOLAK' } });
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.queryByText('Ahmad Fauzan')).not.toBeInTheDocument();

    // Tab Riwayat Peminjaman
    fireEvent.click(screen.getByRole('button', { name: /Riwayat Peminjaman/i }));
    const historySelect = screen.getByLabelText('Filter status riwayat peminjaman');
    fireEvent.change(historySelect, { target: { value: 'SELESAI' } });
    expect(screen.getByText('TRX-LUNAS-01')).toBeInTheDocument();
    expect(screen.queryByText('TRX-BELUM-02')).not.toBeInTheDocument();
  });
});
