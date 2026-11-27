import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../services/dashboardService.js', () => ({
  ambilRingkasan: vi.fn(),
  ambilKoleksi: vi.fn(),
  ambilSirkulasi: vi.fn(),
  ambilDenda: vi.fn(),
  ambilLayanan: vi.fn(),
}));

const svc = await import('../../services/dashboardService.js');
const { default: PengelolaPage } = await import('./index.jsx');
const { default: DashboardKoleksi } = await import('./DashboardKoleksi.jsx');
const { default: DashboardSirkulasi } = await import('./DashboardSirkulasi.jsx');
const { default: DashboardDenda } = await import('./DashboardDenda.jsx');
const { default: DashboardLayanan } = await import('./DashboardLayanan.jsx');

const rapikan = (t) => t.replace(/\s/g, ' ');
const PERIODE = { kode: '30h', label: '30 hari terakhir', satuan: 'hari', mulai: '2026-10-23', akhir: '2026-11-21' };
const PEMBANDING = { kode: '30h-sebelumnya', label: '30 hari sebelumnya', satuan: 'hari', mulai: '2026-09-23', akhir: '2026-10-22' };
const WAKTU = '2026-11-21T08:49:00.000Z';
const TREN = [
  { tanggal: '2026-11-20', jumlah: 1, total_nominal: 2000 },
  { tanggal: '2026-11-21', jumlah: 2, total_nominal: 3000 },
];
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((label, i) => ({ label, jumlah: i === 2 ? 3 : i === 6 ? 1 : 0 }));
const JAM = Array.from({ length: 24 }, (_, j) => ({ label: String(j).padStart(2, '0'), jumlah: j === 13 ? 5 : j === 9 ? 2 : 0 }));

const KOLEKSI = {
  koleksi_aktif: 3,
  koleksi_nonaktif: 1,
  per_kategori: [
    { id_kategori: 1, nama_kategori: 'Komputer', aktif: 2, nonaktif: 1 },
    { id_kategori: 2, nama_kategori: 'Sastra', aktif: 1, nonaktif: 0 },
  ],
  total_eksemplar: 5,
  eksemplar_per_status: [
    { label: 'Tersedia', jumlah: 4 },
    { label: 'Dipinjam', jumlah: 1 },
  ],
  judul_tanpa_eksemplar_tersedia: 1,
  per_dekade: [
    { label: '2000-an', jumlah: 2 },
    { label: '2010-an', jumlah: 1 },
  ],
  per_bahasa: [
    { label: 'Inggris', jumlah: 2 },
    { label: 'Indonesia', jumlah: 1 },
  ],
  dihitung_pada: WAKTU,
};

const SIRKULASI = {
  periode: PERIODE,
  total_peminjaman: 4,
  tren_peminjaman: TREN,
  per_jalur: [
    { label: 'Mandiri', jumlah: 3 },
    { label: 'Loket', jumlah: 1 },
  ],
  rata_lama_pinjam_hari: 9.5,
  jumlah_dikembalikan: 2,
  keterlambatan: { hari_1_7: 1, hari_8_30: 0, lebih_30: 2 },
  top_koleksi: [{ id_koleksi: 1, judul: 'Clean Code', jumlah: 3 }],
  per_hari_minggu: HARI,
  pembanding: { ...PEMBANDING, total_peminjaman: 5 },
  dihitung_pada: WAKTU,
};

const DENDA = {
  periode: PERIODE,
  belum_lunas: {
    belum_dibayar: { jumlah: 2, total_nominal: 8000 },
    menunggu_verifikasi: { jumlah: 1, total_nominal: 2000 },
    lainnya: { jumlah: 0, total_nominal: 0 },
  },
  tren_denda: TREN,
  denda_terbentuk: { jumlah: 3, total_nominal: 5000 },
  pembayaran_per_status: [
    { label: 'Menunggu verifikasi', jumlah: 2, total_nominal: 4000 },
    { label: 'Terverifikasi', jumlah: 1, total_nominal: 2000 },
    { label: 'Ditolak', jumlah: 0, total_nominal: 0 },
  ],
  rata_waktu_verifikasi_jam: 1.5,
  jumlah_diverifikasi: 1,
  koreksi: { jumlah: 1, total_selisih: 1000 },
  denda_per_keterlambatan: [
    { label: '1–3 hari', jumlah: 2, total_nominal: 2000 },
    { label: '4–7 hari', jumlah: 1, total_nominal: 3000 },
    { label: '8–14 hari', jumlah: 0, total_nominal: 0 },
    { label: '> 14 hari', jumlah: 0, total_nominal: 0 },
  ],
  pembanding: { ...PEMBANDING, denda_terbentuk: { jumlah: 3, total_nominal: 4000 }, total_pembayaran: 2 },
  dihitung_pada: WAKTU,
};

