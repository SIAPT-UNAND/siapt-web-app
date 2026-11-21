import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const db = vi.hoisted(() => ({
  koleksi: { groupBy: vi.fn() },
  kategori: { findMany: vi.fn() },
  eksemplar: { groupBy: vi.fn(), count: vi.fn() },
  peminjaman: { groupBy: vi.fn(), count: vi.fn() },
  detailPeminjaman: { count: vi.fn() },
  denda: { groupBy: vi.fn(), aggregate: vi.fn() },
  pembayaranDenda: { groupBy: vi.fn(), count: vi.fn() },
  koreksiDenda: { aggregate: vi.fn() },
  permintaanLayanan: { groupBy: vi.fn(), count: vi.fn() },
  pesanChatbot: { count: vi.fn() },
  usulanKoleksi: { groupBy: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock('../lib/prisma.js', () => ({ default: db, prisma: db }));

const sesi = vi.hoisted(() => ({ user: null }));
vi.mock('../middleware/auth.js', async (importOriginal) => {
  const asli = await importOriginal();
  return {
    requireRole: asli.requireRole,
    requireAuth: (req, res, next) => {
      if (!sesi.user) return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
      req.user = sesi.user;
      return next();
    },
  };
});

const { default: app } = await import('../app.js');

const PENGELOLA = { id: 4, nama: 'Pengelola', pengenal: 'pengelola01', role: 'Pengelola' };
const SEKARANG = new Date('2026-11-21T03:00:00.000Z');
const MENU = ['koleksi', 'sirkulasi', 'denda', 'layanan'];

/** Isi semua query dengan data kosong agar setiap endpoint bisa dipanggil. */
function dataKosong() {
  db.koleksi.groupBy.mockResolvedValue([]);
  db.kategori.findMany.mockResolvedValue([]);
  db.eksemplar.groupBy.mockResolvedValue([]);
  db.eksemplar.count.mockResolvedValue(0);
  db.peminjaman.groupBy.mockResolvedValue([]);
  db.peminjaman.count.mockResolvedValue(0);
  db.detailPeminjaman.count.mockResolvedValue(0);
  db.denda.groupBy.mockResolvedValue([]);
  db.pembayaranDenda.groupBy.mockResolvedValue([]);
  db.pembayaranDenda.count.mockResolvedValue(0);
  db.denda.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { nominal: null } });
  db.koreksiDenda.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { nominal_lama: null, nominal_baru: null } });
  db.permintaanLayanan.groupBy.mockResolvedValue([]);
  db.permintaanLayanan.count.mockResolvedValue(0);
  db.pesanChatbot.count.mockResolvedValue(0);
  db.usulanKoleksi.groupBy.mockResolvedValue([]);
  db.$queryRaw.mockResolvedValue([]);
}

