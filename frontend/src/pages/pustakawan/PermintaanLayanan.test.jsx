import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PermintaanLayanan from './PermintaanLayanan.jsx';
import {
  getDaftarPermintaan,
  getDetailPermintaan,
  tanggapiPermintaan,
} from '../../services/permintaanService.js';

vi.mock('../../services/permintaanService.js', () => ({
  getDaftarPermintaan: vi.fn(),
  getDetailPermintaan: vi.fn(),
  tanggapiPermintaan: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

const permintaan = {
  id_permintaan: 7,
  dibuat_pada: '2026-01-01T00:00:00Z',
  anggota: { nama: 'Budi', pengenal: '123' },
  isi_permintaan: 'Jam buka perpustakaan?',
  status: 'Baru',
};

const detail = {
  ...permintaan,
  chatbot: { pertanyaan: 'Jam buka?', jawaban: 'Belum tahu' },
  tanggapan: [],
};

function siapkan(isiDetail = detail) {
  getDaftarPermintaan.mockResolvedValue({
    permintaan: [{ ...permintaan, status: isiDetail.status }],
    ringkasan: { Baru: 1, Diproses: 0, Selesai: 0, Ditolak: 0 },
  });
  getDetailPermintaan.mockResolvedValue({ permintaan: isiDetail });
  render(<PermintaanLayanan />);
}

describe('PermintaanLayanan', () => {
  it('menyimpan tanggapan selesai beserta FAQ', async () => {
    tanggapiPermintaan.mockResolvedValue({ faq_dibuat: true });
    siapkan();
    fireEvent.click(await screen.findByRole('button', { name: 'Tanggapi' }));
    fireEvent.change(await screen.findByLabelText('Status'), { target: { value: 'Selesai' } });
    fireEvent.change(screen.getByLabelText('Tanggapan untuk Anggota'), {
      target: { value: 'Buka jam 8' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Pertanyaan FAQ'), { target: { value: 'Jam buka?' } });
    fireEvent.change(screen.getByLabelText(/Kata kunci/), { target: { value: 'jam buka' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan tanggapan' }));

    expect(await screen.findByText(/ditambahkan ke FAQ/)).toBeInTheDocument();
    expect(tanggapiPermintaan).toHaveBeenCalledWith(7, {
      catatan: 'Buka jam 8',
      status: 'Selesai',
      faq: { pertanyaan: 'Jam buka?', kata_kunci: 'jam buka' },
    });
  });

  it('menampilkan galat simpan dan meminta konfirmasi sebelum menutup', async () => {
    tanggapiPermintaan.mockRejectedValue(new Error('Gagal simpan'));
    const konfirmasi = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    siapkan();
    fireEvent.click(await screen.findByRole('button', { name: 'Tanggapi' }));
    fireEvent.change(await screen.findByLabelText('Tanggapan untuk Anggota'), {
      target: { value: 'Draf' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan tanggapan' }));
    expect(await screen.findByText('Gagal simpan')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.getByRole('button', { name: 'Batal' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(konfirmasi).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Batal' })).not.toBeInTheDocument();
  });

  it('mengunci permintaan selesai dan menampilkan riwayat tanggapan', async () => {
    siapkan({
      ...detail,
      status: 'Selesai',
      tanggapan: [{ id_tanggapan: 1, status_hasil: 'Selesai', catatan: 'Sudah dijawab' }],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Lihat' }));
    expect(await screen.findByText('Sudah dijawab')).toBeInTheDocument();
    expect(screen.getByText(/terkunci/)).toBeInTheDocument();
  });

  it('memfilter, memuat ulang, dan menampilkan daftar kosong', async () => {
    getDaftarPermintaan.mockResolvedValue({
      permintaan: [],
      ringkasan: { Baru: 0, Diproses: 0, Selesai: 0, Ditolak: 0 },
    });
    render(<PermintaanLayanan />);
    expect(await screen.findByText(/Tidak ada permintaan/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Baru/ }));
    await waitFor(() => expect(getDaftarPermintaan).toHaveBeenLastCalledWith('Baru'));
    await screen.findByText(/Tidak ada permintaan/);
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    await waitFor(() => expect(getDaftarPermintaan).toHaveBeenCalledTimes(3));
  });

  it('menampilkan galat daftar dan detail', async () => {
    siapkan();
    getDetailPermintaan.mockRejectedValue(new Error('Detail gagal'));
    fireEvent.click(await screen.findByRole('button', { name: 'Tanggapi' }));
    expect(await screen.findByText('Detail gagal')).toBeInTheDocument();
    getDaftarPermintaan.mockRejectedValue(new Error('Daftar gagal'));
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    expect(await screen.findByText('Daftar gagal')).toBeInTheDocument();
  });
});
