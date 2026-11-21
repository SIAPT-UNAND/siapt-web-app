// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//   console.log('🌱 Memulai proses seeding database SIAPT...');

//   // 1. Bersihkan data lama dengan urutan aman (menghindari pelanggaran foreign key)
//   console.log('🧹 Membersihkan data sebelumnya...');
//   await prisma.rincianPembayaran.deleteMany();
//   await prisma.pembayaranDenda.deleteMany();
//   await prisma.koreksiDenda.deleteMany();
//   await prisma.denda.deleteMany();
//   await prisma.detailPeminjaman.deleteMany();
//   await prisma.peminjaman.deleteMany();
//   await prisma.usulanKoleksi.deleteMany();
//   await prisma.tanggapanPermintaan.deleteMany();
//   await prisma.permintaanLayanan.deleteMany();
//   await prisma.pesanChatbot.deleteMany();
//   await prisma.logKonfigurasi.deleteMany();
//   await prisma.eksemplar.deleteMany();
//   await prisma.koleksiPengarang.deleteMany();
//   await prisma.koleksi.deleteMany();
//   await prisma.pengguna.deleteMany();
//   await prisma.konfigurasiSistem.deleteMany();
//   await prisma.faq.deleteMany();
//   await prisma.pengarang.deleteMany();
//   await prisma.kategori.deleteMany();
//   await prisma.role.deleteMany();

//   // ==========================================
//   // 1. SEED TABEL MASTER
//   // ==========================================
//   console.log('📌 Seeding Master Data...');

//   // Role
//   const roleAdmin = await prisma.role.create({
//     data: { nama_role: 'Admin' },
//   });
//   const rolePustakawan = await prisma.role.create({
//     data: { nama_role: 'Pustakawan' },
//   });
//   const roleAnggota = await prisma.role.create({
//     data: { nama_role: 'Anggota' },
//   });

//   // Kategori
//   const katKomputer = await prisma.kategori.create({
//     data: {
//       nama_kategori: 'Ilmu Komputer & Sistem Informasi',
//       status_aktif: true,
//     },
//   });
//   const katSains = await prisma.kategori.create({
//     data: {
//       nama_kategori: 'Sains & Teknologi Terapan',
//       status_aktif: true,
//     },
//   });
//   const katSastra = await prisma.kategori.create({
//     data: {
//       nama_kategori: 'Sastra & Humaniora',
//       status_aktif: true,
//     },
//   });

//   // Pengarang
//   const pengarangMartin = await prisma.pengarang.create({
//     data: { nama_pengarang: 'Robert C. Martin' },
//   });
//   const pengarangFowler = await prisma.pengarang.create({
//     data: { nama_pengarang: 'Martin Fowler' },
//   });
//   const pengarangPramoedya = await prisma.pengarang.create({
//     data: { nama_pengarang: 'Pramoedya Ananta Toer' },
//   });

//   // FAQ
//   const faqPinjam = await prisma.faq.create({
//     data: {
//       pertanyaan: 'Berapa batas waktu peminjaman buku untuk mahasiswa?',
//       jawaban:
//         'Batas waktu peminjaman buku adalah 7 hari kalender dan dapat diperpanjang maksimal 2 kali bila tidak sedang dipesan oleh pengguna lain.',
//       kata_kunci: 'pinjam, durasi, perpanjangan, batas waktu',
//       status_aktif: true,
//     },
//   });
//   await prisma.faq.create({
//     data: {
//       pertanyaan: 'Bagaimana prosedur penyelesaian denda keterlambatan?',
//       jawaban:
//         'Penyelesaian denda dapat dilakukan dengan transfer ke rekening resmi perpustakaan dan mengunggah bukti bayar di aplikasi, atau langsung di loket sirkulasi.',
//       kata_kunci: 'denda, bayar, transfer, loket',
//       status_aktif: true,
//     },
//   });

//   // Konfigurasi Sistem
//   const konfigBatasPinjam = await prisma.konfigurasiSistem.create({
//     data: {
//       kunci_parameter: 'maks_pinjam_eksemplar',
//       nilai: '3',
//       tipe_data: 'number',
//       satuan: 'eksemplar',
//       nilai_min: '1',
//       nilai_maks: '10',
//       wajib: true,
//     },
//   });
//   const konfigTarifDenda = await prisma.konfigurasiSistem.create({
//     data: {
//       kunci_parameter: 'tarif_denda_per_hari',
//       nilai: '1000',
//       tipe_data: 'decimal',
//       satuan: 'rupiah',
//       nilai_min: '500',
//       nilai_maks: '10000',
//       wajib: true,
//     },
//   });
//   await prisma.konfigurasiSistem.create({
//     data: {
//       kunci_parameter: 'durasi_pinjam_hari',
//       nilai: '7',
//       tipe_data: 'number',
//       satuan: 'hari',
//       nilai_min: '1',
//       nilai_maks: '30',
//       wajib: true,
//     },
//   });

//   // ==========================================
//   // 2. SEED PENGGUNA
//   // ==========================================
//   console.log('📌 Seeding Pengguna...');

//   const userAdmin = await prisma.pengguna.create({
//     data: {
//       id_role: roleAdmin.id_role,
//       pengenal: 'ADM-001',
//       nama: 'Administrator Sistem SIAPT',
//       kata_sandi_hash: '$2b$10$eO1v0T31RjRz2gqV.exampleHashedPasswordAdmin',
//       status_aktif: true,
//       dibuat_pada: new Date(),
//     },
//   });

//   const userPustakawan = await prisma.pengguna.create({
//     data: {
//       id_role: rolePustakawan.id_role,
//       pengenal: '198805122014042001',
//       nama: 'Siti Rahmawati, S.I.Pust.',
//       kata_sandi_hash: '$2b$10$eO1v0T31RjRz2gqV.exampleHashedPasswordPustakawan',
//       status_aktif: true,
//       dibuat_pada: new Date(),
//     },
//   });

