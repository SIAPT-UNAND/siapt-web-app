import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PASSWORD_DEMO = 'Password123';

const ROLES = ['Anggota', 'Pustakawan', 'Admin', 'Pengelola'];

const AKUN_DEMO = [
  { role: 'Anggota', pengenal: 'anggota01', nama: 'Anggota Demo' },
  { role: 'Pustakawan', pengenal: 'pustakawan01', nama: 'Pustakawan Demo' },
  { role: 'Pengelola', pengenal: 'pengelola01', nama: 'Pengelola Demo' },
  { role: 'Admin', pengenal: 'admin01', nama: 'Admin Demo' },
];

const KONFIGURASI = [
  {
    kunci_parameter: 'chatbot_aktif',
    nilai: 'true',
    tipe_data: 'boolean',
    satuan: null,
    nilai_min: null,
    nilai_maks: null,
    wajib: true,
  },
  {
    kunci_parameter: 'chatbot_panjang_maks',
    nilai: '300',
    tipe_data: 'integer',
    satuan: 'karakter',
    nilai_min: '20',
    nilai_maks: '2000',
    wajib: true,
  },
];

const FAQ_AWAL = [
  {
    pertanyaan: 'Bagaimana cara meminjam koleksi?',
    jawaban:
      'Cari koleksi di halaman Beranda, lalu pilih Pinjam Mandiri. Sistem akan memeriksa status akun, denda yang belum lunas, ketersediaan koleksi, dan batas peminjaman aktif. Jika semua aturan terpenuhi, peminjaman langsung tercatat dengan status Dipinjam.',
    kata_kunci: 'pinjam,meminjam,peminjaman,cara pinjam,mau pinjam,pinjam buku',
  },
  {
    pertanyaan: 'Bagaimana cara mencari koleksi?',
    jawaban:
      'Gunakan kolom pencarian di halaman Beranda, lalu masukkan judul, pengarang, kategori, atau kata kunci. Kamu juga bisa memakai filter kategori.',
    kata_kunci: 'cari,mencari,pencarian,judul,pengarang,kategori',
  },
  {
    pertanyaan: 'Bagaimana cara mengembalikan koleksi?',
    jawaban:
      'Pengembalian diproses oleh Pustakawan. Serahkan koleksi secara fisik kepada Pustakawan, lalu Pustakawan mengonfirmasi pengembalian di sistem.',
    kata_kunci: 'kembali,mengembalikan,dikembalikan,pengembalian,balikin',
  },
  {
    pertanyaan: 'Kapan denda dikenakan?',
    jawaban:
      'Denda terbentuk jika koleksi dikembalikan setelah tanggal jatuh tempo. Nominalnya mengikuti tarif denda per hari pada konfigurasi sistem.',
    kata_kunci: 'denda,terlambat,telat,keterlambatan,jatuh tempo',
  },
  {
    pertanyaan: 'Bagaimana cara membayar denda?',
    jawaban:
      'Pembayaran dilakukan di luar sistem sesuai informasi pembayaran yang ditampilkan, lalu unggah bukti pembayarannya. Status menjadi Menunggu verifikasi dan baru Lunas setelah disetujui Pustakawan.',
    kata_kunci:
      'bayar denda,membayar denda,pembayaran denda,bayar,membayar,bukti pembayaran,unggah bukti',
  },
  {
    pertanyaan: 'Saya lupa kata sandi, bagaimana?',
    jawaban:
      'Pilih Lupa kata sandi di halaman login, lalu hubungi Admin lewat WhatsApp. Admin akan membantu mengatur ulang akunmu.',
    kata_kunci: 'lupa,kata sandi,password,sandi,reset',
  },
];

async function main() {
  // Akun demo memakai kata sandi yang tertulis di kode, jadi ditolak di server produksi
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Seed akun demo dinonaktifkan saat NODE_ENV=production.');
  }

  for (const nama_role of ROLES) {
    await prisma.role.upsert({ where: { nama_role }, update: {}, create: { nama_role } });
  }

  const hash = await bcrypt.hash(PASSWORD_DEMO, 10);
  for (const akun of AKUN_DEMO) {
    const role = await prisma.role.findUnique({ where: { nama_role: akun.role } });
    await prisma.pengguna.upsert({
      where: { pengenal: akun.pengenal },
      update: {}, // akun yang sudah ada tidak diubah atau direset
      create: {
        id_role: role.id_role,
        pengenal: akun.pengenal,
        nama: akun.nama,
        kata_sandi_hash: hash,
        status_aktif: true,
        dibuat_pada: new Date(),
      },
    });
  }

  for (const k of KONFIGURASI) {
    await prisma.konfigurasiSistem.upsert({
      where: { kunci_parameter: k.kunci_parameter },
      update: {},
      create: k,
    });
  }

  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({ data: FAQ_AWAL.map((f) => ({ ...f, status_aktif: true })) });
  }

  console.log('Seed selesai.');
  console.log('Akun demo (kata sandi akun yang baru dibuat: ' + PASSWORD_DEMO + '):');
  for (const a of AKUN_DEMO) console.log(`  ${a.role.padEnd(11)} ${a.pengenal}`);
}

main()
  .catch((err) => {
    console.error('Seed gagal:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());