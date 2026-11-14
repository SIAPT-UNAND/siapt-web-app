import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AnggotaPage from './index.jsx';

const currentUser = { pengenal: '2211521001', nama: 'Ahmad Fauzan', role: 'Anggota' };

const KOLEKSI = {
  'KOL-CS-001': { id_koleksi: 1, kode_koleksi: 'KOL-CS-001', judul: 'Clean Code' },
  'KOL-CS-002': { id_koleksi: 2, kode_koleksi: 'KOL-CS-002', judul: 'Refactoring' },
  'KOL-LIT-001': { id_koleksi: 3, kode_koleksi: 'KOL-LIT-001', judul: 'Bumi Manusia' },
};

const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });

// Fetch tiruan: test tidak memanggil backend asli.
// sisaKuota = maks_pinjam (2) - pinjaman aktif di database
const pasangFetch = ({ sisaKuota = 2, stokHabis = [], gagalSaatKonfirmasi = [] } = {}) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
    if (url === '/api/peminjaman/ketentuan') {
      return jsonResponse(200, {
        success: true,
        data: { maks_pinjam: 2, durasi_hari: 14, tarif_denda_per_hari: 500 },
      });
    }

    if (url.startsWith('/api/peminjaman/cek')) {
      const kode = new URL(url, 'http://x').searchParams.get('kode_koleksi');
      if (!KOLEKSI[kode]) return jsonResponse(404, { success: false, message: 'Koleksi tidak ditemukan.' });
      if (stokHabis.includes(kode)) {
        return jsonResponse(422, { success: false, message: 'Stok koleksi ini sedang habis.' });
      }
      return jsonResponse(200, {
        success: true,
        data: {
          koleksi: KOLEKSI[kode],
          lokasi_rak: 'RAK-1',
          eksemplar_tersedia: 1,
          maks_pinjam: 2,
          sisa_kuota: sisaKuota,
        },
      });
    }

    const { kode_koleksi } = JSON.parse(options.body);
    if (gagalSaatKonfirmasi.includes(kode_koleksi)) {
      return jsonResponse(409, { success: false, message: 'Eksemplar baru saja dipinjam orang lain.' });
    }
    return jsonResponse(201, {
      success: true,
      data: {
        id_peminjaman: 9,
        nomor_transaksi: 'TRX-202611-009',
        tanggal_pinjam: '2026-11-14',
        tanggal_jatuh_tempo: '2026-11-28',
        eksemplar: { kode_eksemplar: 'EKS-001-A', lokasi_rak: 'RAK-1' },
      },
    });
  });

const tampilkan = (onAddLoan = vi.fn()) =>
  render(
    <AnggotaPage
      activeMenu="peminjaman-mandiri"
      currentUser={currentUser}
      collections={[]}
      loans={[]}
      onAddLoan={onAddLoan}
    />,
  );

const tambahKode = async (kode) => {
  fireEvent.change(screen.getByLabelText('Kode koleksi'), { target: { value: kode } });
  fireEvent.click(screen.getByRole('button', { name: /Tambahkan/ }));
  // tunggu pengecekan selesai (tombol kembali aktif)
  await screen.findByRole('button', { name: /Tambahkan/ });
};

const tutupPopup = () => fireEvent.click(screen.getByRole('button', { name: 'Mengerti' }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Peminjaman Mandiri', () => {
  beforeEach(() => {
    pasangFetch();
  });

  it('menampilkan ketentuan dari konfigurasi, bukan angka tetap', async () => {
    tampilkan();
    expect(await screen.findByText('2 eksemplar')).toBeInTheDocument();
    expect(screen.getByText('14 hari')).toBeInTheDocument();
    expect(screen.getByText('Rp500/hari')).toBeInTheDocument();
  });

  it('mengecek ke database saat menambah buku dan memakai judul dari database', async () => {
    tampilkan();
    await screen.findByText('2 eksemplar');

    await tambahKode('KOL-CS-001');

    expect(await screen.findByText('"Clean Code" ditambahkan ke keranjang.')).toBeInTheDocument();
    const cek = fetch.mock.calls.find(([url]) => url.startsWith('/api/peminjaman/cek'));
    expect(cek[0]).toBe('/api/peminjaman/cek?kode_koleksi=KOL-CS-001');
    expect(cek[1].headers['x-pengenal']).toBe('2211521001');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('menampilkan bukti peminjaman setelah konfirmasi', async () => {
    const onAddLoan = vi.fn();
    tampilkan(onAddLoan);
    await screen.findByText('2 eksemplar');

    await tambahKode('KOL-CS-001');
    fireEvent.click(await screen.findByRole('button', { name: /Konfirmasi peminjaman/ }));

    expect(await screen.findByText('TRX-202611-009')).toBeInTheDocument();
    expect(screen.getByText('Peminjaman berhasil dicatat')).toBeInTheDocument();
    expect(onAddLoan).toHaveBeenCalledTimes(1);
  });

  it('menampilkan buku yang ditolak saat konfirmasi (mis. keburu dipinjam orang lain)', async () => {
    vi.restoreAllMocks();
    pasangFetch({ gagalSaatKonfirmasi: ['KOL-CS-002'] });
    tampilkan();
    await screen.findByText('2 eksemplar');

    await tambahKode('KOL-CS-001');
    await tambahKode('KOL-CS-002');
    fireEvent.click(screen.getByRole('button', { name: /Konfirmasi peminjaman/ }));

    expect(await screen.findByText('TRX-202611-009')).toBeInTheDocument();
    expect(screen.getByText('Eksemplar baru saja dipinjam orang lain.')).toBeInTheDocument();
  });
});

describe('Popup peringatan saat menambah buku', () => {
  it('stok habis: buku tidak masuk keranjang dan popup muncul', async () => {
    pasangFetch({ stokHabis: ['KOL-CS-001'] });
    tampilkan();
    await screen.findByText('2 eksemplar');

    await tambahKode('KOL-CS-001');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Buku belum bisa dipinjam')).toBeInTheDocument();
    expect(screen.getByText('Stok koleksi ini sedang habis.')).toBeInTheDocument();
    expect(screen.getByText('Keranjang masih kosong')).toBeInTheDocument();

    tutupPopup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('kode tidak ditemukan memunculkan popup', async () => {
    pasangFetch();
    tampilkan();
    await screen.findByText('2 eksemplar');

    await tambahKode('KOL-XXX');
    expect(await screen.findByText('Koleksi tidak ditemukan.')).toBeInTheDocument();
  });

  it('kuota mengikuti pinjaman aktif di database', async () => {
    pasangFetch({ sisaKuota: 1 }); // sudah meminjam 1 dari maksimal 2
    tampilkan();
    await screen.findByText('2 eksemplar');

    await tambahKode('KOL-CS-001');
    await tambahKode('KOL-CS-002');

    expect(await screen.findByText(/Kuota peminjaman kamu tinggal 1 buku/)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('buku yang sama tidak bisa dimasukkan dua kali', async () => {
    pasangFetch();
    tampilkan();
    await screen.findByText('2 eksemplar');

    await tambahKode('KOL-CS-001');
    await tambahKode('KOL-CS-001');

    expect(await screen.findByText('Buku ini sudah ada di keranjang.')).toBeInTheDocument();
  });
});
