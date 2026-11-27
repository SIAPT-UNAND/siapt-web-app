import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ChatbotWidget from './ChatbotWidget.jsx';
import { getRiwayat, kirimPesan } from '../services/chatbotService.js';

vi.mock('../services/chatbotService.js', () => ({ getRiwayat: vi.fn(), kirimPesan: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function buka() {
  render(<ChatbotWidget />);
  fireEvent.click(screen.getByRole('button', { name: 'Buka chatbot AI' }));
}

describe('ChatbotWidget', () => {
  it('memuat riwayat, mengirim pesan, lalu ditutup dengan Escape', async () => {
    getRiwayat.mockResolvedValue({
      riwayat: [{ id_pesan: 1, pertanyaan: 'Tanya lama', jawaban: 'Jawab lama' }],
      aktif: true,
      panjang_maks: 300,
    });
    kirimPesan.mockResolvedValue({
      jawaban: 'Jawab baru',
      sumber: 'faq',
      whatsapp: { url: 'https://wa.me/62', tampil: '+62' },
    });
    buka();
    expect(await screen.findByText('Jawab lama')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ketik pertanyaanmu…'), {
      target: { value: ' Tanya baru ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
    expect(await screen.findByText('Jawab baru')).toBeInTheDocument();
    expect(kirimPesan).toHaveBeenCalledWith('Tanya baru');
    expect(screen.getByText('Dari FAQ perpustakaan')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://wa.me/62');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('menampilkan sapaan, status nonaktif, dan galat pengiriman', async () => {
    getRiwayat.mockResolvedValue({ riwayat: [], aktif: false, panjang_maks: 100 });
    kirimPesan.mockRejectedValue(new Error('Gagal mengirim'));
    buka();
    expect(await screen.findByText(/Aku asisten SIAPT/)).toBeInTheDocument();
    expect(screen.getByText(/Layanan AI sedang nonaktif/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kapan denda dikenakan?' }));
    expect(await screen.findByText('Gagal mengirim')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tutup chatbot' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('menampilkan galat jika riwayat gagal dimuat', async () => {
    getRiwayat.mockRejectedValue(new Error('Riwayat gagal'));
    buka();
    expect(await screen.findByText('Riwayat gagal')).toBeInTheDocument();
  });

  it('mempertahankan pesan yang dikirim selagi riwayat masih dimuat', async () => {
    let selesai;
    getRiwayat.mockReturnValue(new Promise((resolve) => (selesai = resolve)));
    kirimPesan.mockResolvedValue({ id_pesan: 2, jawaban: 'Jawab baru', sumber: 'faq' });
    buka();
    fireEvent.click(screen.getByRole('button', { name: 'Kapan denda dikenakan?' }));
    expect(await screen.findByText('Jawab baru')).toBeInTheDocument();

    selesai({
      riwayat: [{ id_pesan: 1, pertanyaan: 'Tanya lama', jawaban: 'Jawab lama' }],
      aktif: true,
      panjang_maks: 300,
    });
    expect(await screen.findByText('Jawab lama')).toBeInTheDocument();
    expect(screen.getByText('Jawab baru')).toBeInTheDocument();
  });

  it('menandai pertanyaan yang sudah diajukan', async () => {
    getRiwayat.mockResolvedValue({
      riwayat: [
        {
          id_pesan: 1,
          pertanyaan: 'Tanya lama',
          jawaban: 'Belum tahu',
          diajukan: true,
          whatsapp: { url: 'https://wa.me/62', tampil: '+62' },
        },
      ],
      aktif: true,
      panjang_maks: 300,
    });
    buka();
    expect(await screen.findByText('Sudah diajukan ke Pustakawan.')).toBeInTheDocument();
  });
});
