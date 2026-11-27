import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App.jsx';
import { headerBypass } from './services/apiClient.js';
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

function clickButton(name, scope = screen) {
  fireEvent.click(scope.getByRole('button', { name }));
}

function changeValue(input, value) {
  fireEvent.change(input, { target: { value } });
}

function createKoleksiFetchMock(initialBooks = sampleCollections) {
  let dbBooks = initialBooks.map((b) => ({ ...b }));
  let nextId = Math.max(0, ...dbBooks.map((b) => b.id_koleksi || 0)) + 1;

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
    const urlStr = String(url);
    const method = (options.method || 'GET').toUpperCase();

    if (urlStr.includes('/api/koleksi/opsi-form')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            kategori: ['Ilmu Komputer', 'Sastra & Humaniora'],
            pengarang: ['Robert C. Martin', 'Pramoedya Ananta Toer'],
            penerbit: ['Prentice Hall', 'Lentera Dipantara'],
            next_id_koleksi: nextId,
          },
        }),
      };
    }

    if (urlStr.match(/\/api\/koleksi\/\d+$/) && method === 'PUT') {
      const id = Number(urlStr.split('/').pop());
      const body = JSON.parse(options.body || '{}');
      dbBooks = dbBooks.map((b) => (b.id_koleksi === id ? { ...b, ...body, id_koleksi: id } : b));
      const updated = dbBooks.find((b) => b.id_koleksi === id);
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: updated }),
      };
    }

    if (urlStr.match(/\/api\/koleksi\/\d+$/) && method === 'DELETE') {
      const id = Number(urlStr.split('/').pop());
      dbBooks = dbBooks.filter((b) => b.id_koleksi !== id);
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id_koleksi: id } }),
      };
    }

    if (urlStr.includes('/api/koleksi') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const created = {
        ...body,
        id_koleksi: nextId++,
        kode_koleksi: `KOL-00${nextId}`,
        total_stok: Array.isArray(body.eksemplar) ? body.eksemplar.length : 0,
        stok_tersedia: Array.isArray(body.eksemplar) ? body.eksemplar.length : 0,
      };
      dbBooks = [created, ...dbBooks];
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: created }),
      };
    }

    if (urlStr.includes('/api/koleksi')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: dbBooks }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    };
  });
}

/**
 * API tiruan untuk modul Admin (Kelola Akun memakai /api/admin/akun).
 * Permintaan lain diteruskan ke tiruan koleksi di atas.
 */
function createAdminFetchMock() {
  const spy = createKoleksiFetchMock();
  const lanjutkan = spy.getMockImplementation();
  const akun = [
    {
      id_pengguna: 1,
      pengenal: 'ADM-001',
      nama: 'Administrator',
      role: 'Admin',
      status_aktif: true,
      alasan_nonaktif: null,
      dibuat_pada: '2026-11-01T00:00:00.000Z',
    },
  ];
  let idBerikutnya = 2;
  const parameter = [
    {
      kunci_parameter: 'durasi_pinjam_hari',
      label: 'Durasi peminjaman',
      deskripsi: 'Jumlah hari sampai jatuh tempo.',
      nilai: '7',
      tipe_data: 'number',
      satuan: 'hari',
      nilai_min: '1',
      nilai_maks: '30',
      wajib: true,
    },
  ];
  const riwayat = [];
  const berhasil = (data, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });

  spy.mockImplementation(async (url, options = {}) => {
    const urlStr = String(url);
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};

    if (urlStr.startsWith('/api/admin/akun') && method === 'GET') {
      return berhasil({ items: akun, total: akun.length, halaman: 1, per_halaman: 10 });
    }
    if (urlStr === '/api/admin/akun' && method === 'POST') {
      const baru = {
        id_pengguna: idBerikutnya++,
        pengenal: body.pengenal,
        nama: body.nama,
        role: body.role,
        status_aktif: true,
        alasan_nonaktif: null,
        dibuat_pada: '2026-11-27T00:00:00.000Z',
      };
      akun.unshift(baru);
      return berhasil(baru, 201);
    }
    const status = urlStr.match(/^\/api\/admin\/akun\/(\d+)\/status$/);
    if (status && method === 'PATCH') {
      const target = akun.find((a) => a.id_pengguna === Number(status[1]));
      target.status_aktif = body.status_aktif;
      target.alasan_nonaktif = body.status_aktif ? null : body.alasan;
      return berhasil(target);
    }
    if (urlStr.startsWith('/api/admin/konfigurasi/riwayat')) {
      return berhasil(riwayat);
    }
    if (urlStr === '/api/admin/konfigurasi' && method === 'GET') {
      return berhasil(parameter);
    }
    const ubahNilai = urlStr.match(/^\/api\/admin\/konfigurasi\/([a-z_]+)$/);
    if (ubahNilai && method === 'PATCH') {
      const target = parameter.find((p) => p.kunci_parameter === ubahNilai[1]);
      riwayat.unshift({
        id_log: riwayat.length + 1,
        kunci_parameter: target.kunci_parameter,
        label: target.label,
        nilai_lama: target.nilai,
        nilai_baru: String(body.nilai),
        waktu: '2026-11-27T03:00:00.000Z',
        pengubah: { id_pengguna: 1, nama: 'Administrator', pengenal: 'ADM-001' },
      });
      target.nilai = String(body.nilai);
      return berhasil({ parameter: target, berubah: true });
    }
    return lanjutkan(url, options);
  });
  return spy;
}

