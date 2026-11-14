import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Database tiruan: test tidak memakai database asli.
const db = vi.hoisted(() => ({
  pengguna: { findUnique: vi.fn() },
  denda: { count: vi.fn() },
  koleksi: { findUnique: vi.fn() },
  eksemplar: { findFirst: vi.fn(), updateMany: vi.fn() },
  konfigurasiSistem: { findMany: vi.fn() },
  detailPeminjaman: { count: vi.fn() },
  peminjaman: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
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

const pinjam = (body = { id_koleksi: 1 }, id = 3) =>
  request(app).post('/api/peminjaman/mandiri').set('x-id-pengguna', String(id)).send(body);

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

  it('menolak jika id_koleksi kosong', async () => {
    const res = await pinjam({});
    expect(res.status).toBe(400);
  });

  it('menolak jika belum login', async () => {
    const res = await request(app).post('/api/peminjaman/mandiri').send({ id_koleksi: 1 });
    expect(res.status).toBe(401);
  });

  it('menolak peran selain Anggota', async () => {
    loginSebagai(pustakawan);
    const res = await pinjam({ id_koleksi: 1 }, 2);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/peminjaman/ketentuan', () => {
  it('mengembalikan batas dan durasi dari konfigurasi', async () => {
    const res = await request(app).get('/api/peminjaman/ketentuan').set('x-id-pengguna', '3');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ maks_pinjam: 3, durasi_hari: 7 });
  });
});
