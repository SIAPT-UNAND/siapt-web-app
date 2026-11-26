import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const db = vi.hoisted(() => ({
  pengguna: {
    findUnique: vi.fn(),
  },
  kategori: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  pengarang: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  koleksi: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  koleksiPengarang: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  eksemplar: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  detailPeminjaman: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  denda: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  koreksiDenda: {
    deleteMany: vi.fn(),
  },
  rincianPembayaran: {
    deleteMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({ default: db, prisma: db }));

const { default: app } = await import('../app.js');

const baseBookPayload = {
  judul: 'Clean Code',
  pengarang: 'Robert C. Martin',
  kategori: 'Ilmu Komputer',
  penerbit: 'Prentice Hall',
  tahun_terbit: 2008,
  isbn: '9780132350884',
  nomor_panggil: '005.1 MAR c',
  bahasa: 'Inggris',
  deskripsi: 'Panduan kode bersih.',
};

const existingBookWithCopies = {
  id_koleksi: 1,
  kode_koleksi: 'KOL-001',
  id_kategori: 1,
  ...baseBookPayload,
  sampul: null,
  status_aktif: true,
  kategori: { id_kategori: 1, nama_kategori: 'Ilmu Komputer' },
  koleksi_pengarang: [{ urutan: 1, pengarang: { nama_pengarang: 'Robert C. Martin' } }],
  eksemplar: [
    { id_eksemplar: 101, kode_eksemplar: 'EKS-001-A', lokasi_rak: 'RAK-1', status: 'TERSEDIA' },
    { id_eksemplar: 102, kode_eksemplar: 'EKS-001-B', lokasi_rak: 'RAK-1', status: 'TERSEDIA' },
  ],
};

const librarianUser = {
  id_pengguna: 2,
  pengenal: '198805122014042001',
  status_aktif: true,
  role: { nama_role: 'Pustakawan' },
};

const memberUser = {
  id_pengguna: 3,
  pengenal: '2211521001',
  status_aktif: true,
  role: { nama_role: 'Anggota' },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.pengguna.findUnique.mockImplementation(async ({ where }) => {
    if (where?.pengenal === librarianUser.pengenal) return librarianUser;
    if (where?.pengenal === memberUser.pengenal) return memberUser;
    return null;
  });
  db.koleksi.findFirst.mockResolvedValue(null);
  db.koleksi.findMany.mockResolvedValue([]);
  db.koleksi.count.mockResolvedValue(0);
  db.kategori.findMany.mockResolvedValue([]);
  db.pengarang.findMany.mockResolvedValue([]);
  db.eksemplar.findMany.mockResolvedValue([]);
  db.kategori.findUnique.mockResolvedValue({ id_kategori: 1, nama_kategori: 'Ilmu Komputer' });
  db.pengarang.findFirst.mockResolvedValue({ id_pengarang: 1, nama_pengarang: 'Robert C. Martin' });
  db.koleksiPengarang.deleteMany.mockResolvedValue({ count: 1 });
  db.koleksiPengarang.create.mockResolvedValue({});
  db.koleksi.update.mockResolvedValue(existingBookWithCopies);
  db.koleksi.delete.mockResolvedValue(existingBookWithCopies);
  db.eksemplar.deleteMany.mockResolvedValue({ count: 1 });
  db.eksemplar.update.mockResolvedValue({});
  db.eksemplar.create.mockResolvedValue({ id_eksemplar: 103 });
  db.koleksi.create.mockResolvedValue(existingBookWithCopies);
  db.detailPeminjaman.findMany.mockResolvedValue([]);
  db.$queryRaw.mockResolvedValue([]);
});

describe('Koleksi copy-removal & collection-deletion history preservation', () => {
  it('rejects hard deletion of a copy referenced by circulation records and leaves history untouched', async () => {
    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    db.detailPeminjaman.findMany.mockResolvedValueOnce([{ id_eksemplar: 101 }]);

    const res = await request(app)
      .put('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        eksemplar: [
          { id_eksemplar: 102, kode_eksemplar: 'EKS-001-B', lokasi_rak: 'RAK-1', status: 'TERSEDIA' },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('EKS-001-A');
    expect(db.rincianPembayaran.deleteMany).not.toHaveBeenCalled();
    expect(db.koreksiDenda.deleteMany).not.toHaveBeenCalled();
    expect(db.denda.deleteMany).not.toHaveBeenCalled();
    expect(db.detailPeminjaman.deleteMany).not.toHaveBeenCalled();
    expect(db.eksemplar.deleteMany).not.toHaveBeenCalled();
    expect(db.koleksi.update).not.toHaveBeenCalled();
  });

  it('allows hard deletion of copies that have no circulation history', async () => {
    const updatedBook = {
      ...existingBookWithCopies,
      eksemplar: [
        { id_eksemplar: 101, kode_eksemplar: 'EKS-001-A', lokasi_rak: 'RAK-1', status: 'TERSEDIA' },
      ],
    };
    db.koleksi.findUnique
      .mockResolvedValueOnce(existingBookWithCopies)
      .mockResolvedValueOnce(updatedBook);
    db.detailPeminjaman.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .put('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        eksemplar: [
          { id_eksemplar: 101, kode_eksemplar: 'EKS-001-A', lokasi_rak: 'RAK-1', status: 'TERSEDIA' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.detailPeminjaman.findMany).toHaveBeenCalledWith({
      where: { id_eksemplar: { in: [102] } },
      select: { id_eksemplar: true },
      distinct: ['id_eksemplar'],
    });
    expect(db.eksemplar.deleteMany).toHaveBeenCalledWith({
      where: { id_eksemplar: { in: [102] } },
    });
    expect(db.rincianPembayaran.deleteMany).not.toHaveBeenCalled();
    expect(db.koreksiDenda.deleteMany).not.toHaveBeenCalled();
    expect(db.denda.deleteMany).not.toHaveBeenCalled();
    expect(db.detailPeminjaman.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects hard deletion of a collection when any copy has circulation history', async () => {
    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    db.detailPeminjaman.findMany.mockResolvedValueOnce([{ id_eksemplar: 101 }]);

    const res = await request(app)
      .delete('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('EKS-001-A');
    expect(db.koleksi.delete).not.toHaveBeenCalled();
    expect(db.rincianPembayaran.deleteMany).not.toHaveBeenCalled();
    expect(db.koreksiDenda.deleteMany).not.toHaveBeenCalled();
    expect(db.denda.deleteMany).not.toHaveBeenCalled();
    expect(db.detailPeminjaman.deleteMany).not.toHaveBeenCalled();
  });

  it('hard-deletes a collection when none of its copies have circulation history', async () => {
    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    db.detailPeminjaman.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .delete('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.koleksi.delete).toHaveBeenCalledWith({
      where: { id_koleksi: 1 },
    });
    expect(db.rincianPembayaran.deleteMany).not.toHaveBeenCalled();
    expect(db.koreksiDenda.deleteMany).not.toHaveBeenCalled();
    expect(db.denda.deleteMany).not.toHaveBeenCalled();
    expect(db.detailPeminjaman.deleteMany).not.toHaveBeenCalled();
  });
});

describe('Koleksi route authorization', () => {
  it('allows public read access without authentication headers', async () => {
    const resList = await request(app).get('/api/koleksi');
    const resKat = await request(app).get('/api/koleksi/kategori');

    expect(resList.status).toBe(200);
    expect(resKat.status).toBe(200);
  });

  it('rejects unauthenticated requests (401) and non-librarian roles (403) on write routes', async () => {
    const unauthRoutes = [
      await request(app).post('/api/koleksi').send(baseBookPayload),
      await request(app).post('/api/koleksi/import').send({ items: [baseBookPayload] }),
      await request(app).put('/api/koleksi/1').send(baseBookPayload),
      await request(app).delete('/api/koleksi/1'),
    ];
    for (const res of unauthRoutes) {
      expect(res.status).toBe(401);
    }

    const forbiddenRoutes = [
      await request(app)
        .post('/api/koleksi')
        .set('x-pengenal', memberUser.pengenal)
        .send(baseBookPayload),
      await request(app)
        .post('/api/koleksi/import')
        .set('x-pengenal', memberUser.pengenal)
        .send({ items: [baseBookPayload] }),
      await request(app)
        .put('/api/koleksi/1')
        .set('x-pengenal', memberUser.pengenal)
        .send(baseBookPayload),
      await request(app).delete('/api/koleksi/1').set('x-pengenal', memberUser.pengenal),
    ];
    for (const res of forbiddenRoutes) {
      expect(res.status).toBe(403);
    }
  });
});

describe('Koleksi read endpoints (kategori, opsi-form, list, detail)', () => {
  it('GET /api/koleksi/kategori returns sorted categories and forwards errors', async () => {
    db.kategori.findMany.mockResolvedValueOnce([
      { id_kategori: 1, nama_kategori: 'Basis Data' },
      { id_kategori: 2, nama_kategori: 'Ilmu Komputer' },
    ]);

    const res = await request(app).get('/api/koleksi/kategori');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    db.kategori.findMany.mockRejectedValueOnce(new Error('DB down'));
    const errRes = await request(app).get('/api/koleksi/kategori');
    expect(errRes.status).toBe(500);
  });

  it('GET /api/koleksi/opsi-form returns form options and computes next_id_koleksi', async () => {
    db.kategori.findMany.mockResolvedValueOnce([{ nama_kategori: 'Ilmu Komputer' }]);
    db.pengarang.findMany.mockResolvedValueOnce([
      { nama_pengarang: 'Robert C. Martin' },
      { nama_pengarang: 'Robert C. Martin' },
    ]);
    db.koleksi.findMany.mockResolvedValueOnce([{ penerbit: 'Informatika' }, { penerbit: 'Andi' }]);
    db.koleksi.findFirst.mockResolvedValueOnce({ id_koleksi: 4 });
    db.$queryRaw.mockResolvedValueOnce([{ nextId: 7 }]);

    const res = await request(app).get('/api/koleksi/opsi-form');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      kategori: ['Ilmu Komputer'],
      pengarang: ['Robert C. Martin'],
      penerbit: ['Andi', 'Informatika'],
      next_id_koleksi: 7,
    });

    db.kategori.findMany.mockRejectedValueOnce(new Error('Query error'));
    const errRes = await request(app).get('/api/koleksi/opsi-form');
    expect(errRes.status).toBe(500);
  });

  it('GET /api/koleksi supports filters across all searchBy modes and pagination', async () => {
    db.koleksi.findMany.mockResolvedValue([existingBookWithCopies]);
    db.koleksi.count.mockResolvedValue(1);

    const queries = [
      '/api/koleksi',
      '/api/koleksi?kategori=Ilmu%20Komputer&onlyAvailable=true&page=1&limit=10',
      '/api/koleksi?q=Clean&searchBy=judul',
      '/api/koleksi?q=Martin&searchBy=penulis',
      '/api/koleksi?q=978&searchBy=isbn',
      '/api/koleksi?q=Prentice&searchBy=penerbit',
      '/api/koleksi?q=Komputer&searchBy=kategori',
      '/api/koleksi?q=Clean&searchBy=all',
    ];

    for (const url of queries) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0]).toMatchObject({
        id_koleksi: 1,
        total_stok: 2,
        stok_tersedia: 2,
      });
    }

    db.koleksi.findMany.mockRejectedValueOnce(new Error('List failure'));
    const errRes = await request(app).get('/api/koleksi');
    expect(errRes.status).toBe(500);
  });

  it('GET /api/koleksi/:id returns 200 when found, 404 when missing, and 500 on error', async () => {
    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    const okRes = await request(app).get('/api/koleksi/1');
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.judul).toBe('Clean Code');

    db.koleksi.findUnique.mockResolvedValueOnce(null);
    const notFound = await request(app).get('/api/koleksi/999');
    expect(notFound.status).toBe(404);

    db.koleksi.findUnique.mockRejectedValueOnce(new Error('Lookup fail'));
    const errRes = await request(app).get('/api/koleksi/1');
    expect(errRes.status).toBe(500);
  });
});

