import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const db = vi.hoisted(() => ({
  konfigurasiSistem: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  logKonfigurasi: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../lib/prisma.js', () => ({ default: db, prisma: db }));

const sesi = vi.hoisted(() => ({ user: null }));
vi.mock('../middleware/auth.js', async (importOriginal) => {
  const asli = await importOriginal();
  return {
    requireRole: asli.requireRole,
    requireAuth: (req, res, next) => {
      if (!sesi.user) {
        return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
      }
      req.user = sesi.user;
      return next();
    },
  };
});

const { default: app } = await import('../app.js');

const ADMIN_LOGIN = { id: 1, nama: 'Admin Demo', pengenal: 'admin01', role: 'Admin' };

const DURASI = {
  id_konfigurasi: 3,
  kunci_parameter: 'durasi_pinjam_hari',
  nilai: '7',
  tipe_data: 'number',
  satuan: 'hari',
  nilai_min: '1',
  nilai_maks: '30',
  wajib: true,
};
const TARIF = {
  id_konfigurasi: 2,
  kunci_parameter: 'tarif_denda_per_hari',
  nilai: '1000',
  tipe_data: 'decimal',
  satuan: 'rupiah',
  nilai_min: '500',
  nilai_maks: '10000',
  wajib: true,
};
const CHATBOT = { id_konfigurasi: 4, kunci_parameter: 'chatbot_aktif', nilai: 'true', tipe_data: 'boolean', wajib: true };
const TEKS = { id_konfigurasi: 5, kunci_parameter: 'info_rekening', nilai: 'BNI', tipe_data: null, wajib: false };
const BEBAS = { id_konfigurasi: 6, kunci_parameter: 'maks_perpanjangan', nilai: '2', tipe_data: 'number', nilai_min: null, nilai_maks: null };

function harapGagal(res, status) {
  expect(res.status).toBe(status);
  expect(res.body.success).toBe(false);
  expect(typeof res.body.message).toBe('string');
}

function harapTidakAdaTulis() {
  expect(db.konfigurasiSistem.update).not.toHaveBeenCalled();
  expect(db.logKonfigurasi.create).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(db)));
  db.konfigurasiSistem.update.mockImplementation(async ({ data }) => ({ ...sesi.parameter, ...data }));
  db.logKonfigurasi.create.mockImplementation(async ({ data }) => ({ id_log: 99, ...data }));
  sesi.user = ADMIN_LOGIN;
});

function pakaiParameter(parameter) {
  sesi.parameter = parameter;
  db.konfigurasiSistem.findUnique.mockResolvedValue(parameter);
}

// ---------------------------------------------------------------------------
// NFR-02: setiap endpoint konfigurasi hanya untuk Admin
// ---------------------------------------------------------------------------
const ENDPOINT = [
  ['get', '/api/admin/konfigurasi'],
  ['get', '/api/admin/konfigurasi/riwayat'],
  ['patch', '/api/admin/konfigurasi/durasi_pinjam_hari'],
];

describe('hak akses endpoint konfigurasi', () => {
  it.each(ENDPOINT)('%s %s tanpa login ditolak 401', async (method, url) => {
    sesi.user = null;
    harapGagal(await request(app)[method](url).send({ nilai: '14' }), 401);
    harapTidakAdaTulis();
  });

  const kombinasi = ENDPOINT.flatMap(([m, u]) => ['Anggota', 'Pustakawan', 'Pengelola'].map((r) => [r, m, u]));
  it.each(kombinasi)('peran %s ke %s %s ditolak 403', async (role, method, url) => {
    sesi.user = { id: 50, nama: 'X', pengenal: 'x01', role };
    harapGagal(await request(app)[method](url).send({ nilai: '14' }), 403);
    harapTidakAdaTulis();
  });

  it.each(['post', 'delete'])('%s parameter tidak tersedia', async (method) => {
    const url = method === 'post' ? '/api/admin/konfigurasi' : '/api/admin/konfigurasi/durasi_pinjam_hari';
    harapGagal(await request(app)[method](url).send({ kunci_parameter: 'baru', nilai: '1' }), 404);
    harapTidakAdaTulis();
  });
});