//   const userAnggota = await prisma.pengguna.create({
//     data: {
//       id_role: roleAnggota.id_role,
//       pengenal: '2211521001',
//       nama: 'Ahmad Fauzan',
//       kata_sandi_hash: '$2b$10$eO1v0T31RjRz2gqV.exampleHashedPasswordAnggota',
//       status_aktif: true,
//       dibuat_pada: new Date(),
//     },
//   });

//   // ==========================================
//   // 3. SEED KOLEKSI, PENGARANG & EKSEMPLAR
//   // ==========================================
//   console.log('📌 Seeding Koleksi & Inventaris...');

//   const kolCleanCode = await prisma.koleksi.create({
//     data: {
//       kode_koleksi: 'KOL-CS-001',
//       id_kategori: katKomputer.id_kategori,
//       judul: 'Clean Code: A Handbook of Agile Software Craftsmanship',
//       isbn: '9780132350884',
//       penerbit: 'Prentice Hall',
//       tahun_terbit: 2008,
//       edisi: '1st Edition',
//       nomor_panggil: '005.1 MAR c',
//       bahasa: 'Inggris',
//       deskripsi: 'Panduan fundamental mengenai rekayasa perangkat lunak dan arsitektur kode bersih.',
//       sampul: '/covers/clean-code.jpg',
//       status_aktif: true,
//     },
//   });

//   const kolRefactoring = await prisma.koleksi.create({
//     data: {
//       kode_koleksi: 'KOL-CS-002',
//       id_kategori: katKomputer.id_kategori,
//       judul: 'Refactoring: Improving the Design of Existing Code',
//       isbn: '9780201485677',
//       penerbit: 'Addison-Wesley Professional',
//       tahun_terbit: 2018,
//       edisi: '2nd Edition',
//       nomor_panggil: '005.1 FOW r',
//       bahasa: 'Inggris',
//       deskripsi: 'Katalog teknik refaktorisasi kode program.',
//       sampul: '/covers/refactoring.jpg',
//       status_aktif: true,
//     },
//   });

//   const kolBumiManusia = await prisma.koleksi.create({
//     data: {
//       kode_koleksi: 'KOL-LIT-001',
//       id_kategori: katSastra.id_kategori,
//       judul: 'Bumi Manusia',
//       isbn: '9789799731234',
//       penerbit: 'Lentera Dipantara',
//       tahun_terbit: 2005,
//       edisi: 'Cetakan 17',
//       nomor_panggil: '899.221 TOE b',
//       bahasa: 'Indonesia',
//       deskripsi: 'Roman sejarah bagian pertama dari Tetralogi Buru.',
//       sampul: '/covers/bumi-manusia.jpg',
//       status_aktif: true,
//     },
//   });

//   // Hubungkan Koleksi dengan Pengarang
//   await prisma.koleksiPengarang.createMany({
//     data: [
//       { id_koleksi: kolCleanCode.id_koleksi, id_pengarang: pengarangMartin.id_pengarang, urutan: 1 },
//       { id_koleksi: kolRefactoring.id_koleksi, id_pengarang: pengarangFowler.id_pengarang, urutan: 1 },
//       { id_koleksi: kolBumiManusia.id_koleksi, id_pengarang: pengarangPramoedya.id_pengarang, urutan: 1 },
//     ],
//   });

//   // Eksemplar
//   const eksCleanCodeA = await prisma.eksemplar.create({
//     data: {
//       id_koleksi: kolCleanCode.id_koleksi,
//       kode_eksemplar: 'EKS-001-A',
//       lokasi_rak: 'RAK-CS-01',
//       status: 'TERSEDIA',
//       dibuat_pada: new Date(),
//     },
//   });

//   const eksCleanCodeB = await prisma.eksemplar.create({
//     data: {
//       id_koleksi: kolCleanCode.id_koleksi,
//       kode_eksemplar: 'EKS-001-B',
//       lokasi_rak: 'RAK-CS-01',
//       status: 'TERSEDIA',
//       dibuat_pada: new Date(),
//     },
//   });

//   await prisma.eksemplar.create({
//     data: {
//       id_koleksi: kolRefactoring.id_koleksi,
//       kode_eksemplar: 'EKS-002-A',
//       lokasi_rak: 'RAK-CS-02',
//       status: 'TERSEDIA',
//       dibuat_pada: new Date(),
//     },
//   });

//   await prisma.eksemplar.create({
//     data: {
//       id_koleksi: kolBumiManusia.id_koleksi,
//       kode_eksemplar: 'EKS-003-A',
//       lokasi_rak: 'RAK-LIT-01',
//       status: 'TERSEDIA',
//       dibuat_pada: new Date(),
//     },
//   });

//   // ==========================================
//   // 4. SEED FITUR LAYANAN & CHATBOT
//   // ==========================================
//   console.log('📌 Seeding Log & Fitur Chatbot/Layanan...');

//   // Log Konfigurasi
//   await prisma.logKonfigurasi.create({
//     data: {
//       id_konfigurasi: konfigTarifDenda.id_konfigurasi,
//       id_pengubah: userAdmin.id_pengguna,
//       nilai_lama: '500',
//       nilai_baru: '1000',
//       waktu: new Date(),
//     },
//   });

//   // Pesan Chatbot Umum
//   await prisma.pesanChatbot.create({
//     data: {
//       id_anggota: userAnggota.id_pengguna,
//       id_faq: faqPinjam.id_faq,
//       pertanyaan: 'Berapa hari saya bisa meminjam buku?',
//       jawaban: faqPinjam.jawaban,
//       is_fallback: false,
//       waktu: new Date(),
//     },
//   });

