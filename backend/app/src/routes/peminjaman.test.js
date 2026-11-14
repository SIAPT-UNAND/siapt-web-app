import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Database tiruan: test tidak memakai database asli.
const db = vi.hoisted(() => ({
  pengguna: { findUnique: vi.fn() },
  denda: { count: vi.fn(), aggregate: vi.fn() },
  koleksi: { findUnique: vi.fn() },
  eksemplar: { findFirst: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  konfigurasiSistem: { findMany: vi.fn() },
  detailPeminjaman: { count: vi.fn() },
  peminjaman: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock('../lib/prisma.js', () => ({ default: db, prisma: db }));

const { default: app } = await import('../app.js');

const anggota = { id_pengguna: 3, status_aktif: true, role: { nama_role: 'Anggota' } };
const pustakawan = { id_pengguna: 2, status_aktif: true, role: { nama_role: 'Pustakawan' } };
const koleksi = { id_koleksi: 1, kode_koleksi: 'KOL-CS-001', judul: 'Clean Code', status_aktif: true };
const eksemplar = { id_eksemplar: 10, id_koleksi: 1, kode_eksemplar: 'EKS-001-A', lokasi_rak: 'RAK-CS-01', status: 'TERSEDIA' };
const konfigurasi = [
  { kunci_parameter: 'maks_pinjam_eksemplar', nilai: '3' },
  { kunci_parameter: 'durasi_pinjam_hari', nilai: '7' },
];

const hasilTersimpan = (overrides = {}) => ({
  id_peminjaman: 5,
  id_anggota: 3,
  nomor_transaksi: 'TRX-202611-005',
  jalur: 'MANDIRI',
  status: 'DIPINJAM',
  tanggal_pinjam: new Date('2026-11-14'),
  tanggal_jatuh_tempo: new Date('2026-11-21'),
  detail_peminjaman: [{ eksemplar: { ...eksemplar, koleksi } }],
  ...overrides,
});

// Pengguna yang login (header) dan anggota yang diperiksa syaratnya
const loginSebagai = (pengguna) => db.pengguna.findUnique.mockResolvedValue(pengguna);

const pinjam = (body = { id_koleksi: 1 }, pengenal = '2211521001') =>
  request(app).post('/api/peminjaman/mandiri').set('x-pengenal', pengenal).send(body);

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn) => fn(db));
  loginSebagai(anggota);
  db.denda.count.mockResolvedValue(0);
  db.koleksi.findUnique.mockResolvedValue(koleksi);
  db.eksemplar.findFirst.mockResolvedValue(eksemplar);
  db.eksemplar.updateMany.mockResolvedValue({ count: 1 });
  db.konfigurasiSistem.findMany.mockResolvedValue(konfigurasi);
  db.detailPeminjaman.count.mockResolvedValue(0);
  db.peminjaman.findUnique.mockResolvedValue(null);
  db.peminjaman.create.mockResolvedValue({ id_peminjaman: 5 });
  db.peminjaman.update.mockResolvedValue(hasilTersimpan());
});