describe('App', () => {
  it('renders the application name', () => {
    createKoleksiFetchMock([]);

    render(<App />);

    expect(screen.getByText('SIAPT UNAND')).toBeInTheDocument();
  });

  it('memvalidasi pengenal dan mengakhiri sesi dari navbar', () => {
    createKoleksiFetchMock();
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
  }, 15000);

  describe('identitas sesi saat Admin mengubah akunnya sendiri', () => {
    /** PATCH /api/admin/akun/1 ditahan sampai `selesaikan()` dipanggil. */
    function siapkanSimpanTertunda() {
      const spy = createAdminFetchMock();
      const lanjutkan = spy.getMockImplementation();
      let selesaikan;
      const tertunda = new Promise((r) => {
        selesaikan = r;
      });
      spy.mockImplementation(async (url, options = {}) => {
        if (String(url) === '/api/admin/akun/1' && options.method === 'PATCH') {
          const body = JSON.parse(options.body);
          await tertunda;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: { id_pengguna: 1, role: 'Admin', status_aktif: true, alasan_nonaktif: null, ...body },
            }),
          };
        }
        return lanjutkan(url, options);
      });
      return { spy, selesaikan: () => selesaikan() };
    }

    const headerTerakhir = (spy, awalan) =>
      spy.mock.calls.filter(([u]) => String(u).startsWith(awalan)).at(-1)?.[1]?.headers?.['x-pengenal'];

    async function ubahPengenalSendiri() {
      clickButton('Admin');
      clickButton('Kelola Akun');
      fireEvent.click(await screen.findByRole('button', { name: 'Ubah ADM-001' }));
      const dialog = within(screen.getByRole('dialog'));
      changeValue(dialog.getByLabelText('Pengenal *'), 'ADM-BARU');
      clickButton('Simpan Perubahan', dialog);
    }

    afterEach(() => vi.unstubAllEnvs());

    const bypassAktif = { VITE_AUTH_SEMENTARA: 'true' };
    const tungguPatchSelesai = async (spy) => {
      await waitFor(() => expect(spy.mock.calls.some(([u, o]) => u === '/api/admin/akun/1' && o?.method === 'PATCH')).toBe(true));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    };

    it('selesai setelah logout: tetap di halaman login dan identitas tidak terpasang lagi', async () => {
      const { spy, selesaikan } = siapkanSimpanTertunda();
      render(<App />);
      await ubahPengenalSendiri();

      clickButton('Keluar');
      selesaikan();
      await tungguPatchSelesai(spy);

      expect(screen.getByRole('button', { name: 'Masuk ke Layanan' })).toBeVisible();
      expect(headerBypass(bypassAktif)).toEqual({});
    }, 15000);

    it('selesai setelah login akun lain: identitas sesi baru tidak tertimpa', async () => {
      const { spy, selesaikan } = siapkanSimpanTertunda();
      render(<App />);
      await ubahPengenalSendiri();

      clickButton('Keluar');
      changeValue(screen.getByPlaceholderText(/2211521001 atau ADM-001/), 'ADM-002');
      changeValue(screen.getByLabelText(/kata sandi|password/i), 'contoh');
      changeValue(screen.getByRole('combobox'), 'Admin');
      clickButton('Masuk ke Layanan');
      selesaikan();
      await tungguPatchSelesai(spy);

      expect(headerBypass(bypassAktif)).toEqual({ 'x-pengenal': 'ADM-002' });
      expect(screen.queryByText('ADM-BARU')).not.toBeInTheDocument();
    }, 15000);

    it('modal yang dibuka sebelum pengenal berganti tetap memperbarui identitas sesi', async () => {
      const { selesaikan } = siapkanSimpanTertunda();
      render(<App />);
      await ubahPengenalSendiri(); // ADM-001 -> ADM-BARU, masih tertunda

      // Tutup modal, buka lagi dari baris yang masih berpengenal ADM-001
      clickButton('Tutup Modal');
      clickButton('Ubah ADM-001');
      selesaikan();
      await waitFor(() => expect(headerBypass(bypassAktif)).toEqual({ 'x-pengenal': 'ADM-BARU' }));

      const dialog = within(screen.getByRole('dialog'));
      changeValue(dialog.getByLabelText('Pengenal *'), 'ADM-KEDUA');
      clickButton('Simpan Perubahan', dialog);
      await waitFor(() => expect(headerBypass(bypassAktif)).toEqual({ 'x-pengenal': 'ADM-KEDUA' }));
    }, 15000);

    it('selesai saat sesi masih aktif: identitas ikut diperbarui', async () => {
      vi.stubEnv('VITE_AUTH_SEMENTARA', 'true');
      const { spy, selesaikan } = siapkanSimpanTertunda();
      render(<App />);
      await ubahPengenalSendiri();
      expect(headerTerakhir(spy, '/api/admin/akun')).toBe('ADM-001');

      selesaikan();
      // Daftar dimuat ulang setelah simpan, kini dengan pengenal yang baru
      await waitFor(() => expect(headerTerakhir(spy, '/api/admin/akun')).toBe('ADM-BARU'));
      expect(screen.queryByRole('button', { name: 'Masuk ke Layanan' })).not.toBeInTheDocument();
    }, 15000);
  });

  it('menambah pengguna, mengubah statusnya, dan menyimpan konfigurasi', async () => {
    createAdminFetchMock();
    render(<App />);
    clickButton('Admin');
    clickButton('Kelola Akun');
    await screen.findByText('ADM-001');

    // Kelola Akun memakai API (UC-13): tambah akun dengan kata sandi awal
    clickButton(/Tambah Pengguna/);
    let dialog = within(screen.getByRole('dialog'));
    changeValue(dialog.getByLabelText('Peran *'), 'Pustakawan');
    changeValue(dialog.getByLabelText('Pengenal (NIM / NIP / username) *'), '1985010101');
    changeValue(dialog.getByLabelText('Nama lengkap *'), 'Nadia Penguji');
    changeValue(dialog.getByLabelText('Kata sandi awal *'), 'rahasia123');
    changeValue(dialog.getByLabelText('Ulangi kata sandi *'), 'rahasia123');
    clickButton('Simpan Pengguna', dialog);
    await screen.findByRole('row', { name: /Nadia Penguji/ });

    // Nonaktifkan wajib alasan, lalu aktifkan kembali
    clickButton('Nonaktifkan 1985010101');
    dialog = within(screen.getByRole('dialog'));
    changeValue(dialog.getByLabelText('Alasan penonaktifan *'), 'Cuti panjang');
    clickButton('Nonaktifkan', dialog);
    await waitFor(() =>
      expect(within(screen.getByRole('row', { name: /Nadia Penguji/ })).getByText('Nonaktif')).toBeVisible(),
    );
    clickButton('Aktifkan 1985010101');
    clickButton('Aktifkan', within(screen.getByRole('dialog')));
    await waitFor(() =>
      expect(within(screen.getByRole('row', { name: /Nadia Penguji/ })).getByText('Aktif')).toBeVisible(),
    );

    // Konfigurasi memakai API (UC-15): nilai baru tersimpan dan tercatat di riwayat
    clickButton('Kelola Konfigurasi Sistem');
    await screen.findByRole('row', { name: /durasi_pinjam_hari/i });
    clickButton('Ubah nilai Durasi peminjaman');
    dialog = within(screen.getByRole('dialog'));
    changeValue(dialog.getByLabelText('Nilai baru (hari) *'), '21');
    clickButton('Simpan Nilai', dialog);
    expect(await screen.findByText('Durasi peminjaman diubah menjadi 21 hari.')).toBeVisible();
    await waitFor(() =>
      expect(within(screen.getByRole('row', { name: /durasi_pinjam_hari/i })).getByText('21 hari')).toBeVisible(),
    );
  }, 15000);

  it('mencari, menambah, mengedit, dan menghapus koleksi dari akun pustakawan', async () => {
    createKoleksiFetchMock();
    render(<App />);
    clickButton('Pustakawan');

    await screen.findByRole('row', { name: /Bumi Manusia/i });

    const search = screen.getByPlaceholderText(/Cari judul, penulis/i);
    changeValue(search, 'koleksi yang tidak ada');
    expect(screen.queryByRole('row', { name: /Bumi Manusia/i })).not.toBeInTheDocument();
    changeValue(search, '');
    expect(screen.getByRole('row', { name: /Bumi Manusia/i })).toBeVisible();

    clickButton(/Kategori: Semua/i);
    let dialog = within(screen.getByRole('dialog'));
    const categorySelect = dialog.getByRole('combobox');
    changeValue(categorySelect, 'Sastra & Humaniora');
    expect(screen.queryByRole('row', { name: /Clean Code/i })).not.toBeInTheDocument();

    clickButton(/Kategori: Sastra & Humaniora/i);
    dialog = within(screen.getByRole('dialog'));
    clickButton('Reset Kategori', dialog);
    expect(screen.getByRole('row', { name: /Clean Code/i })).toBeVisible();

    clickButton(/Tambah Koleksi/);
    dialog = within(screen.getByRole('dialog'));
    changeValue(dialog.getByPlaceholderText(/Pemrograman Web/i), 'Koleksi Uji');
    changeValue(dialog.getByPlaceholderText(/Cari atau ketik penulis/i), 'Nadia');
    changeValue(dialog.getByPlaceholderText(/Cari atau ketik nama penerbit/i), 'Informatika');
    changeValue(dialog.getByPlaceholderText(/9780132350884/i), '9781111222299');
    changeValue(dialog.getByPlaceholderText(/005.1 MAR c/i), '005.1 NAD');
    changeValue(dialog.getByPlaceholderText(/Tuliskan ringkasan materi/i), 'Deskripsi koleksi uji.');
    clickButton('Simpan Koleksi Buku', dialog);

    await screen.findAllByText('Berhasil Menambahkan Buku');
    clickButton('Tutup');

    const row = within(await screen.findByRole('row', { name: /Koleksi Uji/ }));
    fireEvent.click(row.getByTitle('Edit Koleksi'));
    dialog = within(screen.getByRole('dialog'));
    changeValue(dialog.getByDisplayValue('Koleksi Uji'), 'Koleksi Diperbarui');
    clickButton('Simpan Perubahan', dialog);

    await screen.findAllByText('Berhasil Memperbarui Buku');
    clickButton('Tutup');
    expect(await screen.findByRole('row', { name: /Koleksi Diperbarui/ })).toBeVisible();

    const updatedRow = within(screen.getByRole('row', { name: /Koleksi Diperbarui/ }));
    fireEvent.click(updatedRow.getByTitle('Hapus Koleksi'));
    clickButton('Ya, Hapus Koleksi', within(screen.getByRole('dialog')));

    await screen.findAllByText('Berhasil Menghapus Buku');
    clickButton('Tutup');
    expect(screen.queryByRole('row', { name: /Koleksi Diperbarui/i })).not.toBeInTheDocument();
  }, 30000);

  it('menolak kode yang tidak dikenal dan memproses pengembalian yang valid', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/peminjaman')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id_peminjaman: 1, status: 'SELESAI', koleksi: { judul: 'Clean Code' } },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    });
    render(<App />);
    clickButton('Pustakawan');
    clickButton('Pengembalian Buku');

    const code = screen.getByPlaceholderText(/TRX-202611-001/);
    changeValue(code, 'KODE-TIDAK-ADA');
    clickButton('Verifikasi & Kembalikan');
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(expect.stringContaining('KODE-TIDAK-ADA')),
    );

    changeValue(code, 'trx-202611-001');
    clickButton('Verifikasi & Kembalikan');
    await waitFor(() => expect(screen.getByText(/berhasil dikembalikan/)).toBeVisible());
    await waitFor(() => expect(screen.queryByText('TRX-202611-001')).not.toBeInTheDocument());
  }, 15000);

  it('menampilkan ringkasan sirkulasi untuk pengelola', () => {
    createKoleksiFetchMock();
    render(<App />);
    clickButton('Pengelola');
    expect(screen.getByRole('heading', { name: 'Dashboard Analitik Perpustakaan' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /Top 5 Koleksi/ })).toBeVisible();
  }, 15000);
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
    expect(screen.getByRole('dialog', { name: 'Filter Kategori Koleksi' })).toBeInTheDocument();

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
  }, 15000);

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
  }, 15000);
});

