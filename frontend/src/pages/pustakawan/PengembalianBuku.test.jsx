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
  it('fetches and displays active return items and supports Sinkronisasi Denda button', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
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
              riwayat_koreksi: [
                {
                  id_koreksi: 1,
                  nominal_lama: 6000,
                  nominal_baru: 5000,
                  alasan: 'Diskon',
                  waktu: '2026-11-20T10:00:00.000Z',
                },
              ],
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
          data: { updated_count: 3 },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }));

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    expect(await screen.findByText('TRX-DB-999')).toBeInTheDocument();
    expect(screen.getByText('Buku Dari Database')).toBeInTheDocument();
    expect(screen.getByText(/Ahmad Fauzan/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 5\.000/)).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/pengembalian?status=semua',
      expect.objectContaining({
        headers: { 'x-pengenal': '198805122014042001' },
      })
    );

    // Klik tombol Sinkronisasi Denda
    fireEvent.click(screen.getByRole('button', { name: 'Sinkronisasi Denda' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pengembalian/sync-denda',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(
      await screen.findByText(/Sinkronisasi denda selesai \(3 data diperbarui\)/i)
    ).toBeInTheDocument();
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
              denda: 2000,
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
          headers: {
            'Content-Type': 'application/json',
            'x-pengenal': '198805122014042001',
          },
        })
      );
    });

    expect(
      await screen.findByText(/Buku "Buku Dari Database" berhasil dikembalikan/)
    ).toBeInTheDocument();
    expect(screen.queryByText('TRX-DB-999')).not.toBeInTheDocument();
  });

  it('filters records by status, searches, and verifies/rejects payment proof on Denda, Verifikasi, and Riwayat tabs', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
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
              riwayat_koreksi: [
                {
                  id_koreksi: 11,
                  nominal_lama: 6000,
                  nominal_baru: 5000,
                  alasan: 'Koreksi awal',
                  waktu: '2026-11-18T09:00:00.000Z',
                },
              ],
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
              status: 'MENUNGGU_VERIFIKASI',
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
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: {
            koreksi: { id_koreksi: 12, nominal_lama: 5000, nominal_baru: 3000 },
            item: {
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
              denda: 3000,
              status_denda: 'BELUM_LUNAS',
              riwayat_koreksi: [],
              anggota: { id_pengguna: 4, pengenal: '2211521002', nama: 'Budi Santoso' },
            },
          },
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: { id_pembayaran: 1, status: 'DITOLAK' },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }));

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    expect(await screen.findByText('TRX-BELUM-02')).toBeInTheDocument();

    // Uji modal Koreksi Denda satuan dari tab Aktif
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi Denda' }));
    expect(screen.getByText('Riwayat Koreksi Sebelumnya:')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nominal Denda Baru/i), {
      target: { value: '3000' },
    });
    fireEvent.change(screen.getByLabelText(/Alasan Koreksi Denda/i), {
      target: { value: 'Potongan dispensasi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Koreksi Denda' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pengembalian/denda/koreksi',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Tab Koreksi & Daftar Denda
    fireEvent.click(screen.getByRole('button', { name: /Koreksi & Daftar Denda/i }));
    const dendaSelect = screen.getByLabelText('Filter status denda');
    fireEvent.change(dendaSelect, { target: { value: 'LUNAS' } });
    expect(screen.getByText('TRX-LUNAS-01')).toBeInTheDocument();
    expect(screen.queryByText('TRX-BELUM-02')).not.toBeInTheDocument();

    // Tab Verifikasi Bukti Pembayaran Denda + Tolak Bukti
    fireEvent.click(screen.getByRole('button', { name: /Verifikasi Bukti Pembayaran Denda/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Periksa & Verifikasi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }));
    fireEvent.change(screen.getByLabelText(/Alasan Penolakan Bukti Pembayaran/i), {
      target: { value: 'Bukti tidak terbaca' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi Penolakan' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pengembalian/pembayaran/1/verifikasi',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Tab Riwayat Peminjaman + Pencarian
    fireEvent.click(screen.getByRole('button', { name: /Riwayat Peminjaman/i }));
    const searchInput = screen.getByPlaceholderText(/Cari no\. transaksi/i);
    fireEvent.change(searchInput, { target: { value: 'TIDAK-ADA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hapus pencarian' }));
  });

  it('submits bulk fine correction via POST /api/pengembalian/denda/koreksi-massal including LUNASI_SEMUA', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
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
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: {
            updated_count: 1,
            operator: 'KURANG',
            nilai_koreksi: 2000,
            target_status_buku: 'BELUM_KEMBALI',
          },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }));

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    expect(await screen.findByText('TRX-BELUM-02')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Koreksi & Daftar Denda/i }));
    fireEvent.click(screen.getByRole('button', { name: /Koreksi Denda Massal/i }));

    fireEvent.change(screen.getByLabelText(/Sasaran Status Pengembalian Buku/i), {
      target: { value: 'BELUM_KEMBALI' },
    });
    fireEvent.change(screen.getByLabelText(/Operator Penyesuaian Denda/i), {
      target: { value: 'KURANG' },
    });
    fireEvent.click(screen.getByRole('button', { name: '-2.000' }));
    fireEvent.change(screen.getByLabelText(/Alasan Koreksi Denda Massal/i), {
      target: { value: 'Kompensasi hari libur' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Terapkan ke 1 Tagihan/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pengembalian/denda/koreksi-massal',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pengenal': '198805122014042001',
          },
          body: JSON.stringify({
            operator: 'KURANG',
            nilai_koreksi: 2000,
            target_status_buku: 'BELUM_KEMBALI',
            alasan: 'Kompensasi hari libur',
          }),
        })
      );
    });
  });

  it('displays pagination when records exceed 20 items and handles fetch errors gracefully', async () => {
    const manyItems = Array.from({ length: 22 }, (_, i) => ({
      id_detail: 200 + i,
      id_peminjaman: 50 + i,
      nomor_transaksi: `TRX-PAGE-${String(i + 1).padStart(2, '0')}`,
      kode_eksemplar: `EKS-P-${i + 1}`,
      judul: `Buku Halaman ${i + 1}`,
      tanggal_pinjam: '2026-11-10',
      tanggal_jatuh_tempo: '2026-11-25',
      status: 'SEDANG_DIPINJAM',
      hari_terlambat: 0,
      denda: 0,
      status_denda: 'TIDAK_ADA',
    }));

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' })
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: manyItems }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }));

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    expect(await screen.findByText(/Server API backend/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));

    expect(await screen.findByText('TRX-PAGE-22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }));
    expect(await screen.findByText('TRX-PAGE-01')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sebelumnya/i }));
    expect(await screen.findByText('TRX-PAGE-22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(await screen.findByText('TRX-PAGE-01')).toBeInTheDocument();
  });

  it('covers payment approval, bulk LUNASI_SEMUA & TAMBAH, form return, and error validations', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_detail: 301,
              id_peminjaman: 20,
              id_denda: 31,
              nomor_transaksi: 'TRX-TIE-01',
              kode_eksemplar: 'EKS-T1',
              lokasi_rak: '-',
              judul: 'Buku Tie 1',
              tanggal_pinjam: '2026-11-10',
              tanggal_jatuh_tempo: 'invalid-date',
              tanggal_kembali: null,
              status: 'TERLAMBAT',
              hari_terlambat: 3,
              denda: 3000,
              status_denda: 'BELUM_LUNAS',
              riwayat_koreksi: [
                {
                  id_koreksi: 91,
                  nominal_lama: 4000,
                  nominal_baru: 3000,
                  alasan: 'Uji',
                  waktu: 'not-a-date',
                },
              ],
            },
            {
              id_detail: 302,
              id_peminjaman: 20,
              id_denda: 32,
              nomor_transaksi: 'TRX-TIE-02',
              kode_eksemplar: 'EKS-T2',
              judul: 'Buku Tie 2',
              tanggal_pinjam: '2026-11-10',
              tanggal_jatuh_tempo: '-',
              tanggal_kembali: '2026-11-18',
              status: 'SELESAI',
              hari_terlambat: 2,
              denda: 2000,
              status_denda: 'BELUM_LUNAS',
              riwayat_koreksi: [],
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_pembayaran: 11,
              nominal_bayar: 3000,
              path_bukti: '/api/pengembalian/pembayaran/11/bukti',
              tipe_berkas: 'image/webp',
              status: 'MENUNGGU VERIFIKASI',
              waktu_unggah: '2026-11-18T10:00:00.000Z',
              rincian: [],
            },
            {
              id_pembayaran: 12,
              nominal_bayar: 2000,
              path_bukti: '/api/pengembalian/pembayaran/12/bukti',
              tipe_berkas: 'image/webp',
              status: 'MENUNGGU VERIFIKASI',
              waktu_unggah: '2026-11-18T10:00:00.000Z',
              rincian: [],
            },
          ],
        })
      )
      // Sync denda gagal
      .mockResolvedValueOnce(
        mockJsonResponse({ success: false, message: 'Gagal sinkron' }, false, 500)
      )
      // Return via form gagal
      .mockResolvedValueOnce(
        mockJsonResponse({ success: false, message: 'Kode tidak valid' }, false, 404)
      )
      // Bulk LUNASI_SEMUA sukses
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: { updated_count: 2, operator: 'LUNASI_SEMUA' },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_pembayaran: 11,
              nominal_bayar: 3000,
              path_bukti: null,
              bukti_token: 'tok-11',
              tipe_berkas: 'image/webp',
              status: 'MENUNGGU VERIFIKASI',
              waktu_unggah: 'not-a-date',
              rincian: [],
            },
          ],
        })
      )
      // ReceiptImage fetch untuk id_pembayaran 11 saat modal dibuka
      .mockResolvedValueOnce(mockJsonResponse({ success: true }))
      // Verifikasi TERVERIFIKASI sukses
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: { id_pembayaran: 11, status: 'TERVERIFIKASI' },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }));

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    expect(await screen.findByText('TRX-TIE-01')).toBeInTheDocument();

    // Sync denda gagal
    fireEvent.click(screen.getByRole('button', { name: 'Sinkronisasi Denda' }));
    expect(await screen.findByText('Gagal sinkron')).toBeInTheDocument();

    // Form return gagal
    fireEvent.change(screen.getByLabelText(/Masukkan Kode Eksemplar/i), {
      target: { value: 'EKS-SALAH' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verifikasi & Kembalikan' }));
    expect(await screen.findByText('Kode tidak valid')).toBeInTheDocument();

    // Buka & tutup modal Koreksi Denda satuan + validasi alasan kosong
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi Denda' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Simpan Koreksi Denda' }).closest('form')
    );
    expect(screen.getByText(/Alasan koreksi denda wajib diisi/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

    // Tab Denda -> Koreksi Denda Massal (validasi, TAMBAH, SUDAH_KEMBALI, lalu LUNASI_SEMUA)
    fireEvent.click(screen.getByRole('button', { name: /Koreksi & Daftar Denda/i }));
    fireEvent.change(screen.getByLabelText('Filter status denda'), {
      target: { value: 'BELUM_LUNAS' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Koreksi Denda Massal/i }));

    fireEvent.change(screen.getByLabelText(/Sasaran Status Pengembalian Buku/i), {
      target: { value: 'SUDAH_KEMBALI' },
    });
    fireEvent.change(screen.getByLabelText(/Operator Penyesuaian Denda/i), {
      target: { value: 'TAMBAH' },
    });
    fireEvent.change(screen.getByLabelText(/Nominal Penambahan/i), {
      target: { value: '0' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: /Terapkan ke/i }).closest('form')
    );
    expect(
      screen.getByText(/Nominal koreksi harus berupa angka lebih dari 0/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Operator Penyesuaian Denda/i), {
      target: { value: 'LUNASI_SEMUA' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: /Terapkan ke/i }).closest('form')
    );
    expect(
      screen.getByText(/Alasan koreksi denda massal wajib diisi/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Alasan Koreksi Denda Massal/i), {
      target: { value: 'Pemutihan denda' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Terapkan ke/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pengembalian/denda/koreksi-massal',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Tab Verifikasi Pembayaran -> Setujui (TERVERIFIKASI)
    fireEvent.click(screen.getByRole('button', { name: /Verifikasi Bukti Pembayaran Denda/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Periksa & Verifikasi' }));
    fireEvent.click(
      screen.getByRole('button', { name: /Verifikasi & Setujui \(Lunas\)/i })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/pengembalian/pembayaran/11/verifikasi',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            status: 'TERVERIFIKASI',
            alasan_penolakan: null,
            reviewed_bukti_token: 'tok-11',
            reviewed_waktu_unggah: 'not-a-date',
          }),
        })
      );
    });
  });

  it('keeps active-return table interactive when payment request fails or returns non-JSON and allows retrying payments', async () => {
    const activeRecord = {
      id_detail: 401,
      id_peminjaman: 41,
      nomor_transaksi: 'TRX-ACTIVE-401',
      kode_eksemplar: 'EKS-401',
      judul: 'Clean Architecture',
      tanggal_pinjam: '2026-11-20',
      tanggal_jatuh_tempo: '2026-11-28',
      status: 'SEDANG_DIPINJAM',
      hari_terlambat: 0,
      denda: 0,
      status_denda: 'TIDAK_ADA',
      anggota: { id_pengguna: 3, pengenal: '2211521001', nama: 'Ahmad Fauzan' },
    };

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockJsonResponse({ success: true, data: [activeRecord] }))
      .mockRejectedValueOnce(new Error('Koneksi pembayaran terputus'))
      // Retry #1: non-JSON response
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      })
      // Retry #2: succeeds
      .mockResolvedValueOnce(
        mockJsonResponse({
          success: true,
          data: [
            {
              id_pembayaran: 88,
              nominal_bayar: 5000,
              path_bukti: '/api/pengembalian/pembayaran/88/bukti',
              status: 'MENUNGGU VERIFIKASI',
              anggota: { pengenal: '2211521001', nama: 'Ahmad Fauzan' },
              rincian: [],
            },
          ],
        })
      );

    render(<PengembalianBuku currentUser={{ pengenal: '198805122014042001' }} />);

    // Tabel pengembalian aktif tetap tampil lengkap dengan tombol aksi
    expect(await screen.findByText('TRX-ACTIVE-401')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proses Kembali' })).toBeInTheDocument();

    // Error pembayaran tampil terpisah beserta tombol retry
    expect(
      await screen.findByText(/Daftar pembayaran denda gagal dimuat: Koneksi pembayaran terputus/i)
    ).toBeInTheDocument();

    // Retry pertama mengembalikan respons non-JSON -> aktif tetap tampil, error diperbarui
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi Pembayaran' }));
    expect(await screen.findByText(/Respons server tidak valid \(HTTP 502\)/i)).toBeInTheDocument();
    expect(screen.getByText('TRX-ACTIVE-401')).toBeInTheDocument();

    // Retry kedua berhasil -> banner error hilang dan daftar pembayaran tampil di tab verifikasi
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi Pembayaran' }));
    await waitFor(() => {
      expect(
        screen.queryByText(/Daftar pembayaran denda gagal dimuat/i)
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Verifikasi Bukti Pembayaran Denda/i }));
    expect(await screen.findByText('Rp 5.000')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