const LAYANAN = {
  periode: PERIODE,
  total_permintaan: 3,
  permintaan_per_status: { Baru: 1, Diproses: 1, Selesai: 1, Ditolak: 0, Lainnya: 0 },
  permintaan_per_jenis: [{ label: 'Usulan koleksi', jumlah: 3 }],
  tren_permintaan: TREN,
  chatbot: { total_pertanyaan: 8, gagal_dijawab: 3, persen_gagal: 37.5 },
  top_faq: [{ id_faq: 1, pertanyaan: 'Batas pinjam?', jumlah: 5 }],
  usulan_per_status: [{ label: 'Rencana pengadaan', jumlah: 2 }],
  pertanyaan_per_jam: JAM,
  pembanding: { ...PEMBANDING, total_permintaan: 6, total_pertanyaan_chatbot: 0 },
  dihitung_pada: WAKTU,
};

function kartu(label) {
  return screen.getByText(label, { selector: '.dsb-kpi-label' }).closest('.dsb-kpi');
}

function wilayah(nama) {
  return screen.getByRole('region', { name: nama });
}

beforeEach(() => {
  vi.resetAllMocks();
  svc.ambilRingkasan.mockResolvedValue({
    koleksi_aktif: 0,
    koleksi_total: 0,
    peminjaman_dipinjam: 0,
    peminjaman_terlambat: 0,
    denda_belum_lunas: { jumlah: 0, total_nominal: 0, rincian: {} },
    permintaan_layanan: { Baru: 0, Diproses: 0, Selesai: 0, Ditolak: 0, Lainnya: 0 },
    tanggal_acuan: '2026-11-21',
    dihitung_pada: WAKTU,
  });
  svc.ambilKoleksi.mockResolvedValue(KOLEKSI);
  svc.ambilSirkulasi.mockResolvedValue(SIRKULASI);
  svc.ambilDenda.mockResolvedValue(DENDA);
  svc.ambilLayanan.mockResolvedValue(LAYANAN);
});

afterEach(() => {
  cleanup();
});

