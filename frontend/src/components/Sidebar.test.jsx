import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Sidebar from './Sidebar.jsx';

afterEach(() => {
  cleanup();
});

function tampilkan(props = {}) {
  const handler = { onSelectMenu: vi.fn(), onClose: vi.fn() };
  const hasil = render(
    <Sidebar role="Admin" activeMenu="home" isOpen={false} {...handler} {...props} />,
  );
  return { ...hasil, ...handler };
}

function labelMenu() {
  const nav = screen.getByRole('navigation');
  return within(nav)
    .getAllByRole('button')
    .map((b) => b.textContent);
}

describe('Sidebar', () => {
  it.each([
    ['Anggota', ['Beranda (Koleksi)', 'Peminjaman Mandiri', 'Informasi Peminjaman']],
    ['Pustakawan', ['Daftar Koleksi', 'Peminjaman Buku', 'Pengembalian Buku']],
    ['Pengelola', ['Ringkasan', 'Koleksi & Inventaris', 'Sirkulasi', 'Denda & Pembayaran', 'Layanan & Chatbot']],
    ['Admin', ['Home (Beranda)', 'Kelola Akun', 'Hak Akses', 'Kelola Konfigurasi Sistem']],
  ])('menampilkan menu peran %s', (role, menu) => {
    tampilkan({ role });
    expect(labelMenu()).toEqual(menu);
    expect(screen.getByRole('navigation')).toHaveAccessibleName(`Menu ${role}`);
  });

  it('peran tidak dikenal tidak menampilkan menu', () => {
    tampilkan({ role: 'Tamu' });
    expect(within(screen.getByRole('navigation')).queryAllByRole('button')).toHaveLength(0);
  });

  it('menandai menu aktif dengan aria-current', () => {
    tampilkan({ activeMenu: 'kelola-akun' });
    const aktif = screen.getByRole('button', { name: 'Kelola Akun' });
    expect(aktif).toHaveAttribute('aria-current', 'page');
    expect(aktif).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Hak Akses' })).not.toHaveAttribute('aria-current');
  });

  it('klik menu memanggil onSelectMenu lalu menutup laci', () => {
    const { onSelectMenu, onClose } = tampilkan();
    fireEvent.click(screen.getByRole('button', { name: 'Hak Akses' }));
    expect(onSelectMenu).toHaveBeenCalledWith('kelola-hak-akses');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tetap aman tanpa onClose', () => {
    const onSelectMenu = vi.fn();
    render(<Sidebar role="Admin" activeMenu="home" isOpen={false} onSelectMenu={onSelectMenu} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kelola Akun' }));
    expect(onSelectMenu).toHaveBeenCalledWith('kelola-akun');
  });

  it('laci terbuka: backdrop dan tombol tutup memanggil onClose', () => {
    const { container, onClose } = tampilkan({ isOpen: true });
    expect(container.querySelector('.app-sidebar')).toHaveClass('open');

    fireEvent.click(container.querySelector('.sidebar-backdrop'));
    fireEvent.click(screen.getByRole('button', { name: 'Tutup Menu' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('laci tertutup tidak merender backdrop', () => {
    const { container } = tampilkan({ isOpen: false });
    expect(container.querySelector('.sidebar-backdrop')).toBeNull();
    expect(container.querySelector('.app-sidebar')).not.toHaveClass('open');
  });
});
