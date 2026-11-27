import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('../../services/konfigurasiService.js', () => ({
  daftarKonfigurasi: vi.fn(),
  ubahKonfigurasi: vi.fn(),
  riwayatKonfigurasi: vi.fn(),
}));

const service = await import('../../services/konfigurasiService.js');
const { default: KelolaKonfigurasi } = await import('./KelolaKonfigurasi.jsx');

const DURASI = {
  kunci_parameter: 'durasi_pinjam_hari',
  label: 'Durasi peminjaman',
  deskripsi: 'Jumlah hari sampai jatuh tempo.',
  nilai: '7',
  tipe_data: 'number',
  satuan: 'hari',
  nilai_min: '1',
  nilai_maks: '30',
  wajib: true,
};
const TARIF = {
  kunci_parameter: 'tarif_denda_per_hari',
  label: 'Tarif denda per hari',
  deskripsi: '',
  nilai: '1000',
  tipe_data: 'decimal',
  satuan: 'rupiah',
  nilai_min: '500',
  nilai_maks: '10000',
  wajib: true,
};
const CHATBOT = { kunci_parameter: 'chatbot_aktif', label: 'Chatbot aktif', deskripsi: '', nilai: 'true', tipe_data: 'boolean' };
const TEKS = { kunci_parameter: 'info_rekening', label: 'info_rekening', deskripsi: '', nilai: 'BNI', tipe_data: null };
const LOG = {
  id_log: 3,
  kunci_parameter: 'durasi_pinjam_hari',
  label: 'Durasi peminjaman',
  nilai_lama: '7',
  nilai_baru: '14',
  waktu: '2026-11-23T03:00:00.000Z',
  pengubah: { id_pengguna: 1, nama: 'Admin Demo', pengenal: 'admin01' },
};

const rapikan = (teks) => teks.replace(/\s/g, ' ');

beforeEach(() => {
  vi.resetAllMocks();
  service.daftarKonfigurasi.mockResolvedValue([DURASI, TARIF, CHATBOT, TEKS]);
  service.riwayatKonfigurasi.mockResolvedValue([LOG]);
});

afterEach(() => {
  cleanup();
});

async function bukaUbah(label) {
  render(<KelolaKonfigurasi />);
  await screen.findByText('durasi_pinjam_hari');
  fireEvent.click(screen.getByRole('button', { name: `Ubah nilai ${label}` }));
  return screen.getByRole('dialog');
}