//   // Pesan Chatbot yang memicu Permintaan Layanan (Usulan Koleksi)
//   const pesanUsulan = await prisma.pesanChatbot.create({
//     data: {
//       id_anggota: userAnggota.id_pengguna,
//       pertanyaan: 'Saya ingin mengusulkan pengadaan buku Designing Data-Intensive Applications',
//       jawaban: 'Permintaan usulan buku Anda telah kami daftarkan ke sistem dan akan ditinjau pustakawan.',
//       is_fallback: true,
//       waktu: new Date(),
//     },
//   });

//   const permintaanUsulan = await prisma.permintaanLayanan.create({
//     data: {
//       id_pesan: pesanUsulan.id_pesan,
//       jenis_permintaan: 'USULAN_KOLEKSI',
//       isi_permintaan: 'Pengusulan buku referensi Designing Data-Intensive Applications karya Martin Kleppmann',
//       status: 'DISETUJUI',
//       dibuat_pada: new Date(),
//       diperbarui_pada: new Date(),
//     },
//   });

//   await prisma.tanggapanPermintaan.create({
//     data: {
//       id_permintaan: permintaanUsulan.id_permintaan,
//       id_pustakawan: userPustakawan.id_pengguna,
//       catatan: 'Buku sangat relevan untuk kebutuhan kurikulum rekayasa data. Disetujui untuk pengadaan.',
//       status_hasil: 'DISETUJUI',
//       waktu: new Date(),
//     },
//   });

//   await prisma.usulanKoleksi.create({
//     data: {
//       id_permintaan: permintaanUsulan.id_permintaan,
//       judul_usulan: 'Designing Data-Intensive Applications',
//       pengarang_usulan: 'Martin Kleppmann',
//       status_pengadaan: 'RENCANA_PENGADAAN',
//       tahun_rencana: 2027,
//       diperbarui_pada: new Date(),
//     },
//   });

//   // ==========================================
//   // 5. SEED TRANSAKSI (PEMINJAMAN & DENDA)
//   // ==========================================
//   console.log('📌 Seeding Transaksi Peminjaman, Denda & Pembayaran...');

//   // Transaksi Peminjaman Selesai (dengan Keterlambatan)
//   const peminjamanSelesai = await prisma.peminjaman.create({
//     data: {
//       nomor_transaksi: 'TRX-202611-001',
//       id_anggota: userAnggota.id_pengguna,
//       id_pustakawan_peminjaman: userPustakawan.id_pengguna,
//       jalur: 'MANDIRI',
//       tanggal_pinjam: new Date('2026-11-01'),
//       tanggal_jatuh_tempo: new Date('2026-11-08'),
//       status: 'SELESAI',
//       kunci_idempotensi: 'IDEMP-TRX-202611-001',
//     },
//   });

//   const detailPinjam = await prisma.detailPeminjaman.create({
//     data: {
//       id_peminjaman: peminjamanSelesai.id_peminjaman,
//       id_eksemplar: eksCleanCodeA.id_eksemplar,
//       id_pustakawan_pengembalian: userPustakawan.id_pengguna,
//       tanggal_kembali: new Date('2026-11-10'), // Terlambat 2 hari
//       status: 'KEMBALI',
//     },
//   });

//   const dendaTerlambat = await prisma.denda.create({
//     data: {
//       id_detail: detailPinjam.id_detail,
//       hari_terlambat: 2,
//       tarif_per_hari: 1000.0,
//       nominal: 2000.0,
//       total_terbayar: 2000.0,
//       status: 'LUNAS',
//       dibuat_pada: new Date('2026-11-10T09:00:00Z'),
//     },
//   });

//   // Koreksi Denda (contoh dispensasi/koreksi catatan)
//   await prisma.koreksiDenda.create({
//     data: {
//       id_denda: dendaTerlambat.id_denda,
//       id_pustakawan: userPustakawan.id_pengguna,
//       nominal_lama: 3000.0,
//       nominal_baru: 2000.0,
//       alasan: 'Penyesuaian hari libur fakultas pada hari minggu.',
//       waktu: new Date('2026-11-10T10:00:00Z'),
//     },
//   });

//   // Pembayaran Denda
//   const bayarDenda = await prisma.pembayaranDenda.create({
//     data: {
//       id_anggota: userAnggota.id_pengguna,
//       id_pemverifikasi: userPustakawan.id_pengguna,
//       nominal_bayar: 2000.0,
//       path_bukti: '/uploads/bukti/bukti-denda-001.jpg',
//       tipe_berkas: 'image/jpeg',
//       status: 'TERVERIFIKASI',
//       waktu_unggah: new Date('2026-11-10T11:00:00Z'),
//       waktu_verifikasi: new Date('2026-11-10T11:30:00Z'),
//     },
//   });

//   // Rincian Alokasi Pembayaran
//   await prisma.rincianPembayaran.create({
//     data: {
//       id_pembayaran: bayarDenda.id_pembayaran,
//       id_denda: dendaTerlambat.id_denda,
//       nominal_dialokasikan: 2000.0,
//     },
//   });

//   console.log('✅ Seeding database SIAPT berhasil diselesaikan!');
// }

// main()
//   .catch((e) => {
//     console.error('❌ Terjadi kesalahan saat seeding:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Helper untuk membuat objek Date (UTC midnight) mundur sebanyak `days` hari dari hari ini.
 * Nilai negatif berarti hari di masa depan (misal -3 = 3 hari dari sekarang).
 */
function dateDaysAgo(baseDate, days) {
  return new Date(
    Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - days)
  );
}

function countOverdueDaysDifference(dueDate, referenceDate) {
  const dueUtcMs = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate()
  );
  const refUtcMs = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  if (refUtcMs <= dueUtcMs) return 0;
  return Math.max(0, Math.round((refUtcMs - dueUtcMs) / (24 * 60 * 60 * 1000)));
}

