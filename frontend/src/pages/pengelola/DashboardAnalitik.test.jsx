import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../services/dashboardService.js', () => ({ ambilRingkasan: vi.fn() }));

const { ambilRingkasan } = await import('../../services/dashboardService.js');
const { default: DashboardAnalitik } = await import('./DashboardAnalitik.jsx');
const { default: PengelolaPage } = await import('./index.jsx');

const rapikan = (t) => t.replace(/\s/g, ' ');

// Data uji PRD 04 §5.2
const DATA = {
  koleksi_aktif: 4,
  koleksi_total: 5,
  peminjaman_dipinjam: 6,
  peminjaman_terlambat: 2,
  keterlambatan: { hari_1_7: 1, hari_8_30: 0, lebih_30: 1 },
  denda_belum_lunas: {
    jumlah: 3,
    total_nominal: 10000,
    rincian: {
      belum_dibayar: { jumlah: 2, total_nominal: 8000 },
      menunggu_verifikasi: { jumlah: 1, total_nominal: 2000 },
      lainnya: { jumlah: 0, total_nominal: 0 },
    },
  },
  permintaan_layanan: { Baru: 2, Diproses: 1, Selesai: 3, Ditolak: 1, Lainnya: 0 },
  tanggal_acuan: '2026-11-21',
  dihitung_pada: '2026-11-21T08:49:00.000Z',
};

const NOL = {
  koleksi_aktif: 0,
  koleksi_total: 0,
  peminjaman_dipinjam: 0,
  peminjaman_terlambat: 0,
  keterlambatan: { hari_1_7: 0, hari_8_30: 0, lebih_30: 0 },
  denda_belum_lunas: { jumlah: 0, total_nominal: 0, rincian: {} },
  permintaan_layanan: { Baru: 0, Diproses: 0, Selesai: 0, Ditolak: 0, Lainnya: 0 },
  tanggal_acuan: '2026-11-21',
  dihitung_pada: '2026-11-21T08:49:00.000Z',
};

function kartu(label) {
  return screen.getByText(label, { selector: '.dsb-kpi-label' }).closest('.dsb-kpi');
}

beforeEach(() => {
  vi.resetAllMocks();
  ambilRingkasan.mockResolvedValue(DATA);
});

afterEach(() => {
  cleanup();
});