// ---------------------------------------------------------------------------
// UC-15 / TC-15
// ---------------------------------------------------------------------------
describe('GET /api/admin/konfigurasi', () => {
  it('KF-01 daftar dengan label/deskripsi dan fallback untuk kunci lain', async () => {
    db.konfigurasiSistem.findMany.mockResolvedValue([DURASI, BEBAS]);

    const res = await request(app).get('/api/admin/konfigurasi');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual({
      kunci_parameter: 'durasi_pinjam_hari',
      label: 'Durasi peminjaman',
      deskripsi: 'Jumlah hari sampai jatuh tempo (UC-03, UC-04, UC-09).',
      nilai: '7',
      tipe_data: 'number',
      satuan: 'hari',
      nilai_min: '1',
      nilai_maks: '30',
      wajib: true,
    });
    expect(res.body.data[1]).toMatchObject({ kunci_parameter: 'maks_perpanjangan', label: 'maks_perpanjangan', deskripsi: '' });
    expect(res.body.data[0]).not.toHaveProperty('id_konfigurasi');
    expect(db.konfigurasiSistem.findMany).toHaveBeenCalledWith({ orderBy: { kunci_parameter: 'asc' } });
  });

  it('error database diteruskan (500)', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.konfigurasiSistem.findMany.mockRejectedValue(new Error('down'));
    harapGagal(await request(app).get('/api/admin/konfigurasi'), 500);
    konsol.mockRestore();
  });
});