async function main() {
  console.log('🌱 Memulai proses seeding database SIAPT...');

  // 1. Bersihkan data lama dengan urutan aman (menghindari pelanggaran foreign key)
  console.log('🧹 Membersihkan data sebelumnya...');
  await prisma.rincianPembayaran.deleteMany();
  await prisma.pembayaranDenda.deleteMany();
  await prisma.koreksiDenda.deleteMany();
  await prisma.denda.deleteMany();
  await prisma.detailPeminjaman.deleteMany();
  await prisma.peminjaman.deleteMany();
  await prisma.usulanKoleksi.deleteMany();
  await prisma.tanggapanPermintaan.deleteMany();
  await prisma.permintaanLayanan.deleteMany();
  await prisma.pesanChatbot.deleteMany();
  await prisma.logKonfigurasi.deleteMany();
  await prisma.eksemplar.deleteMany();
  await prisma.koleksiPengarang.deleteMany();
  await prisma.koleksi.deleteMany();
  await prisma.pengguna.deleteMany();
  await prisma.konfigurasiSistem.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.pengarang.deleteMany();
  await prisma.kategori.deleteMany();
  await prisma.role.deleteMany();

  // ==========================================
  // 1. SEED TABEL MASTER
  // ==========================================
  console.log('📌 Seeding Master Data...');

  // Role
  const roleAdmin = await prisma.role.create({
    data: { nama_role: 'Admin' },
  });
  const rolePustakawan = await prisma.role.create({
    data: { nama_role: 'Pustakawan' },
  });
  const roleAnggota = await prisma.role.create({
    data: { nama_role: 'Anggota' },
  });

  // Kategori (10 Kategori Utama Perpustakaan)
  const categoryNames = [
    'Ilmu Komputer, Informasi & Karya Umum',
    'Filsafat & Psikologi',
    'Agama',
    'Ilmu Sosial',
    'Bahasa',
    'Sains & Matematika',
    'Teknologi',
    'Seni & Rekreasi',
    'Sastra',
    'Sejarah & Geografi',
  ];

  const kategoriMap = {};
  for (const nama_kategori of categoryNames) {
    const createdKat = await prisma.kategori.create({
      data: {
        nama_kategori,
        status_aktif: true,
      },
    });
    kategoriMap[nama_kategori] = createdKat;
  }

  // Pengarang
  const authorNames = [
    'Robert C. Martin',
    'Henry Manampiring',
    'Prof. Dr. Quraish Shihab',
    'Prof. Dr. Koentjaraningrat',
    'Prof. Dr. Abdul Chaer',
    'Yuval Noah Harari',
    'Ir. Onno W. Purbo',
    'Mikke Susanto',
    'Pramoedya Ananta Toer',
    'Prof. Dr. Sartono Kartodirdjo',
  ];

  const pengarangMap = {};
  for (const nama_pengarang of authorNames) {
    const createdAuthor = await prisma.pengarang.create({
      data: { nama_pengarang },
    });
    pengarangMap[nama_pengarang] = createdAuthor;
  }

  // FAQ
  const faqPinjam = await prisma.faq.create({
    data: {
      pertanyaan: 'Berapa batas waktu peminjaman buku untuk mahasiswa?',
      jawaban:
        'Batas waktu peminjaman buku adalah 7 hari kalender dan dapat diperpanjang maksimal 2 kali bila tidak sedang dipesan oleh pengguna lain.',
      kata_kunci: 'pinjam, durasi, perpanjangan, batas waktu',
      status_aktif: true,
    },
  });
  await prisma.faq.create({
    data: {
      pertanyaan: 'Bagaimana prosedur penyelesaian denda keterlambatan?',
      jawaban:
        'Penyelesaian denda dapat dilakukan dengan transfer ke rekening resmi perpustakaan dan mengunggah bukti bayar di aplikasi, atau langsung di loket sirkulasi.',
      kata_kunci: 'denda, bayar, transfer, loket',
      status_aktif: true,
    },
  });

  // Konfigurasi Sistem
  await prisma.konfigurasiSistem.create({
    data: {
      kunci_parameter: 'maks_pinjam_eksemplar',
      nilai: '3',
      tipe_data: 'number',
      satuan: 'eksemplar',
      nilai_min: '1',
      nilai_maks: '10',
      wajib: true,
    },
  });
  const konfigTarifDenda = await prisma.konfigurasiSistem.create({
    data: {
      kunci_parameter: 'tarif_denda_per_hari',
      nilai: '1000',
      tipe_data: 'decimal',
      satuan: 'rupiah',
      nilai_min: '500',
      nilai_maks: '10000',
      wajib: true,
    },
  });
  await prisma.konfigurasiSistem.create({
    data: {
      kunci_parameter: 'durasi_pinjam_hari',
      nilai: '7',
      tipe_data: 'number',
      satuan: 'hari',
      nilai_min: '1',
      nilai_maks: '30',
      wajib: true,
    },
  });

  // ==========================================
  // 2. SEED PENGGUNA (1 ADMIN, 1 PUSTAKAWAN, 10 ANGGOTA)
  // ==========================================
  console.log('📌 Seeding Pengguna (Admin, Pustakawan & 10 Anggota)...');

  const userAdmin = await prisma.pengguna.create({
    data: {
      id_role: roleAdmin.id_role,
      pengenal: 'ADM-001',
      nama: 'Administrator Sistem SIAPT',
      kata_sandi_hash: '$2b$10$eO1v0T31RjRz2gqV.exampleHashedPasswordAdmin',
      status_aktif: true,
      dibuat_pada: new Date(),
    },
  });

  const userPustakawan = await prisma.pengguna.create({
    data: {
      id_role: rolePustakawan.id_role,
      pengenal: '198805122014042001',
      nama: 'Siti Rahmawati, S.I.Pust.',
      kata_sandi_hash: '$2b$10$eO1v0T31RjRz2gqV.exampleHashedPasswordPustakawan',
      status_aktif: true,
      dibuat_pada: new Date(),
    },
  });

  const anggotaSeedList = [
    { pengenal: '2211521001', nama: 'Ahmad Fauzan' },
    { pengenal: '2211521002', nama: 'Siti Nurhaliza' },
    { pengenal: '2211521003', nama: 'Budi Santoso' },
    { pengenal: '2211521004', nama: 'Aulia Putri Maharani' },
    { pengenal: '2211521005', nama: 'Muhammad Rizki Pratama' },
    { pengenal: '2211521006', nama: 'Nadia Rahmadani' },
    { pengenal: '2211521007', nama: 'Farhan Hidayat' },
    { pengenal: '2211521008', nama: 'Dewi Lestari' },
    { pengenal: '2211521009', nama: 'Kevin Mahendra' },
    { pengenal: '2211521010', nama: 'Zahra Khairunnisa' },
  ];

  const anggotaUsers = [];
  for (const m of anggotaSeedList) {
    const createdUser = await prisma.pengguna.create({
      data: {
        id_role: roleAnggota.id_role,
        pengenal: m.pengenal,
        nama: m.nama,
        kata_sandi_hash: '$2b$10$eO1v0T31RjRz2gqV.exampleHashedPasswordAnggota',
        status_aktif: true,
        dibuat_pada: new Date(),
      },
    });
    anggotaUsers.push(createdUser);
  }

  // ==========================================
  // 3. SEED 10 KOLEKSI BUKU (MASING-MASING 2-3 EKSEMPLAR = TOTAL 28 EKSEMPLAR)
  // ==========================================
  console.log('📌 Seeding 10 Koleksi Buku & 28 Eksemplar...');

  const booksSeedData = [
    {
      kode_koleksi: 'KOL-001',
      kategori: 'Ilmu Komputer, Informasi & Karya Umum',
      judul: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      pengarang: 'Robert C. Martin',
      isbn: '9780132350884',
      penerbit: 'Prentice Hall',
      tahun_terbit: 2008,
      edisi: '1st Edition',
      nomor_panggil: '005.1 MAR c',
      bahasa: 'Inggris',
      deskripsi:
        'Panduan fundamental mengenai rekayasa perangkat lunak, prinsip penulisan kode bersih, serta praktik refactoring modern.',
      eksemplarCodes: [
        { kode: 'EKS-001-A', rak: 'RAK-KOM-01' },
        { kode: 'EKS-001-B', rak: 'RAK-KOM-01' },
        { kode: 'EKS-001-C', rak: 'RAK-KOM-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-002',
      kategori: 'Filsafat & Psikologi',
      judul: 'Filosofi Teras: Filsafat Yunani-Romawi Kuno untuk Mental Tangguh Masa Kini',
      pengarang: 'Henry Manampiring',
      isbn: '9786024125189',
      penerbit: 'Kompas Media Nusantara',
      tahun_terbit: 2019,
      edisi: 'Cetakan ke-12',
      nomor_panggil: '188 MAN f',
      bahasa: 'Indonesia',
      deskripsi:
        'Pengantar populer filsafat Stoikisme untuk mengelola emosi negatif dan membangun ketangguhan mental di era modern.',
      eksemplarCodes: [
        { kode: 'EKS-002-A', rak: 'RAK-FIL-01' },
        { kode: 'EKS-002-B', rak: 'RAK-FIL-01' },
        { kode: 'EKS-002-C', rak: 'RAK-FIL-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-003',
      kategori: 'Agama',
      judul: 'Membumikan Al-Quran: Fungsi dan Peran Wahyu dalam Kehidupan Masyarakat',
      pengarang: 'Prof. Dr. Quraish Shihab',
      isbn: '9789794330159',
      penerbit: 'Mizan Pustaka',
      tahun_terbit: 2013,
      edisi: 'Edisi Revisi',
      nomor_panggil: '297.122 SHI m',
      bahasa: 'Indonesia',
      deskripsi:
        'Kumpulan kajian tematik mengenai tafsir kontekstual Al-Quran dalam menjawab persoalan sosial, sains, dan kemasyarakatan.',
      eksemplarCodes: [
        { kode: 'EKS-003-A', rak: 'RAK-AGM-01' },
        { kode: 'EKS-003-B', rak: 'RAK-AGM-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-004',
      kategori: 'Ilmu Sosial',
      judul: 'Pengantar Ilmu Antropologi',
      pengarang: 'Prof. Dr. Koentjaraningrat',
      isbn: '9789795186557',
      penerbit: 'Rineka Cipta',
      tahun_terbit: 2015,
      edisi: 'Edisi Baru',
      nomor_panggil: '301 KOE p',
      bahasa: 'Indonesia',
      deskripsi:
        'Buku teks standar mengenai konsep dasar antropologi budaya, dinamika masyarakat, dan sistem kekerabatan Nusantara.',
      eksemplarCodes: [
        { kode: 'EKS-004-A', rak: 'RAK-SOS-01' },
        { kode: 'EKS-004-B', rak: 'RAK-SOS-01' },
        { kode: 'EKS-004-C', rak: 'RAK-SOS-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-005',
      kategori: 'Bahasa',
      judul: 'Linguistik Umum',
      pengarang: 'Prof. Dr. Abdul Chaer',
      isbn: '9789795185871',
      penerbit: 'Rineka Cipta',
      tahun_terbit: 2014,
      edisi: 'Edisi Revisi',
      nomor_panggil: '410 CHA l',
      bahasa: 'Indonesia',
      deskripsi:
        'Pembahasan lengkap cabang-cabang ilmu linguistik meliputi fonologi, morfologi, sintaksis, semantik, dan sosiolinguistik.',
      eksemplarCodes: [
        { kode: 'EKS-005-A', rak: 'RAK-BHS-01' },
        { kode: 'EKS-005-B', rak: 'RAK-BHS-01' },
        { kode: 'EKS-005-C', rak: 'RAK-BHS-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-006',
      kategori: 'Sains & Matematika',
      judul: 'Calculus: Early Transcendentals & Applied Science',
      pengarang: 'Yuval Noah Harari',
      isbn: '9781285741550',
      penerbit: 'Cengage Learning',
      tahun_terbit: 2016,
      edisi: '8th Edition',
      nomor_panggil: '515 HAR c',
      bahasa: 'Inggris',
      deskripsi:
        'Referensi kalkulus diferensial, integral, deret tak hingga, serta penerapannya pada pemodelan sains dan matematika.',
      eksemplarCodes: [
        { kode: 'EKS-006-A', rak: 'RAK-SAI-01' },
        { kode: 'EKS-006-B', rak: 'RAK-SAI-01' },
        { kode: 'EKS-006-C', rak: 'RAK-SAI-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-007',
      kategori: 'Teknologi',
      judul: 'Internet of Things dan Jaringan Komputer Terapan',
      pengarang: 'Ir. Onno W. Purbo',
      isbn: '9786230104512',
      penerbit: 'Andi Publisher',
      tahun_terbit: 2021,
      edisi: 'Edisi 1',
      nomor_panggil: '621.38 PUR i',
      bahasa: 'Indonesia',
      deskripsi:
        'Panduan praktis perancangan infrastruktur jaringan, sensor mikrokontroler, serta implementasi teknologi Internet of Things.',
      eksemplarCodes: [
        { kode: 'EKS-007-A', rak: 'RAK-TEK-01' },
        { kode: 'EKS-007-B', rak: 'RAK-TEK-01' },
        { kode: 'EKS-007-C', rak: 'RAK-TEK-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-008',
      kategori: 'Seni & Rekreasi',
      judul: 'Diksi Rupa: Kumpulan Istilah dan Gerakan Seni Rupa',
      pengarang: 'Mikke Susanto',
      isbn: '9786029024586',
      penerbit: 'DictiArt Lab',
      tahun_terbit: 2018,
      edisi: 'Cetakan ke-2',
      nomor_panggil: '703 SUS d',
      bahasa: 'Indonesia',
      deskripsi:
        'Ensiklopedia komprehensif istilah seni rupa, desain grafis, arsitektur estetika, serta sejarah gerakan seni modern.',
      eksemplarCodes: [
        { kode: 'EKS-008-A', rak: 'RAK-SEN-01' },
        { kode: 'EKS-008-B', rak: 'RAK-SEN-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-009',
      kategori: 'Sastra',
      judul: 'Bumi Manusia',
      pengarang: 'Pramoedya Ananta Toer',
      isbn: '9789799731234',
      penerbit: 'Lentera Dipantara',
      tahun_terbit: 2005,
      edisi: 'Cetakan 17',
      nomor_panggil: '899.221 TOE b',
      bahasa: 'Indonesia',
      deskripsi:
        'Roman sejarah bagian pertama dari Tetralogi Buru yang mengisahkan perjuangan Minke menghadapi kolonialisme.',
      eksemplarCodes: [
        { kode: 'EKS-009-A', rak: 'RAK-SAS-01' },
        { kode: 'EKS-009-B', rak: 'RAK-SAS-01' },
        { kode: 'EKS-009-C', rak: 'RAK-SAS-01' },
      ],
    },
    {
      kode_koleksi: 'KOL-010',
      kategori: 'Sejarah & Geografi',
      judul: 'Pengantar Sejarah Indonesia Baru: 1500-1900',
      pengarang: 'Prof. Dr. Sartono Kartodirdjo',
      isbn: '9789794031292',
      penerbit: 'Ombak',
      tahun_terbit: 2017,
      edisi: 'Cetakan ke-4',
      nomor_panggil: '959.8 KAR p',
      bahasa: 'Indonesia',
      deskripsi:
        'Analisis historiografi mendalam mengenai transformasi sosial, jalur perdagangan maritim, dan dinamika kerajaan Nusantara.',
      eksemplarCodes: [
        { kode: 'EKS-010-A', rak: 'RAK-SEJ-01' },
        { kode: 'EKS-010-B', rak: 'RAK-SEJ-01' },
        { kode: 'EKS-010-C', rak: 'RAK-SEJ-01' },
      ],
    },
  ];

  // Simpan seluruh koleksi, pengarang, dan eksemplar (default status TERSEDIA dulu)
  const eksemplarByCode = {};
  for (const book of booksSeedData) {
    const createdKol = await prisma.koleksi.create({
      data: {
        kode_koleksi: book.kode_koleksi,
        id_kategori: kategoriMap[book.kategori].id_kategori,
        judul: book.judul,
        isbn: book.isbn,
        penerbit: book.penerbit,
        tahun_terbit: book.tahun_terbit,
        edisi: book.edisi,
        nomor_panggil: book.nomor_panggil,
        bahasa: book.bahasa,
        deskripsi: book.deskripsi,
        sampul: null,
        status_aktif: true,
      },
    });

    await prisma.koleksiPengarang.create({
      data: {
        id_koleksi: createdKol.id_koleksi,
        id_pengarang: pengarangMap[book.pengarang].id_pengarang,
        urutan: 1,
      },
    });

    for (const eks of book.eksemplarCodes) {
      const createdEks = await prisma.eksemplar.create({
        data: {
          id_koleksi: createdKol.id_koleksi,
          kode_eksemplar: eks.kode,
          lokasi_rak: eks.rak,
          status: 'TERSEDIA',
          dibuat_pada: new Date(),
        },
      });
      eksemplarByCode[eks.kode] = createdEks;
    }
  }

  // ==========================================
  // 4. SEED FITUR LAYANAN & CHATBOT
  // ==========================================
  console.log('📌 Seeding Log & Fitur Chatbot/Layanan...');

  await prisma.logKonfigurasi.create({
    data: {
      id_konfigurasi: konfigTarifDenda.id_konfigurasi,
      id_pengubah: userAdmin.id_pengguna,
      nilai_lama: '500',
      nilai_baru: '1000',
      waktu: new Date(),
    },
  });

  await prisma.pesanChatbot.create({
    data: {
      id_anggota: anggotaUsers[0].id_pengguna,
      id_faq: faqPinjam.id_faq,
      pertanyaan: 'Berapa hari saya bisa meminjam buku?',
      jawaban: faqPinjam.jawaban,
      is_fallback: false,
      waktu: new Date(),
    },
  });

  const pesanUsulan = await prisma.pesanChatbot.create({
    data: {
      id_anggota: anggotaUsers[0].id_pengguna,
      pertanyaan: 'Saya ingin mengusulkan pengadaan buku Designing Data-Intensive Applications',
      jawaban:
        'Permintaan usulan buku Anda telah kami daftarkan ke sistem dan akan ditinjau pustakawan.',
      is_fallback: true,
      waktu: new Date(),
    },
  });

  const permintaanUsulan = await prisma.permintaanLayanan.create({
    data: {
      id_pesan: pesanUsulan.id_pesan,
      jenis_permintaan: 'USULAN_KOLEKSI',
      isi_permintaan:
        'Pengusulan buku referensi Designing Data-Intensive Applications karya Martin Kleppmann',
      status: 'DISETUJUI',
      dibuat_pada: new Date(),
      diperbarui_pada: new Date(),
    },
  });

  await prisma.tanggapanPermintaan.create({
    data: {
      id_permintaan: permintaanUsulan.id_permintaan,
      id_pustakawan: userPustakawan.id_pengguna,
      catatan: 'Buku sangat relevan untuk kebutuhan kurikulum rekayasa data. Disetujui untuk pengadaan.',
      status_hasil: 'DISETUJUI',
      waktu: new Date(),
    },
  });

  await prisma.usulanKoleksi.create({
    data: {
      id_permintaan: permintaanUsulan.id_permintaan,
      judul_usulan: 'Designing Data-Intensive Applications',
      pengarang_usulan: 'Martin Kleppmann',
      status_pengadaan: 'RENCANA_PENGADAAN',
      tahun_rencana: 2027,
      diperbarui_pada: new Date(),
    },
  });

  // ==========================================
  // 5. SEED TRANSAKSI PEMINJAMAN (22 BUKU DIPINJAM OLEH 10 ANGGOTA + VARIASI TANGGAL MULAI 15 HARI LALU)
  // ==========================================
  console.log('📌 Seeding Transaksi Peminjaman (22 Eksemplar Dipinjam oleh 10 Anggota)...');

  const today = new Date();
  const TARIF_DENDA = 1000;
  const DURASI_PINJAM = 7;

  // Rencana peminjaman aktif: 10 anggota meminjam total 22 buku (eksemplar)
  // Variasi daysAgo mulai dari 15 hari yang lalu sehingga anggota 1-6 mengalami keterlambatan pengembalian
  const activeLoansPlan = [
    {
      anggotaIdx: 0, // Ahmad Fauzan -> 15 hari lalu (Terlambat 8 hari)
      nomor_transaksi: 'TRX-202611-101',
      daysAgo: 15,
      jalur: 'MANDIRI',
      codes: ['EKS-001-A', 'EKS-002-A'],
    },
    {
      anggotaIdx: 1, // Siti Nurhaliza -> 14 hari lalu (Terlambat 7 hari)
      nomor_transaksi: 'TRX-202611-102',
      daysAgo: 14,
      jalur: 'MANDIRI',
      codes: ['EKS-003-A', 'EKS-004-A'],
    },
    {
      anggotaIdx: 2, // Budi Santoso -> 12 hari lalu (Terlambat 5 hari)
      nomor_transaksi: 'TRX-202611-103',
      daysAgo: 12,
      jalur: 'PUSTAKAWAN',
      codes: ['EKS-005-A', 'EKS-006-A', 'EKS-007-A'],
    },
    {
      anggotaIdx: 3, // Aulia Putri Maharani -> 10 hari lalu (Terlambat 3 hari)
      nomor_transaksi: 'TRX-202611-104',
      daysAgo: 10,
      jalur: 'MANDIRI',
      codes: ['EKS-008-A', 'EKS-009-A'],
    },
    {
      anggotaIdx: 4, // Muhammad Rizki Pratama -> 9 hari lalu (Terlambat 2 hari)
      nomor_transaksi: 'TRX-202611-105',
      daysAgo: 9,
      jalur: 'PUSTAKAWAN',
      codes: ['EKS-010-A', 'EKS-001-B'],
    },
    {
      anggotaIdx: 5, // Nadia Rahmadani -> 8 hari lalu (Terlambat 1 hari)
      nomor_transaksi: 'TRX-202611-106',
      daysAgo: 8,
      jalur: 'MANDIRI',
      codes: ['EKS-002-B', 'EKS-004-B'],
    },
    {
      anggotaIdx: 6, // Farhan Hidayat -> 6 hari lalu (Belum terlambat, jatuh tempo besok)
      nomor_transaksi: 'TRX-202611-107',
      daysAgo: 6,
      jalur: 'MANDIRI',
      codes: ['EKS-005-B', 'EKS-006-B', 'EKS-007-B'],
    },
    {
      anggotaIdx: 7, // Dewi Lestari -> 4 hari lalu (Belum terlambat)
      nomor_transaksi: 'TRX-202611-108',
      daysAgo: 4,
      jalur: 'PUSTAKAWAN',
      codes: ['EKS-009-B', 'EKS-010-B'],
    },
    {
      anggotaIdx: 8, // Kevin Mahendra -> 2 hari lalu (Belum terlambat)
      nomor_transaksi: 'TRX-202611-109',
      daysAgo: 2,
      jalur: 'MANDIRI',
      codes: ['EKS-001-C', 'EKS-002-C'],
    },
    {
      anggotaIdx: 9, // Zahra Khairunnisa -> 1 hari lalu (Belum terlambat)
      nomor_transaksi: 'TRX-202611-110',
      daysAgo: 1,
      jalur: 'MANDIRI',
      codes: ['EKS-004-C', 'EKS-005-C'],
    },
  ];

  let totalDipinjamCount = 0;

  for (const plan of activeLoansPlan) {
    const tanggalPinjam = dateDaysAgo(today, plan.daysAgo);
    const tanggalJatuhTempo = dateDaysAgo(today, plan.daysAgo - DURASI_PINJAM);
    const overdueDays = countOverdueDaysDifference(tanggalJatuhTempo, today);
    const isLate = overdueDays > 0;

    const createdLoan = await prisma.peminjaman.create({
      data: {
        nomor_transaksi: plan.nomor_transaksi,
        id_anggota: anggotaUsers[plan.anggotaIdx].id_pengguna,
        id_pustakawan_peminjaman: userPustakawan.id_pengguna,
        jalur: plan.jalur,
        tanggal_pinjam: tanggalPinjam,
        tanggal_jatuh_tempo: tanggalJatuhTempo,
        status: isLate ? 'TERLAMBAT' : 'SEDANG_DIPINJAM',
        kunci_idempotensi: `IDEMP-${plan.nomor_transaksi}`,
      },
    });

    for (const kodeEks of plan.codes) {
      const eksRecord = eksemplarByCode[kodeEks];
      if (!eksRecord) {
        throw new Error(`Kode eksemplar ${kodeEks} tidak ditemukan saat seeding`);
      }

      const detailRecord = await prisma.detailPeminjaman.create({
        data: {
          id_peminjaman: createdLoan.id_peminjaman,
          id_eksemplar: eksRecord.id_eksemplar,
          id_pustakawan_pengembalian: null,
          tanggal_kembali: null,
          status: 'DIPINJAM',
        },
      });

      // Tandai eksemplar sebagai DIPINJAM di tabel inventaris
      await prisma.eksemplar.update({
        where: { id_eksemplar: eksRecord.id_eksemplar },
        data: { status: 'DIPINJAM' },
      });

      totalDipinjamCount++;

      // Catat denda berjalan untuk peminjaman yang sudah melewati tanggal jatuh tempo
      if (isLate) {
        await prisma.denda.create({
          data: {
            id_detail: detailRecord.id_detail,
            hari_terlambat: overdueDays,
            tarif_per_hari: TARIF_DENDA,
            nominal: overdueDays * TARIF_DENDA,
            total_terbayar: 0,
            status: 'BELUM_LUNAS',
            dibuat_pada: new Date(),
          },
        });
      }
    }
  }

  // Riwayat Transaksi Selesai (sudah dikembalikan terlambat + pembayaran denda terverifikasi)
  // Menggunakan salah satu eksemplar yang saat ini statusnya TERSEDIA (EKS-003-B)
  const eksRiwayat = eksemplarByCode['EKS-003-B'];
  const peminjamanSelesai = await prisma.peminjaman.create({
    data: {
      nomor_transaksi: 'TRX-202611-001',
      id_anggota: anggotaUsers[0].id_pengguna,
      id_pustakawan_peminjaman: userPustakawan.id_pengguna,
      jalur: 'MANDIRI',
      tanggal_pinjam: dateDaysAgo(today, 25),
      tanggal_jatuh_tempo: dateDaysAgo(today, 18),
      status: 'SELESAI',
      kunci_idempotensi: 'IDEMP-TRX-202611-001',
    },
  });

  const detailPinjamSelesai = await prisma.detailPeminjaman.create({
    data: {
      id_peminjaman: peminjamanSelesai.id_peminjaman,
      id_eksemplar: eksRiwayat.id_eksemplar,
      id_pustakawan_pengembalian: userPustakawan.id_pengguna,
      tanggal_kembali: dateDaysAgo(today, 16), // Terlambat 2 hari
      status: 'KEMBALI',
    },
  });

  const dendaTerlambatLunas = await prisma.denda.create({
    data: {
      id_detail: detailPinjamSelesai.id_detail,
      hari_terlambat: 2,
      tarif_per_hari: 1000.0,
      nominal: 2000.0,
      total_terbayar: 2000.0,
      status: 'LUNAS',
      dibuat_pada: dateDaysAgo(today, 16),
    },
  });

  await prisma.koreksiDenda.create({
    data: {
      id_denda: dendaTerlambatLunas.id_denda,
      id_pustakawan: userPustakawan.id_pengguna,
      nominal_lama: 3000.0,
      nominal_baru: 2000.0,
      alasan: 'Penyesuaian hari libur fakultas pada hari minggu.',
      waktu: dateDaysAgo(today, 16),
    },
  });

  const bayarDenda = await prisma.pembayaranDenda.create({
    data: {
      id_anggota: anggotaUsers[0].id_pengguna,
      id_pemverifikasi: userPustakawan.id_pengguna,
      nominal_bayar: 2000.0,
      path_bukti: '/uploads/bukti/bukti-denda-001.jpg',
      tipe_berkas: 'image/jpeg',
      status: 'TERVERIFIKASI',
      waktu_unggah: dateDaysAgo(today, 16),
      waktu_verifikasi: dateDaysAgo(today, 16),
    },
  });

  await prisma.rincianPembayaran.create({
    data: {
      id_pembayaran: bayarDenda.id_pembayaran,
      id_denda: dendaTerlambatLunas.id_denda,
      nominal_dialokasikan: 2000.0,
    },
  });

  console.log(
    `✅ Seeding selesai: ${categoryNames.length} kategori, ${booksSeedData.length} buku (${Object.keys(eksemplarByCode).length} eksemplar), ${anggotaUsers.length} anggota, ${totalDipinjamCount} buku sedang dipinjam!`
  );
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });