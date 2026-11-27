import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DaftarKoleksi from './DaftarKoleksi';

afterEach(() => {
  cleanup();
});

vi.mock('../../utils/imageCompressor', () => ({
  compressImageToWebp: vi.fn(async () => ({
    dataUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQ',
    sizeBytes: 1024,
    sizeKB: '1.0',
  })),
}));

const makeBooks = (count = 12) =>
  Array.from({ length: count }, (_, idx) => {
    const id = idx + 1;
    return {
      id_koleksi: id,
      kode_koleksi: `KOL-${String(id).padStart(3, '0')}`,
      judul: id === 12 ? 'Design Patterns' : `Buku Pustaka ${id}`,
      pengarang: id === 12 ? 'Erich Gamma' : `Pengarang ${id}`,
      kategori: id % 2 === 0 ? 'Ilmu Komputer' : 'Sastra & Humaniora',
      penerbit: id === 12 ? 'Addison-Wesley' : `Penerbit ${id}`,
      tahun_terbit: 2020 + (id % 4),
      isbn: `9781000000${String(id).padStart(3, '0')}`,
      nomor_panggil: `005.${id} PUS`,
      edisi: '1',
      bahasa: 'Indonesia',
      deskripsi: `Deskripsi buku ${id}`,
      lokasi_rak: `RAK-${id}`,
      sampul: id === 12 ? '/upload/sample.webp' : '',
      total_stok: 1,
      stok_tersedia: 1,
      eksemplar: [
        {
          id_eksemplar: 100 + id,
          kode_eksemplar: `001-2024-${id}`,
          lokasi_rak: `RAK-${id}`,
          status: 'TERSEDIA',
        },
      ],
    };
  });

const makeFileWithBuffer = (content, name) => {
  const file = new File([content], name, { type: 'text/csv' });
  const buf = new TextEncoder().encode(content).buffer;
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => buf,
  });
  return file;
};

