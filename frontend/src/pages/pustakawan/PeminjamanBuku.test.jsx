import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PeminjamanBuku from './PeminjamanBuku.jsx';
import PengembalianBuku from './PengembalianBuku.jsx';

const currentUser = { pengenal: '198805122014042001', nama: 'Siti Rahmawati', role: 'Pustakawan' };

const transaksiLama = {
  id_peminjaman: 1,
  nomor_transaksi: 'TRX-202611-001',
  jalur: 'MANDIRI',
  status: 'SELESAI',
  tanggal_pinjam: '2026-11-01',
  tanggal_jatuh_tempo: '2026-11-08',
  anggota: { pengenal: '2211521001', nama: 'Ahmad Fauzan' },
  koleksi: { judul: 'Clean Code' },
  eksemplar: { kode_eksemplar: 'EKS-001-A' },
};

const kartu = (overrides = {}) => ({
  pengenal: '2211521001',
  nama: 'Ahmad Fauzan',
  status_aktif: true,
  alasan_nonaktif: null,
  pinjaman_aktif: 0,
  maks_pinjam: 3,
  denda_belum_lunas: { jumlah: 0, total: 0 },
  boleh_meminjam: true,
  alasan: null,
  ...overrides,
});

const JUDUL = { 'EKS-001-A': 'Clean Code', 'EKS-002-A': 'Refactoring', 'EKS-003-A': 'Bumi Manusia' };

const buku = (kode, overrides = {}) => ({
  jenis: 'eksemplar',
  koleksi: { kode_koleksi: 'KOL-X', judul: JUDUL[kode] },
  eksemplar: { kode_eksemplar: kode, lokasi_rak: 'RAK-1', status: 'TERSEDIA' },
  eksemplar_tersedia: 1,
  total_eksemplar: 1,
  bisa_dipinjam: true,
  alasan: null,
  ...overrides,
});

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
const ok = (data, status = 200) => json(status, { success: true, data });
const gagal = (status, message) => json(status, { success: false, message });

// Transaksi yang tercatat selama satu test; gagalSaatProses mensimulasikan stok keburu dipinjam
let tercatat;
let gagalSaatProses;
let cekBukuTertunda = null;
let selesaikanCekBuku = null;
let lookupAnggotaTertunda = null;
let selesaikanLookupAnggota = null;
let prosesTertunda = null;
let selesaikanProses = null;

const pasangFetch = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
    const B = '/api/peminjaman/pustakawan/buku/';
    const A = '/api/peminjaman/pustakawan/anggota/';
    if (url === '/api/peminjaman/ketentuan') return ok({ maks_pinjam: 3, durasi_hari: 7, tarif_denda_per_hari: 1000 });
    if (url === '/api/peminjaman/terbaru') return ok([...tercatat].reverse().concat(transaksiLama));
    if (url === `${A}2211521001`) {
      if (lookupAnggotaTertunda === '2211521001') {
        await new Promise((resolve) => {
          selesaikanLookupAnggota = resolve;
        });
      }
      return ok(kartu({ pinjaman_aktif: tercatat.length }));
    }
    if (url === `${A}2300`) return ok(kartu({ nama: 'Citra R.', pengenal: '2300', pinjaman_aktif: 2 }));
    if (url === `${A}2299`) {
      return ok(kartu({ nama: 'Bima P.', pengenal: '2299', denda_belum_lunas: { jumlah: 1, total: 5000 }, boleh_meminjam: false, alasan: 'Masih ada denda yang belum lunas.' }));
    }
    if (url.startsWith(A)) return gagal(404, 'Anggota dengan NIM/ID "999" tidak ditemukan.');
    if (url === `${B}EKS-009`) {
      return ok(buku('EKS-009', { koleksi: { judul: 'Sains Data' }, bisa_dipinjam: false, alasan: 'Eksemplar EKS-009 tercatat sedang dipinjam.' }));
    }
    if (url.startsWith(B) && JUDUL[url.slice(B.length)]) {
      const kode = url.slice(B.length);
      if (cekBukuTertunda === kode) {
        await new Promise((resolve) => {
          selesaikanCekBuku = resolve;
        });
      }
      return ok(buku(kode));
    }
    if (url.startsWith(B)) return gagal(404, 'Kode tidak ditemukan.');
    if (url === '/api/peminjaman/pustakawan' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (gagalSaatProses.includes(body.kode)) return gagal(409, 'Eksemplar baru saja dipinjam orang lain.');
      if (prosesTertunda) {
        await new Promise((resolve) => {
          selesaikanProses = resolve;
        });
      }
      const no = 10 + tercatat.length;
      const baru = {
        id_peminjaman: no,
        nomor_transaksi: `TRX-202611-0${no}`,
        jalur: 'PUSTAKAWAN',
        status: 'DIPINJAM',
        tanggal_pinjam: '2026-11-14',
        tanggal_jatuh_tempo: '2026-11-21',
        anggota: { pengenal: body.pengenal_anggota, nama: 'Ahmad Fauzan' },
        pustakawan: { nama: 'Siti Rahmawati' },
        koleksi: { judul: JUDUL[body.kode] },
        eksemplar: { kode_eksemplar: body.kode, lokasi_rak: 'RAK-1' },
      };
      tercatat.push(baru);
      return ok(baru, 201);
    }
    return gagal(404, 'tidak dikenal');
  });