describe('POST /api/peminjaman/mandiri', () => {
  it('mencatat peminjaman jika semua syarat terpenuhi', async () => {
    const res = await pinjam();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      nomor_transaksi: 'TRX-202611-005',
      status: 'DIPINJAM',
      jalur: 'MANDIRI',
      koleksi: { judul: 'Clean Code' },
      eksemplar: { kode_eksemplar: 'EKS-001-A' },
    });

    // Eksemplar diubah menjadi DIPINJAM hanya jika masih TERSEDIA
    expect(db.eksemplar.updateMany).toHaveBeenCalledWith({
      where: { id_eksemplar: 10, status: 'TERSEDIA' },
      data: { status: 'DIPINJAM' },
    });

    // Jatuh tempo = tanggal pinjam + durasi dari konfigurasi (7 hari)
    const data = db.peminjaman.create.mock.calls[0][0].data;
    expect(data.id_anggota).toBe(3);
    expect(data.jalur).toBe('MANDIRI');
    expect(data.status).toBe('DIPINJAM');
    expect((data.tanggal_jatuh_tempo - data.tanggal_pinjam) / 86400000).toBe(7);
  });

  it('menolak akun tidak aktif', async () => {
    loginSebagai({ ...anggota, status_aktif: false });
    const res = await pinjam();
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/tidak aktif/);
    expect(db.peminjaman.create).not.toHaveBeenCalled();
  });

  it('menolak anggota yang masih punya denda belum lunas', async () => {
    db.denda.count.mockResolvedValue(1);
    const res = await pinjam();
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/denda/);
    expect(db.peminjaman.create).not.toHaveBeenCalled();
  });

  it('menolak koleksi yang tidak aktif', async () => {
    db.koleksi.findUnique.mockResolvedValue({ ...koleksi, status_aktif: false });
    const res = await pinjam();
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/tidak aktif/);
  });

  it('menolak koleksi yang tidak ada', async () => {
    db.koleksi.findUnique.mockResolvedValue(null);
    const res = await pinjam({ id_koleksi: 99 });
    expect(res.status).toBe(404);
  });

  it('menolak jika stok habis', async () => {
    db.eksemplar.findFirst.mockResolvedValue(null);
    const res = await pinjam();
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/habis/);
    expect(db.peminjaman.create).not.toHaveBeenCalled();
  });

  it('menolak jika batas peminjaman dari konfigurasi tercapai', async () => {
    db.detailPeminjaman.count.mockResolvedValue(3);
    const res = await pinjam();
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/maksimal 3/);
    expect(db.peminjaman.create).not.toHaveBeenCalled();
  });

  it('memakai batas dari konfigurasi, bukan angka tetap', async () => {
    db.konfigurasiSistem.findMany.mockResolvedValue([
      { kunci_parameter: 'maks_pinjam_eksemplar', nilai: '5' },
      { kunci_parameter: 'durasi_pinjam_hari', nilai: '14' },
    ]);
    db.detailPeminjaman.count.mockResolvedValue(3);
    const res = await pinjam();
    expect(res.status).toBe(201);
    const data = db.peminjaman.create.mock.calls[0][0].data;
    expect((data.tanggal_jatuh_tempo - data.tanggal_pinjam) / 86400000).toBe(14);
  });

  it('menolak jika eksemplar keburu dipinjam orang lain', async () => {
    db.eksemplar.updateMany.mockResolvedValue({ count: 0 });
    const res = await pinjam();
    expect(res.status).toBe(409);
    expect(db.peminjaman.create).not.toHaveBeenCalled();
  });

  it('tidak membuat transaksi ganda jika dikirim dua kali dengan kunci yang sama', async () => {
    db.peminjaman.findUnique.mockResolvedValue(hasilTersimpan());
    const res = await pinjam({ id_koleksi: 1, kunci_idempotensi: 'abc-123' });
    expect(res.status).toBe(200);
    expect(res.body.data.nomor_transaksi).toBe('TRX-202611-005');
    expect(db.peminjaman.create).not.toHaveBeenCalled();
  });

  it('bisa memilih koleksi lewat kode_koleksi', async () => {
    const res = await pinjam({ kode_koleksi: 'KOL-CS-001' });
    expect(res.status).toBe(201);
    expect(db.koleksi.findUnique).toHaveBeenCalledWith({ where: { kode_koleksi: 'KOL-CS-001' } });
    expect(db.eksemplar.findFirst.mock.calls[0][0].where.id_koleksi).toBe(1);
  });

  it('menolak jika koleksi tidak dipilih', async () => {
    const res = await pinjam({});
    expect(res.status).toBe(400);
  });

  it('menolak jika belum login', async () => {
    const res = await request(app).post('/api/peminjaman/mandiri').send({ id_koleksi: 1 });
    expect(res.status).toBe(401);
  });

  it('menolak peran selain Anggota', async () => {
    loginSebagai(pustakawan);
    const res = await pinjam({ id_koleksi: 1 }, '198805122014042001');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/peminjaman/cek', () => {
  const cek = (kode = 'KOL-CS-001') =>
    request(app)
      .get('/api/peminjaman/cek')
      .query(kode === null ? {} : { kode_koleksi: kode })
      .set('x-pengenal', '2211521001');

  it('mengembalikan data koleksi dan sisa kuota tanpa menyimpan apa pun', async () => {
    db.eksemplar.count.mockResolvedValue(2);
    db.detailPeminjaman.count.mockResolvedValue(1);

    const res = await cek();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      koleksi: { id_koleksi: 1, kode_koleksi: 'KOL-CS-001', judul: 'Clean Code' },
      lokasi_rak: 'RAK-CS-01',
      eksemplar_tersedia: 2,
      maks_pinjam: 3,
      sisa_kuota: 2,
    });
    expect(db.peminjaman.create).not.toHaveBeenCalled();
    expect(db.eksemplar.updateMany).not.toHaveBeenCalled();
  });

  it('menolak dengan alasan yang sama seperti saat konfirmasi', async () => {
    db.eksemplar.findFirst.mockResolvedValue(null);
    const res = await cek();
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Stok koleksi ini sedang habis.');
  });

  it('menolak jika kode koleksi kosong', async () => {
    const res = await cek(null);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/peminjaman/saya', () => {
  const riwayat = (query = {}, pengenal = '2211521001') =>
    request(app).get('/api/peminjaman/saya').query(query).set('x-pengenal', pengenal);

  const baris = (overrides = {}, detail = {}) => ({
    id_peminjaman: 1,
    nomor_transaksi: 'TRX-202611-001',
    jalur: 'MANDIRI',
    status: 'DIPINJAM',
    tanggal_pinjam: new Date('2026-11-01'),
    tanggal_jatuh_tempo: new Date('2026-11-08'),
    detail_peminjaman: [
      {
        status: 'DIPINJAM',
        tanggal_kembali: null,
        eksemplar: { ...eksemplar, koleksi },
        denda: null,
        ...detail,
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    db.peminjaman.count.mockResolvedValue(0);
    db.denda.aggregate.mockResolvedValue({ _sum: { nominal: null }, _count: 0 });
  });

  it('hanya mengambil transaksi milik anggota yang login', async () => {
    db.peminjaman.findMany.mockResolvedValue([]);
    const res = await riwayat();
    expect(res.status).toBe(200);
    expect(db.peminjaman.findMany.mock.calls[0][0].where).toEqual({ id_anggota: 3 });
    expect(res.body.data.transaksi).toEqual([]);
  });

  it('menandai pinjaman yang lewat jatuh tempo sebagai terlambat', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-11T03:00:00Z'), toFake: ['Date'] });
    db.peminjaman.findMany.mockResolvedValue([baris()]);
    const res = await riwayat();
    vi.useRealTimers();

    expect(res.body.data.transaksi[0]).toMatchObject({
      nomor_transaksi: 'TRX-202611-001',
      status: 'DIPINJAM',
      tanggal_jatuh_tempo: '2026-11-08',
      terlambat: true,
      hari_terlambat: 3,
      koleksi: { judul: 'Clean Code' },
      eksemplar: { kode_eksemplar: 'EKS-001-A' },
      denda: null,
    });
  });

  it('menampilkan pengembalian beserta dendanya', async () => {
    db.peminjaman.findMany.mockResolvedValue([
      baris(
        { status: 'SELESAI' },
        {
          status: 'KEMBALI',
          tanggal_kembali: new Date('2026-11-10'),
          denda: { hari_terlambat: 2, nominal: '2000.00', status: 'BELUM_DIBAYAR' },
        },
      ),
    ]);
    const res = await riwayat();
    expect(res.body.data.transaksi[0]).toMatchObject({
      status: 'SELESAI',
      tanggal_kembali: '2026-11-10',
      terlambat: true,
      hari_terlambat: 2,
      denda: { nominal: 2000, status: 'BELUM_DIBAYAR' },
    });
  });

  it('mengirim ringkasan: jumlah per status, denda, dan jatuh tempo terdekat', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-05T03:00:00Z'), toFake: ['Date'] });
    db.peminjaman.findMany.mockResolvedValue([]);
    // urutan: sedang dipinjam, terlambat, dikembalikan
    db.peminjaman.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(4);
    db.denda.aggregate.mockResolvedValue({ _sum: { nominal: '3500.00' }, _count: 2 });
    db.peminjaman.findFirst.mockResolvedValue(baris());

    const res = await riwayat();
    vi.useRealTimers();

    expect(res.body.data.ringkasan).toEqual({
      sedang_dipinjam: 2,
      dikembalikan: 4,
      terlambat: 1,
      maks_pinjam: 3,
      jumlah_denda_belum_lunas: 2,
      total_denda_belum_lunas: 3500,
      jatuh_tempo_terdekat: {
        nomor_transaksi: 'TRX-202611-001',
        judul: 'Clean Code',
        tanggal_jatuh_tempo: '2026-11-08',
        sisa_hari: 3,
      },
    });
  });

  it('tidak ada jatuh tempo terdekat jika tidak sedang meminjam', async () => {
    db.peminjaman.findMany.mockResolvedValue([]);
    db.peminjaman.findFirst.mockResolvedValue(null);
    const res = await riwayat();
    expect(res.body.data.ringkasan.jatuh_tempo_terdekat).toBeNull();
  });

  it('memfilter berdasarkan status dan kata kunci', async () => {
    db.peminjaman.findMany.mockResolvedValue([]);
    await riwayat({ status: 'dikembalikan', q: 'clean' });
    const where = db.peminjaman.findMany.mock.calls[0][0].where;
    expect(where.id_anggota).toBe(3);
    expect(where.status).toBe('SELESAI');
    expect(where.OR[0]).toEqual({ nomor_transaksi: { contains: 'clean' } });
  });

  it('menolak filter status yang tidak dikenal', async () => {
    expect((await riwayat({ status: 'constructor' })).status).toBe(400);
    expect((await riwayat({ status: 'aneh' })).status).toBe(400);
  });

  it('menolak peran selain Anggota', async () => {
    loginSebagai(pustakawan);
    const res = await riwayat({}, '198805122014042001');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/peminjaman/ketentuan', () => {
  it('mengembalikan batas dan durasi dari konfigurasi', async () => {
    const res = await request(app).get('/api/peminjaman/ketentuan').set('x-pengenal', '2211521001');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ maks_pinjam: 3, durasi_hari: 7, tarif_denda_per_hari: null });

    db.konfigurasiSistem.findMany.mockResolvedValue([
      ...konfigurasi,
      { kunci_parameter: 'tarif_denda_per_hari', nilai: '1000' },
    ]);
    const res2 = await request(app).get('/api/peminjaman/ketentuan').set('x-pengenal', '2211521001');
    expect(res2.body.data.tarif_denda_per_hari).toBe(1000);
  });
});
