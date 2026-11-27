/**
 * Logika bisnis UC-13 (Mengelola Akun Pengguna) dan UC-14 (Mengelola Hak Akses).
 * Validasi format input dilakukan di controller; service memeriksa aturan yang butuh database.
 */
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';

// Sama dengan modul login Clara (auth.service.mjs), supaya akun yang dibuat di sini bisa login.
export const BCRYPT_COST = 10;

export const PERAN_ADMIN = 'Admin';

// Urutan tampilan empat peran resmi (A2 §3.1). Peran lain di tabel role ditaruh di akhir.
export const URUTAN_PERAN = ['Anggota', 'Pustakawan', 'Pengelola', PERAN_ADMIN];

const PESAN_AKUN_TIDAK_DITEMUKAN = 'Akun tidak ditemukan.';
const PESAN_PERAN_TIDAK_DIKENAL = 'Peran tidak dikenal.';
const PESAN_PENGENAL_DIPAKAI = 'Pengenal sudah digunakan.';
const PESAN_ADMIN_TERAKHIR = 'Minimal harus ada satu Admin aktif.';

/**
 * Satu-satunya pemeta akun ke bentuk publik. kata_sandi_hash tidak pernah ikut.
 */
export function keAkunPublik(pengguna) {
  return {
    id_pengguna: pengguna.id_pengguna,
    pengenal: pengguna.pengenal,
    nama: pengguna.nama ?? null,
    role: pengguna.role?.nama_role ?? null,
    status_aktif: pengguna.status_aktif === true,
    alasan_nonaktif: pengguna.alasan_nonaktif ?? null,
    dibuat_pada: pengguna.dibuat_pada ?? null,
  };
}

export function urutkanPeran(daftar) {
  const posisi = (nama) => {
    const i = URUTAN_PERAN.indexOf(nama);
    return i === -1 ? URUTAN_PERAN.length : i;
  };
  return [...daftar].sort(
    (a, b) => posisi(a.nama_role) - posisi(b.nama_role) || a.nama_role.localeCompare(b.nama_role),
  );
}

export function bangunFilterAkun({ q, role, status } = {}) {
  const kondisi = [];
  if (q) {
    kondisi.push({ OR: [{ pengenal: { contains: q } }, { nama: { contains: q } }] });
  }
  if (role) {
    kondisi.push({ role: { nama_role: role } });
  }
  if (status === 'aktif') {
    kondisi.push({ status_aktif: true });
  } else if (status === 'nonaktif') {
    // Akun dengan status_aktif null juga tidak bisa login (Clara: status_aktif !== true)
    kondisi.push({ OR: [{ status_aktif: false }, { status_aktif: null }] });
  }
  return kondisi.length > 0 ? { AND: kondisi } : {};
}

function adalahDuplikat(err) {
  return err?.code === 'P2002';
}

async function cariAkun(db, id) {
  const akun = await db.pengguna.findUnique({
    where: { id_pengguna: id },
    include: { role: true },
  });
  if (!akun) {
    throw new AppError(404, PESAN_AKUN_TIDAK_DITEMUKAN);
  }
  return akun;
}

async function cariPeran(db, namaRole) {
  const peran = await db.role.findUnique({ where: { nama_role: namaRole } });
  if (!peran) {
    throw new AppError(400, PESAN_PERAN_TIDAK_DIKENAL);
  }
  return peran;
}

// Tolak perubahan yang membuat tidak ada lagi Admin aktif (selain akun target).
async function pastikanAdaAdminLain(db, idTarget) {
  const jumlah = await db.pengguna.count({
    where: {
      status_aktif: true,
      role: { nama_role: PERAN_ADMIN },
      NOT: { id_pengguna: idTarget },
    },
  });
  if (jumlah === 0) {
    throw new AppError(409, PESAN_ADMIN_TERAKHIR);
  }
}

// Percobaan maksimal untuk transaksi Serializable yang bentrok (Prisma P2034).
export const BATAS_PERCOBAAN_TRANSAKSI = 3;
const PESAN_BENTROK = 'Data akun sedang diubah oleh Admin lain. Silakan coba lagi.';

/**
 * Menjalankan `fungsi(tx)` dalam transaksi Serializable agar dua perubahan bersamaan
 * (mis. dua Admin saling menonaktifkan) tidak bisa sama-sama lolos cek "Admin terakhir".
 * Bentrok (P2034) diulang dengan membaca ulang data; jika tetap bentrok -> 409 dengan `pesanBentrok`.
 * Dipakai juga oleh modul Konfigurasi Sistem.
 */
