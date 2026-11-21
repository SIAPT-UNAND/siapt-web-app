import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../services/akunService.js', () => ({
  PERAN_RESMI: ['Anggota', 'Pustakawan', 'Pengelola', 'Admin'],
  daftarAkun: vi.fn(),
  daftarPeran: vi.fn(),
}));

const service = await import('../../services/akunService.js');
const { default: AdminPage } = await import('./index.jsx');
const { default: Sidebar } = await import('../../components/Sidebar.jsx');
const { formatTanggal, hitungTotalHalaman, keadaanMuat, kelasPeran, pesanDari } = await import('./adminUtils.js');
const { Notifikasi } = await import('./AdminUI.jsx');

beforeEach(() => {
  vi.resetAllMocks();
  service.daftarAkun.mockResolvedValue({ items: [], total: 0, halaman: 1, per_halaman: 10 });
  service.daftarPeran.mockResolvedValue([]);
});

describe('menu Admin', () => {
  it('Sidebar Admin memuat menu Hak Akses dan dapat dipilih', () => {
    const onSelectMenu = vi.fn();
    render(<Sidebar role="Admin" activeMenu="home" onSelectMenu={onSelectMenu} isOpen={false} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Hak Akses/ }));
    expect(onSelectMenu).toHaveBeenCalledWith('kelola-hak-akses');
  });

  it('Beranda menampilkan akun terbaru, akun nonaktif, dan tautan Kelola akun', async () => {
    const onSelectMenu = vi.fn();
    service.daftarAkun.mockImplementation(async ({ status }) => {
      if (status === 'nonaktif') {
        return { items: [{ id_pengguna: 9, pengenal: 'lulus01', nama: 'Budi', role: 'Anggota', status_aktif: false, alasan_nonaktif: 'Lulus' }], total: 1 };
      }
      if (status === 'aktif') return { items: [], total: 2 };
      return {
        items: [{ id_pengguna: 3, pengenal: 'baru01', nama: 'Siti', role: 'Pustakawan', status_aktif: true, dibuat_pada: '2026-11-21T04:10:00.000Z' }],
        total: 3,
      };
    });
    render(<AdminPage activeMenu="home" onSelectMenu={onSelectMenu} configurations={[]} />);

    expect(screen.getAllByText('Memuat...')).toHaveLength(2);
    expect(await screen.findByText('baru01')).toBeInTheDocument();
    expect(screen.getByText('Lulus')).toBeInTheDocument();
    expect(service.daftarAkun).toHaveBeenCalledWith({ per_halaman: 5 });
    expect(service.daftarAkun).toHaveBeenCalledWith({ status: 'nonaktif', per_halaman: 5 });

    fireEvent.click(screen.getByRole('button', { name: 'Kelola akun' }));
    expect(onSelectMenu).toHaveBeenCalledWith('kelola-akun');
  });

  it('Beranda: daftar kosong dan tautan aman tanpa onSelectMenu', async () => {
    render(<AdminPage activeMenu="home" configurations={[]} />);
    expect(await screen.findByLabelText('Total akun: 0')).toBeInTheDocument();
    expect(screen.getByText('Belum ada akun.')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada akun nonaktif.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kelola akun' }));
    expect(screen.getByText('Beranda Administrator')).toBeInTheDocument();
  });

  it('Beranda menampilkan ringkasan jumlah akun dari API', async () => {
    service.daftarAkun.mockImplementation(async ({ status }) => {
      const total = { aktif: 30, nonaktif: 7 }[status] ?? 37;
      return { items: [], total, halaman: 1, per_halaman: 1 };
    });
    render(<AdminPage activeMenu="home" currentUser={{ nama: 'Admin Demo' }} configurations={[]} />);

    expect(screen.getByLabelText('Total akun: …')).toBeInTheDocument();
    expect(await screen.findByLabelText('Total akun: 37')).toBeInTheDocument();
    expect(screen.getByLabelText('Aktif: 30')).toBeInTheDocument();
    expect(screen.getByLabelText('Nonaktif: 7')).toBeInTheDocument();
    expect(service.daftarAkun).toHaveBeenCalledWith({ status: 'aktif', per_halaman: 1 });
  });

  it('Beranda menampilkan "-" jika ringkasan gagal dimuat', async () => {
    service.daftarAkun.mockRejectedValue(new Error('Gagal'));
    render(<AdminPage activeMenu="home" configurations={[]} />);
    expect(await screen.findByLabelText('Total akun: -')).toBeInTheDocument();
    expect(screen.getAllByText(/Data tidak dapat dimuat/)).toHaveLength(2);
  });

  it.each([
    ['kelola-akun', 'Kelola Akun Pengguna'],
    ['kelola-hak-akses', 'Pengaturan Hak Akses'],
  ])('menu %s merender halamannya', async (menu, judul) => {
    render(<AdminPage activeMenu={menu} currentUser={{ pengenal: 'ADM-001' }} configurations={[]} />);
    expect(screen.getByRole('heading', { name: judul })).toBeInTheDocument();
    expect(await screen.findByText('Belum ada akun.')).toBeInTheDocument();
  });
});