describe('DashboardAnalitik', () => {
  it('lima indikator tampil sesuai data, dengan konteks dan tanggal acuan', async () => {
    render(<DashboardAnalitik />);

    expect(screen.getByText('Menghitung indikator...')).toBeInTheDocument();
    await screen.findByText(/Data per 21 November 2026, dihitung pukul 15\.49 WIB/);

    expect(within(kartu('Koleksi aktif')).getByText('4')).toBeInTheDocument();
    expect(within(kartu('Koleksi aktif')).getByText('dari 5 koleksi (80%)')).toBeInTheDocument();
    expect(within(kartu('Sedang dipinjam')).getByText('6')).toBeInTheDocument();
    expect(within(kartu('Sedang dipinjam')).getByText('2 di antaranya terlambat (33%)')).toBeInTheDocument();
    expect(within(kartu('Terlambat')).getByText('2')).toBeInTheDocument();
    expect(within(kartu('Denda belum lunas')).getByText('3')).toBeInTheDocument();
    expect(rapikan(within(kartu('Denda belum lunas')).getByText(/^total/).textContent)).toBe('total Rp 10.000');
    expect(within(kartu('Permintaan terbuka')).getByText('3')).toBeInTheDocument();
    expect(within(kartu('Permintaan terbuka')).getByText('dari 7 permintaan')).toBeInTheDocument();
  });

  it('rincian: lama keterlambatan, denda per status (Rupiah), permintaan per status', async () => {
    render(<DashboardAnalitik />);
    await screen.findByText('Lama keterlambatan');

    const keterlambatan = screen.getByRole('region', { name: 'Lama keterlambatan' });
    expect(within(keterlambatan).getByRole('row', { name: /1–7 hari/ })).toHaveTextContent('1');
    expect(within(keterlambatan).getByRole('row', { name: /> 30 hari/ })).toHaveTextContent('50%');

    const denda = screen.getByRole('region', { name: 'Denda belum lunas' });
    const menunggu = within(denda).getByRole('row', { name: /Menunggu verifikasi/ });
    expect(rapikan(menunggu.textContent)).toContain('Rp 2.000');
    expect(within(denda).queryByText('Status lain')).not.toBeInTheDocument();

    const permintaan = screen.getByRole('region', { name: 'Permintaan layanan per status' });
    expect(within(permintaan).getAllByRole('row').map((r) => r.querySelector('th')?.textContent)).toEqual([
      'Kategori',
      'Baru',
      'Diproses',
      'Selesai',
      'Ditolak',
    ]);
  });

  it('panel Perlu perhatian memuat hal yang mendesak', async () => {
    render(<DashboardAnalitik />);
    const panel = await screen.findByRole('region', { name: 'Perlu perhatian' });
    const isi = within(panel).getAllByRole('listitem').map((li) => li.textContent);
    expect(isi).toEqual([
      '1 peminjaman terlambat lebih dari 30 hari',
      '1 peminjaman terlambat 1–30 hari',
      '1 pembayaran denda menunggu verifikasi',
      '2 permintaan layanan baru belum diproses',
    ]);
  });

  it('baris Lainnya dan Status lain hanya muncul jika > 0', async () => {
    ambilRingkasan.mockResolvedValue({
      ...DATA,
      denda_belum_lunas: { ...DATA.denda_belum_lunas, rincian: { ...DATA.denda_belum_lunas.rincian, lainnya: { jumlah: 1, total_nominal: 500 } } },
      permintaan_layanan: { ...DATA.permintaan_layanan, Lainnya: 4 },
    });
    render(<DashboardAnalitik />);
    expect(await screen.findByText('Status lain')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Lainnya/ })).toHaveTextContent('4');
  });

  it('semua nol: tetap tampil 0 dengan label dan catatan "Belum ada data operasional."', async () => {
    ambilRingkasan.mockResolvedValue(NOL);
    render(<DashboardAnalitik />);

    expect(await screen.findByText(/Belum ada data operasional\./)).toBeInTheDocument();
    expect(within(kartu('Koleksi aktif')).getByText('0')).toBeInTheDocument();
    expect(within(kartu('Koleksi aktif')).getByText('dari 0 koleksi (0%)')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada yang perlu ditindaklanjuti saat ini.')).toBeInTheDocument();
  });

  it('error menampilkan pesan dan Coba lagi memanggil service lagi', async () => {
    ambilRingkasan.mockRejectedValueOnce(new Error('Kamu tidak memiliki izin untuk mengakses fungsi ini.'));
    render(<DashboardAnalitik />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Kamu tidak memiliki izin');
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByText('Lama keterlambatan')).toBeInTheDocument();
    expect(ambilRingkasan).toHaveBeenCalledTimes(2);
  });

  it('error tanpa pesan memakai pesan umum', async () => {
    ambilRingkasan.mockRejectedValueOnce({});
    render(<DashboardAnalitik />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Silakan coba lagi.');
  });

  it('Muat ulang memanggil service lagi tanpa menghapus data lama selama memuat', async () => {
    render(<DashboardAnalitik />);
    await screen.findByText('Lama keterlambatan');

    let selesai;
    ambilRingkasan.mockImplementationOnce(() => new Promise((r) => { selesai = r; }));
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));

    expect(screen.getByRole('button', { name: 'Memuat...' })).toBeDisabled();
    expect(screen.getByText('Lama keterlambatan')).toBeInTheDocument();

    selesai({ ...DATA, koleksi_aktif: 5 });
    await waitFor(() => expect(within(kartu('Koleksi aktif')).getByText('5')).toBeInTheDocument());
    expect(ambilRingkasan).toHaveBeenCalledTimes(2);
  });

  it('tidak ada lagi angka atau grafik contoh statis yang lama', async () => {
    render(<PengelolaPage />);
    await screen.findByText('Lama keterlambatan');
    for (const teksLama of [/Total Judul Koleksi/, /judul baru bln ini/, /Top 5/i, /Tren/i, /Kategori Favorit/i]) {
      expect(screen.queryByText(teksLama)).not.toBeInTheDocument();
    }
  });

  it('hasil yang datang setelah halaman ditutup diabaikan', async () => {
    let selesai;
    ambilRingkasan.mockImplementationOnce(() => new Promise((r) => { selesai = r; }));
    const { unmount } = render(<DashboardAnalitik />);
    unmount();
    selesai(DATA);
    await Promise.resolve();
    expect(ambilRingkasan).toHaveBeenCalledTimes(1);
  });

  it('hasil error yang datang setelah halaman ditutup diabaikan', async () => {
    let gagal;
    ambilRingkasan.mockImplementationOnce(() => new Promise((_, rej) => { gagal = rej; }));
    const { unmount } = render(<DashboardAnalitik />);
    unmount();
    gagal(new Error('x'));
    await Promise.resolve();
    expect(ambilRingkasan).toHaveBeenCalledTimes(1);
  });
});