const NIM = /NIM \/ NIP/;
const KODE = /Kode Eksemplar/;
const isi = (label, nilai) => fireEvent.change(screen.getByLabelText(label), { target: { value: nilai } });
const tombol = (nama) => screen.getByRole('button', { name: nama });
const tombolTambah = () => tombol(/^Tambah$/);
const tombolProses = () => tombol(/Proses peminjaman/);

/** Tahap 1: isi NIM lalu klik Pilih; tunggu ringkasan anggota tampil. */
const pilih = async (nim = '2211521001') => {
  isi(NIM, nim);
  fireEvent.click(tombol(/^Pilih$/));
  await screen.findByText(/buku dipinjam/);
};

/** Tahap 2: isi kode lalu klik Tambah; tunggu pengecekan selesai. */
const tambah = async (kode) => {
  isi(KODE, kode);
  fireEvent.click(tombolTambah());
  await waitFor(() => expect(screen.queryByText('Memeriksa buku…')).not.toBeInTheDocument());
};

beforeEach(() => {
  tercatat = [];
  gagalSaatProses = [];
  cekBukuTertunda = null;
  selesaikanCekBuku = null;
  lookupAnggotaTertunda = null;
  selesaikanLookupAnggota = null;
  prosesTertunda = null;
  selesaikanProses = null;
  pasangFetch();
});

afterEach(() => {
  cleanup(); // vitest tanpa globals: bersihkan tampilan setiap selesai test
  vi.restoreAllMocks();
});

describe('Pengembalian dari sumber backend', () => {
  it('memuat transaksi terbaru dan dapat mencarinya kembali', async () => {
    tercatat = [{
      id_peminjaman: 10,
      nomor_transaksi: 'TRX-202611-010',
      status: 'DIPINJAM',
      tanggal_pinjam: '2026-11-14',
      tanggal_jatuh_tempo: '2026-11-21',
      koleksi: { judul: 'Refactoring' },
      eksemplar: { kode_eksemplar: 'EKS-002-A' },
    }];
    render(
      <PengembalianBuku
        loans={[]}
        currentUser={currentUser}
        onReturnLoan={vi.fn()}
      />,
    );

    expect(await screen.findByText('TRX-202611-010')).toBeInTheDocument();
    expect(screen.getAllByText('EKS-002-A').length).toBeGreaterThan(0);
  });
});

