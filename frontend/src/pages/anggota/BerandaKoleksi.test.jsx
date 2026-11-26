import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BerandaKoleksi from './BerandaKoleksi';

afterEach(() => {
  cleanup();
});

const makeBooks = (count = 18) =>
  Array.from({ length: count }, (_, idx) => {
    const id = idx + 1;
    return {
      id_koleksi: id,
      kode_koleksi: `KOL-${String(id).padStart(3, '0')}`,
      judul: id === 18 ? 'Clean Code' : `Buku Referensi ${id}`,
      pengarang: id === 18 ? 'Robert C. Martin' : `Penulis ${id}`,
      kategori: id % 2 === 0 ? 'Ilmu Komputer' : 'Sastra & Fiksi',
      penerbit: id === 18 ? 'Prentice Hall' : `Penerbit ${id}`,
      tahun_terbit: 2020 + (id % 5),
      isbn: `9780000000${String(id).padStart(3, '0')}`,
      nomor_panggil: `005.${id} BUK`,
      edisi: '1',
      bahasa: 'Indonesia',
      deskripsi: `Sinopsis buku ${id}`,
      lokasi_rak: `Rak ${id}`,
      total_stok: id === 17 ? 0 : 2,
      stok_tersedia: id === 17 ? 0 : 1,
      eksemplar:
        id === 18
          ? [
              { id_eksemplar: 1, kode_eksemplar: 'EKS-001', lokasi_rak: 'Rak IT-1', status: 'TERSEDIA' },
              { id_eksemplar: 2, kode_eksemplar: 'EKS-002', lokasi_rak: 'Rak IT-1', status: 'DIPINJAM' },
            ]
          : [],
    };
  });

describe('BerandaKoleksi', () => {
  it('supports loading, database error retry, search criteria, availability filter, and empty reset', () => {
    const onRefreshCollections = vi.fn();
    const { rerender } = render(
      <BerandaKoleksi
        collections={[]}
        isLoadingCollections={true}
        collectionError="Koneksi gagal"
        onRefreshCollections={onRefreshCollections}
      />
    );

    expect(screen.getByText(/Sedang memuat katalog koleksi/i)).toBeInTheDocument();
    expect(screen.getByText(/Koneksi gagal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(onRefreshCollections).toHaveBeenCalledTimes(1);

    const books = makeBooks(5);
    rerender(
      <BerandaKoleksi
        collections={books}
        dbCategories={['Ilmu Komputer', 'Sastra & Fiksi']}
        isLoadingCollections={false}
        onAddToCart={vi.fn()}
      />
    );

    const select = screen.getByLabelText('Cari:');
    const input = screen.getByPlaceholderText(/Cari judul, penulis, ISBN/i);

    fireEvent.change(select, { target: { value: 'judul' } });
    expect(screen.getByPlaceholderText('Ketik judul buku...')).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'penulis' } });
    fireEvent.change(input, { target: { value: 'Penulis 1' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Buku Referensi 1' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'isbn' } });
    fireEvent.change(input, { target: { value: '9780000000002' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Buku Referensi 2' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'penerbit' } });
    fireEvent.change(input, { target: { value: 'Penerbit 3' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Buku Referensi 3' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'kategori' } });
    fireEvent.change(input, { target: { value: 'Sastra' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Buku Referensi 1' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'all' } });
    fireEvent.change(input, { target: { value: 'ZzzTidakAda' } });
    expect(screen.getByText(/Tidak ada koleksi buku yang cocok/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Pencarian' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Buku Referensi 5' })).toBeInTheDocument();

    // Test clear button & filter modal onlyAvailable toggle
    fireEvent.change(input, { target: { value: 'Buku' } });
    fireEvent.click(screen.getByTitle('Bersihkan pencarian'));
    expect(input.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: /Kategori: Semua/i }));
    const filterDialog = screen.getByRole('dialog', { name: 'Filter Kategori Koleksi' });
    fireEvent.click(within(filterDialog).getByRole('checkbox'));
    fireEvent.change(within(filterDialog).getByRole('combobox'), {
      target: { value: 'Ilmu Komputer' },
    });
    expect(screen.queryByRole('dialog', { name: 'Filter Kategori Koleksi' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Semua Filter' }));
  });

  it('paginates books (15 per page), opens detail modal, and triggers onAddToCart', () => {
    const books = makeBooks(18);
    const onAddToCart = vi.fn();
    render(<BerandaKoleksi collections={books} loans={[]} onAddToCart={onAddToCart} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Clean Code' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Buku Referensi 1' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }));
    expect(screen.getByRole('heading', { level: 3, name: 'Buku Referensi 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sebelumnya/i }));
    expect(screen.getByRole('heading', { level: 3, name: 'Clean Code' })).toBeInTheDocument();

    // Open detail modal via cover click for Clean Code (which has 2 eksemplar)
    const detailTriggers = screen.getAllByTitle('Klik untuk melihat sinopsis & detail');
    fireEvent.click(detailTriggers[0]);

    const dialog = screen.getByRole('dialog', { name: 'Informasi Koleksi Buku' });
    expect(within(dialog).getByText('EKS-001')).toBeInTheDocument();
    expect(within(dialog).getByText('EKS-002')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Pinjam Mandiri Sekarang/i }));
    expect(onAddToCart).toHaveBeenCalledWith(expect.objectContaining({ id_koleksi: 18 }));
  });
});