describe('PATCH /api/admin/konfigurasi/:kunci', () => {
  it('KF-02 nilai valid disimpan bersama log dalam satu transaksi', async () => {
    pakaiParameter(DURASI);

    const res = await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai: '14' });

    expect(res.status).toBe(200);
    expect(res.body.data.berubah).toBe(true);
    expect(res.body.data.parameter).toMatchObject({ kunci_parameter: 'durasi_pinjam_hari', nilai: '14' });
    // Baca, validasi, tulis, dan log dalam SATU transaksi Serializable
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    expect(db.konfigurasiSistem.update).toHaveBeenCalledWith({ where: { id_konfigurasi: 3 }, data: { nilai: '14' } });
    const { data: log } = db.logKonfigurasi.create.mock.calls[0][0];
    expect(log).toMatchObject({ id_konfigurasi: 3, id_pengubah: 1, nilai_lama: '7', nilai_baru: '14' });
    expect(log.waktu).toBeInstanceOf(Date);
  });

  it('KF-02 nilai angka (bukan string) juga diterima', async () => {
    pakaiParameter(DURASI);
    const res = await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai: 21 });
    expect(res.status).toBe(200);
    expect(db.konfigurasiSistem.update.mock.calls[0][0].data).toEqual({ nilai: '21' });
  });

  it.each(['7.5', 'abc', '', '0', '31'])('KF-03 durasi "%s" ditolak 400 tanpa update/log', async (nilai) => {
    pakaiParameter(DURASI);
    harapGagal(await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai }), 400);
    harapTidakAdaTulis();
  });

  it('KF-03 pesan kesalahan menjelaskan tipe dan rentang', async () => {
    pakaiParameter(DURASI);
    const res = await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai: '31' });
    expect(res.body.message).toBe('Nilai Durasi peminjaman harus bilangan bulat antara 1 dan 30 hari.');
  });

  it('KF-04 desimal: "1500.50" diterima', async () => {
    pakaiParameter(TARIF);
    const res = await request(app).patch('/api/admin/konfigurasi/tarif_denda_per_hari').send({ nilai: '1500.50' });
    expect(res.status).toBe(200);
    expect(res.body.data.parameter.nilai).toBe('1500.50');
  });

  it.each(['1e3', '12,5', '1500.555'])('KF-04 desimal "%s" ditolak', async (nilai) => {
    pakaiParameter(TARIF);
    harapGagal(await request(app).patch('/api/admin/konfigurasi/tarif_denda_per_hari').send({ nilai }), 400);
    harapTidakAdaTulis();
  });

  it.each([
    [false, 200],
    ['false', 200],
    ['ya', 400],
  ])('KF-05 boolean %j → %i', async (nilai, status) => {
    pakaiParameter(CHATBOT);
    const res = await request(app).patch('/api/admin/konfigurasi/chatbot_aktif').send({ nilai });
    expect(res.status).toBe(status);
  });

  it.each([
    ['kosong', ''],
    ['256 karakter', 'x'.repeat(256)],
  ])('KF-06 teks %s ditolak', async (_label, nilai) => {
    pakaiParameter(TEKS);
    harapGagal(await request(app).patch('/api/admin/konfigurasi/info_rekening').send({ nilai }), 400);
  });

  it('KF-07 tanpa nilai_min/nilai_maks hanya cek tipe', async () => {
    pakaiParameter(BEBAS);
    const res = await request(app).patch('/api/admin/konfigurasi/maks_perpanjangan').send({ nilai: '50' });
    expect(res.status).toBe(200);
  });

  it('KF-08 kunci tidak terdaftar → 404, tidak membuat parameter', async () => {
    db.konfigurasiSistem.findUnique.mockResolvedValue(null);
    const res = await request(app).patch('/api/admin/konfigurasi/parameter_baru').send({ nilai: '1' });
    harapGagal(res, 404);
    expect(res.body.message).toBe('Parameter tidak dikenal.');
    harapTidakAdaTulis();
  });

  it('KF-08 kunci dengan format salah → 404 tanpa query database', async () => {
    harapGagal(await request(app).patch('/api/admin/konfigurasi/Bukan-Kunci!').send({ nilai: '1' }), 404);
    expect(db.konfigurasiSistem.findUnique).not.toHaveBeenCalled();
  });

  it('KF-09 nilai sama → 200 berubah:false tanpa log', async () => {
    pakaiParameter(TARIF);
    const res = await request(app).patch('/api/admin/konfigurasi/tarif_denda_per_hari').send({ nilai: '1000.00' });
    expect(res.status).toBe(200);
    expect(res.body.data.berubah).toBe(false);
    expect(res.body.data.parameter.nilai).toBe('1000');
    harapTidakAdaTulis();
  });

  it.each([
    ['tanpa field nilai', {}],
    ['nilai null', { nilai: null }],
    ['nilai objek', { nilai: { a: 1 } }],
  ])('body %s → 400', async (_label, body) => {
    pakaiParameter(DURASI);
    harapGagal(await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send(body), 400);
    harapTidakAdaTulis();
  });

  it('body array → 400', async () => {
    harapGagal(await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send([1]), 400);
  });

  it('bentrok (P2034) diulang dengan membaca ulang; nilai_lama = nilai yang benar-benar digantikan', async () => {
    const bentrok = Object.assign(new Error('write conflict'), { code: 'P2034' });
    // Percobaan 1 membaca '7' lalu bentrok (tulisannya dibatalkan); Admin lain sudah menyimpan '10'
    db.konfigurasiSistem.findUnique.mockResolvedValueOnce(DURASI).mockResolvedValueOnce({ ...DURASI, nilai: '10' });
    sesi.parameter = { ...DURASI, nilai: '10' };
    const txBatal = {
      konfigurasiSistem: { findUnique: db.konfigurasiSistem.findUnique, update: vi.fn(async ({ data }) => ({ ...DURASI, ...data })) },
      logKonfigurasi: { create: vi.fn() },
    };
    db.$transaction
      .mockImplementationOnce(async (fn) => {
        await fn(txBatal);
        throw bentrok;
      })
      .mockImplementationOnce((fn) => fn(db));

    const res = await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai: '14' });

    expect(res.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(db.logKonfigurasi.create).toHaveBeenCalledTimes(1);
    expect(db.logKonfigurasi.create.mock.calls[0][0].data).toMatchObject({ nilai_lama: '10', nilai_baru: '14' });
  });

  it('bentrok terus-menerus → 409 dengan pesan yang ramah; error lain tidak diulang', async () => {
    pakaiParameter(DURASI);
    const bentrok = Object.assign(new Error('write conflict'), { code: 'P2034' });
    db.$transaction.mockRejectedValue(bentrok);
    const res = await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai: '14' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Parameter sedang diubah oleh Admin lain. Silakan coba lagi.');
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it('angka di luar batas aman → 400 tanpa menulis', async () => {
    pakaiParameter(DURASI);
    harapGagal(
      await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai: '99999999999999999999' }),
      400,
    );
    harapTidakAdaTulis();
  });

  it('transaksi gagal diteruskan (500)', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    pakaiParameter(DURASI);
    db.$transaction.mockRejectedValue(new Error('deadlock'));
    harapGagal(await request(app).patch('/api/admin/konfigurasi/durasi_pinjam_hari').send({ nilai: '14' }), 500);
    konsol.mockRestore();
  });
});