/** Argumen nilai (bukan potongan SQL) dari panggilan $queryRaw ke-i. */
function nilaiQuery(i) {
  return db.$queryRaw.mock.calls[i].slice(1);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SEKARANG);
  sesi.user = PENGELOLA;
  dataKosong();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('hak akses menu dashboard rinci', () => {
  it.each(MENU)('/api/dashboard/%s tanpa login → 401', async (menu) => {
    sesi.user = null;
    expect((await request(app).get(`/api/dashboard/${menu}`)).status).toBe(401);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  const kombinasi = MENU.flatMap((m) => ['Admin', 'Pustakawan', 'Anggota'].map((r) => [r, m]));
  it.each(kombinasi)('peran %s ke /api/dashboard/%s → 403', async (role, menu) => {
    sesi.user = { id: 9, nama: 'X', pengenal: 'x', role };
    const res = await request(app).get(`/api/dashboard/${menu}`);
    expect(res.status).toBe(403);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('validasi periode', () => {
  it.each(['sirkulasi', 'denda', 'layanan'])('%s menolak periode tidak sah (400)', async (menu) => {
    const res = await request(app).get(`/api/dashboard/${menu}?periode=365h`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Periode harus salah satu/);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it('periode ganda (?periode=a&periode=b) ditolak', async () => {
    expect((await request(app).get('/api/dashboard/sirkulasi?periode=7h&periode=30h')).status).toBe(400);
  });

  it.each(MENU)('%s dengan data kosong → 200, semua angka 0', async (menu) => {
    const res = await request(app).get(`/api/dashboard/${menu}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dihitung_pada).toBe('2026-11-21T03:00:00.000Z');
  });
});

describe('GET /api/dashboard/koleksi (K-1..K-3)', () => {
  it('koleksi per kategori, eksemplar per status, judul tanpa eksemplar tersedia', async () => {
    db.koleksi.groupBy.mockResolvedValue([
      { id_kategori: 1, status_aktif: true, _count: { _all: 5 } },
      { id_kategori: 1, status_aktif: false, _count: { _all: 1 } },
      { id_kategori: 2, status_aktif: true, _count: { _all: 2 } },
      { id_kategori: 9, status_aktif: null, _count: { _all: 1 } },
    ]);
    db.kategori.findMany.mockResolvedValue([
      { id_kategori: 1, nama_kategori: 'Komputer' },
      { id_kategori: 2, nama_kategori: 'Sastra' },
    ]);
    db.eksemplar.groupBy.mockResolvedValue([
      { status: 'TERSEDIA', _count: { _all: 7 } },
      { status: 'tersedia', _count: { _all: 1 } },
      { status: 'DIPINJAM', _count: { _all: 3 } },
      { status: 'RUSAK', _count: { _all: 1 } },
      { status: null, _count: { _all: 1 } },
    ]);
    db.eksemplar.count.mockResolvedValue(13);
    db.$queryRaw.mockResolvedValue([{ n: 2n }]);

    const res = await request(app).get('/api/dashboard/koleksi');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      koleksi_aktif: 7,
      koleksi_nonaktif: 2,
      per_kategori: [
        { id_kategori: 1, nama_kategori: 'Komputer', aktif: 5, nonaktif: 1 },
        { id_kategori: 2, nama_kategori: 'Sastra', aktif: 2, nonaktif: 0 },
        { id_kategori: 9, nama_kategori: 'Tanpa kategori', aktif: 0, nonaktif: 1 },
      ],
      total_eksemplar: 13,
      eksemplar_per_status: [
        { label: 'Tersedia', jumlah: 8 },
        { label: 'Dipinjam', jumlah: 3 },
        { label: 'Rusak', jumlah: 1 },
        { label: 'Tanpa status', jumlah: 1 },
      ],
      judul_tanpa_eksemplar_tersedia: 2,
    });
  });

  it('error database → 500', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.eksemplar.count.mockRejectedValue(new Error('down'));
    expect((await request(app).get('/api/dashboard/koleksi')).status).toBe(500);
    konsol.mockRestore();
  });
});

describe('GET /api/dashboard/sirkulasi (S-1..S-5)', () => {
  it('tren lengkap per hari, jalur, rata-rata lama pinjam, keterlambatan, top koleksi', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ t: new Date('2026-11-15T00:00:00Z'), n: 2n }]) // tren
      .mockResolvedValueOnce([{ rata: '9.5000', n: 4n }]) // lama pinjam
      .mockResolvedValueOnce([
        { id_koleksi: 1, judul: 'Clean Code', n: 3n },
        { id_koleksi: 2, judul: 'Refactoring', n: 1n },
      ]);
    db.peminjaman.groupBy.mockResolvedValue([
      { jalur: 'MANDIRI', _count: { _all: 2 } },
      { jalur: 'LOKET', _count: { _all: 1 } },
    ]);
    db.detailPeminjaman.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(2);

    const res = await request(app).get('/api/dashboard/sirkulasi?periode=7h');

    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.periode).toEqual({ kode: '7h', label: '7 hari terakhir', satuan: 'hari', mulai: '2026-11-15', akhir: '2026-11-21' });
    expect(d.tren_peminjaman).toHaveLength(7);
    expect(d.tren_peminjaman[0]).toEqual({ tanggal: '2026-11-15', jumlah: 2 });
    expect(d.total_peminjaman).toBe(3);
    expect(d.per_jalur).toEqual([
      { label: 'Mandiri', jumlah: 2 },
      { label: 'Loket', jumlah: 1 },
    ]);
    expect(d.rata_lama_pinjam_hari).toBe(9.5);
    expect(d.jumlah_dikembalikan).toBe(4);
    expect(d.keterlambatan).toEqual({ hari_1_7: 1, hari_8_30: 0, lebih_30: 2 });
    expect(d.top_koleksi).toEqual([
      { id_koleksi: 1, judul: 'Clean Code', jumlah: 3 },
      { id_koleksi: 2, judul: 'Refactoring', jumlah: 1 },
    ]);

    // Query memakai parameter terikat dengan batas tanggal periode (bukan string SQL gabungan)
    expect(nilaiQuery(0)).toEqual([new Date('2026-11-15T00:00:00Z'), new Date('2026-11-22T00:00:00Z')]);
    expect(db.peminjaman.groupBy.mock.calls[0][0].where).toEqual({
      tanggal_pinjam: { gte: new Date('2026-11-15T00:00:00Z'), lt: new Date('2026-11-22T00:00:00Z') },
    });
  });

  it('tanpa pengembalian dalam periode, rata-rata lama pinjam null', async () => {
    db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ rata: null, n: 0n }]).mockResolvedValueOnce([]);
    const res = await request(app).get('/api/dashboard/sirkulasi');
    expect(res.body.data.rata_lama_pinjam_hari).toBeNull();
    expect(res.body.data.periode.kode).toBe('30h');
    expect(res.body.data.tren_peminjaman).toHaveLength(30);
  });
});

describe('GET /api/dashboard/denda (F-1..F-5)', () => {
  it('belum lunas, tren denda terbentuk, pembayaran per status, waktu verifikasi, koreksi', async () => {
    db.denda.groupBy.mockResolvedValue([{ status: 'BELUM_DIBAYAR', _count: { _all: 2 }, _sum: { nominal: '5000' } }]);
    db.$queryRaw
      .mockResolvedValueOnce([
        { t: '2026-11-20', n: 1n, total: '2000.00' },
        { t: '2026-11-21', n: 2n, total: '3000.00' },
      ])
      .mockResolvedValueOnce([{ menit: '90.0000', n: 3n }]);
    db.pembayaranDenda.groupBy.mockResolvedValue([
      { status: 'MENUNGGU_VERIFIKASI', _count: { _all: 2 }, _sum: { nominal_bayar: '4000' } },
      { status: 'TERVERIFIKASI', _count: { _all: 3 }, _sum: { nominal_bayar: '6000' } },
      { status: 'DITOLAK', _count: { _all: 1 }, _sum: { nominal_bayar: null } },
    ]);
    db.koreksiDenda.aggregate.mockResolvedValue({ _count: { _all: 2 }, _sum: { nominal_lama: '5000', nominal_baru: '3500' } });

    const res = await request(app).get('/api/dashboard/denda?periode=7h');

    const d = res.body.data;
    expect(d.belum_lunas.belum_dibayar).toEqual({ jumlah: 2, total_nominal: 5000 });
    expect(d.tren_denda.at(-1)).toEqual({ tanggal: '2026-11-21', jumlah: 2, total_nominal: 3000 });
    expect(d.denda_terbentuk).toEqual({ jumlah: 3, total_nominal: 5000 });
    expect(d.pembayaran_per_status).toEqual([
      { label: 'Menunggu verifikasi', jumlah: 2, total_nominal: 4000 },
      { label: 'Terverifikasi', jumlah: 3, total_nominal: 6000 },
      { label: 'Ditolak', jumlah: 1, total_nominal: 0 },
    ]);
    expect(d.rata_waktu_verifikasi_jam).toBe(1.5);
    expect(d.jumlah_diverifikasi).toBe(3);
    expect(d.koreksi).toEqual({ jumlah: 2, total_selisih: 1500 });
    // Kolom DateTime dibandingkan dengan batas tengah malam WIB dalam UTC
    expect(nilaiQuery(0)).toEqual([new Date('2026-11-14T17:00:00Z'), new Date('2026-11-21T17:00:00Z')]);
  });

  it('status pembayaran lain muncul sebagai Lainnya; tanpa verifikasi → null', async () => {
    db.pembayaranDenda.groupBy.mockResolvedValue([{ status: 'BATAL', _count: { _all: 1 }, _sum: {} }]);
    db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ menit: null, n: 0n }]);
    db.koreksiDenda.aggregate.mockResolvedValue({});
    const d = (await request(app).get('/api/dashboard/denda')).body.data;
    expect(d.pembayaran_per_status.at(-1)).toEqual({ label: 'Lainnya', jumlah: 1, total_nominal: 0 });
    expect(d.rata_waktu_verifikasi_jam).toBeNull();
    expect(d.koreksi).toEqual({ jumlah: 0, total_selisih: 0 });
  });
});

describe('GET /api/dashboard/layanan (L-1..L-5)', () => {
  it('permintaan per status/jenis, tren, chatbot, top FAQ, usulan', async () => {
    db.permintaanLayanan.groupBy
      .mockResolvedValueOnce([
        { status: null, _count: { _all: 1 } },
        { status: 'Diproses', _count: { _all: 2 } },
        { status: 'DISETUJUI', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { jenis_permintaan: 'USULAN_KOLEKSI', _count: { _all: 3 } },
        { jenis_permintaan: null, _count: { _all: 1 } },
      ]);
    db.$queryRaw
      .mockResolvedValueOnce([{ t: '2026-11-21', n: 4n }])
      .mockResolvedValueOnce([{ id_faq: 1, pertanyaan: 'Batas pinjam?', n: 5n }, { id_faq: 2, pertanyaan: null, n: 1n }]);
    db.pesanChatbot.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
    db.usulanKoleksi.groupBy.mockResolvedValue([{ status_pengadaan: 'RENCANA_PENGADAAN', _count: { _all: 2 } }]);

    const d = (await request(app).get('/api/dashboard/layanan?periode=bulan')).body.data;

    expect(d.periode).toMatchObject({ kode: 'bulan', mulai: '2026-11-01', akhir: '2026-11-21' });
    expect(d.permintaan_per_status).toEqual({ Baru: 1, Diproses: 2, Selesai: 0, Ditolak: 0, Lainnya: 1 });
    expect(d.permintaan_per_jenis).toEqual([
      { label: 'Usulan koleksi', jumlah: 3 },
      { label: 'Tidak tercatat', jumlah: 1 },
    ]);
    expect(d.total_permintaan).toBe(4);
    expect(d.tren_permintaan).toHaveLength(21);
    expect(d.chatbot).toEqual({ total_pertanyaan: 8, gagal_dijawab: 3, persen_gagal: 37.5 });
    expect(d.top_faq).toEqual([
      { id_faq: 1, pertanyaan: 'Batas pinjam?', jumlah: 5 },
      { id_faq: 2, pertanyaan: '-', jumlah: 1 },
    ]);
    expect(d.usulan_per_status).toEqual([{ label: 'Rencana pengadaan', jumlah: 2 }]);
    expect(db.pesanChatbot.count.mock.calls[1][0].where).toMatchObject({ is_fallback: true });
  });

  it('chatbot tanpa pertanyaan → persentase 0, bukan NaN', async () => {
    const d = (await request(app).get('/api/dashboard/layanan')).body.data;
    expect(d.chatbot).toEqual({ total_pertanyaan: 0, gagal_dijawab: 0, persen_gagal: 0 });
  });
});

describe('rincian tambahan: pembanding, pola waktu, distribusi', () => {
  it('koleksi per dekade dan per bahasa', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ n: 0n }]) // judul tanpa eksemplar tersedia
      .mockResolvedValueOnce([
        { dekade: '2010', n: 1n },
        { dekade: null, n: 2n },
        { dekade: 2000, n: 3n },
      ]);
    db.koleksi.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { bahasa: 'Inggris', _count: { _all: 2 } },
      { bahasa: null, _count: { _all: 1 } },
    ]);
    const d = (await request(app).get('/api/dashboard/koleksi')).body.data;
    expect(d.per_dekade).toEqual([
      { label: '2000-an', jumlah: 3 },
      { label: '2010-an', jumlah: 1 },
      { label: 'Tahun tidak tercatat', jumlah: 2 },
    ]);
    expect(d.per_bahasa).toEqual([
      { label: 'Inggris', jumlah: 2 },
      { label: 'Tidak tercatat', jumlah: 1 },
    ]);
    expect(db.koleksi.groupBy.mock.calls[1][0]).toMatchObject({ by: ['bahasa'], where: { status_aktif: true } });
  });

  it('sirkulasi: pembanding periode sebelumnya dan pola per hari dalam seminggu', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ rata: null, n: 0n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { d: 1, n: 2n },
        { d: 2, n: 5n },
        { d: 9, n: 7n },
      ]);
    db.peminjaman.count.mockResolvedValue(12);

    const d = (await request(app).get('/api/dashboard/sirkulasi?periode=7h')).body.data;

    expect(d.pembanding).toEqual({
      kode: '7h-sebelumnya',
      label: '7 hari sebelumnya',
      satuan: 'hari',
      mulai: '2026-11-08',
      akhir: '2026-11-14',
      total_peminjaman: 12,
    });
    expect(db.peminjaman.count).toHaveBeenCalledWith({
      where: { tanggal_pinjam: { gte: new Date('2026-11-08T00:00:00Z'), lt: new Date('2026-11-15T00:00:00Z') } },
    });
    expect(d.per_hari_minggu).toEqual([
      { label: 'Sen', jumlah: 5 },
      { label: 'Sel', jumlah: 0 },
      { label: 'Rab', jumlah: 0 },
      { label: 'Kam', jumlah: 0 },
      { label: 'Jum', jumlah: 0 },
      { label: 'Sab', jumlah: 0 },
      { label: 'Min', jumlah: 2 },
    ]);
  });

  it('denda: pembanding dan distribusi lama keterlambatan', async () => {
    db.denda.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { hari_terlambat: 2, _count: { _all: 1 }, _sum: { nominal: '2000' } },
      { hari_terlambat: 5, _count: { _all: 2 }, _sum: { nominal: '10000' } },
      { hari_terlambat: 10, _count: { _all: 1 }, _sum: { nominal: null } },
      { hari_terlambat: 30, _count: { _all: 1 }, _sum: { nominal: '30000' } },
      { hari_terlambat: null, _count: { _all: 1 }, _sum: {} },
    ]);
    db.denda.aggregate.mockResolvedValue({ _count: { _all: 4 }, _sum: { nominal: '9000.00' } });
    db.pembayaranDenda.count.mockResolvedValue(6);

    const d = (await request(app).get('/api/dashboard/denda')).body.data;

    expect(d.denda_per_keterlambatan).toEqual([
      { label: '1–3 hari', jumlah: 1, total_nominal: 2000 },
      { label: '4–7 hari', jumlah: 2, total_nominal: 10000 },
      { label: '8–14 hari', jumlah: 1, total_nominal: 0 },
      { label: '> 14 hari', jumlah: 1, total_nominal: 30000 },
      { label: 'Tidak tercatat', jumlah: 1, total_nominal: 0 },
    ]);
    expect(d.pembanding).toMatchObject({
      label: '30 hari sebelumnya',
      denda_terbentuk: { jumlah: 4, total_nominal: 9000 },
      total_pembayaran: 6,
    });
  });

  it('denda: pembanding kosong menjadi 0', async () => {
    db.denda.aggregate.mockResolvedValue(undefined);
    const d = (await request(app).get('/api/dashboard/denda')).body.data;
    expect(d.pembanding.denda_terbentuk).toEqual({ jumlah: 0, total_nominal: 0 });
    expect(d.denda_per_keterlambatan.map((k) => k.label)).not.toContain('Tidak tercatat');
  });

  it('layanan: pembanding dan pertanyaan chatbot per jam WIB', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { j: 13, n: 2n },
        { j: 0, n: 1n },
        { j: 24, n: 9n },
      ]);
    db.permintaanLayanan.count.mockResolvedValue(5);
    db.pesanChatbot.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(11);

    const d = (await request(app).get('/api/dashboard/layanan?periode=bulan')).body.data;

    expect(d.pertanyaan_per_jam).toHaveLength(24);
    expect(d.pertanyaan_per_jam[0]).toEqual({ label: '00', jumlah: 1 });
    expect(d.pertanyaan_per_jam[13]).toEqual({ label: '13', jumlah: 2 });
    expect(d.pertanyaan_per_jam.reduce((n, j) => n + j.jumlah, 0)).toBe(3);
    // Bulan ini (1–21 Nov, 21 hari) dibandingkan dengan 21 hari sebelumnya
    expect(d.pembanding).toMatchObject({
      label: '21 hari sebelumnya',
      mulai: '2026-10-11',
      akhir: '2026-10-31',
      total_permintaan: 5,
      total_pertanyaan_chatbot: 11,
    });
  });
});
