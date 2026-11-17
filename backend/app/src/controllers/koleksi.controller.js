import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Direktori penyimpanan sampul buku: backend/app/public/upload
const UPLOAD_DIR = path.resolve(__dirname, '../../public/upload');
const MAX_COVER_SIZE_BYTES = 100 * 1024; // Maksimal 100 KB

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Menyimpan data gambar base64 (WebP) ke folder public/upload di backend.
 * Memastikan ukuran file maksimal 100 KB dan ekstensi .webp.
 */
const saveCoverToDisk = async (sampulInput) => {
  if (!sampulInput || typeof sampulInput !== 'string') {
    return null;
  }

  const trimmed = sampulInput.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('data:image/')) {
    const matches = trimmed.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches) {
      const err = new Error('Format data gambar sampul tidak valid');
      err.status = 400;
      throw err;
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_COVER_SIZE_BYTES) {
      const err = new Error(
        `Ukuran file sampul (${(buffer.length / 1024).toFixed(1)} KB) melebihi batas maksimal 100 KB`
      );
      err.status = 400;
      throw err;
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const filename = `cover-${uniqueSuffix}.webp`;
    const filePath = path.join(UPLOAD_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);
    return `/upload/${filename}`;
  }

  return trimmed;
};

/**
 * Menghapus file sampul buku dari folder public/upload jika ada.
 */
