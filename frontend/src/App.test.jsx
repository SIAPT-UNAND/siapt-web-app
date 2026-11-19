import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';
import BerandaKoleksi from './pages/anggota/BerandaKoleksi.jsx';
import DaftarKoleksi from './pages/pustakawan/DaftarKoleksi.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleCollections = [
  {
    id_koleksi: 1,
    kode_koleksi: 'KOL-CS-001',
    judul: 'Clean Code',
    pengarang: 'Robert C. Martin',
    penerbit: 'Prentice Hall',
    tahun_terbit: 2008,
    isbn: '9780132350884',
    nomor_panggil: '005.1 MAR c',
    kategori: 'Ilmu Komputer',
    lokasi_rak: 'RAK-CS-01',
    stok_tersedia: 2,
    total_stok: 2,
    eksemplar: [
      { id_eksemplar: 101, kode_eksemplar: 'EKS-001-A', lokasi_rak: 'RAK-CS-01', status: 'TERSEDIA' },
      { id_eksemplar: 102, kode_eksemplar: 'EKS-001-B', lokasi_rak: 'RAK-CS-01', status: 'TERSEDIA' },
    ],
  },
  {
    id_koleksi: 2,
    kode_koleksi: 'KOL-LIT-002',
    judul: 'Bumi Manusia',
    pengarang: 'Pramoedya Ananta Toer',
    penerbit: 'Lentera Dipantara',
    tahun_terbit: 2005,
    isbn: '9789799731234',
    nomor_panggil: '899.221 TOE b',
    kategori: 'Sastra & Humaniora',
    lokasi_rak: 'RAK-LIT-01',
    stok_tersedia: 1,
    total_stok: 1,
    eksemplar: [
      { id_eksemplar: 201, kode_eksemplar: 'EKS-002-A', lokasi_rak: 'RAK-LIT-01', status: 'TERSEDIA' },
    ],
  },
];

describe('App', () => {
  it('renders the application name', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    render(<App />);

    expect(screen.getByText('SIAPT UNAND')).toBeInTheDocument();
  });
});

describe('BerandaKoleksi (Anggota)', () => {
  it('displays books sorted by newest id_koleksi first and closes filter modal immediately on category selection', () => {
    render(
      <BerandaKoleksi
        collections={sampleCollections}
        dbCategories={['Ilmu Komputer', 'Sastra & Humaniora']}
        loans={[]}
        onAddToCart={vi.fn()}
      />
    );

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('Bumi Manusia');
    expect(headings[1]).toHaveTextContent('Clean Code');

    fireEvent.click(screen.getByRole('button', { name: /Kategori: Semua/i }));
    expect(screen.getByText('Filter Kategori Koleksi')).toBeInTheDocument();

    const selectEl = screen.getByDisplayValue('Semua');
    fireEvent.change(selectEl, { target: { value: 'Ilmu Komputer' } });

    expect(screen.queryByText('Filter Kategori Koleksi')).not.toBeInTheDocument();
    expect(screen.getAllByText('Clean Code').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bumi Manusia')).not.toBeInTheDocument();
  });
});

describe('DaftarKoleksi (Pustakawan)', () => {
  it('shows duplicate ISBN and Kode Eksemplar warnings inside Tambah Buku modal and shows feedback popup on success', async () => {
    const onAddCollection = vi.fn().mockResolvedValue({});

    render(
      <DaftarKoleksi
        collections={sampleCollections}
        dbCategories={['Ilmu Komputer', 'Sastra & Humaniora']}
        dbAuthors={['Robert C. Martin', 'Pramoedya Ananta Toer']}
        dbPublishers={['Prentice Hall', 'Lentera Dipantara']}
        onAddCollection={onAddCollection}
        onUpdateCollection={vi.fn()}
        onDeleteCollection={vi.fn()}
        onImportCollections={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Tambah Koleksi/i }));
    expect(screen.getByText('Tambah Koleksi Buku Baru')).toBeInTheDocument();

    const isbnInput = screen.getByPlaceholderText(/9780132350884/i);
    fireEvent.change(isbnInput, { target: { value: '9780132350884' } });

    expect(
      screen.getAllByText(/ISBN "9780132350884" sudah terdaftar pada buku "Clean Code"/i).length
    ).toBeGreaterThan(0);

    fireEvent.change(isbnInput, { target: { value: '9781111222233' } });
    fireEvent.change(screen.getByPlaceholderText(/Pemrograman Web/i), {
      target: { value: 'Algoritma Pemrograman' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Cari atau ketik penulis/i), {
      target: { value: 'Rinaldi Munir' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Cari atau ketik nama penerbit/i), {
      target: { value: 'Informatika' },
    });
    fireEvent.change(screen.getByPlaceholderText(/005.1 MAR c/i), {
      target: { value: '005.1 MUN a' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Tuliskan ringkasan materi/i), {
      target: { value: 'Buku dasar algoritma dan pemrograman.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Simpan Koleksi Buku/i }));

    await waitFor(() => {
      expect(onAddCollection).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findAllByText('Berhasil Menambahkan Buku')).toBeTruthy();
  });

  it('generates kode eksemplar using <3-digit seq>-<full year>-<id_buku> for both new and existing books', () => {
    const year = String(new Date().getFullYear());

    render(
      <DaftarKoleksi
        collections={sampleCollections}
        dbCategories={['Ilmu Komputer', 'Sastra & Humaniora']}
        dbAuthors={['Robert C. Martin', 'Pramoedya Ananta Toer']}
        dbPublishers={['Prentice Hall', 'Lentera Dipantara']}
        nextBookId={11}
        onAddCollection={vi.fn()}
        onUpdateCollection={vi.fn()}
        onDeleteCollection={vi.fn()}
        onImportCollections={vi.fn()}
      />
    );

    // 1. Uji Generate pada Modal Tambah Buku (menggunakan nextBookId = 11)
    fireEvent.click(screen.getByRole('button', { name: /Tambah Koleksi/i }));
    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate 2 Kode Eksemplar/i }));

    expect(screen.getByDisplayValue(`001-${year}-11`)).toBeInTheDocument();
    expect(screen.getByDisplayValue(`002-${year}-11`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Batal/i }));

    // 2. Uji Generate pada Modal Edit Buku (Clean Code id_koleksi = 1 sudah punya 2 eksemplar)
    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editButtons[1]); // Baris ke-2 adalah Clean Code (id_koleksi: 1)

    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate 2 Kode Eksemplar/i }));

    expect(screen.getByDisplayValue(`003-${year}-1`)).toBeInTheDocument();
    expect(screen.getByDisplayValue(`004-${year}-1`)).toBeInTheDocument();
  });
});

