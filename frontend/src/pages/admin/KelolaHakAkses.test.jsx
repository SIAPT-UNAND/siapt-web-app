import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../services/akunService.js', () => ({
  PERAN_RESMI: ['Anggota', 'Pustakawan', 'Pengelola', 'Admin'],
  daftarAkun: vi.fn(),
  daftarPeran: vi.fn(),
  ubahPeran: vi.fn(),
}));

const service = await import('../../services/akunService.js');
const { default: KelolaHakAkses } = await import('./KelolaHakAkses.jsx');

const AKUN = [
  { id_pengguna: 1, pengenal: 'ADM-001', nama: 'Administrator', role: 'Admin', status_aktif: true },
  { id_pengguna: 12, pengenal: '2311523041', nama: 'Rafi', role: 'Anggota', status_aktif: true },
  { id_pengguna: 13, pengenal: '2211521009', nama: null, role: 'Anggota', status_aktif: false },
];
const PERAN = [
  { id_role: 1, nama_role: 'Admin' },
  { id_role: 9, nama_role: 'Auditor' },
  { id_role: 2, nama_role: 'Pustakawan' },
  { id_role: 3, nama_role: 'Anggota' },
  { id_role: 4, nama_role: 'Pengelola' },
];

function tampilkan() {
  return render(<KelolaHakAkses currentUser={{ id: 1, pengenal: 'ADM-001', role: 'Admin' }} />);
}

async function bukaUbahPeranRafi() {
  tampilkan();
  await screen.findByText('2311523041');
  fireEvent.click(screen.getByRole('button', { name: 'Ubah peran 2311523041' }));
  return screen.getByRole('dialog');
}

beforeEach(() => {
  vi.resetAllMocks();
  service.daftarAkun.mockResolvedValue({ items: AKUN, total: 3, halaman: 1, per_halaman: 10 });
  service.daftarPeran.mockResolvedValue(PERAN);
});

describe('KelolaHakAkses', () => {
  it('menampilkan daftar akun beserta perannya dan teks bantuan', async () => {
    tampilkan();

    expect(screen.getByText('Memuat daftar akun...')).toBeInTheDocument();
    expect(await screen.findByText('2311523041')).toBeInTheDocument();
    expect(screen.getAllByText('Anggota').length).toBe(2);
    expect(screen.getByText('Nonaktif')).toBeInTheDocument();
    expect(screen.getByText(/tidak dapat diubah di aplikasi/)).toBeInTheDocument();
    expect(service.daftarAkun).toHaveBeenCalledWith({ q: '', halaman: 1, per_halaman: 10 });
  });

  it('akun sendiri tidak dapat diubah perannya', async () => {
    tampilkan();
    await screen.findByText('2311523041');

    expect(screen.getByRole('button', { name: 'Ubah peran ADM-001' })).toBeDisabled();
    expect(screen.getByText('Peran akunmu sendiri tidak dapat diubah.')).toBeInTheDocument();
  });

  it('pilihan peran mengikuti urutan resmi, peran lain di akhir', async () => {
    const dialog = await bukaUbahPeranRafi();
    const pilihan = within(dialog).getAllByRole('radio').map((r) => r.value);
    expect(pilihan).toEqual(['Anggota', 'Pustakawan', 'Pengelola', 'Admin', 'Auditor']);
    expect(within(dialog).getByRole('radio', { name: 'Anggota' })).toBeChecked();
    expect(within(dialog).getByRole('button', { name: 'Simpan' })).toBeDisabled();
  });

  it('pilih peran baru → konfirmasi → ubahPeran dipanggil dan notifikasi tampil', async () => {
    service.ubahPeran.mockResolvedValue({});
    const dialog = await bukaUbahPeranRafi();

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Pustakawan' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));

    expect(within(dialog).getByText(/Ubah peran/)).toHaveTextContent('Ubah peran Rafi dari Anggota menjadi Pustakawan?');
    expect(service.ubahPeran).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, ubah peran' }));

    expect(await screen.findByText('Peran 2311523041 berhasil diubah menjadi Pustakawan.')).toBeInTheDocument();
    expect(service.ubahPeran).toHaveBeenCalledWith(12, 'Pustakawan');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(service.daftarAkun).toHaveBeenCalledTimes(2));
  });

  it('Kembali dari konfirmasi tidak memanggil service', async () => {
    const dialog = await bukaUbahPeranRafi();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Admin' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kembali' }));

    expect(within(dialog).getByRole('radio', { name: 'Admin' })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(service.ubahPeran).not.toHaveBeenCalled();
  });

  it.each([
    ['400', 'Peran tidak dikenal.'],
    ['409', 'Minimal harus ada satu Admin aktif.'],
  ])('error %s dari server ditampilkan', async (_kode, pesan) => {
    service.ubahPeran.mockRejectedValue(new Error(pesan));
    const dialog = await bukaUbahPeranRafi();

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Pengelola' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, ubah peran' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(pesan);
  });

  it('memakai nama pengenal jika nama kosong', async () => {
    tampilkan();
    await screen.findByText('2211521009');
    fireEvent.click(screen.getByRole('button', { name: 'Ubah peran 2211521009' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Pustakawan' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    expect(within(dialog).getByText(/Ubah peran/)).toHaveTextContent('Ubah peran 2211521009 dari Anggota');
  });

  it('pencarian memanggil service dengan q', async () => {
    tampilkan();
    await screen.findByText('2311523041');

    fireEvent.change(screen.getByLabelText('Cari pengenal atau nama'), { target: { value: ' siti ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    await waitFor(() =>
      expect(service.daftarAkun).toHaveBeenLastCalledWith({ q: 'siti', halaman: 1, per_halaman: 10 }),
    );
  });

  it('kosong dan error + Coba lagi', async () => {
    service.daftarAkun.mockRejectedValueOnce(new Error('Kamu tidak memiliki izin untuk mengakses fungsi ini.'));
    service.daftarAkun.mockResolvedValueOnce({ items: [], total: 0, halaman: 1, per_halaman: 10 });
    tampilkan();

    expect(await screen.findByText(/tidak memiliki izin/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Belum ada akun.')).toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
});

describe('KelolaHakAkses: keadaan kosong', () => {
  it('pencarian tanpa hasil menampilkan tombol Hapus pencarian', async () => {
    tampilkan();
    await screen.findByText('2311523041');

    service.daftarAkun.mockResolvedValue({ items: [], total: 0, halaman: 1, per_halaman: 10 });
    fireEvent.change(screen.getByLabelText('Cari pengenal atau nama'), { target: { value: 'zzz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    expect(await screen.findByText('Tidak ada akun yang cocok dengan pencarian.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hapus pencarian' }));

    await waitFor(() =>
      expect(service.daftarAkun).toHaveBeenLastCalledWith({ q: '', halaman: 1, per_halaman: 10 }),
    );
    expect(screen.getByLabelText('Cari pengenal atau nama')).toHaveValue('');
  });
});

describe('KelolaHakAkses: peran yang belum ada di database', () => {
  it('Pengelola tetap tampil tetapi tidak bisa dipilih jika belum ada di tabel role', async () => {
    service.daftarPeran.mockResolvedValue(PERAN.filter((p) => p.nama_role !== 'Pengelola'));
    const dialog = await bukaUbahPeranRafi();

    const pengelola = within(dialog).getByRole('radio', { name: 'Pengelola' });
    expect(pengelola).toBeDisabled();
    expect(within(dialog).getByText(/Belum tersedia di database/)).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: 'Pustakawan' })).toBeEnabled();
  });
});
