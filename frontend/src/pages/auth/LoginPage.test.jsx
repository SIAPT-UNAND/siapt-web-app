import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LoginPage from './LoginPage.jsx';
import { getBantuan } from '../../services/authService.js';

vi.mock('../../services/authService.js', () => ({ getBantuan: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function isiForm(pengenal, sandi) {
  fireEvent.change(screen.getByLabelText(/Nomor Pengenal/), { target: { value: pengenal } });
  fireEvent.change(screen.getByLabelText('Kata Sandi:'), { target: { value: sandi } });
  fireEvent.click(screen.getByRole('button', { name: 'Masuk ke Layanan' }));
}

describe('LoginPage', () => {
  it('menolak form kosong', () => {
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);
    isiForm(' ', '');
    expect(screen.getByRole('alert')).toHaveTextContent('wajib diisi');
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('mengirim pengenal yang sudah dirapikan dan menampilkan galat login', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('NIM/NIP atau kata sandi salah.'));
    render(<LoginPage onLogin={onLogin} />);
    fireEvent.click(screen.getByLabelText('Tampilkan kata sandi'));
    isiForm(' 123 ', 'rahasia');
    expect(onLogin).toHaveBeenCalledWith('123', 'rahasia');
    expect(await screen.findByText('NIM/NIP atau kata sandi salah.')).toBeInTheDocument();
  });

  it('menampilkan kontak bantuan lupa kata sandi lalu kembali', async () => {
    getBantuan.mockResolvedValue({ whatsapp: { url: 'https://wa.me/62', tampil: '+62' } });
    render(<LoginPage onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lupa kata sandi?' }));
    expect(await screen.findByRole('link')).toHaveAttribute('href', 'https://wa.me/62');
    fireEvent.click(screen.getByRole('button', { name: /Kembali/ }));
    expect(screen.getByRole('button', { name: 'Masuk ke Layanan' })).toBeInTheDocument();
  });

  it('menampilkan galat jika kontak bantuan gagal dimuat', async () => {
    getBantuan.mockRejectedValue(new Error('Server mati'));
    render(<LoginPage onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lupa kata sandi?' }));
    expect(await screen.findByText('Server mati')).toBeInTheDocument();
  });
});