const deleteCoverFromDisk = async (sampulPath) => {
  if (!sampulPath || typeof sampulPath !== 'string') {
    return;
  }

  try {
    const filename = path.basename(sampulPath);
    if (!filename || filename === '.' || filename === '..') {
      return;
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (err) {
    console.warn('Gagal menghapus file sampul lama:', err.message);
  }
};

/**
 * Helper untuk memisahkan banyak penulis (dipisahkan koma),
 * menambahkan penulis baru ke tabel pengarang jika belum ada,
 * dan menghubungkannya ke tabel koleksi_pengarang sesuai urutan.
 */
const syncAuthorsForKoleksi = async (id_koleksi, pengarangString) => {
  if (!pengarangString || typeof pengarangString !== 'string') return;

  const rawNames = pengarangString
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  const uniqueNames = [];
  const seen = new Set();
  for (const name of rawNames) {
    const lower = name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueNames.push(name);
    }
  }

  if (uniqueNames.length === 0) return;

  await prisma.koleksiPengarang.deleteMany({
    where: { id_koleksi },
  });

  for (let i = 0; i < uniqueNames.length; i++) {
    const authorName = uniqueNames[i];
    let authorRecord = await prisma.pengarang.findFirst({
      where: { nama_pengarang: authorName },
    });
    if (!authorRecord) {
      authorRecord = await prisma.pengarang.create({
        data: { nama_pengarang: authorName },
      });
    }

    await prisma.koleksiPengarang.create({
      data: {
        id_koleksi,
        id_pengarang: authorRecord.id_pengarang,
        urutan: i + 1,
      },
    });
  }
};

/**
 * Helper untuk mencari atau membuat kategori berdasarkan nama_kategori.
 */
const resolveKategoriId = async (id_kategori, kategoriName) => {
  if (id_kategori) {
    return parseInt(id_kategori, 10);
  }
  if (kategoriName && typeof kategoriName === 'string' && kategoriName.trim()) {
    const cleanName = kategoriName.trim();
    const existing = await prisma.kategori.findUnique({
      where: { nama_kategori: cleanName },
    });
    if (existing) {
      return existing.id_kategori;
    }
    const created = await prisma.kategori.create({
      data: { nama_kategori: cleanName, status_aktif: true },
    });
    return created.id_kategori;
  }

  const defaultCat = await prisma.kategori.findFirst();
  if (defaultCat) {
    return defaultCat.id_kategori;
  }
  const createdDefault = await prisma.kategori.create({
    data: { nama_kategori: 'Ilmu Komputer & Sistem Informasi', status_aktif: true },
  });
  return createdDefault.id_kategori;
};

/**
 * Helper menghapus detail_peminjaman beserta denda terkait untuk daftar id_eksemplar.
 */
const cleanupLoanDetailsForEksemplars = async (eksemplarIds) => {
  if (!Array.isArray(eksemplarIds) || eksemplarIds.length === 0) return;

  const details = await prisma.detailPeminjaman.findMany({
    where: { id_eksemplar: { in: eksemplarIds } },
    select: { id_detail: true },
  });
  const detailIds = details.map((d) => d.id_detail);

  if (detailIds.length > 0) {
    const dendas = await prisma.denda.findMany({
      where: { id_detail: { in: detailIds } },
      select: { id_denda: true },
    });
    const dendaIds = dendas.map((d) => d.id_denda);

    if (dendaIds.length > 0) {
      await prisma.rincianPembayaran.deleteMany({
        where: { id_denda: { in: dendaIds } },
      });
      await prisma.koreksiDenda.deleteMany({
        where: { id_denda: { in: dendaIds } },
      });
      await prisma.denda.deleteMany({
        where: { id_denda: { in: dendaIds } },
      });
    }

    await prisma.detailPeminjaman.deleteMany({
      where: { id_detail: { in: detailIds } },
    });
  }
};

/**
 * Validasi field wajib untuk buku:
 * Wajib: judul, pengarang, kategori, penerbit, tahun_terbit, isbn, nomor_panggil, bahasa, deskripsi.
 * Opsional (boleh kosong): edisi, lokasi_rak, kode_eksemplar, sampul.
 */
const validateRequiredBookFields = (payload) => {
  const missing = [];
  if (!payload.judul || !String(payload.judul).trim()) missing.push('Judul Buku');
  if (!payload.pengarang || !String(payload.pengarang).trim()) missing.push('Penulis / Pengarang');
  if (
    (!payload.kategori || !String(payload.kategori).trim()) &&
    !payload.id_kategori
  ) {
    missing.push('Kategori');
  }
  if (!payload.penerbit || !String(payload.penerbit).trim()) missing.push('Penerbit');
  if (
    payload.tahun_terbit === undefined ||
    payload.tahun_terbit === null ||
    String(payload.tahun_terbit).trim() === '' ||
    Number.isNaN(parseInt(payload.tahun_terbit, 10))
  ) {
    missing.push('Tahun Terbit');
  }
  if (!payload.isbn || !String(payload.isbn).trim()) missing.push('ISBN');
  if (!payload.nomor_panggil || !String(payload.nomor_panggil).trim()) {
    missing.push('Nomor Panggil');
  }
  if (!payload.bahasa || !String(payload.bahasa).trim()) missing.push('Bahasa');
  if (!payload.deskripsi || !String(payload.deskripsi).trim()) {
    missing.push('Deskripsi / Sinopsis Buku');
  }
  return missing;
};

/**
 * Helper untuk memformat objek koleksi dari Prisma agar seragam di seluruh endpoint.
 */
const formatKoleksi = (book) => {
  const pengarangList = (book.koleksi_pengarang || [])
    .map((kp) => kp.pengarang?.nama_pengarang)
    .filter(Boolean);

  const eksemplarList = (book.eksemplar || []).map((e) => ({
    id_eksemplar: e.id_eksemplar,
    kode_eksemplar: e.kode_eksemplar,
    lokasi_rak: e.lokasi_rak || '',
    status: e.status || 'TERSEDIA',
  }));

  const totalStok = eksemplarList.length;
  const stokTersedia = eksemplarList.filter(
    (e) => e.status === 'TERSEDIA' || !e.status
  ).length;

  const uniqueRaks = Array.from(
    new Set(eksemplarList.map((e) => e.lokasi_rak).filter(Boolean))
  );
  const lokasiRak = uniqueRaks.length > 0 ? uniqueRaks.join(', ') : '';

  return {
    id_koleksi: book.id_koleksi,
    kode_koleksi: book.kode_koleksi,
    judul: book.judul,
    pengarang: pengarangList.join(', ') || 'Anonim',
    kategori: book.kategori?.nama_kategori || 'Umum',
    id_kategori: book.id_kategori,
    penerbit: book.penerbit || '',
    tahun_terbit: book.tahun_terbit || null,
    isbn: book.isbn || '',
    nomor_panggil: book.nomor_panggil || '',
    edisi: book.edisi || '',
    bahasa: book.bahasa || 'Indonesia',
    deskripsi: book.deskripsi || '',
    sampul: book.sampul || '',
    lokasi_rak: lokasiRak,
    status_aktif: book.status_aktif ?? true,
    total_stok: totalStok,
    stok_tersedia: stokTersedia,
    eksemplar: eksemplarList,
  };
};

// GET /api/koleksi/kategori
export const getKategoriList = async (req, res, next) => {
  try {
    const categories = await prisma.kategori.findMany({
      where: {
        OR: [{ status_aktif: true }, { status_aktif: null }],
      },
      orderBy: {
        nama_kategori: 'asc',
      },
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/koleksi/opsi-form
export const getFormOptions = async (req, res, next) => {
  try {
    const [categories, authors, publishersRaw] = await Promise.all([
      prisma.kategori.findMany({
        where: { OR: [{ status_aktif: true }, { status_aktif: null }] },
        orderBy: { nama_kategori: 'asc' },
      }),
      prisma.pengarang.findMany({
        orderBy: { nama_pengarang: 'asc' },
      }),
      prisma.koleksi.findMany({
        where: { penerbit: { not: null } },
        select: { penerbit: true },
        distinct: ['penerbit'],
      }),
    ]);

    const pengarangList = authors
      .map((a) => a.nama_pengarang?.trim())
      .filter(Boolean);

    const penerbitList = publishersRaw
      .map((p) => p.penerbit?.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      success: true,
      data: {
        kategori: categories.map((c) => c.nama_kategori).filter(Boolean),
        pengarang: Array.from(new Set(pengarangList)),
        penerbit: Array.from(new Set(penerbitList)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/koleksi
export const getKoleksi = async (req, res, next) => {
  try {
    const {
      q,
      searchBy = 'all',
      kategori,
      onlyAvailable,
      limit = 200,
      page = 1,
    } = req.query;

    const andConditions = [];

    if (kategori && kategori !== 'Semua') {
      andConditions.push({
        kategori: {
          nama_kategori: { equals: kategori },
        },
      });
    }

    if (onlyAvailable === 'true' || onlyAvailable === '1') {
      andConditions.push({
        eksemplar: {
          some: {
            status: 'TERSEDIA',
          },
        },
      });
    }

    if (q && q.trim()) {
      const query = q.trim();

      if (searchBy === 'judul') {
        andConditions.push({ judul: { contains: query } });
      } else if (searchBy === 'penulis') {
        andConditions.push({
          koleksi_pengarang: {
            some: {
              pengarang: {
                nama_pengarang: { contains: query },
              },
            },
          },
        });
      } else if (searchBy === 'isbn') {
        andConditions.push({ isbn: { contains: query } });
      } else if (searchBy === 'penerbit') {
        andConditions.push({ penerbit: { contains: query } });
      } else if (searchBy === 'kategori') {
        andConditions.push({
          kategori: {
            nama_kategori: { contains: query },
          },
        });
      } else {
        andConditions.push({
          OR: [
            { judul: { contains: query } },
            { kode_koleksi: { contains: query } },
            { isbn: { contains: query } },
            { penerbit: { contains: query } },
            { nomor_panggil: { contains: query } },
            {
              kategori: {
                nama_kategori: { contains: query },
              },
            },
            {
              koleksi_pengarang: {
                some: {
                  pengarang: {
                    nama_pengarang: { contains: query },
                  },
                },
              },
            },
          ],
        });
      }
    }

    const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

    const take = parseInt(limit, 10) || 200;
    const skip = (parseInt(page, 10) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.koleksi.findMany({
        where: whereClause,
        include: {
          kategori: true,
          koleksi_pengarang: {
            include: {
              pengarang: true,
            },
            orderBy: {
              urutan: 'asc',
            },
          },
          eksemplar: {
            orderBy: {
              id_eksemplar: 'asc',
            },
          },
        },
        skip,
        take,
        orderBy: {
          id_koleksi: 'desc',
        },
      }),
      prisma.koleksi.count({ where: whereClause }),
    ]);

    const formattedData = items.map(formatKoleksi);

    res.status(200).json({
      success: true,
      meta: {
        total,
        page: parseInt(page, 10),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
      data: formattedData,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/koleksi/:id
export const getKoleksiById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const book = await prisma.koleksi.findUnique({
      where: { id_koleksi: id },
      include: {
        kategori: true,
        koleksi_pengarang: {
          include: {
            pengarang: true,
          },
          orderBy: {
            urutan: 'asc',
          },
        },
        eksemplar: {
          orderBy: {
            id_eksemplar: 'asc',
          },
        },
      },
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Koleksi buku tidak ditemukan',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: formatKoleksi(book),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/koleksi
export const createKoleksi = async (req, res, next) => {
  try {
    const {
      judul,
      pengarang,
      kategori,
      id_kategori,
      kode_koleksi,
      isbn,
      penerbit,
      tahun_terbit,
      edisi,
      nomor_panggil,
      bahasa,
      deskripsi,
      sampul,
      eksemplar = [],
    } = req.body;

    // Validasi 9 field wajib (edisi, lokasi_rak, kode_eksemplar, dan sampul bersifat opsional)
    const missingFields = validateRequiredBookFields(req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Field berikut wajib diisi: ${missingFields.join(', ')}`,
        },
      });
    }

    // Cek apakah ISBN sudah digunakan oleh buku lain di database
    const cleanIsbn = String(isbn).trim();
    const existingIsbnBook = await prisma.koleksi.findFirst({
      where: { isbn: cleanIsbn },
      select: { id_koleksi: true, judul: true, kode_koleksi: true },
    });
    if (existingIsbnBook) {
      return res.status(400).json({
        success: false,
        error: {
          message: `ISBN "${cleanIsbn}" sudah terdaftar pada buku "${existingIsbnBook.judul}" (${existingIsbnBook.kode_koleksi}).`,
        },
      });
    }

    // Filter daftar kode eksemplar yang diisi (boleh kosong)
    const cleanEksemplarList = (Array.isArray(eksemplar) ? eksemplar : [])
      .map((item) => ({
        kode_eksemplar: String(item.kode_eksemplar || '').trim(),
        lokasi_rak:
          item.lokasi_rak && String(item.lokasi_rak).trim()
            ? String(item.lokasi_rak).trim()
            : null,
        status:
          item.status && String(item.status).trim()
            ? String(item.status).trim().toUpperCase()
            : 'TERSEDIA',
      }))
      .filter((item) => item.kode_eksemplar !== '');

    if (cleanEksemplarList.length > 0) {
      // Cek duplikat kode_eksemplar di dalam input form
      const seenCodes = new Set();
      for (const item of cleanEksemplarList) {
        const lower = item.kode_eksemplar.toLowerCase();
        if (seenCodes.has(lower)) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Terdapat kode eksemplar ganda di dalam daftar: "${item.kode_eksemplar}"`,
            },
          });
        }
        seenCodes.add(lower);
      }

      // Cek apakah kode_eksemplar sudah digunakan di database
      const existingInDb = await prisma.eksemplar.findMany({
        where: {
          kode_eksemplar: {
            in: cleanEksemplarList.map((e) => e.kode_eksemplar),
          },
        },
        select: { kode_eksemplar: true },
      });

      if (existingInDb.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Kode eksemplar sudah terdaftar di database: ${existingInDb
              .map((e) => e.kode_eksemplar)
              .join(', ')}`,
          },
        });
      }
    }

    // 1. Simpan sampul buku (.webp <= 100KB) ke folder public/upload jika ada (opsional)
    const savedCoverPath = await saveCoverToDisk(sampul);

    // 2. Tentukan Kategori ID
    const finalKategoriId = await resolveKategoriId(id_kategori, kategori);

    // 3. Buat Kode Koleksi unik
    const finalKode =
      kode_koleksi && String(kode_koleksi).trim()
        ? String(kode_koleksi).trim()
        : `KOL-${Date.now().toString().slice(-6)}-${Math.random()
            .toString(36)
            .substring(2, 5)
            .toUpperCase()}`;

    // 4. Buat record Koleksi di database
    const newBook = await prisma.koleksi.create({
      data: {
        kode_koleksi: finalKode,
        id_kategori: finalKategoriId,
        judul: String(judul).trim(),
        isbn: String(isbn).trim(),
        penerbit: String(penerbit).trim(),
        tahun_terbit: parseInt(tahun_terbit, 10),
        edisi: edisi && String(edisi).trim() ? String(edisi).trim() : null,
        nomor_panggil: String(nomor_panggil).trim(),
        bahasa: String(bahasa).trim(),
        deskripsi: String(deskripsi).trim(),
        sampul: savedCoverPath,
        status_aktif: true,
      },
    });

    // 5. Hubungkan dengan Pengarang (mendukung lebih dari 1 penulis dipisahkan koma)
    await syncAuthorsForKoleksi(newBook.id_koleksi, String(pengarang));

    // 6. Tambahkan setiap Kode Eksemplar ke tabel eksemplar (jika ada yang diisi)
    for (const eks of cleanEksemplarList) {
      await prisma.eksemplar.create({
        data: {
          id_koleksi: newBook.id_koleksi,
          kode_eksemplar: eks.kode_eksemplar,
          lokasi_rak: eks.lokasi_rak,
          status: eks.status,
          dibuat_pada: new Date(),
        },
      });
    }

    // 7. Ambil data lengkap beserta relasinya
    const completeBook = await prisma.koleksi.findUnique({
      where: { id_koleksi: newBook.id_koleksi },
      include: {
        kategori: true,
        koleksi_pengarang: {
          include: { pengarang: true },
          orderBy: { urutan: 'asc' },
        },
        eksemplar: {
          orderBy: { id_eksemplar: 'asc' },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: formatKoleksi(completeBook),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper membuat kunci pengelompokan buku berdasarkan:
 * Judul Buku + Penulis (dinormalisasi) + Penerbit + Tahun Terbit.
 */
const makeBookIdentityKey = (judul, pengarang, penerbit, tahunTerbit) => {
  const j = String(judul || '').trim().toLowerCase();
  const a = String(pengarang || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(', ');
  const p = String(penerbit || '').trim().toLowerCase();
  const t = tahunTerbit ? String(parseInt(tahunTerbit, 10) || '') : '';
  return `${j}||${a}||${p}||${t}`;
};

// POST /api/koleksi/import
export const importKoleksi = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Data buku untuk diimport kosong atau tidak valid',
        },
      });
    }

    // Validasi setiap item yang akan diimport:
    // Kolom Kode Eksemplar, Edisi, dan Lokasi Rak boleh kosong; selebihnya wajib diisi.
    for (let idx = 0; idx < items.length; idx++) {
      const missing = validateRequiredBookFields(items[idx]);
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Data buku ke-${idx + 1} ("${items[idx]?.judul || 'Tanpa Judul'}") belum lengkap. Kolom wajib yang belum diisi: ${missing.join(', ')}`,
          },
        });
      }
    }

    const existingBooksInDb = await prisma.koleksi.findMany({
      include: {
        koleksi_pengarang: {
          include: { pengarang: true },
          orderBy: { urutan: 'asc' },
        },
        eksemplar: true,
      },
    });

    const bookIdentityMap = new Map();
    const isbnDbMap = new Map();
    const eksDbMap = new Map();

    for (const b of existingBooksInDb) {
      const authorsStr = (b.koleksi_pengarang || [])
        .map((kp) => kp.pengarang?.nama_pengarang)
        .filter(Boolean)
        .join(', ');
      const key = makeBookIdentityKey(b.judul, authorsStr, b.penerbit, b.tahun_terbit);
      bookIdentityMap.set(key, b.id_koleksi);

      if (b.isbn && String(b.isbn).trim()) {
        isbnDbMap.set(String(b.isbn).trim().toLowerCase(), {
          id_koleksi: b.id_koleksi,
          judul: b.judul,
          identityKey: key,
        });
      }

      for (const e of b.eksemplar || []) {
        if (e.kode_eksemplar) {
          eksDbMap.set(e.kode_eksemplar.trim().toLowerCase(), {
            kode_eksemplar: e.kode_eksemplar,
            judul: b.judul,
          });
        }
      }
    }

    // Validasi pra-import untuk mendeteksi ISBN atau Kode Eksemplar yang bentrok
    const importIsbnMap = new Map();
    const importEksSet = new Set();

    for (let idx = 0; idx < items.length; idx++) {
      const row = items[idx];
      const judul = String(row.judul).trim();
      const pengarang = String(row.pengarang).trim();
      const penerbit = String(row.penerbit).trim();
      const tahunValid = parseInt(row.tahun_terbit, 10);
      const cleanIsbn = String(row.isbn).trim();
      const lowerIsbn = cleanIsbn.toLowerCase();
      const identityKey = makeBookIdentityKey(judul, pengarang, penerbit, tahunValid);

      // Cek bentrok ISBN dengan buku lain di Database
      if (isbnDbMap.has(lowerIsbn)) {
        const dbMatch = isbnDbMap.get(lowerIsbn);
        if (dbMatch.identityKey !== identityKey) {
          return res.status(400).json({
            success: false,
            error: {
              message: `ISBN "${cleanIsbn}" pada buku "${judul}" sudah terdaftar pada buku lain di database ("${dbMatch.judul}").`,
            },
          });
        }
      }

      // Cek bentrok ISBN antar buku berbeda di dalam file Excel yang diimport
      if (importIsbnMap.has(lowerIsbn)) {
        const prevBook = importIsbnMap.get(lowerIsbn);
        if (prevBook.identityKey !== identityKey) {
          return res.status(400).json({
            success: false,
            error: {
              message: `ISBN "${cleanIsbn}" digunakan oleh lebih dari satu buku berbeda di dalam file Excel ("${prevBook.judul}" dan "${judul}").`,
            },
          });
        }
      } else {
        importIsbnMap.set(lowerIsbn, { judul, identityKey });
      }

      // Cek bentrok Kode Eksemplar
      let codesToCheck = [];
      if (Array.isArray(row.eksemplar) && row.eksemplar.length > 0) {
        codesToCheck = row.eksemplar
          .map((e) => String(e.kode_eksemplar || '').trim())
          .filter(Boolean);
      } else if (row.kode_eksemplar && String(row.kode_eksemplar).trim()) {
        codesToCheck = String(row.kode_eksemplar)
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
      }

      for (const code of codesToCheck) {
        const lowerCode = code.toLowerCase();
        if (eksDbMap.has(lowerCode)) {
          const dbEks = eksDbMap.get(lowerCode);
          return res.status(400).json({
            success: false,
            error: {
              message: `Kode Eksemplar "${code}" pada buku "${judul}" sudah terdaftar di database pada buku "${dbEks.judul}".`,
            },
          });
        }
        if (importEksSet.has(lowerCode)) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Terdapat Kode Eksemplar yang sama (duplikat) di dalam file Excel: "${code}".`,
            },
          });
        }
        importEksSet.add(lowerCode);
      }
    }

    const affectedKoleksiIds = new Set();

    for (let idx = 0; idx < items.length; idx++) {
      const row = items[idx];
      const judul = String(row.judul).trim();
      const pengarang = String(row.pengarang).trim();
      const penerbit = String(row.penerbit).trim();
      const tahunValid = parseInt(row.tahun_terbit, 10);

      const identityKey = makeBookIdentityKey(judul, pengarang, penerbit, tahunValid);
      let targetKoleksiId = bookIdentityMap.get(identityKey);

      if (!targetKoleksiId) {
        const finalKategoriId = await resolveKategoriId(row.id_kategori, row.kategori);
        const uniqueCode = `KOL-${Date.now().toString().slice(-5)}-${idx + 1}-${Math.random()
          .toString(36)
          .substring(2, 5)
          .toUpperCase()}`;

        const newBook = await prisma.koleksi.create({
          data: {
            kode_koleksi: uniqueCode,
            id_kategori: finalKategoriId,
            judul,
            isbn: String(row.isbn).trim(),
            penerbit,
            tahun_terbit: tahunValid,
            edisi: row.edisi && String(row.edisi).trim() ? String(row.edisi).trim() : null,
            nomor_panggil: String(row.nomor_panggil).trim(),
            bahasa: String(row.bahasa).trim(),
            deskripsi: String(row.deskripsi).trim(),
            sampul: null, // Sampul opsional (diinput manual satu per satu)
            status_aktif: true,
          },
        });

        await syncAuthorsForKoleksi(newBook.id_koleksi, pengarang);
        targetKoleksiId = newBook.id_koleksi;
        bookIdentityMap.set(identityKey, targetKoleksiId);
      }

      affectedKoleksiIds.add(targetKoleksiId);

      // Ekstrak daftar kode_eksemplar (boleh kosong! Lokasi rak juga boleh kosong!)
      const defaultRak =
        row.lokasi_rak && String(row.lokasi_rak).trim()
          ? String(row.lokasi_rak).trim()
          : null;

      let eksEntries = [];
      if (Array.isArray(row.eksemplar) && row.eksemplar.length > 0) {
        eksEntries = row.eksemplar
          .map((e) => ({
            kode_eksemplar: String(e.kode_eksemplar || '').trim(),
            lokasi_rak:
              e.lokasi_rak && String(e.lokasi_rak).trim()
                ? String(e.lokasi_rak).trim()
                : defaultRak,
            status: e.status ? String(e.status).trim().toUpperCase() : 'TERSEDIA',
          }))
          .filter((e) => e.kode_eksemplar !== '');
      } else if (row.kode_eksemplar && String(row.kode_eksemplar).trim()) {
        const codes = String(row.kode_eksemplar)
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        eksEntries = codes.map((c) => ({
          kode_eksemplar: c,
          lokasi_rak: defaultRak,
          status: 'TERSEDIA',
        }));
      }

      for (const eks of eksEntries) {
        const alreadyExists = await prisma.eksemplar.findUnique({
          where: { kode_eksemplar: eks.kode_eksemplar },
        });
        if (!alreadyExists) {
          await prisma.eksemplar.create({
            data: {
              id_koleksi: targetKoleksiId,
              kode_eksemplar: eks.kode_eksemplar,
              lokasi_rak: eks.lokasi_rak,
              status: eks.status,
              dibuat_pada: new Date(),
            },
          });
        }
      }
    }

    const allBooks = await prisma.koleksi.findMany({
      include: {
        kategori: true,
        koleksi_pengarang: {
          include: { pengarang: true },
          orderBy: { urutan: 'asc' },
        },
        eksemplar: {
          orderBy: { id_eksemplar: 'asc' },
        },
      },
      orderBy: { id_koleksi: 'desc' },
    });

    res.status(201).json({
      success: true,
      count: affectedKoleksiIds.size,
      data: allBooks.map(formatKoleksi),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/koleksi/:id
export const updateKoleksi = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      judul,
      pengarang,
      kategori,
      id_kategori,
      isbn,
      penerbit,
      tahun_terbit,
      edisi,
      nomor_panggil,
      bahasa,
      deskripsi,
      sampul,
      eksemplar,
      status_aktif,
    } = req.body;

    const existingBook = await prisma.koleksi.findUnique({
      where: { id_koleksi: id },
      include: { eksemplar: true },
    });

    if (!existingBook) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Koleksi buku tidak ditemukan',
        },
      });
    }

    // Validasi 9 field wajib (edisi, lokasi_rak, kode_eksemplar, dan sampul boleh kosong)
    const missingFields = validateRequiredBookFields(req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Field berikut wajib diisi: ${missingFields.join(', ')}`,
        },
      });
    }

    // Cek apakah ISBN sudah digunakan oleh buku LAIN di database
    const cleanIsbn = String(isbn).trim();
    const conflictingIsbnBook = await prisma.koleksi.findFirst({
      where: {
        isbn: cleanIsbn,
        id_koleksi: { not: id },
      },
      select: { id_koleksi: true, judul: true, kode_koleksi: true },
    });
    if (conflictingIsbnBook) {
      return res.status(400).json({
        success: false,
        error: {
          message: `ISBN "${cleanIsbn}" sudah digunakan oleh buku lain: "${conflictingIsbnBook.judul}" (${conflictingIsbnBook.kode_koleksi}).`,
        },
      });
    }

    // Jika array eksemplar dikirimkan, filter yang kode_eksemplar-nya diisi (boleh kosong 0 baris)
    let cleanEksemplarList = null;
    if (Array.isArray(eksemplar)) {
      cleanEksemplarList = eksemplar
        .map((item) => ({
          id_eksemplar: item.id_eksemplar ? parseInt(item.id_eksemplar, 10) : null,
          kode_eksemplar: String(item.kode_eksemplar || '').trim(),
          lokasi_rak:
            item.lokasi_rak && String(item.lokasi_rak).trim()
              ? String(item.lokasi_rak).trim()
              : null,
          status:
            item.status && String(item.status).trim()
              ? String(item.status).trim().toUpperCase()
              : 'TERSEDIA',
        }))
        .filter((item) => item.kode_eksemplar !== '');

      if (cleanEksemplarList.length > 0) {
        const seenCodes = new Set();
        for (const item of cleanEksemplarList) {
          const lower = item.kode_eksemplar.toLowerCase();
          if (seenCodes.has(lower)) {
            return res.status(400).json({
              success: false,
              error: {
                message: `Terdapat kode eksemplar ganda di dalam daftar: "${item.kode_eksemplar}"`,
              },
            });
          }
          seenCodes.add(lower);
        }

        const conflictingInDb = await prisma.eksemplar.findMany({
          where: {
            kode_eksemplar: {
              in: cleanEksemplarList.map((e) => e.kode_eksemplar),
            },
            id_koleksi: {
              not: id,
            },
          },
          select: { kode_eksemplar: true },
        });

        if (conflictingInDb.length > 0) {
          return res.status(400).json({
            success: false,
            error: {
              message: `Kode eksemplar sudah digunakan oleh koleksi buku lain: ${conflictingInDb
                .map((e) => e.kode_eksemplar)
                .join(', ')}`,
            },
          });
        }
      }
    }

    const dataToUpdate = {
      judul: String(judul).trim(),
      isbn: String(isbn).trim(),
      penerbit: String(penerbit).trim(),
      tahun_terbit: parseInt(tahun_terbit, 10),
      edisi: edisi && String(edisi).trim() ? String(edisi).trim() : null,
      nomor_panggil: String(nomor_panggil).trim(),
      bahasa: String(bahasa).trim(),
      deskripsi: String(deskripsi).trim(),
    };
    if (status_aktif !== undefined) dataToUpdate.status_aktif = Boolean(status_aktif);

    // Penanganan Sampul Buku (opsional):
    if (sampul !== undefined) {
      if (typeof sampul === 'string' && sampul.startsWith('data:image/')) {
        const newCoverPath = await saveCoverToDisk(sampul);
        if (existingBook.sampul) {
          await deleteCoverFromDisk(existingBook.sampul);
        }
        dataToUpdate.sampul = newCoverPath;
      } else if (!sampul || String(sampul).trim() === '') {
        if (existingBook.sampul) {
          await deleteCoverFromDisk(existingBook.sampul);
        }
        dataToUpdate.sampul = null;
      } else if (sampul !== existingBook.sampul) {
        if (existingBook.sampul) {
          await deleteCoverFromDisk(existingBook.sampul);
        }
        dataToUpdate.sampul = String(sampul).trim();
      }
    }

    // Kategori
    dataToUpdate.id_kategori = await resolveKategoriId(id_kategori, kategori);

    await prisma.koleksi.update({
      where: { id_koleksi: id },
      data: dataToUpdate,
    });

    // Update Pengarang
    await syncAuthorsForKoleksi(id, String(pengarang));

    // Sinkronisasi daftar Kode Eksemplar di database (boleh kosong 0 baris)
    if (cleanEksemplarList !== null) {
      const currentEksemplar = existingBook.eksemplar || [];
      const currentById = new Map(currentEksemplar.map((e) => [e.id_eksemplar, e]));
      const currentByCode = new Map(
        currentEksemplar.map((e) => [e.kode_eksemplar.toLowerCase(), e])
      );

      const retainedIds = new Set();
      const itemsToUpdate = [];
      const itemsToCreate = [];

      for (const item of cleanEksemplarList) {
        let matchedExisting = null;
        if (item.id_eksemplar && currentById.has(item.id_eksemplar)) {
          matchedExisting = currentById.get(item.id_eksemplar);
        } else if (currentByCode.has(item.kode_eksemplar.toLowerCase())) {
          matchedExisting = currentByCode.get(item.kode_eksemplar.toLowerCase());
        }

        if (matchedExisting && !retainedIds.has(matchedExisting.id_eksemplar)) {
          retainedIds.add(matchedExisting.id_eksemplar);
          itemsToUpdate.push({
            id_eksemplar: matchedExisting.id_eksemplar,
            kode_eksemplar: item.kode_eksemplar,
            lokasi_rak: item.lokasi_rak,
            status: item.status,
          });
        } else {
          itemsToCreate.push(item);
        }
      }

      const removedIds = currentEksemplar
        .map((e) => e.id_eksemplar)
        .filter((eid) => !retainedIds.has(eid));

      if (removedIds.length > 0) {
        await cleanupLoanDetailsForEksemplars(removedIds);
        await prisma.eksemplar.deleteMany({
          where: { id_eksemplar: { in: removedIds } },
        });
      }

      for (const u of itemsToUpdate) {
        const orig = currentById.get(u.id_eksemplar);
        if (orig && orig.kode_eksemplar !== u.kode_eksemplar) {
          await prisma.eksemplar.update({
            where: { id_eksemplar: u.id_eksemplar },
            data: { kode_eksemplar: `__TMP_${u.id_eksemplar}_${Date.now()}` },
          });
        }
      }

      for (const u of itemsToUpdate) {
        await prisma.eksemplar.update({
          where: { id_eksemplar: u.id_eksemplar },
          data: {
            kode_eksemplar: u.kode_eksemplar,
            lokasi_rak: u.lokasi_rak,
            status: u.status,
          },
        });
      }

      for (const c of itemsToCreate) {
        await prisma.eksemplar.create({
          data: {
            id_koleksi: id,
            kode_eksemplar: c.kode_eksemplar,
            lokasi_rak: c.lokasi_rak,
            status: c.status,
            dibuat_pada: new Date(),
          },
        });
      }
    }

    const updatedBook = await prisma.koleksi.findUnique({
      where: { id_koleksi: id },
      include: {
        kategori: true,
        koleksi_pengarang: {
          include: { pengarang: true },
          orderBy: { urutan: 'asc' },
        },
        eksemplar: {
          orderBy: { id_eksemplar: 'asc' },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: formatKoleksi(updatedBook),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/koleksi/:id
export const deleteKoleksi = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existingBook = await prisma.koleksi.findUnique({
      where: { id_koleksi: id },
      include: { eksemplar: true },
    });

    if (!existingBook) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Koleksi buku tidak ditemukan',
        },
      });
    }

    const eksemplarIds = (existingBook.eksemplar || []).map((e) => e.id_eksemplar);

    if (eksemplarIds.length > 0) {
      await cleanupLoanDetailsForEksemplars(eksemplarIds);
    }

    await prisma.koleksi.delete({
      where: { id_koleksi: id },
    });

    if (existingBook.sampul) {
      await deleteCoverFromDisk(existingBook.sampul);
    }

    res.status(200).json({
      success: true,
      data: {
        id_koleksi: id,
        message: 'Koleksi buku beserta file sampulnya berhasil dihapus',
      },
    });
  } catch (error) {
    next(error);
  }
};
