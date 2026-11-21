import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const db = vi.hoisted(() => ({
  pengguna: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  role: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../lib/prisma.js', () => ({ default: db, prisma: db }));

const bcryptMock = vi.hoisted(() => ({ hash: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: bcryptMock }));

// req.user diatur per test; requireRole memakai implementasi asli.
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

const ROLE = {
  Admin: { id_role: 1, nama_role: 'Admin' },
  Pustakawan: { id_role: 2, nama_role: 'Pustakawan' },
  Anggota: { id_role: 3, nama_role: 'Anggota' },
  Pengelola: { id_role: 4, nama_role: 'Pengelola' },
};

const ADMIN_LOGIN = { id: 1, nama: 'Admin Demo', pengenal: 'admin01', role: 'Admin' };

function loginSebagai(user) {
  sesi.user = user;
}

function akunDb(tambahan = {}) {
  return {
    id_pengguna: 12,
    id_role: ROLE.Anggota.id_role,
    pengenal: '2311523041',
    nama: 'Rafi',
    kata_sandi_hash: '$2b$10$hashAsliYangTidakBolehBocor',
    status_aktif: true,
    alasan_nonaktif: null,
    dibuat_pada: new Date('2026-11-21T04:10:00Z'),
    role: ROLE.Anggota,
    ...tambahan,
  };
}

function adminDb(tambahan = {}) {
  return akunDb({ id_pengguna: 7, id_role: 1, pengenal: 'admin02', nama: 'Admin Dua', role: ROLE.Admin, ...tambahan });
}

function harapGagal(res, status) {
  expect(res.status).toBe(status);
  expect(res.body.success).toBe(false);
  expect(typeof res.body.message).toBe('string');
  expect(res.body.message.length).toBeGreaterThan(0);
}

beforeEach(() => {
  vi.resetAllMocks();
  bcryptMock.hash.mockResolvedValue('hash-palsu');
  db.$transaction.mockImplementation((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(db)));
  loginSebagai(ADMIN_LOGIN);
});

// ---------------------------------------------------------------------------
// NFR-02 / TC-14: setiap endpoint admin
// ---------------------------------------------------------------------------
const ENDPOINT_ADMIN = [
  ['get', '/api/admin/akun'],
  ['get', '/api/admin/akun/12'],
  ['post', '/api/admin/akun'],
  ['patch', '/api/admin/akun/12'],
  ['patch', '/api/admin/akun/12/status'],
  ['patch', '/api/admin/akun/12/kata-sandi'],
  ['get', '/api/admin/peran'],
  ['patch', '/api/admin/akun/12/peran'],
];

describe('hak akses endpoint admin', () => {
  it.each(ENDPOINT_ADMIN)('%s %s tanpa login ditolak 401', async (method, url) => {
    loginSebagai(null);
    const res = await request(app)[method](url).send({});
    harapGagal(res, 401);
    expect(db.pengguna.findMany).not.toHaveBeenCalled();
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  const PERAN_LAIN = ['Anggota', 'Pustakawan', 'Pengelola'];
  const kombinasi = ENDPOINT_ADMIN.flatMap(([method, url]) => PERAN_LAIN.map((peran) => [peran, method, url]));

  it.each(kombinasi)('peran %s ke %s %s ditolak 403', async (peran, method, url) => {
    loginSebagai({ id: 50, nama: 'Bukan Admin', pengenal: 'lain01', role: peran });
    const res = await request(app)[method](url).send({});
    harapGagal(res, 403);
    expect(res.body.message).toBe('Kamu tidak memiliki izin untuk mengakses fungsi ini.');
    expect(db.pengguna.create).not.toHaveBeenCalled();
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('DELETE akun tidak tersedia', async () => {
    const res = await request(app).delete('/api/admin/akun/12');
    harapGagal(res, 404);
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UC-13 / TC-13
// ---------------------------------------------------------------------------
describe('GET /api/admin/akun', () => {
  it('AK-01 mengembalikan daftar berhalaman tanpa kata_sandi_hash', async () => {
    db.pengguna.findMany.mockResolvedValue([akunDb(), adminDb()]);
    db.pengguna.count.mockResolvedValue(37);

    const res = await request(app).get('/api/admin/akun');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ total: 37, halaman: 1, per_halaman: 20 });
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0]).toEqual({
      id_pengguna: 12,
      pengenal: '2311523041',
      nama: 'Rafi',
      role: 'Anggota',
      status_aktif: true,
      alasan_nonaktif: null,
      dibuat_pada: '2026-11-21T04:10:00.000Z',
    });
    expect(JSON.stringify(res.body)).not.toContain('kata_sandi');
    expect(db.pengguna.findMany).toHaveBeenCalledWith({
      where: {},
      include: { role: true },
      orderBy: [{ dibuat_pada: 'desc' }, { id_pengguna: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(db.pengguna.count).toHaveBeenCalledWith({ where: {} });
  });

  it('AK-02 meneruskan filter q, role, status aktif, dan paginasi ke Prisma', async () => {
    db.role.findUnique.mockResolvedValue(ROLE.Pustakawan);
    db.pengguna.findMany.mockResolvedValue([]);
    db.pengguna.count.mockResolvedValue(0);

    const res = await request(app).get('/api/admin/akun').query({
      q: 'siti',
      role: 'Pustakawan',
      status: 'aktif',
      halaman: '2',
      per_halaman: '10',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], total: 0, halaman: 2, per_halaman: 10 });
    const argumen = db.pengguna.findMany.mock.calls[0][0];
    expect(argumen.where).toEqual({
      AND: [
        { OR: [{ pengenal: { contains: 'siti' } }, { nama: { contains: 'siti' } }] },
        { role: { nama_role: 'Pustakawan' } },
        { status_aktif: true },
      ],
    });
    expect(argumen.skip).toBe(10);
    expect(argumen.take).toBe(10);
    expect(db.pengguna.count).toHaveBeenCalledWith({ where: argumen.where });
  });

  it('AK-02 status=nonaktif mencakup status null', async () => {
    db.pengguna.findMany.mockResolvedValue([akunDb({ status_aktif: false, alasan_nonaktif: 'Lulus' })]);
    db.pengguna.count.mockResolvedValue(1);

    const res = await request(app).get('/api/admin/akun?status=nonaktif');

    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toMatchObject({ status_aktif: false, alasan_nonaktif: 'Lulus' });
    expect(db.pengguna.findMany.mock.calls[0][0].where).toEqual({
      AND: [{ OR: [{ status_aktif: false }, { status_aktif: null }] }],
    });
  });

  it('AK-03 role tidak dikenal ditolak 400', async () => {
    db.role.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/admin/akun?role=Dosen');
    harapGagal(res, 400);
    expect(res.body.message).toBe('Peran tidak dikenal.');
    expect(db.pengguna.findMany).not.toHaveBeenCalled();
  });

  it.each(['status=xyz', 'halaman=0', 'per_halaman=500'])('AK-03 query %s ditolak 400', async (query) => {
    const res = await request(app).get(`/api/admin/akun?${query}`);
    harapGagal(res, 400);
    expect(db.pengguna.findMany).not.toHaveBeenCalled();
  });

  it('AK-17 error database tak terduga diteruskan ke errorHandler (500)', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.pengguna.findMany.mockRejectedValue(new Error('koneksi database putus'));
    db.pengguna.count.mockResolvedValue(0);

    const res = await request(app).get('/api/admin/akun');

    harapGagal(res, 500);
    konsol.mockRestore();
  });
});

describe('GET /api/admin/akun/:id', () => {
  it('AK-04 akun ada → 200', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    const res = await request(app).get('/api/admin/akun/12');
    expect(res.status).toBe(200);
    expect(res.body.data.pengenal).toBe('2311523041');
    expect(res.body.data).not.toHaveProperty('kata_sandi_hash');
    expect(db.pengguna.findUnique).toHaveBeenCalledWith({ where: { id_pengguna: 12 }, include: { role: true } });
  });

  it('AK-04 akun tidak ada → 404', async () => {
    db.pengguna.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/admin/akun/99');
    harapGagal(res, 404);
    expect(res.body.message).toBe('Akun tidak ditemukan.');
  });

  it('AK-04 id bukan angka → 400', async () => {
    const res = await request(app).get('/api/admin/akun/abc');
    harapGagal(res, 400);
    expect(db.pengguna.findUnique).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/akun', () => {
  const bodyValid = { pengenal: ' 2311523041 ', nama: ' Rafi ', role: 'Anggota', kata_sandi: 'rahasia123' };

  it('AK-05 akun valid dibuat dengan hash bcrypt cost 10 dan status aktif', async () => {
    db.role.findUnique.mockResolvedValue(ROLE.Anggota);
    db.pengguna.findUnique.mockResolvedValue(null);
    db.pengguna.create.mockImplementation(async ({ data }) => akunDb({ ...data, id_pengguna: 30, role: ROLE.Anggota }));

    const res = await request(app).post('/api/admin/akun').send(bodyValid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id_pengguna: 30,
      pengenal: '2311523041',
      nama: 'Rafi',
      role: 'Anggota',
      status_aktif: true,
      alasan_nonaktif: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('hash');
    expect(bcryptMock.hash).toHaveBeenCalledWith('rahasia123', 10);

    const { data } = db.pengguna.create.mock.calls[0][0];
    expect(data).toMatchObject({
      id_role: 3,
      pengenal: '2311523041',
      nama: 'Rafi',
      kata_sandi_hash: 'hash-palsu',
      status_aktif: true,
      alasan_nonaktif: null,
    });
    expect(data.dibuat_pada).toBeInstanceOf(Date);
    expect(Object.values(data)).not.toContain('rahasia123');
  });

  it.each([
    ['pengenal kosong', { pengenal: '' }],
    ['pengenal terlalu pendek', { pengenal: 'ab' }],
    ['pengenal karakter ilegal', { pengenal: 'nim 123!' }],
    ['nama kosong', { nama: '   ' }],
    ['kata sandi 7 karakter', { kata_sandi: '1234567' }],
    ['kata sandi 73 karakter', { kata_sandi: 'a'.repeat(73) }],
    ['role kosong', { role: '' }],
  ])('AK-06 %s → 400 tanpa create', async (_label, ubahan) => {
    const res = await request(app).post('/api/admin/akun').send({ ...bodyValid, ...ubahan });
    harapGagal(res, 400);
    expect(db.pengguna.create).not.toHaveBeenCalled();
    expect(bcryptMock.hash).not.toHaveBeenCalled();
  });

  it('AK-06 role tidak ada di tabel role → 400 tanpa create', async () => {
    db.role.findUnique.mockResolvedValue(null);
    const res = await request(app).post('/api/admin/akun').send({ ...bodyValid, role: 'Dosen' });
    harapGagal(res, 400);
    expect(res.body.message).toBe('Peran tidak dikenal.');
    expect(db.pengguna.create).not.toHaveBeenCalled();
  });

  it('AK-06 body bukan objek → 400', async () => {
    const res = await request(app).post('/api/admin/akun').send([1, 2, 3]);
    harapGagal(res, 400);
    expect(db.pengguna.create).not.toHaveBeenCalled();
  });

  it('AK-07 pengenal sudah ada → 409', async () => {
    db.role.findUnique.mockResolvedValue(ROLE.Anggota);
    db.pengguna.findUnique.mockResolvedValue(akunDb());

    const res = await request(app).post('/api/admin/akun').send(bodyValid);

    harapGagal(res, 409);
    expect(res.body.message).toBe('Pengenal sudah digunakan.');
    expect(db.pengguna.create).not.toHaveBeenCalled();
  });

  it('AK-08 Prisma P2002 (race condition) → 409', async () => {
    db.role.findUnique.mockResolvedValue(ROLE.Anggota);
    db.pengguna.findUnique.mockResolvedValue(null);
    db.pengguna.create.mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));

    const res = await request(app).post('/api/admin/akun').send(bodyValid);

    harapGagal(res, 409);
    expect(res.body.message).toBe('Pengenal sudah digunakan.');
  });

  it('AK-17 error create lain diteruskan (500)', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.role.findUnique.mockResolvedValue(ROLE.Anggota);
    db.pengguna.findUnique.mockResolvedValue(null);
    db.pengguna.create.mockRejectedValue(new Error('timeout'));

    const res = await request(app).post('/api/admin/akun').send(bodyValid);

    harapGagal(res, 500);
    konsol.mockRestore();
  });
});

describe('PATCH /api/admin/akun/:id', () => {
  it('AK-09 mengubah nama dan pengenal', async () => {
    db.pengguna.findUnique.mockResolvedValueOnce(akunDb()).mockResolvedValueOnce(null);
    db.pengguna.update.mockImplementation(async ({ data }) => akunDb(data));

    const res = await request(app).patch('/api/admin/akun/12').send({ nama: ' Rafi Y ', pengenal: 'RAFI-01' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nama: 'Rafi Y', pengenal: 'RAFI-01' });
    expect(db.pengguna.update).toHaveBeenCalledWith({
      where: { id_pengguna: 12 },
      data: { nama: 'Rafi Y', pengenal: 'RAFI-01' },
      include: { role: true },
    });
  });

  it('AK-09 hanya nama, tanpa memeriksa pengenal', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.pengguna.update.mockImplementation(async ({ data }) => akunDb(data));

    const res = await request(app).patch('/api/admin/akun/12').send({ nama: 'Nama Baru' });

    expect(res.status).toBe(200);
    expect(db.pengguna.findUnique).toHaveBeenCalledTimes(1);
    expect(db.pengguna.update.mock.calls[0][0].data).toEqual({ nama: 'Nama Baru' });
  });

  it('AK-09 pengenal sama dengan miliknya sendiri tidak dianggap duplikat', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.pengguna.update.mockImplementation(async ({ data }) => akunDb(data));

    const res = await request(app).patch('/api/admin/akun/12').send({ pengenal: '2311523041' });

    expect(res.status).toBe(200);
    expect(db.pengguna.findUnique).toHaveBeenCalledTimes(1);
  });

  it('AK-09 body kosong → 400', async () => {
    const res = await request(app).patch('/api/admin/akun/12').send({});
    harapGagal(res, 400);
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('AK-09 field role/status/kata sandi ditolak di endpoint ini', async () => {
    const res = await request(app).patch('/api/admin/akun/12').send({ nama: 'X Y', role: 'Admin' });
    harapGagal(res, 400);
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('AK-09 pengenal milik akun lain → 409', async () => {
    db.pengguna.findUnique
      .mockResolvedValueOnce(akunDb())
      .mockResolvedValueOnce(akunDb({ id_pengguna: 99, pengenal: 'dipakai01' }));

    const res = await request(app).patch('/api/admin/akun/12').send({ pengenal: 'dipakai01' });

    harapGagal(res, 409);
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('AK-09 P2002 saat update → 409', async () => {
    db.pengguna.findUnique.mockResolvedValueOnce(akunDb()).mockResolvedValueOnce(null);
    db.pengguna.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));

    const res = await request(app).patch('/api/admin/akun/12').send({ pengenal: 'baru01' });

    harapGagal(res, 409);
  });

  it('AK-17 error update lain → 500', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.pengguna.update.mockRejectedValue(new Error('deadlock'));

    const res = await request(app).patch('/api/admin/akun/12').send({ nama: 'Nama Baru' });

    harapGagal(res, 500);
    konsol.mockRestore();
  });

  it('akun tidak ada → 404', async () => {
    db.pengguna.findUnique.mockResolvedValue(null);
    const res = await request(app).patch('/api/admin/akun/12').send({ nama: 'Nama Baru' });
    harapGagal(res, 404);
  });
});

describe('PATCH /api/admin/akun/:id/status', () => {
  it('AK-10 nonaktifkan tanpa alasan → 400', async () => {
    const res = await request(app).patch('/api/admin/akun/12/status').send({ status_aktif: false });
    harapGagal(res, 400);
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('AK-10 status_aktif bukan boolean → 400', async () => {
    const res = await request(app).patch('/api/admin/akun/12/status').send({ status_aktif: 'false', alasan: 'Lulus' });
    harapGagal(res, 400);
  });

  it('AK-11 nonaktifkan dengan alasan menyimpan alasan_nonaktif', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.pengguna.update.mockImplementation(async ({ data }) => akunDb(data));

    const res = await request(app)
      .patch('/api/admin/akun/12/status')
      .send({ status_aktif: false, alasan: '  Lulus, keanggotaan berakhir ' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status_aktif: false, alasan_nonaktif: 'Lulus, keanggotaan berakhir' });
    expect(db.pengguna.update).toHaveBeenCalledWith({
      where: { id_pengguna: 12 },
      data: { status_aktif: false, alasan_nonaktif: 'Lulus, keanggotaan berakhir' },
      include: { role: true },
    });
    expect(db.pengguna.count).not.toHaveBeenCalled();
  });

  it('AK-12 aktifkan kembali mengosongkan alasan', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb({ status_aktif: false, alasan_nonaktif: 'Lulus' }));
    db.pengguna.update.mockImplementation(async ({ data }) => akunDb(data));

    const res = await request(app).patch('/api/admin/akun/12/status').send({ status_aktif: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status_aktif: true, alasan_nonaktif: null });
    expect(db.pengguna.update.mock.calls[0][0].data).toEqual({ status_aktif: true, alasan_nonaktif: null });
  });

  it('AK-13 menonaktifkan akun sendiri → 409', async () => {
    db.pengguna.findUnique.mockResolvedValue(adminDb({ id_pengguna: 1 }));

    const res = await request(app).patch('/api/admin/akun/1/status').send({ status_aktif: false, alasan: 'Coba' });

    harapGagal(res, 409);
    expect(res.body.message).toBe('Kamu tidak dapat menonaktifkan akunmu sendiri.');
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('AK-14 menonaktifkan Admin aktif terakhir → 409', async () => {
    db.pengguna.findUnique.mockResolvedValue(adminDb());
    db.pengguna.count.mockResolvedValue(0);

    const res = await request(app).patch('/api/admin/akun/7/status').send({ status_aktif: false, alasan: 'Pindah' });

    harapGagal(res, 409);
    expect(res.body.message).toBe('Minimal harus ada satu Admin aktif.');
    expect(db.pengguna.count).toHaveBeenCalledWith({
      where: { status_aktif: true, role: { nama_role: 'Admin' }, NOT: { id_pengguna: 7 } },
    });
    expect(db.pengguna.update).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it('AK-14 menonaktifkan Admin lain diizinkan jika masih ada Admin aktif', async () => {
    db.pengguna.findUnique.mockResolvedValue(adminDb());
    db.pengguna.count.mockResolvedValue(1);
    db.pengguna.update.mockImplementation(async ({ data }) => adminDb(data));

    const res = await request(app).patch('/api/admin/akun/7/status').send({ status_aktif: false, alasan: 'Pindah' });

    expect(res.status).toBe(200);
    expect(res.body.data.status_aktif).toBe(false);
  });

  it('AK-15 status sudah sama → 200 tanpa update', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb({ status_aktif: false, alasan_nonaktif: 'Lulus' }));

    const res = await request(app).patch('/api/admin/akun/12/status').send({ status_aktif: false, alasan: 'Lagi' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status_aktif: false, alasan_nonaktif: 'Lulus' });
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('akun tidak ada → 404', async () => {
    db.pengguna.findUnique.mockResolvedValue(null);
    const res = await request(app).patch('/api/admin/akun/12/status').send({ status_aktif: true });
    harapGagal(res, 404);
  });
});

describe('PATCH /api/admin/akun/:id/kata-sandi', () => {
  it('AK-16 reset valid → 200 data null, hash baru disimpan', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.pengguna.update.mockResolvedValue({ id_pengguna: 12 });

    const res = await request(app).patch('/api/admin/akun/12/kata-sandi').send({ kata_sandi_baru: 'sandiBaru123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
    expect(bcryptMock.hash).toHaveBeenCalledWith('sandiBaru123', 10);
    expect(db.pengguna.update).toHaveBeenCalledWith({
      where: { id_pengguna: 12 },
      data: { kata_sandi_hash: 'hash-palsu' },
      select: { id_pengguna: true },
    });
  });

  it('AK-16 kata sandi terlalu pendek → 400', async () => {
    const res = await request(app).patch('/api/admin/akun/12/kata-sandi').send({ kata_sandi_baru: 'pendek' });
    harapGagal(res, 400);
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('AK-16 akun tidak ada → 404', async () => {
    db.pengguna.findUnique.mockResolvedValue(null);
    const res = await request(app).patch('/api/admin/akun/99/kata-sandi').send({ kata_sandi_baru: 'sandiBaru123' });
    harapGagal(res, 404);
    expect(bcryptMock.hash).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UC-14 / TC-14
// ---------------------------------------------------------------------------
describe('GET /api/admin/peran', () => {
  it('HA-01 urutan Anggota, Pustakawan, Pengelola, Admin', async () => {
    db.role.findMany.mockResolvedValue([ROLE.Admin, ROLE.Pustakawan, ROLE.Anggota, ROLE.Pengelola]);

    const res = await request(app).get('/api/admin/peran');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([ROLE.Anggota, ROLE.Pustakawan, ROLE.Pengelola, ROLE.Admin]);
  });

  it('HA-01 error database → 500', async () => {
    const konsol = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.role.findMany.mockRejectedValue(new Error('down'));
    const res = await request(app).get('/api/admin/peran');
    harapGagal(res, 500);
    konsol.mockRestore();
  });
});

describe('PATCH /api/admin/akun/:id/peran', () => {
  it('HA-02 peran valid disimpan dalam transaksi', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.role.findUnique.mockResolvedValue(ROLE.Pustakawan);
    db.pengguna.update.mockImplementation(async ({ data }) => akunDb({ ...data, role: ROLE.Pustakawan }));

    const res = await request(app).patch('/api/admin/akun/12/peran').send({ role: 'Pustakawan' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('Pustakawan');
    expect(db.pengguna.update).toHaveBeenCalledWith({
      where: { id_pengguna: 12 },
      data: { id_role: 2 },
      include: { role: true },
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(db.pengguna.count).not.toHaveBeenCalled();
  });

  it('HA-02 peran sama → 200 tanpa update', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.role.findUnique.mockResolvedValue(ROLE.Anggota);

    const res = await request(app).patch('/api/admin/akun/12/peran').send({ role: 'Anggota' });

    expect(res.status).toBe(200);
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('HA-03 peran tidak dikenal → 400', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.role.findUnique.mockResolvedValue(null);

    const res = await request(app).patch('/api/admin/akun/12/peran').send({ role: 'Dosen' });

    harapGagal(res, 400);
    expect(res.body.message).toBe('Peran tidak dikenal.');
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('HA-03 body tanpa role → 400', async () => {
    const res = await request(app).patch('/api/admin/akun/12/peran').send({});
    harapGagal(res, 400);
    expect(db.pengguna.findUnique).not.toHaveBeenCalled();
  });

  it('HA-04 mengubah peran sendiri → 409', async () => {
    db.pengguna.findUnique.mockResolvedValue(adminDb({ id_pengguna: 1 }));
    db.role.findUnique.mockResolvedValue(ROLE.Anggota);

    const res = await request(app).patch('/api/admin/akun/1/peran').send({ role: 'Anggota' });

    harapGagal(res, 409);
    expect(res.body.message).toBe('Kamu tidak dapat mengubah peranmu sendiri.');
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('HA-05 menurunkan Admin aktif terakhir → 409', async () => {
    db.pengguna.findUnique.mockResolvedValue(adminDb());
    db.role.findUnique.mockResolvedValue(ROLE.Pustakawan);
    db.pengguna.count.mockResolvedValue(0);

    const res = await request(app).patch('/api/admin/akun/7/peran').send({ role: 'Pustakawan' });

    harapGagal(res, 409);
    expect(res.body.message).toBe('Minimal harus ada satu Admin aktif.');
    expect(db.pengguna.update).not.toHaveBeenCalled();
  });

  it('HA-05 menurunkan Admin diizinkan jika masih ada Admin aktif lain', async () => {
    db.pengguna.findUnique.mockResolvedValue(adminDb());
    db.role.findUnique.mockResolvedValue(ROLE.Pengelola);
    db.pengguna.count.mockResolvedValue(2);
    db.pengguna.update.mockImplementation(async ({ data }) => adminDb({ ...data, role: ROLE.Pengelola }));

    const res = await request(app).patch('/api/admin/akun/7/peran').send({ role: 'Pengelola' });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('Pengelola');
  });

  it('HA-05 menaikkan akun menjadi Admin tidak memeriksa Admin terakhir', async () => {
    db.pengguna.findUnique.mockResolvedValue(akunDb());
    db.role.findUnique.mockResolvedValue(ROLE.Admin);
    db.pengguna.update.mockImplementation(async ({ data }) => akunDb({ ...data, role: ROLE.Admin }));

    const res = await request(app).patch('/api/admin/akun/12/peran').send({ role: 'Admin' });

    expect(res.status).toBe(200);
    expect(db.pengguna.count).not.toHaveBeenCalled();
  });

  it('HA-06 akun tidak ada → 404', async () => {
    db.pengguna.findUnique.mockResolvedValue(null);

    const res = await request(app).patch('/api/admin/akun/99/peran').send({ role: 'Pustakawan' });

    harapGagal(res, 404);
    expect(db.role.findUnique).not.toHaveBeenCalled();
  });
});