describe('PengelolaPage memilih halaman sesuai menu', () => {
  it.each([
    ['dashboard-analitik', 'Dashboard Analitik'],
    [undefined, 'Dashboard Analitik'],
    ['dashboard-koleksi', 'Koleksi & Inventaris'],
    ['dashboard-sirkulasi', 'Sirkulasi'],
    ['dashboard-denda', 'Denda & Pembayaran'],
    ['dashboard-layanan', 'Layanan & Chatbot'],
  ])('menu %s → %s', async (menu, judul) => {
    render(<PengelolaPage activeMenu={menu} />);
    expect(screen.getByRole('heading', { level: 2, name: judul })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Menghitung indikator...')).not.toBeInTheDocument());
  });
});

describe('DashboardKoleksi', () => {
  it('kartu angka, kategori, komposisi eksemplar, distribusi tahun terbit dan bahasa', async () => {
    render(<DashboardKoleksi />);
    expect(await screen.findByText('Kondisi saat ini, dihitung pukul 15.49 WIB')).toBeInTheDocument();
    expect(within(kartu('Koleksi aktif')).getByText('dari 4 judul (75%)')).toBeInTheDocument();
    expect(within(kartu('Eksemplar tersedia')).getByText('dari 5 eksemplar (80%)')).toBeInTheDocument();
    expect(within(kartu('Judul tanpa eksemplar tersedia')).getByText('Anggota belum bisa meminjam judul ini')).toBeInTheDocument();
    expect(within(wilayah('Koleksi aktif per kategori')).getByRole('row', { name: /Komputer/ })).toHaveTextContent('1 nonaktif');
    expect(within(wilayah('Koleksi aktif per kategori')).getByRole('row', { name: /Sastra/ })).not.toHaveTextContent('nonaktif');
    expect(within(wilayah('Komposisi status eksemplar')).getByRole('row', { name: /Tersedia/ })).toHaveTextContent('480%');
    expect(within(wilayah('Koleksi aktif per tahun terbit')).getByRole('row', { name: /2000-an/ })).toHaveTextContent('2');
    expect(within(wilayah('Koleksi aktif per bahasa')).getByRole('row', { name: /Inggris/ })).toHaveTextContent('2');
  });

  it('tanpa eksemplar dan tanpa data distribusi', async () => {
    svc.ambilKoleksi.mockResolvedValue({
      ...KOLEKSI,
      eksemplar_per_status: [],
      total_eksemplar: 0,
      judul_tanpa_eksemplar_tersedia: 0,
      per_dekade: undefined,
      per_bahasa: undefined,
    });
    render(<DashboardKoleksi />);
    expect(await screen.findByText('Semua judul aktif bisa dipinjam')).toBeInTheDocument();
    expect(within(wilayah('Komposisi status eksemplar')).getByText('Belum ada data.')).toBeInTheDocument();
    expect(screen.getAllByText('Belum ada koleksi aktif.')).toHaveLength(2);
  });

  it('error lalu Coba lagi memuat ulang', async () => {
    svc.ambilKoleksi.mockRejectedValueOnce(new Error('Server sibuk.'));
    render(<DashboardKoleksi />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Server sibuk.');
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(await screen.findByText('Koleksi aktif per kategori')).toBeInTheDocument();
    expect(svc.ambilKoleksi).toHaveBeenCalledTimes(2);
  });

  it('error tanpa pesan memakai pesan umum', async () => {
    svc.ambilKoleksi.mockRejectedValueOnce({});
    render(<DashboardKoleksi />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Silakan coba lagi.');
  });
});

describe('DashboardSirkulasi', () => {
  it('kartu dengan perubahan, tren, pola hari, jalur, keterlambatan, top koleksi; ganti periode', async () => {
    render(<DashboardSirkulasi />);
    expect(await screen.findByText('30 hari terakhir (2026-10-23 s.d. 2026-11-21), dihitung pukul 15.49 WIB')).toBeInTheDocument();
    expect(svc.ambilSirkulasi).toHaveBeenCalledWith('30h');
    expect(within(kartu('Transaksi peminjaman')).getByText(/turun 20% dari 30 hari sebelumnya \(5\)/)).toBeInTheDocument();
    expect(within(kartu('Rata-rata lama pinjam')).getByText('9,5 hari')).toBeInTheDocument();
    expect(within(kartu('Peminjaman mandiri')).getByText('75%')).toBeInTheDocument();
    expect(within(kartu('Terlambat saat ini')).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Tren peminjaman: total 3 transaksi/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Peminjaman per hari dalam seminggu: total 4 transaksi, tertinggi 3 pada Rab.' })).toBeInTheDocument();
    expect(wilayah('5 koleksi paling sering dipinjam')).toHaveTextContent('Clean Code');

    fireEvent.click(screen.getByRole('button', { name: '7 hari' }));
    await waitFor(() => expect(svc.ambilSirkulasi).toHaveBeenLastCalledWith('7h'));
  });

  it('data kosong: rata-rata "-", tanpa pembanding dan pola hari', async () => {
    svc.ambilSirkulasi.mockResolvedValue({
      ...SIRKULASI,
      rata_lama_pinjam_hari: null,
      per_jalur: [],
      total_peminjaman: 0,
      top_koleksi: [],
      per_hari_minggu: undefined,
      pembanding: undefined,
    });
    render(<DashboardSirkulasi />);
    await screen.findByText('Peminjaman per jalur');
    expect(within(kartu('Rata-rata lama pinjam')).getByText('-')).toBeInTheDocument();
    expect(kartu('Transaksi peminjaman').querySelector('.dsb-kpi-delta')).toBeNull();
    expect(screen.getAllByText('Belum ada peminjaman pada periode ini.')).toHaveLength(2);
  });
});

describe('DashboardDenda', () => {
  it('kartu (Rupiah, jam, perubahan), tren, komposisi pembayaran, belum lunas, per lama keterlambatan', async () => {
    render(<DashboardDenda />);
    await screen.findByText('Komposisi pembayaran');
    expect(rapikan(within(kartu('Denda belum lunas')).getByText(/^total/).textContent)).toBe('total Rp 10.000');
    expect(within(kartu('Denda terbentuk')).getByText(/sama dengan 30 hari sebelumnya \(3\)/)).toBeInTheDocument();
    expect(within(kartu('Pembayaran menunggu')).getByText('dari 3 bukti diunggah')).toBeInTheDocument();
    expect(within(kartu('Rata-rata waktu verifikasi')).getByText('1,5 jam')).toBeInTheDocument();
    expect(rapikan(within(kartu('Koreksi denda')).getByText(/selisih/).textContent)).toBe('selisih Rp 1.000');
    const terverifikasi = within(wilayah('Komposisi pembayaran')).getByRole('row', { name: /Terverifikasi/ });
    expect(rapikan(terverifikasi.textContent)).toContain('33% · Rp 2.000');
    expect(rapikan(within(wilayah('Denda per lama keterlambatan')).getByRole('row', { name: /4–7 hari/ }).textContent)).toContain('Rp 3.000');
    expect(screen.queryByText('Status lain')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '90 hari' }));
    await waitFor(() => expect(svc.ambilDenda).toHaveBeenLastCalledWith('90h'));
  });

  it('status lain, waktu verifikasi kosong, tanpa pembanding dan distribusi', async () => {
    svc.ambilDenda.mockResolvedValue({
      ...DENDA,
      rata_waktu_verifikasi_jam: null,
      belum_lunas: { ...DENDA.belum_lunas, lainnya: { jumlah: 1, total_nominal: 500 } },
      pembayaran_per_status: [{ label: 'Terverifikasi', jumlah: 1, total_nominal: 2000 }],
      denda_per_keterlambatan: undefined,
      pembanding: undefined,
    });
    render(<DashboardDenda />);
    expect(await screen.findByText('Status lain')).toBeInTheDocument();
    expect(within(kartu('Rata-rata waktu verifikasi')).getByText('-')).toBeInTheDocument();
    expect(within(kartu('Pembayaran menunggu')).getByText('0')).toBeInTheDocument();
    expect(within(wilayah('Denda per lama keterlambatan')).getByText('Belum ada data.')).toBeInTheDocument();
  });

  it('tooltip tren denda memuat nominal Rupiah', async () => {
    const { container } = render(<DashboardDenda />);
    await screen.findByText('Komposisi pembayaran');
    fireEvent.mouseEnter(container.querySelectorAll('.dsb-tren-hit')[1]);
    expect(rapikan(screen.getByRole('status').textContent)).toContain('Rp 3.000');
  });
});

describe('DashboardLayanan', () => {
  it('kartu dengan perubahan, komposisi status dan jawaban chatbot, jam sibuk, jenis, usulan, top FAQ', async () => {
    render(<DashboardLayanan />);
    await screen.findByText('Komposisi status permintaan');
    expect(within(kartu('Permintaan masuk')).getByText(/turun 50% dari 30 hari sebelumnya \(6\)/)).toBeInTheDocument();
    expect(within(kartu('Pertanyaan chatbot')).getByText(/naik dari 0 pada 30 hari sebelumnya/)).toBeInTheDocument();
    expect(within(kartu('Permintaan terbuka')).getByText('1 baru, 1 diproses')).toBeInTheDocument();
    expect(within(kartu('Chatbot gagal menjawab')).getByText('37,5%')).toBeInTheDocument();
    expect(within(kartu('Usulan koleksi')).getByText('2')).toBeInTheDocument();
    expect(within(wilayah('Jawaban chatbot')).getByRole('row', { name: /Terjawab dari FAQ/ })).toHaveTextContent('563%');
    expect(within(wilayah('Jawaban chatbot')).getByRole('row', { name: /Gagal dijawab/ })).toHaveTextContent('338%');
    expect(within(wilayah('Komposisi status permintaan')).queryByText('Lainnya')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Pertanyaan chatbot per jam: total 7 pertanyaan, tertinggi 5 pada 13.' })).toBeInTheDocument();
    expect(wilayah('5 FAQ yang paling sering dipakai chatbot')).toHaveTextContent('Batas pinjam?');

    fireEvent.click(screen.getByRole('button', { name: 'Bulan ini' }));
    await waitFor(() => expect(svc.ambilLayanan).toHaveBeenLastCalledWith('bulan'));
  });

  it('Lainnya muncul jika ada status di luar empat status resmi; data kosong lainnya', async () => {
    svc.ambilLayanan.mockResolvedValue({
      ...LAYANAN,
      permintaan_per_status: { ...LAYANAN.permintaan_per_status, Lainnya: 4 },
      top_faq: [],
      usulan_per_status: [],
      permintaan_per_jenis: [],
      pertanyaan_per_jam: undefined,
      pembanding: undefined,
    });
    render(<DashboardLayanan />);
    await screen.findByText('Komposisi status permintaan');
    expect(within(wilayah('Komposisi status permintaan')).getByText('Lainnya')).toBeInTheDocument();
    expect(screen.getByText('Belum ada usulan koleksi.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada pertanyaan yang cocok dengan FAQ pada periode ini.')).toBeInTheDocument();
    expect(within(wilayah('Pertanyaan chatbot per jam')).getByText('Belum ada data pada periode ini.')).toBeInTheDocument();
  });
});