describe('Tahap 1: pilih anggota (antrean, NIM diisi sekali)', () => {
  it('menampilkan durasi dari konfigurasi dan transaksi terbaru dari database', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    expect(await screen.findByText(/Masa pinjam 7 hari/)).toBeInTheDocument();
    expect(await screen.findByText('TRX-202611-001')).toBeInTheDocument();
  });

  it('kolom kode belum aktif sebelum anggota dipilih', () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    expect(screen.getByLabelText(NIM)).toHaveFocus();
    expect(screen.getByLabelText(KODE)).toBeDisabled();
    expect(tombolTambah()).toBeDisabled();
    expect(tombolProses()).toBeDisabled();
  });

  it('Enter di kolom NIM memilih anggota: NIM terkunci dan kursor pindah ke kolom kode', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    isi(NIM, '2211521001');
    fireEvent.keyDown(screen.getByLabelText(NIM), { key: 'Enter' });

    const panel = within(screen.getByRole('complementary', { name: 'Ringkasan peminjaman' }));
    expect(await panel.findByText('Aktif · 0/3 buku dipinjam · Tanpa denda')).toBeInTheDocument();
    expect(screen.getByLabelText(NIM)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(KODE)).toBeEnabled();
    // kursor dipindah sesaat setelah tampilan diperbarui
    await waitFor(() => expect(screen.getByLabelText(KODE)).toHaveFocus());
    expect(tombol(/^Ganti$/)).toBeInTheDocument();
  });

  it('NIM dikunci saat pencarian anggota berjalan', async () => {
    lookupAnggotaTertunda = '2211521001';
    render(<PeminjamanBuku currentUser={currentUser} />);
    isi(NIM, '2211521001');
    fireEvent.click(tombol(/^Pilih$/));

    expect(await screen.findByRole('button', { name: 'Pilih' })).toBeDisabled();
    expect(screen.getByLabelText(NIM)).toHaveAttribute('readonly');

    selesaikanLookupAnggota();
    await waitFor(() => expect(screen.getByLabelText(KODE)).toBeEnabled());
  });

  it('Enter pada NIM aktif tidak memilih ulang anggota', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    const jumlahPermintaan = fetch.mock.calls.filter(([url]) =>
      url.includes('/anggota/2211521001'),
    ).length;

    fireEvent.keyDown(screen.getByLabelText(NIM), { key: 'Enter' });

    expect(fetch.mock.calls.filter(([url]) =>
      url.includes('/anggota/2211521001'),
    )).toHaveLength(jumlahPermintaan);
  });

  it('anggota yang tidak memenuhi syarat: popup alasan dan tidak bisa lanjut', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    isi(NIM, '2299');
    fireEvent.click(tombol(/^Pilih$/));

    expect(await screen.findByText('Masih ada denda yang belum lunas.')).toBeInTheDocument();
    expect(screen.getByLabelText(KODE)).toBeDisabled();
  });

  it('NIM yang tidak terdaftar', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    isi(NIM, '999');
    fireEvent.click(tombol(/^Pilih$/));
    expect(await screen.findByText(/tidak ditemukan/)).toBeInTheDocument();
  });

  it('Ganti dengan buku yang belum diproses meminta konfirmasi dulu', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    await tambah('EKS-002-A');
    expect(screen.getByText(/Daftar buku/)).toBeInTheDocument();

    // Batal: daftar tetap ada
    fireEvent.click(tombol(/^Ganti$/));
    expect(screen.getByText('1 buku di daftar belum diproses dan akan dihapus dari daftar.')).toBeInTheDocument();
    fireEvent.click(tombol('Batal'));
    expect(screen.getByText(/Daftar buku/)).toBeInTheDocument();
    expect(screen.getByLabelText(NIM)).toHaveValue('2211521001');

    // Ganti anggota: daftar dikosongkan
    fireEvent.click(tombol(/^Ganti$/));
    fireEvent.click(tombol('Ganti anggota'));
    expect(screen.queryByText(/Daftar buku/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(NIM)).toHaveValue('');
    expect(screen.getByLabelText(NIM)).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText(NIM)).toHaveFocus();
  });
});