describe('adminUtils', () => {
  it('pesanDari memakai pesan error atau pesan umum', () => {
    expect(pesanDari(new Error('Gagal X'))).toBe('Gagal X');
    expect(pesanDari(null)).toBe('Terjadi kesalahan. Silakan coba lagi.');
  });

  it('hitungTotalHalaman minimal 1', () => {
    expect(hitungTotalHalaman(0, 10)).toBe(1);
    expect(hitungTotalHalaman(undefined, 10)).toBe(1);
    expect(hitungTotalHalaman(21, 10)).toBe(3);
  });

  it('formatTanggal menangani nilai kosong dan tidak valid', () => {
    expect(formatTanggal(null)).toBe('-');
    expect(formatTanggal('bukan tanggal')).toBe('-');
    expect(formatTanggal('2026-11-21T04:10:00.000Z')).toMatch(/2026/);
  });

  it('kelasPeran menurunkan huruf dan aman untuk null', () => {
    expect(kelasPeran('Pustakawan')).toBe('role-pill role-pustakawan');
    expect(kelasPeran(null)).toBe('role-pill role-');
  });


  it('keadaanMuat', () => {
    expect(keadaanMuat({ kunci: 'a', error: '' }, 'b')).toBe('memuat');
    expect(keadaanMuat({ kunci: 'a', error: 'x' }, 'a')).toBe('error');
    expect(keadaanMuat({ kunci: 'a', error: '' }, 'a')).toBe('siap');
  });
});

afterEach(() => {
  cleanup();
});

describe('Notifikasi', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hilang sendiri setelah beberapa detik', () => {
    vi.useFakeTimers();
    const onTutup = vi.fn();
    render(<Notifikasi pesan="Tersimpan." onTutup={onTutup} />);

    expect(screen.getByRole('status')).toHaveTextContent('Tersimpan.');
    vi.advanceTimersByTime(4000);
    expect(onTutup).toHaveBeenCalledWith('');
  });

  it('tidak merender apa pun jika pesan kosong', () => {
    const { container } = render(<Notifikasi pesan="" onTutup={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Beranda Admin: pindah halaman sebelum data selesai', () => {
  it.each([
    ['berhasil', (r) => r.resolve({ items: [], total: 5 })],
    ['gagal', (r) => r.reject(new Error('Gagal'))],
  ])('hasil %s yang datang terlambat diabaikan tanpa error', async (_nama, selesaikan) => {
    const tertunda = [];
    service.daftarAkun.mockImplementation(
      () => new Promise((resolve, reject) => tertunda.push({ resolve, reject })),
    );
    const { unmount } = render(<AdminPage activeMenu="home" configurations={[]} />);
    unmount();

    tertunda.forEach(selesaikan);
    await Promise.allSettled(tertunda.map(() => Promise.resolve()));
    expect(service.daftarAkun).toHaveBeenCalledTimes(3);
  });
});
