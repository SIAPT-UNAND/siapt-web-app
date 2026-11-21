import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function clickButton(name, scope = screen) {
  fireEvent.click(scope.getByRole('button', { name }));
}

function changeValue(input, value) {
  fireEvent.change(input, { target: { value } });
}

describe('App', () => {
  it('renders the application name', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    render(<App />);

    expect(screen.getByText('SIAPT UNAND')).toBeInTheDocument();
  });

  it('memvalidasi pengenal dan mengakhiri sesi dari navbar', () => {
    render(<App />);

    const identifier = screen.getByPlaceholderText(/2211521001 atau ADM-001/);
    changeValue(identifier, ' ');
    clickButton('Masuk ke Layanan');
    expect(screen.getByText(/Silakan masukkan nomor pengenal/)).toBeVisible();

    changeValue(identifier, 'ADM-001');
    changeValue(screen.getByLabelText(/kata sandi|password/i), 'contoh');
    changeValue(screen.getByRole('combobox'), 'Admin');
    clickButton('Masuk ke Layanan');
    expect(screen.getByText('Admin Perpustakaan')).toBeVisible();

    const sidebar = screen.getByRole('button', { name: 'Tutup Menu' }).closest('aside');
    clickButton('Toggle Sidebar');
    expect(sidebar).toHaveClass('open');
    clickButton('Tutup Menu');
    expect(sidebar).not.toHaveClass('open');
    clickButton('Toggle Sidebar');
    clickButton('Kelola Akun');
    expect(sidebar).not.toHaveClass('open');
    clickButton('Keluar');
    expect(screen.getByRole('button', { name: 'Masuk ke Layanan' })).toBeVisible();
  });

  it('menambah pengguna, mengubah statusnya, dan menyimpan konfigurasi', () => {
    render(<App />);
    clickButton('Admin');
    clickButton('Kelola Akun');
    clickButton(/Tambah Pengguna/);
    let dialog = within(screen.getByRole('dialog'));
    changeValue(dialog.getByRole('combobox'), 'Pustakawan');
    changeValue(dialog.getByPlaceholderText(/2211523003/), '1985010101');
    changeValue(dialog.getByPlaceholderText(/Nama Lengkap/), 'Nadia Penguji');
    clickButton('Simpan Pengguna', dialog);

    const account = within(screen.getByRole('row', { name: /Nadia Penguji/ }));
    clickButton('Nonaktifkan', account);
    expect(account.getByText('Nonaktif')).toBeVisible();
    clickButton('Aktifkan', account);
    expect(account.getByText('Aktif')).toBeVisible();

    clickButton('Kelola Konfigurasi Sistem');
    const config = within(screen.getByRole('row', { name: /durasi_pinjam_hari/i }));
    clickButton('Ubah Nilai', config);
    dialog = within(screen.getByRole('dialog'));
    const [, valueInput] = dialog.getAllByRole('textbox');
    changeValue(valueInput, '21');
    clickButton('Simpan Perubahan', dialog);
    expect(config.getByText('21')).toBeVisible();
  });

  it('mencari, menambah, mengedit, dan menghapus koleksi dari akun pustakawan', () => {
    render(<App />);
    clickButton('Pustakawan');
    const search = screen.getByPlaceholderText(/Cari judul, pengarang/);
    changeValue(search, 'koleksi yang tidak ada');
    expect(screen.queryByText('Bumi Manusia')).not.toBeInTheDocument();
    changeValue(search, '');
    expect(screen.getByText('Bumi Manusia')).toBeVisible();

    clickButton(/Filter/);
    let dialog = within(screen.getByRole('dialog'));
    const category = dialog.getByRole('combobox');
    changeValue(category, 'Sastra & Fiksi');
    expect(screen.queryByText(/Clean Code/)).not.toBeInTheDocument();
    clickButton('Reset', dialog);
    expect(screen.getByText(/Clean Code/)).toBeVisible();
    clickButton('Tutup Modal', dialog);

    clickButton(/Tambah Koleksi/);
    dialog = within(screen.getByRole('dialog'));
    const [title, author, isbn, callNumber, shelf] = dialog.getAllByRole('textbox');
    changeValue(title, 'Koleksi Uji');
    changeValue(author, 'Nadia');
    changeValue(isbn, '9780132350884');
    changeValue(callNumber, '005.1 NAD');
    changeValue(shelf, 'RAK-UJI');
    changeValue(dialog.getByRole('spinbutton'), '4');
    clickButton('Simpan Koleksi', dialog);

    const row = within(screen.getByRole('row', { name: /Koleksi Uji/ }));
    fireEvent.click(row.getByTitle('Edit Koleksi'));
    dialog = within(screen.getByRole('dialog'));
    changeValue(dialog.getByDisplayValue('Koleksi Uji'), 'Koleksi Diperbarui');
    clickButton('Simpan Perubahan', dialog);
    expect(row.getByText('Koleksi Diperbarui')).toBeVisible();

    fireEvent.click(row.getByTitle('Hapus Koleksi'));
    clickButton('Ya, Hapus Koleksi', within(screen.getByRole('dialog')));
    expect(screen.queryByText('Koleksi Diperbarui')).not.toBeInTheDocument();
  });

  it('menolak kode yang tidak dikenal dan memproses pengembalian yang valid', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<App />);
    clickButton('Pustakawan');
    clickButton('Pengembalian Buku');

    const code = screen.getByPlaceholderText(/TRX-202611-001/);
    changeValue(code, 'KODE-TIDAK-ADA');
    clickButton('Verifikasi & Kembalikan');
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('KODE-TIDAK-ADA'));

    changeValue(code, 'trx-202611-001');
    clickButton('Verifikasi & Kembalikan');
    expect(screen.getByText(/berhasil dikembalikan/)).toBeVisible();
    expect(screen.queryByText('TRX-202611-001')).not.toBeInTheDocument();
  });

  it('menampilkan ringkasan sirkulasi untuk pengelola', () => {
    render(<App />);
    clickButton('Pengelola');
    expect(screen.getByRole('heading', { name: 'Dashboard Analitik Perpustakaan' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /Top 5 Koleksi/ })).toBeVisible();
  });
});