describe('KelolaKonfigurasi: daftar dan riwayat', () => {
  it('menampilkan parameter dengan label, nilai bersatuan, rentang, dan riwayat', async () => {
    render(<KelolaKonfigurasi />);

    expect(screen.getByText('Memuat parameter...')).toBeInTheDocument();
    expect(await screen.findByText('durasi_pinjam_hari')).toBeInTheDocument();
    expect(screen.getAllByText('Durasi peminjaman').length).toBeGreaterThan(0);
    const tabelParameter = within(screen.getAllByRole('table')[0]);
    expect(tabelParameter.getByText('7 hari')).toBeInTheDocument();
    expect(tabelParameter.getByText('1–30 hari')).toBeInTheDocument();
    expect(tabelParameter.getByText((t) => rapikan(t) === 'Rp 1.000')).toBeInTheDocument();
    expect(tabelParameter.getByText('Aktif / Nonaktif')).toBeInTheDocument();

    expect(await screen.findByText('Admin Demo')).toBeInTheDocument();
    const tabelRiwayat = within(screen.getAllByRole('table')[1]);
    expect(tabelRiwayat.getByText('7 hari')).toBeInTheDocument();
    expect(tabelRiwayat.getByText('14 hari')).toBeInTheDocument();
    expect(service.riwayatKonfigurasi).toHaveBeenCalledWith({ kunci: '', batas: 20 });
  });

  it('filter riwayat per parameter', async () => {
    render(<KelolaKonfigurasi />);
    await screen.findByText('durasi_pinjam_hari');

    fireEvent.change(screen.getByLabelText('Filter parameter'), { target: { value: 'tarif_denda_per_hari' } });

    await waitFor(() =>
      expect(service.riwayatKonfigurasi).toHaveBeenLastCalledWith({ kunci: 'tarif_denda_per_hari', batas: 20 }),
    );
  });

  it('riwayat kosong dan log untuk parameter yang tidak ada di daftar', async () => {
    service.riwayatKonfigurasi.mockResolvedValueOnce([]);
    render(<KelolaKonfigurasi />);
    expect(await screen.findByText('Belum ada perubahan yang tercatat.')).toBeInTheDocument();
  });

  it('log parameter lain tetap tampil dengan nilai mentah', async () => {
    service.riwayatKonfigurasi.mockResolvedValue([
      { ...LOG, id_log: 9, kunci_parameter: 'lama', label: 'lama', nilai_lama: null, nilai_baru: 'x', pengubah: null },
    ]);
    render(<KelolaKonfigurasi />);
    expect(await screen.findByText('lama')).toBeInTheDocument();
  });

  it('error daftar dan riwayat menampilkan Coba lagi', async () => {
    service.daftarKonfigurasi.mockRejectedValueOnce(new Error('Silakan login terlebih dahulu.'));
    service.riwayatKonfigurasi.mockRejectedValueOnce(new Error('Gagal memuat riwayat.'));
    render(<KelolaKonfigurasi />);

    expect(await screen.findByText('Silakan login terlebih dahulu.')).toBeInTheDocument();
    expect(screen.getByText('Gagal memuat riwayat.')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Coba lagi' })[0]);
    expect(await screen.findByText('durasi_pinjam_hari')).toBeInTheDocument();
  });

  it('daftar kosong', async () => {
    service.daftarKonfigurasi.mockResolvedValueOnce([]);
    render(<KelolaKonfigurasi />);
    expect(await screen.findByText('Belum ada parameter konfigurasi.')).toBeInTheDocument();
  });
});

describe('KelolaKonfigurasi: ubah nilai', () => {
  it('input bilangan bulat memakai step 1 dan menampilkan rentang serta catatan BR-10', async () => {
    const dialog = await bukaUbah('Durasi peminjaman');
    const input = within(dialog).getByLabelText('Nilai baru (hari) *');

    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('step', '1');
    expect(input).toHaveValue(7);
    expect(input).toHaveAccessibleDescription('Rentang valid: 1–30 hari');
    expect(within(dialog).getByText(/tidak dihitung ulang/)).toBeInTheDocument();
  });

  it('nilai di luar rentang ditolak di browser tanpa memanggil service', async () => {
    const dialog = await bukaUbah('Durasi peminjaman');
    const input = within(dialog).getByLabelText('Nilai baru (hari) *');

    fireEvent.change(input, { target: { value: '31' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Nilai harus dalam rentang 1–30 hari.');
    expect(service.ubahKonfigurasi).not.toHaveBeenCalled();
  });

  it('nilai valid disimpan, notifikasi tampil, daftar dan riwayat dimuat ulang', async () => {
    service.ubahKonfigurasi.mockResolvedValue({ parameter: { ...DURASI, nilai: '14' }, berubah: true });
    const dialog = await bukaUbah('Durasi peminjaman');

    fireEvent.change(within(dialog).getByLabelText('Nilai baru (hari) *'), { target: { value: '14' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));

    expect(await screen.findByText('Durasi peminjaman diubah menjadi 14 hari.')).toBeInTheDocument();
    expect(service.ubahKonfigurasi).toHaveBeenCalledWith('durasi_pinjam_hari', '14');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(service.daftarKonfigurasi).toHaveBeenCalledTimes(2));
    expect(service.riwayatKonfigurasi).toHaveBeenCalledTimes(2);
  });

  it('nilai sama memberi tahu tidak ada perubahan', async () => {
    service.ubahKonfigurasi.mockResolvedValue({ parameter: DURASI, berubah: false });
    const dialog = await bukaUbah('Durasi peminjaman');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));
    expect(await screen.findByText('Nilai sama dengan sebelumnya, tidak ada perubahan.')).toBeInTheDocument();
  });

  it('pesan error server ditampilkan di form', async () => {
    service.ubahKonfigurasi.mockRejectedValue(new Error('Nilai Tarif denda per hari harus angka.'));
    const dialog = await bukaUbah('Tarif denda per hari');

    const input = within(dialog).getByLabelText('Nilai baru (rupiah) *');
    expect(input).toHaveAttribute('step', '0.01');
    fireEvent.change(input, { target: { value: '1500.50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));

    expect(await within(dialog).findByText('Nilai Tarif denda per hari harus angka.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Simpan Nilai' })).toBeEnabled();
  });

  it('parameter boolean memakai pilihan Aktif/Nonaktif', async () => {
    service.ubahKonfigurasi.mockResolvedValue({ parameter: { ...CHATBOT, nilai: 'false' }, berubah: true });
    const dialog = await bukaUbah('Chatbot aktif');

    const pilihan = within(dialog).getByLabelText('Nilai baru *');
    expect(pilihan.tagName).toBe('SELECT');
    fireEvent.change(pilihan, { target: { value: 'false' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));

    expect(await screen.findByText('Chatbot aktif diubah menjadi Nonaktif.')).toBeInTheDocument();
    expect(service.ubahKonfigurasi).toHaveBeenCalledWith('chatbot_aktif', 'false');
  });

  it('parameter teks memakai input teks, Batal menutup modal', async () => {
    const dialog = await bukaUbah('info_rekening');
    const input = within(dialog).getByLabelText('Nilai baru *');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('maxLength', '255');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nilai kosong ditolak di browser', async () => {
    const dialog = await bukaUbah('info_rekening');
    fireEvent.change(within(dialog).getByLabelText('Nilai baru *'), { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Nilai wajib diisi.');
  });
});

describe('KelolaKonfigurasi: perbaikan review CodeRabbit', () => {
  it('setiap jenis kolom nilai menandai dirinya wajib diisi; form tetap noValidate', async () => {
    const dialog = await bukaUbah('Durasi peminjaman');
    expect(within(dialog).getByLabelText('Nilai baru (hari) *')).toBeRequired();
    expect(dialog.querySelector('form')).toHaveAttribute('novalidate');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Batal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ubah nilai Chatbot aktif' }));
    expect(within(screen.getByRole('dialog')).getByRole('combobox')).toBeRequired();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Batal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Ubah nilai info_rekening' }));
    expect(within(screen.getByRole('dialog')).getByRole('textbox')).toBeRequired();
  });

  it('penyimpanan lama tidak menutup modal yang dibuka sesudahnya', async () => {
    let selesai;
    service.ubahKonfigurasi.mockImplementation(() => new Promise((r) => { selesai = r; }));
    const dialog = await bukaUbah('Durasi peminjaman');
    fireEvent.change(within(dialog).getByLabelText('Nilai baru (hari) *'), { target: { value: '14' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));

    // Tutup saat masih menyimpan, lalu buka lagi parameter yang SAMA dan mulai mengetik
    fireEvent.click(screen.getByRole('button', { name: 'Tutup Modal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ubah nilai Durasi peminjaman' }));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Nilai baru (hari) *'), { target: { value: '21' } });

    selesai({ berubah: true, parameter: { ...DURASI, nilai: '14' } });
    expect(await screen.findByText('Durasi peminjaman diubah menjadi 14 hari.')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByLabelText('Nilai baru (hari) *')).toHaveValue(21);
  });

  it('penyimpanan biasa tetap menutup form-nya sendiri', async () => {
    service.ubahKonfigurasi.mockResolvedValue({ berubah: true, parameter: { ...DURASI, nilai: '14' } });
    const dialog = await bukaUbah('Durasi peminjaman');
    fireEvent.change(within(dialog).getByLabelText('Nilai baru (hari) *'), { target: { value: '14' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan Nilai' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
