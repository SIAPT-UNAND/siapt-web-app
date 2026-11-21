import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../services/akunService.js', () => ({
  PERAN_RESMI: ['Anggota', 'Pustakawan', 'Pengelola', 'Admin'],
  daftarAkun: vi.fn(),
  tambahAkun: vi.fn(),
  ubahAkun: vi.fn(),
  ubahStatusAkun: vi.fn(),
  resetKataSandi: vi.fn(),
}));

const service = await import('../../services/akunService.js');
const { default: KelolaAkun } = await import('./KelolaAkun.jsx');

const ADMIN = {
  id_pengguna: 1,
  pengenal: 'ADM-001',
  nama: 'Administrator',
  role: 'Admin',
  status_aktif: true,
  alasan_nonaktif: null,
  dibuat_pada: '2026-11-21T04:10:00.000Z',
};
const ANGGOTA = {
  id_pengguna: 12,
  pengenal: '2311523041',
  nama: 'Rafi',
  role: 'Anggota',
  status_aktif: true,
  alasan_nonaktif: null,
  dibuat_pada: null,
};
const NONAKTIF = {
  id_pengguna: 13,
  pengenal: '2211521009',
  nama: 'Budi',
  role: 'Anggota',
  status_aktif: false,
  alasan_nonaktif: 'Lulus',
  dibuat_pada: '2026-11-01T00:00:00.000Z',
};

function halamanData(items, total = items.length) {
  return { items, total, halaman: 1, per_halaman: 10 };
}

function tampilkan() {
  return render(<KelolaAkun currentUser={{ id: 1, pengenal: 'ADM-001', role: 'Admin' }} />);
}

function isi(label, nilai) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: nilai } });
}

beforeEach(() => {
  vi.resetAllMocks();
  service.daftarAkun.mockResolvedValue(halamanData([ADMIN, ANGGOTA, NONAKTIF]));
});