describe('Tahap 2: daftar buku, lalu proses sekaligus', () => {
  it('menampilkan ringkasan buku yang sedang diketik', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    isi(KODE, 'EKS-002-A');
    const panel = within(screen.getByRole('complementary', { name: 'Ringkasan peminjaman' }));
    expect(await panel.findByText('Refactoring')).toBeInTheDocument();
    expect(panel.getByText('EKS-002-A · Rak RAK-1')).toBeInTheDocument();
  });

  it('eksemplar yang sedang dipinjam: alasan tampil dan Tambah dikunci', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    isi(KODE, 'EKS-009');
    expect(await screen.findByText('Eksemplar EKS-009 tercatat sedang dipinjam.')).toBeInTheDocument();
    expect(tombolTambah()).toBeDisabled();
  });

  it('buku yang ditambahkan bisa dihapus dan belum tercatat sebelum diproses', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    await tambah('EKS-001-A');
    await tambah('EKS-002-A');
    expect(screen.getByText('Daftar buku (2 dari 3)')).toBeInTheDocument();
    expect(screen.getByLabelText(KODE)).toHaveFocus();

    fireEvent.click(tombol('Hapus Clean Code dari daftar'));
    expect(screen.getByText('Daftar buku (1 dari 3)')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  });

  it('Enter di kolom kode menambahkan buku', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    isi(KODE, 'EKS-003-A');
    fireEvent.keyDown(screen.getByLabelText(KODE), { key: 'Enter' });
    expect(await screen.findByText('Daftar buku (1 dari 3)')).toBeInTheDocument();
  });

  it('scan cepat berturut-turut: semua buku masuk daftar tanpa ada yang terlewat', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    for (const kode of ['EKS-001-A', 'EKS-002-A']) {
      isi(KODE, kode);
      fireEvent.keyDown(screen.getByLabelText(KODE), { key: 'Enter' });
    }
    expect(await screen.findByText('Daftar buku (2 dari 3)')).toBeInTheDocument();
  });

  it('Ganti anggota dinonaktifkan selama pengecekan buku tertunda', async () => {
    cekBukuTertunda = 'EKS-002-A';
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();

    isi(KODE, 'EKS-002-A');
    fireEvent.keyDown(screen.getByLabelText(KODE), { key: 'Enter' });

    expect(await screen.findByText('Memeriksa buku…')).toBeInTheDocument();
    expect(tombol(/^Ganti$/)).toBeDisabled();

    selesaikanCekBuku();
    await screen.findByText('Daftar buku (1 dari 3)');
    expect(tombol(/^Ganti$/)).toBeEnabled();
  });

  it('buku ditolak: popup muncul, kode dikembalikan ke kolom, Tambah tetap aktif', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    await tambah('EKS-002-A');
    await tambah('EKS-002-A');

    expect(await screen.findByText('Eksemplar EKS-002-A sudah ada di daftar.')).toBeInTheDocument();
    expect(screen.getByLabelText(KODE)).toHaveValue('EKS-002-A');
    expect(tombolTambah()).toBeEnabled();

    fireEvent.click(tombol('Mengerti'));
    expect(screen.getByLabelText(KODE)).toHaveFocus();
  });

  it('daftar dibatasi sisa kuota anggota', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih('2300'); // sudah meminjam 2 dari 3
    await tambah('EKS-002-A');
    await tambah('EKS-003-A');
    expect(await screen.findByText('Kuota peminjaman anggota ini tersisa 1 buku.')).toBeInTheDocument();
    expect(screen.getByText('Daftar buku (1 dari 1)')).toBeInTheDocument();
  });

  it('menjaga anggota dan daftar selama batch peminjaman aktif', async () => {
    prosesTertunda = true;
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    await tambah('EKS-002-A');

    fireEvent.click(tombolProses());

    expect(tombol(/^Ganti$/)).toBeDisabled();
    expect(screen.getByLabelText(NIM)).toHaveValue('2211521001');
    expect(screen.getByText(/Daftar buku/)).toBeInTheDocument();

    selesaikanProses();
    await screen.findByText('1 peminjaman tercatat');
  });

  it('memproses semua buku sekaligus, Cetak menghasilkan satu bukti, lalu Selesai untuk antrean berikutnya', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container } = render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    await tambah('EKS-002-A');
    await tambah('EKS-003-A');

    fireEvent.click(tombolProses());

    expect(await screen.findByText('2 peminjaman tercatat')).toBeInTheDocument();
    expect(print).not.toHaveBeenCalled(); // Proses hanya mencatat
    expect(screen.queryByText(/Daftar buku/)).not.toBeInTheDocument();
    expect(await screen.findByText('Aktif · 2/3 buku dipinjam · Tanpa denda')).toBeInTheDocument();

    const posts = fetch.mock.calls.filter(([, o]) => o?.method === 'POST').map(([, o]) => JSON.parse(o.body));
    expect(posts.map((p) => p.kode)).toEqual(['EKS-002-A', 'EKS-003-A']);
    expect(posts.every((p) => p.pengenal_anggota === '2211521001')).toBe(true);
    expect(posts[0].kunci_idempotensi).not.toBe(posts[1].kunci_idempotensi);

    const bukti = container.querySelector('.bukti-cetak');
    expect(bukti).toHaveTextContent('TRX-202611-010');
    expect(bukti).toHaveTextContent('Refactoring');
    expect(bukti).toHaveTextContent('TRX-202611-011');
    expect(bukti).toHaveTextContent('Bumi Manusia');
    expect(bukti).toHaveTextContent('Siti Rahmawati');

    fireEvent.click(tombol(/^Cetak$/));
    expect(print).toHaveBeenCalledTimes(1);

    fireEvent.click(tombol('Selesai'));
    expect(screen.getByLabelText(NIM)).toHaveValue('');
    expect(screen.getByLabelText(NIM)).toHaveFocus();
    expect(screen.getByLabelText(KODE)).toBeDisabled();
    expect(screen.queryByText(/peminjaman tercatat/)).not.toBeInTheDocument();
  });

  it('buku yang gagal saat diproses tetap di daftar, yang berhasil tetap tercatat', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    gagalSaatProses = ['EKS-003-A'];
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    await tambah('EKS-002-A');
    await tambah('EKS-003-A');

    fireEvent.click(tombolProses());

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Bumi Manusia: Eksemplar baru saja dipinjam orang lain.')).toBeInTheDocument();
    expect(screen.getByText('1 peminjaman tercatat')).toBeInTheDocument();
    expect(screen.getByText(/Daftar buku \(1/)).toBeInTheDocument();
  });
});

describe('Ganti anggota tanpa daftar', () => {
  beforeEach(() => {
    tercatat = [];
    gagalSaatProses = [];
  });

  it('langsung mengosongkan form tanpa konfirmasi jika daftar kosong', async () => {
    render(<PeminjamanBuku currentUser={currentUser} />);
    await pilih();
    fireEvent.click(tombol(/^Ganti$/));
    expect(screen.queryByText('Ganti anggota?')).not.toBeInTheDocument();
    expect(screen.getByLabelText(NIM)).toHaveValue('');
  });
});
