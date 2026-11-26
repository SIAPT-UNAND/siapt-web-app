import '../src/config/database.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  // Kategori
  const katKomputer = await prisma.kategori.create({
    data: {
      nama_kategori: 'Ilmu Komputer & Sistem Informasi',
      status_aktif: true,
    },
  });
  const katSains = await prisma.kategori.create({
    data: {
      nama_kategori: 'Sains & Teknologi Terapan',
      status_aktif: true,
    },
  });
  const katSastra = await prisma.kategori.create({
    data: {
      nama_kategori: 'Sastra & Humaniora',
      status_aktif: true,
    },
  });

  // Pengarang
  const pengarangMartin = await prisma.pengarang.create({
    data: { nama_pengarang: 'Robert C. Martin' },
  });
  const pengarangFowler = await prisma.pengarang.create({
    data: { nama_pengarang: 'Martin Fowler' },
  });
  const pengarangPramoedya = await prisma.pengarang.create({
    data: { nama_pengarang: 'Pramoedya Ananta Toer' },
  });

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
  const konfigBatasPinjam = await prisma.konfigurasiSistem.create({
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
  // 2. SEED PENGGUNA
  // ==========================================
  console.log('📌 Seeding Pengguna...');

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

  const userAnggota = await prisma.pengguna.create({
    data: {
      id_role: roleAnggota.id_role,
      pengenal: '2211521001',
      nama: 'Ahmad Fauzan',
      kata_sandi_hash: '$2b$10$eO1v0T31RjRz2gqV.exampleHashedPasswordAnggota',
      status_aktif: true,
      dibuat_pada: new Date(),
    },
  });

  // ==========================================
  // 3. SEED KOLEKSI, PENGARANG & EKSEMPLAR
  // ==========================================
  console.log('📌 Seeding Koleksi & Inventaris...');

  const kolCleanCode = await prisma.koleksi.create({
    data: {
      kode_koleksi: 'KOL-CS-001',
      id_kategori: katKomputer.id_kategori,
      judul: 'Clean Code: A Handbook of Agile Software Craftsmanship',
      isbn: '9780132350884',
      penerbit: 'Prentice Hall',
      tahun_terbit: 2008,
      edisi: '1st Edition',
      nomor_panggil: '005.1 MAR c',
      bahasa: 'Inggris',
      deskripsi: 'Panduan fundamental mengenai rekayasa perangkat lunak dan arsitektur kode bersih.',
      sampul: '/covers/clean-code.jpg',
      status_aktif: true,
    },
  });

  const kolRefactoring = await prisma.koleksi.create({
    data: {
      kode_koleksi: 'KOL-CS-002',
      id_kategori: katKomputer.id_kategori,
      judul: 'Refactoring: Improving the Design of Existing Code',
      isbn: '9780201485677',
      penerbit: 'Addison-Wesley Professional',
      tahun_terbit: 2018,
      edisi: '2nd Edition',
      nomor_panggil: '005.1 FOW r',
      bahasa: 'Inggris',
      deskripsi: 'Katalog teknik refaktorisasi kode program.',
      sampul: '/covers/refactoring.jpg',
      status_aktif: true,
    },
  });

  const kolBumiManusia = await prisma.koleksi.create({
    data: {
      kode_koleksi: 'KOL-LIT-001',
      id_kategori: katSastra.id_kategori,
      judul: 'Bumi Manusia',
      isbn: '9789799731234',
      penerbit: 'Lentera Dipantara',
      tahun_terbit: 2005,
      edisi: 'Cetakan 17',
      nomor_panggil: '899.221 TOE b',
      bahasa: 'Indonesia',
      deskripsi: 'Roman sejarah bagian pertama dari Tetralogi Buru.',
      sampul: '/covers/bumi-manusia.jpg',
      status_aktif: true,
    },
  });

  // Hubungkan Koleksi dengan Pengarang
  await prisma.koleksiPengarang.createMany({
    data: [
      { id_koleksi: kolCleanCode.id_koleksi, id_pengarang: pengarangMartin.id_pengarang, urutan: 1 },
      { id_koleksi: kolRefactoring.id_koleksi, id_pengarang: pengarangFowler.id_pengarang, urutan: 1 },
      { id_koleksi: kolBumiManusia.id_koleksi, id_pengarang: pengarangPramoedya.id_pengarang, urutan: 1 },
    ],
  });

  // Eksemplar
  const eksCleanCodeA = await prisma.eksemplar.create({
    data: {
      id_koleksi: kolCleanCode.id_koleksi,
      kode_eksemplar: 'EKS-001-A',
      lokasi_rak: 'RAK-CS-01',
      status: 'TERSEDIA',
      dibuat_pada: new Date(),
    },
  });

  const eksCleanCodeB = await prisma.eksemplar.create({
    data: {
      id_koleksi: kolCleanCode.id_koleksi,
      kode_eksemplar: 'EKS-001-B',
      lokasi_rak: 'RAK-CS-01',
      status: 'TERSEDIA',
      dibuat_pada: new Date(),
    },
  });

  await prisma.eksemplar.create({
    data: {
      id_koleksi: kolRefactoring.id_koleksi,
      kode_eksemplar: 'EKS-002-A',
      lokasi_rak: 'RAK-CS-02',
      status: 'TERSEDIA',
      dibuat_pada: new Date(),
    },
  });

  await prisma.eksemplar.create({
    data: {
      id_koleksi: kolBumiManusia.id_koleksi,
      kode_eksemplar: 'EKS-003-A',
      lokasi_rak: 'RAK-LIT-01',
      status: 'TERSEDIA',
      dibuat_pada: new Date(),
    },
  });

  // ==========================================
  // 4. SEED FITUR LAYANAN & CHATBOT
  // ==========================================
  console.log('📌 Seeding Log & Fitur Chatbot/Layanan...');

  // Log Konfigurasi
  await prisma.logKonfigurasi.create({
    data: {
      id_konfigurasi: konfigTarifDenda.id_konfigurasi,
      id_pengubah: userAdmin.id_pengguna,
      nilai_lama: '500',
      nilai_baru: '1000',
      waktu: new Date(),
    },
  });

  // Pesan Chatbot Umum
  await prisma.pesanChatbot.create({
    data: {
      id_anggota: userAnggota.id_pengguna,
      id_faq: faqPinjam.id_faq,
      pertanyaan: 'Berapa hari saya bisa meminjam buku?',
      jawaban: faqPinjam.jawaban,
      is_fallback: false,
      waktu: new Date(),
    },
  });

  // Pesan Chatbot yang memicu Permintaan Layanan (Usulan Koleksi)
  const pesanUsulan = await prisma.pesanChatbot.create({
    data: {
      id_anggota: userAnggota.id_pengguna,
      pertanyaan: 'Saya ingin mengusulkan pengadaan buku Designing Data-Intensive Applications',
      jawaban: 'Permintaan usulan buku Anda telah kami daftarkan ke sistem dan akan ditinjau pustakawan.',
      is_fallback: true,
      waktu: new Date(),
    },
  });

  const permintaanUsulan = await prisma.permintaanLayanan.create({
    data: {
      id_pesan: pesanUsulan.id_pesan,
      jenis_permintaan: 'USULAN_KOLEKSI',
      isi_permintaan: 'Pengusulan buku referensi Designing Data-Intensive Applications karya Martin Kleppmann',
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
  // 5. SEED TRANSAKSI (PEMINJAMAN & DENDA)
  // ==========================================
  console.log('📌 Seeding Transaksi Peminjaman, Denda & Pembayaran...');

  // Transaksi Peminjaman Selesai (dengan Keterlambatan)
  const peminjamanSelesai = await prisma.peminjaman.create({
    data: {
      nomor_transaksi: 'TRX-202611-001',
      id_anggota: userAnggota.id_pengguna,
      id_pustakawan_peminjaman: userPustakawan.id_pengguna,
      jalur: 'MANDIRI',
      tanggal_pinjam: new Date('2026-11-01'),
      tanggal_jatuh_tempo: new Date('2026-11-08'),
      status: 'SELESAI',
      kunci_idempotensi: 'IDEMP-TRX-202611-001',
    },
  });

  const detailPinjam = await prisma.detailPeminjaman.create({
    data: {
      id_peminjaman: peminjamanSelesai.id_peminjaman,
      id_eksemplar: eksCleanCodeA.id_eksemplar,
      id_pustakawan_pengembalian: userPustakawan.id_pengguna,
      tanggal_kembali: new Date('2026-11-10'), // Terlambat 2 hari
      status: 'KEMBALI',
    },
  });

  const dendaTerlambat = await prisma.denda.create({
    data: {
      id_detail: detailPinjam.id_detail,
      hari_terlambat: 2,
      tarif_per_hari: 1000.0,
      nominal: 2000.0,
      total_terbayar: 2000.0,
      status: 'LUNAS',
      dibuat_pada: new Date('2026-11-10T09:00:00Z'),
    },
  });

  // Koreksi Denda (contoh dispensasi/koreksi catatan)
  await prisma.koreksiDenda.create({
    data: {
      id_denda: dendaTerlambat.id_denda,
      id_pustakawan: userPustakawan.id_pengguna,
      nominal_lama: 3000.0,
      nominal_baru: 2000.0,
      alasan: 'Penyesuaian hari libur fakultas pada hari minggu.',
      waktu: new Date('2026-11-10T10:00:00Z'),
    },
  });

  // Pembayaran Denda
  const bayarDenda = await prisma.pembayaranDenda.create({
    data: {
      id_anggota: userAnggota.id_pengguna,
      id_pemverifikasi: userPustakawan.id_pengguna,
      nominal_bayar: 2000.0,
      path_bukti: '/uploads/bukti/bukti-denda-001.jpg',
      tipe_berkas: 'image/jpeg',
      status: 'TERVERIFIKASI',
      waktu_unggah: new Date('2026-11-10T11:00:00Z'),
      waktu_verifikasi: new Date('2026-11-10T11:30:00Z'),
    },
  });

  // Rincian Alokasi Pembayaran
  await prisma.rincianPembayaran.create({
    data: {
      id_pembayaran: bayarDenda.id_pembayaran,
      id_denda: dendaTerlambat.id_denda,
      nominal_dialokasikan: 2000.0,
    },
  });

  console.log('✅ Seeding database SIAPT berhasil diselesaikan!');
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan saat seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

