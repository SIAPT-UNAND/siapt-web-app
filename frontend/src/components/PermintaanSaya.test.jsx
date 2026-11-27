import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PermintaanSaya from './PermintaanSaya.jsx';
import TombolAjukan from './TombolAjukan.jsx';
import { ajukanPermintaan, getPermintaanSaya } from '../services/permintaanService.js';

vi.mock('../services/permintaanService.js', () => ({
  ajukanPermintaan: vi.fn(),
  getPermintaanSaya: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function halaman(nomor, isi) {
  return {
    halaman: nomor,
    total_halaman: 2,
    permintaan: [
      {
        id_permintaan: nomor,
        status: 'Selesai',
        isi_permintaan: isi,
        dibuat_pada: '2026-11-01T00:00:00Z',
        tanggapan: [{ id_tanggapan: nomor, catatan: `Jawaban ${nomor}` }],
      },
    ],
  };
}

describe('PermintaanSaya', () => {
  it('menampilkan permintaan dan berpindah halaman', async () => {
    getPermintaanSaya
      .mockResolvedValueOnce(halaman(1, 'Pertanyaan baru'))
      .mockResolvedValueOnce(halaman(2, 'Pertanyaan lama'))
      .mockResolvedValueOnce(halaman(1, 'Pertanyaan baru'));
    render(<PermintaanSaya />);
    expect(await screen.findByText('Pertanyaan baru')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
    expect(await screen.findByText('Pertanyaan lama')).toBeInTheDocument();
    expect(getPermintaanSaya).toHaveBeenLastCalledWith(2);

    fireEvent.click(screen.getByRole('button', { name: 'Sebelumnya' }));
    expect(await screen.findByText('Pertanyaan baru')).toBeInTheDocument();
  });

  it('menampilkan galat lalu daftar kosong setelah muat ulang', async () => {
    getPermintaanSaya
      .mockRejectedValueOnce(new Error('Gagal memuat'))
      .mockResolvedValueOnce({ halaman: 1, total_halaman: 1, permintaan: [] });
    render(<PermintaanSaya />);
    expect(await screen.findByText('Gagal memuat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    expect(await screen.findByText('Belum ada permintaan.')).toBeInTheDocument();
  });
});

describe('TombolAjukan', () => {
  it('menampilkan galat, lalu berhasil mengajukan', async () => {
    const onDiajukan = vi.fn();
    ajukanPermintaan.mockRejectedValueOnce(new Error('Gagal')).mockResolvedValueOnce({});
    render(<TombolAjukan idPesan={3} isi="Tanya" onDiajukan={onDiajukan} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ajukan ke Pustakawan' }));
    expect(await screen.findByText('Gagal')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Ajukan ke Pustakawan' }));
    await vi.waitFor(() => expect(onDiajukan).toHaveBeenCalledTimes(1));
    expect(ajukanPermintaan).toHaveBeenLastCalledWith(3, 'Tanya');
  });

  it('menganggap 409 sebagai sudah diajukan', async () => {
    const onDiajukan = vi.fn();
    ajukanPermintaan.mockRejectedValue(Object.assign(new Error('dup'), { status: 409 }));
    render(<TombolAjukan idPesan={3} isi="Tanya" onDiajukan={onDiajukan} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajukan ke Pustakawan' }));
    await vi.waitFor(() => expect(onDiajukan).toHaveBeenCalled());
  });
});