describe('KelolaAkun', () => {
  it('menampilkan keadaan memuat lalu tabel akun dari API', async () => {
    tampilkan();

    expect(screen.getByText('Memuat daftar akun...')).toBeInTheDocument();
    expect(await screen.findByText('2311523041')).toBeInTheDocument();
    expect(screen.getByText('Lulus')).toBeInTheDocument();
    expect(screen.getAllByText('Nonaktif').length).toBeGreaterThan(0);
    expect(service.daftarAkun).toHaveBeenCalledWith({ q: '', role: '', status: '', halaman: 1, per_halaman: 10 });
  });

  it('menampilkan pesan kosong', async () => {
    service.daftarAkun.mockResolvedValue(halamanData([]));
    tampilkan();
    expect(await screen.findByText('Belum ada akun.')).toBeInTheDocument();
  });

  it('menampilkan error dari server dan tombol Coba lagi', async () => {
    service.daftarAkun.mockRejectedValueOnce(new Error('Silakan login terlebih dahulu.'));
    tampilkan();

    expect(await screen.findByText(/Silakan login terlebih dahulu\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByText('2311523041')).toBeInTheDocument();
    expect(service.daftarAkun).toHaveBeenCalledTimes(2);
  });

  it('memakai pesan umum jika error tanpa pesan', async () => {
    service.daftarAkun.mockRejectedValueOnce({});
    tampilkan();
    expect(await screen.findByText(/Terjadi kesalahan\. Silakan coba lagi\./)).toBeInTheDocument();
  });

  it('cari dan filter memanggil service dengan parameter yang benar', async () => {
    tampilkan();
    await screen.findByText('2311523041');

    isi('Cari pengenal atau nama', '  rafi ');
    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
    await waitFor(() =>
      expect(service.daftarAkun).toHaveBeenLastCalledWith({ q: 'rafi', role: '', status: '', halaman: 1, per_halaman: 10 }),
    );

    isi('Peran', 'Admin');
    await waitFor(() =>
      expect(service.daftarAkun).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'rafi', role: 'Admin' })),
    );

    isi('Status', 'nonaktif');
    await waitFor(() =>
      expect(service.daftarAkun).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'Admin', status: 'nonaktif' })),
    );
  });

  it('paginasi memuat halaman berikutnya dan sebelumnya', async () => {
    service.daftarAkun.mockResolvedValue(halamanData([ANGGOTA], 25));
    tampilkan();

    expect(await screen.findByText('Halaman 1 dari 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
    expect(await screen.findByText('Halaman 2 dari 3')).toBeInTheDocument();
    expect(service.daftarAkun).toHaveBeenLastCalledWith(expect.objectContaining({ halaman: 2 }));

    fireEvent.click(screen.getByRole('button', { name: 'Sebelumnya' }));
    expect(await screen.findByText('Halaman 1 dari 3')).toBeInTheDocument();
  });

  it('tombol Nonaktifkan disabled untuk akun yang sedang dipakai', async () => {
    tampilkan();
    await screen.findByText('2311523041');

    expect(screen.getByRole('button', { name: 'Nonaktifkan ADM-001' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nonaktifkan 2311523041' })).toBeEnabled();
    expect(screen.getByText('Kamu')).toBeInTheDocument();
  });

  describe('tambah akun', () => {
    async function bukaFormTambah() {
      tampilkan();
      await screen.findByText('2311523041');
      fireEvent.click(screen.getByRole('button', { name: 'Tambah Pengguna' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      isi('Peran *', 'Pustakawan');
      isi('Pengenal (NIM / NIP / username) *', '198805122014042009');
      isi('Nama lengkap *', 'Siti');
      isi('Kata sandi awal *', 'rahasia123');
    }

    it('data valid dikirim ke service, notifikasi tampil, daftar dimuat ulang', async () => {
      service.tambahAkun.mockResolvedValue({ id_pengguna: 40 });
      await bukaFormTambah();
      isi('Ulangi kata sandi *', 'rahasia123');

      fireEvent.click(screen.getByRole('button', { name: 'Simpan Pengguna' }));

      expect(await screen.findByText('Akun berhasil ditambahkan.')).toBeInTheDocument();
      expect(service.tambahAkun).toHaveBeenCalledWith({
        pengenal: '198805122014042009',
        nama: 'Siti',
        role: 'Pustakawan',
        kata_sandi: 'rahasia123',
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(service.daftarAkun).toHaveBeenCalledTimes(2));
    });

    it('kata sandi dan ulangi berbeda: service tidak dipanggil', async () => {
      await bukaFormTambah();
      isi('Ulangi kata sandi *', 'beda12345');

      fireEvent.click(screen.getByRole('button', { name: 'Simpan Pengguna' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Ulangi kata sandi tidak sama.');
      expect(service.tambahAkun).not.toHaveBeenCalled();
    });

    it('pesan 409 dari server ditampilkan di form', async () => {
      service.tambahAkun.mockRejectedValue(new Error('Pengenal sudah digunakan.'));
      await bukaFormTambah();
      isi('Ulangi kata sandi *', 'rahasia123');

      fireEvent.click(screen.getByRole('button', { name: 'Simpan Pengguna' }));

      const dialog = screen.getByRole('dialog');
      expect(await within(dialog).findByText('Pengenal sudah digunakan.')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Simpan Pengguna' })).toBeEnabled();
    });

    it('Batal menutup modal', async () => {
      await bukaFormTambah();
      fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('ubah akun mengirim nama dan pengenal', async () => {
    service.ubahAkun.mockResolvedValue({});
    tampilkan();
    await screen.findByText('2311523041');

    fireEvent.click(screen.getByRole('button', { name: 'Ubah 2311523041' }));
    expect(screen.getByLabelText('Pengenal *')).toHaveValue('2311523041');
    isi('Nama lengkap *', 'Rafi Yandra');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    expect(await screen.findByText('Data akun berhasil diperbarui.')).toBeInTheDocument();
    expect(service.ubahAkun).toHaveBeenCalledWith(12, { nama: 'Rafi Yandra', pengenal: '2311523041' });
  });

  it('ubah akun menampilkan error server', async () => {
    service.ubahAkun.mockRejectedValue(new Error('Pengenal sudah digunakan.'));
    tampilkan();
    await screen.findByText('2311523041');

    fireEvent.click(screen.getByRole('button', { name: 'Ubah 2311523041' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    expect(await screen.findByText('Pengenal sudah digunakan.')).toBeInTheDocument();
  });

  it('reset kata sandi: beda ditolak di client, sama dikirim ke service', async () => {
    service.resetKataSandi.mockResolvedValue(null);
    tampilkan();
    await screen.findByText('2311523041');

    fireEvent.click(screen.getByRole('button', { name: 'Reset kata sandi 2311523041' }));
    isi('Kata sandi baru *', 'sandiBaru1');
    isi('Ulangi kata sandi baru *', 'sandiBaru2');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Kata Sandi' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ulangi kata sandi tidak sama.');
    expect(service.resetKataSandi).not.toHaveBeenCalled();

    isi('Ulangi kata sandi baru *', 'sandiBaru1');
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Kata Sandi' }));

    expect(await screen.findByText('Kata sandi berhasil diubah.')).toBeInTheDocument();
    expect(service.resetKataSandi).toHaveBeenCalledWith(12, 'sandiBaru1');
  });

  it('nonaktifkan wajib alasan sebelum tombol aktif', async () => {
    service.ubahStatusAkun.mockResolvedValue({});
    tampilkan();
    await screen.findByText('2311523041');

    fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan 2311523041' }));
    const dialog = screen.getByRole('dialog');
    const tombol = within(dialog).getByRole('button', { name: 'Nonaktifkan' });
    expect(tombol).toBeDisabled();

    isi('Alasan penonaktifan *', 'ab');
    expect(tombol).toBeDisabled();

    isi('Alasan penonaktifan *', '  Lulus kuliah ');
    expect(tombol).toBeEnabled();
    fireEvent.click(tombol);

    expect(await screen.findByText('Akun berhasil dinonaktifkan.')).toBeInTheDocument();
    expect(service.ubahStatusAkun).toHaveBeenCalledWith(12, false, 'Lulus kuliah');
  });

  it('mengaktifkan kembali akun nonaktif', async () => {
    service.ubahStatusAkun.mockResolvedValue({});
    tampilkan();
    await screen.findByText('2211521009');

    fireEvent.click(screen.getByRole('button', { name: 'Aktifkan 2211521009' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aktifkan' }));

    expect(await screen.findByText('Akun berhasil diaktifkan.')).toBeInTheDocument();
    expect(service.ubahStatusAkun).toHaveBeenCalledWith(13, true, null);
  });

  it('error 409 saat ubah status ditampilkan', async () => {
    service.ubahStatusAkun.mockRejectedValue(new Error('Minimal harus ada satu Admin aktif.'));
    tampilkan();
    await screen.findByText('2311523041');

    fireEvent.click(screen.getByRole('button', { name: 'Nonaktifkan 2311523041' }));
    isi('Alasan penonaktifan *', 'Pindah tugas');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nonaktifkan' }));

    expect(await screen.findByText('Minimal harus ada satu Admin aktif.')).toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
});

describe('KelolaAkun: aksesibilitas form dan keadaan kosong', () => {
  it('filter tanpa hasil menampilkan tombol Hapus filter yang mereset semua filter', async () => {
    tampilkan();
    await screen.findByText('2311523041');

    service.daftarAkun.mockResolvedValue(halamanData([]));
    isi('Cari pengenal atau nama', 'zzz');
    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));
    isi('Peran', 'Pengelola');

    fireEvent.click(await screen.findByRole('button', { name: 'Hapus filter' }));

    await waitFor(() =>
      expect(service.daftarAkun).toHaveBeenLastCalledWith({ q: '', role: '', status: '', halaman: 1, per_halaman: 10 }),
    );
    expect(screen.getByLabelText('Cari pengenal atau nama')).toHaveValue('');
    expect(screen.getByLabelText('Peran')).toHaveValue('');
  });

  it('error kata sandi tidak sama tampil di bawah kolomnya dan terhubung lewat aria-describedby', async () => {
    tampilkan();
    await screen.findByText('2311523041');
    fireEvent.click(screen.getByRole('button', { name: 'Tambah Pengguna' }));
    isi('Kata sandi awal *', 'rahasia123');
    isi('Ulangi kata sandi *', 'beda12345');

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Pengguna' }));

    const kolom = screen.getByLabelText('Ulangi kata sandi *');
    expect(kolom).toHaveAttribute('aria-invalid', 'true');
    expect(kolom).toHaveAccessibleDescription('Ulangi kata sandi tidak sama.');
  });
});