describe('Koleksi write validation and CRUD flows', () => {
  it('POST /api/koleksi validates required fields, duplicate ISBN, duplicate copies, and cover limits', async () => {
    const missingRes = await request(app)
      .post('/api/koleksi')
      .set('x-pengenal', librarianUser.pengenal)
      .send({ judul: 'Only Title' });
    expect(missingRes.status).toBe(400);

    db.koleksi.findFirst.mockResolvedValueOnce({
      id_koleksi: 9,
      judul: 'Existing Book',
      kode_koleksi: 'KOL-009',
    });
    const dupIsbnRes = await request(app)
      .post('/api/koleksi')
      .set('x-pengenal', librarianUser.pengenal)
      .send(baseBookPayload);
    expect(dupIsbnRes.status).toBe(400);

    const dupInPayloadRes = await request(app)
      .post('/api/koleksi')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        eksemplar: [
          { kode_eksemplar: 'DUP-1', lokasi_rak: 'R1' },
          { kode_eksemplar: 'dup-1', lokasi_rak: 'R2' },
        ],
      });
    expect(dupInPayloadRes.status).toBe(400);

    db.eksemplar.findMany.mockResolvedValueOnce([{ kode_eksemplar: 'EKS-USED' }]);
    const dupInDbRes = await request(app)
      .post('/api/koleksi')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        eksemplar: [{ kode_eksemplar: 'EKS-USED', lokasi_rak: 'R1' }],
      });
    expect(dupInDbRes.status).toBe(400);

    const badCoverRes = await request(app)
      .post('/api/koleksi')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        sampul: 'data:image/webp;not-base64',
      });
    expect(badCoverRes.status).toBe(400);

    const hugeBase64 = Buffer.alloc(105 * 1024, 65).toString('base64');
    const bigCoverRes = await request(app)
      .post('/api/koleksi')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        sampul: `data:image/webp;base64,${hugeBase64}`,
      });
    expect(bigCoverRes.status).toBe(400);
  });

  it('POST /api/koleksi creates a book with cover upload and multiple authors, then DELETE removes the cover', async () => {
    const tinyWebp = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    let savedCoverPath = null;

    db.kategori.findUnique.mockResolvedValueOnce(null);
    db.kategori.create.mockResolvedValueOnce({ id_kategori: 5, nama_kategori: 'Kategori Baru' });
    db.pengarang.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    db.pengarang.create
      .mockResolvedValueOnce({ id_pengarang: 11, nama_pengarang: 'Penulis Satu' })
      .mockResolvedValueOnce({ id_pengarang: 12, nama_pengarang: 'Penulis Dua' });
    db.koleksi.create.mockImplementationOnce(async ({ data }) => {
      savedCoverPath = data.sampul;
      return {
        ...existingBookWithCopies,
        id_koleksi: 25,
        sampul: data.sampul,
      };
    });
    db.koleksi.findUnique.mockResolvedValueOnce({
      ...existingBookWithCopies,
      id_koleksi: 25,
      sampul: '/upload/temp.webp',
    });

    const createRes = await request(app)
      .post('/api/koleksi')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        pengarang: 'Penulis Satu, Penulis Dua, Penulis Satu',
        kategori: 'Kategori Baru',
        sampul: tinyWebp,
        eksemplar: [{ kode_eksemplar: 'NEW-EKS-1', lokasi_rak: 'Rak Baru' }],
      });

    expect(createRes.status).toBe(201);
    expect(savedCoverPath).toMatch(/^\/upload\/cover-.*\.webp$/);
    expect(db.eksemplar.create).toHaveBeenCalledTimes(1);

    // Cleanup temporary cover file created during test via DELETE /api/koleksi/25
    db.koleksi.findUnique.mockResolvedValueOnce({
      ...existingBookWithCopies,
      id_koleksi: 25,
      sampul: savedCoverPath,
      eksemplar: [],
    });
    const delRes = await request(app)
      .delete('/api/koleksi/25')
      .set('x-pengenal', librarianUser.pengenal);
    expect(delRes.status).toBe(200);
  });

  it('POST /api/koleksi/import validates payload, detects conflicts, and imports grouped items', async () => {
    const emptyRes = await request(app)
      .post('/api/koleksi/import')
      .set('x-pengenal', librarianUser.pengenal)
      .send({ items: [] });
    expect(emptyRes.status).toBe(400);

    const incompleteRes = await request(app)
      .post('/api/koleksi/import')
      .set('x-pengenal', librarianUser.pengenal)
      .send({ items: [{ judul: 'Tanpa Field Lain' }] });
    expect(incompleteRes.status).toBe(400);

    db.koleksi.findMany.mockResolvedValueOnce([
      {
        ...existingBookWithCopies,
        isbn: '978-DB-1',
        eksemplar: [{ id_eksemplar: 1, kode_eksemplar: 'EKS-DB-1' }],
      },
    ]);
    const dbIsbnConflict = await request(app)
      .post('/api/koleksi/import')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        items: [{ ...baseBookPayload, judul: 'Judul Berbeda', isbn: '978-DB-1' }],
      });
    expect(dbIsbnConflict.status).toBe(400);

    db.koleksi.findMany.mockResolvedValueOnce([]);
    const inFileIsbnConflict = await request(app)
      .post('/api/koleksi/import')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        items: [
          { ...baseBookPayload, judul: 'Buku X', isbn: '978-SAME' },
          { ...baseBookPayload, judul: 'Buku Y', isbn: '978-SAME' },
        ],
      });
    expect(inFileIsbnConflict.status).toBe(400);

    db.koleksi.findMany.mockResolvedValueOnce([
      {
        ...existingBookWithCopies,
        eksemplar: [{ id_eksemplar: 1, kode_eksemplar: 'EKS-DB-DUP' }],
      },
    ]);
    const dbEksConflict = await request(app)
      .post('/api/koleksi/import')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        items: [{ ...baseBookPayload, kode_eksemplar: 'EKS-DB-DUP' }],
      });
    expect(dbEksConflict.status).toBe(400);

    db.koleksi.findMany.mockResolvedValueOnce([]);
    const inFileEksConflict = await request(app)
      .post('/api/koleksi/import')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        items: [
          { ...baseBookPayload, isbn: '978-1', eksemplar: [{ kode_eksemplar: 'SAME-EKS' }] },
          { ...baseBookPayload, judul: 'Clean Code 2', isbn: '978-2', kode_eksemplar: 'SAME-EKS' },
        ],
      });
    expect(inFileEksConflict.status).toBe(400);

    db.koleksi.findMany
      .mockResolvedValueOnce([existingBookWithCopies])
      .mockResolvedValueOnce([existingBookWithCopies]);
    db.koleksi.create.mockResolvedValueOnce({ ...existingBookWithCopies, id_koleksi: 88 });
    db.eksemplar.findUnique.mockResolvedValue(null);

    const okImport = await request(app)
      .post('/api/koleksi/import')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        items: [
          { ...baseBookPayload, kode_eksemplar: 'NEW-IMP-1, NEW-IMP-2', lokasi_rak: 'Rak Z' },
          {
            ...baseBookPayload,
            judul: 'Buku Impor Baru',
            isbn: '978-IMPORT-NEW',
            eksemplar: [{ kode_eksemplar: 'NEW-IMP-3', lokasi_rak: 'Rak W' }],
          },
        ],
      });

    expect(okImport.status).toBe(201);
    expect(okImport.body.count).toBe(2);
    expect(db.eksemplar.create).toHaveBeenCalledTimes(3);
  });

  it('PUT /api/koleksi/:id handles 404, 400 validations, rename/add copies, and sampul updates', async () => {
    db.koleksi.findUnique.mockResolvedValueOnce(null);
    const notFound = await request(app)
      .put('/api/koleksi/999')
      .set('x-pengenal', librarianUser.pengenal)
      .send(baseBookPayload);
    expect(notFound.status).toBe(404);

    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    const missing = await request(app)
      .put('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal)
      .send({ judul: 'Only' });
    expect(missing.status).toBe(400);

    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    db.koleksi.findFirst.mockResolvedValueOnce({
      id_koleksi: 2,
      judul: 'Other',
      kode_koleksi: 'KOL-002',
    });
    const isbnConflict = await request(app)
      .put('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal)
      .send(baseBookPayload);
    expect(isbnConflict.status).toBe(400);

    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    const dupEksPayload = await request(app)
      .put('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        eksemplar: [{ kode_eksemplar: 'A-1' }, { kode_eksemplar: 'a-1' }],
      });
    expect(dupEksPayload.status).toBe(400);

    db.koleksi.findUnique.mockResolvedValueOnce(existingBookWithCopies);
    db.eksemplar.findMany.mockResolvedValueOnce([{ kode_eksemplar: 'OTHER-BOOK-EKS' }]);
    const otherBookEks = await request(app)
      .put('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        eksemplar: [{ kode_eksemplar: 'OTHER-BOOK-EKS' }],
      });
    expect(otherBookEks.status).toBe(400);

    // Rename copy 101, keep 102, add 103, and clear sampul
    db.koleksi.findUnique
      .mockResolvedValueOnce({ ...existingBookWithCopies, sampul: '/upload/non-existent.webp' })
      .mockResolvedValueOnce(existingBookWithCopies);
    const okUpdate = await request(app)
      .put('/api/koleksi/1')
      .set('x-pengenal', librarianUser.pengenal)
      .send({
        ...baseBookPayload,
        status_aktif: true,
        sampul: '',
        eksemplar: [
          { id_eksemplar: 101, kode_eksemplar: 'EKS-001-RENAMED', lokasi_rak: 'RAK-2', status: 'TERSEDIA' },
          { kode_eksemplar: 'EKS-001-B', lokasi_rak: 'RAK-1', status: 'TERSEDIA' },
          { kode_eksemplar: 'EKS-001-C', lokasi_rak: 'RAK-3', status: 'TERSEDIA' },
        ],
      });
    expect(okUpdate.status).toBe(200);
    expect(db.eksemplar.update).toHaveBeenCalled();
    expect(db.eksemplar.create).toHaveBeenCalled();
  });

  it('DELETE /api/koleksi/:id returns 404 when collection does not exist', async () => {
    db.koleksi.findUnique.mockResolvedValueOnce(null);
    const res = await request(app)
      .delete('/api/koleksi/404')
      .set('x-pengenal', librarianUser.pengenal);
    expect(res.status).toBe(404);
  });
});