describe('GET /api/admin/konfigurasi/riwayat', () => {
  const BARIS = {
    id_log: 3,
    nilai_lama: '7',
    nilai_baru: '14',
    waktu: new Date('2026-11-23T03:00:00Z'),
    konfigurasi: { kunci_parameter: 'durasi_pinjam_hari' },
    pengubah: { id_pengguna: 1, nama: 'Admin Demo', pengenal: 'admin01' },
  };

  it('KF-10 tanpa kunci: 20 log terbaru dengan pengubah', async () => {
    db.logKonfigurasi.findMany.mockResolvedValue([BARIS]);

    const res = await request(app).get('/api/admin/konfigurasi/riwayat');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        id_log: 3,
        kunci_parameter: 'durasi_pinjam_hari',
        label: 'Durasi peminjaman',
        nilai_lama: '7',
        nilai_baru: '14',
        waktu: '2026-11-23T03:00:00.000Z',
        pengubah: { id_pengguna: 1, nama: 'Admin Demo', pengenal: 'admin01' },
      },
    ]);
    const argumen = db.logKonfigurasi.findMany.mock.calls[0][0];
    expect(argumen).toMatchObject({ where: {}, take: 20, orderBy: [{ waktu: 'desc' }, { id_log: 'desc' }] });
    expect(argumen.include.pengubah.select).toEqual({ id_pengguna: true, nama: true, pengenal: true });
  });

  it('KF-10 dengan kunci dan batas', async () => {
    pakaiParameter(DURASI);
    db.logKonfigurasi.findMany.mockResolvedValue([{ ...BARIS, nilai_lama: null, waktu: null }]);

    const res = await request(app).get('/api/admin/konfigurasi/riwayat?kunci=durasi_pinjam_hari&batas=5');

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ nilai_lama: null, waktu: null });
    expect(db.logKonfigurasi.findMany.mock.calls[0][0]).toMatchObject({ where: { id_konfigurasi: 3 }, take: 5 });
  });

  it('kunci kosong diperlakukan sebagai tanpa filter', async () => {
    db.logKonfigurasi.findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/admin/konfigurasi/riwayat?kunci=%20');
    expect(res.status).toBe(200);
    expect(db.konfigurasiSistem.findUnique).not.toHaveBeenCalled();
  });

  it('kunci tidak terdaftar → 404', async () => {
    db.konfigurasiSistem.findUnique.mockResolvedValue(null);
    harapGagal(await request(app).get('/api/admin/konfigurasi/riwayat?kunci=tidak_ada'), 404);
  });

  it.each(['batas=0', 'batas=101', 'batas=abc', 'kunci=a&kunci=b'])('KF-10 query %s → 400', async (query) => {
    harapGagal(await request(app).get(`/api/admin/konfigurasi/riwayat?${query}`), 400);
    expect(db.logKonfigurasi.findMany).not.toHaveBeenCalled();
  });
});