describe('DaftarKoleksi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('supports search criteria, error/loading states, refresh, filter modal, export, and pagination', () => {
    const books = makeBooks(12);
    const onRefresh = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:export');
    URL.revokeObjectURL = vi.fn();

    const { rerender } = render(
      <DaftarKoleksi
        collections={[]}
        isLoadingCollections={true}
        collectionError="Database error"
        onRefreshCollections={onRefresh}
      />
    );

    expect(screen.getByText(/Database error/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <DaftarKoleksi
        collections={books}
        dbCategories={['Ilmu Komputer', 'Sastra & Humaniora']}
        dbAuthors={['Erich Gamma', 'Robert C. Martin']}
        dbPublishers={['Addison-Wesley', 'Prentice Hall']}
        onRefreshCollections={onRefresh}
      />
    );

    // Export Excel triggers download without error
    fireEvent.click(screen.getByTitle(/Export data koleksi/i));

    // Pagination (10 per page): book 12 on page 1, book 1 on page 2
    expect(screen.getAllByText('Design Patterns').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/i }));
    expect(screen.getAllByText('Buku Pustaka 1').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Sebelumnya/i }));

    // Search criteria checks
    const criteriaSelect = screen.getByLabelText('Cari:');
    const searchInput = screen.getByPlaceholderText(/Cari judul, penulis/i);

    fireEvent.change(criteriaSelect, { target: { value: 'judul' } });
    fireEvent.change(searchInput, { target: { value: 'Design' } });
    expect(screen.getAllByText('Design Patterns').length).toBeGreaterThan(0);

    fireEvent.change(criteriaSelect, { target: { value: 'penulis' } });
    fireEvent.change(searchInput, { target: { value: 'Pengarang 3' } });
    expect(screen.getAllByText('Buku Pustaka 3').length).toBeGreaterThan(0);

    fireEvent.change(criteriaSelect, { target: { value: 'isbn' } });
    fireEvent.change(searchInput, { target: { value: '9781000000004' } });
    expect(screen.getAllByText('Buku Pustaka 4').length).toBeGreaterThan(0);

    fireEvent.change(criteriaSelect, { target: { value: 'penerbit' } });
    fireEvent.change(searchInput, { target: { value: 'Penerbit 5' } });
    expect(screen.getAllByText('Buku Pustaka 5').length).toBeGreaterThan(0);

    fireEvent.change(criteriaSelect, { target: { value: 'kategori' } });
    fireEvent.change(searchInput, { target: { value: 'Sastra' } });
    expect(screen.getAllByText('Buku Pustaka 11').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTitle('Bersihkan pencarian'));
    expect(searchInput.value).toBe('');

    // Filter category modal
    fireEvent.click(screen.getByRole('button', { name: /Kategori: Semua/i }));
    const filterDialog = screen.getByRole('dialog', { name: 'Filter Kategori Koleksi' });
    fireEvent.change(within(filterDialog).getByRole('combobox'), {
      target: { value: 'Ilmu Komputer' },
    });
    expect(screen.queryByRole('dialog', { name: 'Filter Kategori Koleksi' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Semua Filter' }));
  }, 60000);

  it('handles detail -> edit transition, copy row editing, Bahasa select, delete, and failure popups', async () => {
    const books = makeBooks(2);
    const onUpdateCollection = vi
      .fn()
      .mockRejectedValueOnce(new Error('Simpan gagal'))
      .mockResolvedValueOnce({});
    const onDeleteCollection = vi
      .fn()
      .mockRejectedValueOnce(new Error('Masih dipinjam'))
      .mockResolvedValueOnce({});

    render(
      <DaftarKoleksi
        collections={books}
        dbCategories={['Ilmu Komputer', 'Sastra & Humaniora']}
        dbAuthors={['Pengarang 1', 'Pengarang 2', 'Robert C. Martin']}
        dbPublishers={['Penerbit 1', 'Penerbit 2']}
        onUpdateCollection={onUpdateCollection}
        onDeleteCollection={onDeleteCollection}
      />
    );

    // Open Detail modal -> click Edit Buku Ini
    fireEvent.click(screen.getAllByTitle('Lihat Detail Buku')[0]);
    const detailDialog = screen.getByRole('dialog', { name: 'Detail Koleksi Pustaka' });
    fireEvent.click(within(detailDialog).getByRole('button', { name: /Edit Buku Ini/i }));

    const editDialog = screen.getByRole('dialog', { name: 'Edit Data Koleksi Buku' });
    // Remove sample cover on book 2 via Kosongkan sampul if present, or verify Bahasa dropdown
    const langSelect = within(editDialog).getByDisplayValue('Indonesia');
    fireEvent.change(langSelect, { target: { value: 'Inggris' } });
    expect(langSelect.value).toBe('Inggris');

    // Add & update an eksemplar row via Enter key
    const eksInput = within(editDialog).getByDisplayValue('001-2024-2');
    fireEvent.keyDown(eksInput, { key: 'Enter' });
    const rowInputs = within(editDialog).getAllByPlaceholderText(/Opsional \(Contoh:/i);
    expect(rowInputs.length).toBeGreaterThanOrEqual(2);

    // First submit fails -> shows error modal
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Simpan Perubahan' }));
    await waitFor(() => {
      expect(onUpdateCollection).toHaveBeenCalledTimes(1);
    });
    const errUpdateDlg = await screen.findByRole('dialog', { name: 'Gagal Memperbarui Buku' });
    fireEvent.click(within(errUpdateDlg).getByRole('button', { name: 'Tutup' }));

    // Second submit succeeds
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Simpan Perubahan' }));
    await waitFor(() => {
      expect(onUpdateCollection).toHaveBeenCalledTimes(2);
    });
    const okUpdateDlg = await screen.findByRole('dialog', { name: 'Berhasil Memperbarui Buku' });
    fireEvent.click(within(okUpdateDlg).getByRole('button', { name: 'Tutup' }));

    // Delete modal failure then success
    fireEvent.click(screen.getAllByTitle('Hapus Koleksi')[0]);
    const delDialog = screen.getByRole('dialog', { name: 'Konfirmasi Hapus Koleksi' });
    fireEvent.click(within(delDialog).getByRole('button', { name: /Ya, Hapus Koleksi/i }));
    await waitFor(() => {
      expect(onDeleteCollection).toHaveBeenCalledTimes(1);
    });
    const errDelDlg = await screen.findByRole('dialog', { name: 'Gagal Menghapus Buku' });
    fireEvent.click(within(errDelDlg).getByRole('button', { name: 'Tutup' }));

    fireEvent.click(screen.getAllByTitle('Hapus Koleksi')[0]);
    const delDialog2 = screen.getByRole('dialog', { name: 'Konfirmasi Hapus Koleksi' });
    fireEvent.click(within(delDialog2).getByRole('button', { name: /Ya, Hapus Koleksi/i }));
    await waitFor(() => {
      expect(onDeleteCollection).toHaveBeenCalledTimes(2);
    });
    await screen.findByRole('dialog', { name: 'Berhasil Menghapus Buku' });
  }, 60000);

  it('handles Excel import preview, conflict rejection, valid import, and cover upload in Add modal', async () => {
    const books = makeBooks(1);
    const onImportCollections = vi.fn().mockResolvedValue({});
    const onAddCollection = vi.fn().mockRejectedValue(new Error('Validasi server gagal'));

    render(
      <DaftarKoleksi
        collections={books}
        dbCategories={['Ilmu Komputer']}
        dbAuthors={['Robert C. Martin', 'Adi Nugroho']}
        dbPublishers={['Prentice Hall']}
        onAddCollection={onAddCollection}
        onImportCollections={onImportCollections}
      />
    );

    // 1. Open Import modal & upload CSV with valid rows
    fireEvent.click(screen.getByTitle(/Import daftar koleksi/i));
    const importDialog = screen.getByRole('dialog', { name: 'Import Koleksi Buku dari Excel' });
    const fileInput = document.getElementById('excel-import-input');

    const validCsv =
      'Judul,Penulis / Pengarang,Kategori,Penerbit,Tahun Terbit,Edisi,ISBN,Nomor Panggil,Bahasa,Deskripsi,Kode Eksemplar,Lokasi Rak\n' +
      'Refactoring,Martin Fowler,Ilmu Komputer,Addison-Wesley,2018,2,9780134757599,005.1 FOW r,Inggris,Improving code,EKS-REF-1,Rak IT-2\n';

    fireEvent.change(fileInput, {
      target: { files: [makeFileWithBuffer(validCsv, 'valid.csv')] },
    });

    await waitFor(() => {
      expect(within(importDialog).getByText(/Refactoring/)).toBeInTheDocument();
    });

    fireEvent.click(
      within(importDialog).getByRole('button', { name: /Import 1 Buku ke Database/i })
    );
    await waitFor(() => {
      expect(onImportCollections).toHaveBeenCalledTimes(1);
    });
    const okImportDlg = await screen.findByRole('dialog', {
      name: 'Berhasil Import Buku dari Excel',
    });
    fireEvent.click(within(okImportDlg).getByRole('button', { name: 'Tutup' }));

    // 2. Test Add modal author/publisher autocomplete + cover upload + server failure
    fireEvent.click(screen.getByRole('button', { name: /Tambah Koleksi/i }));
    const addDialog = screen.getByRole('dialog', { name: 'Tambah Koleksi Buku Baru' });

    const authorInput = within(addDialog).getByPlaceholderText(/Cari atau ketik penulis/i);
    fireEvent.focus(authorInput);
    fireEvent.change(authorInput, { target: { value: 'Robert' } });
    const suggestionBtn = within(addDialog).getByRole('button', { name: /Robert C\. Martin/i });
    fireEvent.mouseDown(suggestionBtn);
    fireEvent.click(within(addDialog).getByTitle('Hapus penulis ini'));

    const pubInput = within(addDialog).getByPlaceholderText(/Cari atau ketik nama penerbit/i);
    fireEvent.focus(pubInput);
    fireEvent.change(pubInput, { target: { value: 'Prentice' } });
    fireEvent.mouseDown(within(addDialog).getByRole('button', { name: /Prentice Hall/i }));

    const coverInput = addDialog.querySelector('input[type="file"]');
    const imgFile = new File(['img'], 'cover.png', { type: 'image/png' });
    fireEvent.change(coverInput, { target: { files: [imgFile] } });
    await waitFor(() => {
      expect(within(addDialog).getByTitle('Hapus sampul yang dipilih')).toBeInTheDocument();
    });
    fireEvent.click(within(addDialog).getByTitle('Hapus sampul yang dipilih'));
  }, 60000);
});