export async function transaksiSerializable(fungsi, pesanBentrok = PESAN_BENTROK) {
  for (let percobaan = 1; ; percobaan += 1) {
    try {
      return await prisma.$transaction(fungsi, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (err?.code !== 'P2034') throw err;
      if (percobaan >= BATAS_PERCOBAAN_TRANSAKSI) throw new AppError(409, pesanBentrok);
    }
  }
}

function adalahAdminAktif(akun) {
  return akun.role?.nama_role === PERAN_ADMIN && akun.status_aktif === true;
}

export async function daftarAkun({ q, role, status, halaman = 1, perHalaman = 20 } = {}) {
  if (role) {
    await cariPeran(prisma, role);
  }

  const where = bangunFilterAkun({ q, role, status });
  const [items, total] = await prisma.$transaction([
    prisma.pengguna.findMany({
      where,
      include: { role: true },
      orderBy: [{ dibuat_pada: 'desc' }, { id_pengguna: 'desc' }],
      skip: (halaman - 1) * perHalaman,
      take: perHalaman,
    }),
    prisma.pengguna.count({ where }),
  ]);

  return {
    items: items.map(keAkunPublik),
    total,
    halaman,
    per_halaman: perHalaman,
  };
}

export async function ambilAkun(id) {
  return keAkunPublik(await cariAkun(prisma, id));
}

export async function tambahAkun({ pengenal, nama, role, kataSandi }) {
  const peran = await cariPeran(prisma, role);

  const sudahAda = await prisma.pengguna.findUnique({ where: { pengenal } });
  if (sudahAda) {
    throw new AppError(409, PESAN_PENGENAL_DIPAKAI);
  }

  const kataSandiHash = await bcrypt.hash(kataSandi, BCRYPT_COST);

  try {
    const akun = await prisma.pengguna.create({
      data: {
        id_role: peran.id_role,
        pengenal,
        nama,
        kata_sandi_hash: kataSandiHash,
        status_aktif: true,
        alasan_nonaktif: null,
        dibuat_pada: new Date(),
      },
      include: { role: true },
    });
    return keAkunPublik(akun);
  } catch (err) {
    if (adalahDuplikat(err)) {
      throw new AppError(409, PESAN_PENGENAL_DIPAKAI);
    }
    throw err;
  }
}

export async function ubahAkun(id, { nama, pengenal }) {
  const akun = await cariAkun(prisma, id);

  if (pengenal !== undefined && pengenal !== akun.pengenal) {
    const pemilik = await prisma.pengguna.findUnique({ where: { pengenal } });
    if (pemilik && pemilik.id_pengguna !== id) {
      throw new AppError(409, PESAN_PENGENAL_DIPAKAI);
    }
  }

  const data = {};
  if (nama !== undefined) data.nama = nama;
  if (pengenal !== undefined) data.pengenal = pengenal;

  try {
    const baru = await prisma.pengguna.update({
      where: { id_pengguna: id },
      data,
      include: { role: true },
    });
    return keAkunPublik(baru);
  } catch (err) {
    if (adalahDuplikat(err)) {
      throw new AppError(409, PESAN_PENGENAL_DIPAKAI);
    }
    throw err;
  }
}

export async function ubahStatusAkun(id, { statusAktif, alasan }, idPengubah) {
  return transaksiSerializable(async (tx) => {
    const akun = await cariAkun(tx, id);

    if (!statusAktif && id === idPengubah) {
      throw new AppError(409, 'Kamu tidak dapat menonaktifkan akunmu sendiri.');
    }

    // Idempoten: status sudah sama, tidak ada yang ditulis (aman dari klik ganda)
    if ((akun.status_aktif === true) === statusAktif) {
      return keAkunPublik(akun);
    }

    if (!statusAktif && adalahAdminAktif(akun)) {
      await pastikanAdaAdminLain(tx, id);
    }

    const baru = await tx.pengguna.update({
      where: { id_pengguna: id },
      data: {
        status_aktif: statusAktif,
        alasan_nonaktif: statusAktif ? null : alasan,
      },
      include: { role: true },
    });
    return keAkunPublik(baru);
  });
}

export async function resetKataSandi(id, kataSandiBaru) {
  await cariAkun(prisma, id);
  const kataSandiHash = await bcrypt.hash(kataSandiBaru, BCRYPT_COST);
  await prisma.pengguna.update({
    where: { id_pengguna: id },
    data: { kata_sandi_hash: kataSandiHash },
    select: { id_pengguna: true },
  });
  return null;
}

export async function daftarPeran() {
  const daftar = await prisma.role.findMany();
  return urutkanPeran(daftar).map(({ id_role, nama_role }) => ({ id_role, nama_role }));
}

// Alur mengikuti sequence diagram UC-14 (A3).
export async function ubahPeran(id, namaRole, idPengubah) {
  return transaksiSerializable(async (tx) => {
    const akun = await cariAkun(tx, id);
    const peran = await cariPeran(tx, namaRole);

    if (id === idPengubah) {
      throw new AppError(409, 'Kamu tidak dapat mengubah peranmu sendiri.');
    }

    if (akun.id_role === peran.id_role) {
      return keAkunPublik(akun);
    }

    if (adalahAdminAktif(akun) && peran.nama_role !== PERAN_ADMIN) {
      await pastikanAdaAdminLain(tx, id);
    }

    const baru = await tx.pengguna.update({
      where: { id_pengguna: id },
      data: { id_role: peran.id_role },
      include: { role: true },
    });
    return keAkunPublik(baru);
  });
}
