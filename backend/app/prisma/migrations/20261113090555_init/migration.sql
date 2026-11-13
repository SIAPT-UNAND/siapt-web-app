-- CreateTable
CREATE TABLE `role` (
    `id_role` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_role` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `role_nama_role_key`(`nama_role`),
    PRIMARY KEY (`id_role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kategori` (
    `id_kategori` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_kategori` VARCHAR(255) NOT NULL,
    `status_aktif` BOOLEAN NULL,

    UNIQUE INDEX `kategori_nama_kategori_key`(`nama_kategori`),
    PRIMARY KEY (`id_kategori`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengarang` (
    `id_pengarang` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_pengarang` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id_pengarang`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faq` (
    `id_faq` INTEGER NOT NULL AUTO_INCREMENT,
    `pertanyaan` TEXT NULL,
    `jawaban` TEXT NULL,
    `kata_kunci` VARCHAR(255) NULL,
    `status_aktif` BOOLEAN NULL,

    PRIMARY KEY (`id_faq`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `konfigurasi_sistem` (
    `id_konfigurasi` INTEGER NOT NULL AUTO_INCREMENT,
    `kunci_parameter` VARCHAR(255) NOT NULL,
    `nilai` VARCHAR(255) NULL,
    `tipe_data` VARCHAR(255) NULL,
    `satuan` VARCHAR(255) NULL,
    `nilai_min` VARCHAR(255) NULL,
    `nilai_maks` VARCHAR(255) NULL,
    `wajib` BOOLEAN NULL,

    UNIQUE INDEX `konfigurasi_sistem_kunci_parameter_key`(`kunci_parameter`),
    PRIMARY KEY (`id_konfigurasi`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengguna` (
    `id_pengguna` INTEGER NOT NULL AUTO_INCREMENT,
    `id_role` INTEGER NOT NULL,
    `pengenal` VARCHAR(255) NOT NULL,
    `nama` VARCHAR(255) NULL,
    `kata_sandi_hash` VARCHAR(255) NULL,
    `status_aktif` BOOLEAN NULL,
    `alasan_nonaktif` VARCHAR(255) NULL,
    `dibuat_pada` DATETIME(3) NULL,

    UNIQUE INDEX `pengguna_pengenal_key`(`pengenal`),
    INDEX `pengguna_id_role_idx`(`id_role`),
    PRIMARY KEY (`id_pengguna`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `koleksi` (
    `id_koleksi` INTEGER NOT NULL AUTO_INCREMENT,
    `kode_koleksi` VARCHAR(255) NOT NULL,
    `id_kategori` INTEGER NOT NULL,
    `judul` VARCHAR(255) NOT NULL,
    `isbn` VARCHAR(255) NULL,
    `penerbit` VARCHAR(255) NULL,
    `tahun_terbit` INTEGER NULL,
    `edisi` VARCHAR(255) NULL,
    `nomor_panggil` VARCHAR(255) NULL,
    `bahasa` VARCHAR(255) NULL,
    `deskripsi` TEXT NULL,
    `sampul` VARCHAR(255) NULL,
    `status_aktif` BOOLEAN NULL,

    UNIQUE INDEX `koleksi_kode_koleksi_key`(`kode_koleksi`),
    INDEX `koleksi_id_kategori_idx`(`id_kategori`),
    PRIMARY KEY (`id_koleksi`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `koleksi_pengarang` (
    `id_koleksi` INTEGER NOT NULL,
    `id_pengarang` INTEGER NOT NULL,
    `urutan` INTEGER NULL,

    INDEX `koleksi_pengarang_id_pengarang_idx`(`id_pengarang`),
    PRIMARY KEY (`id_koleksi`, `id_pengarang`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eksemplar` (
    `id_eksemplar` INTEGER NOT NULL AUTO_INCREMENT,
    `id_koleksi` INTEGER NOT NULL,
    `kode_eksemplar` VARCHAR(255) NOT NULL,
    `lokasi_rak` VARCHAR(255) NULL,
    `status` VARCHAR(255) NULL,
    `dibuat_pada` DATETIME(3) NULL,

    UNIQUE INDEX `eksemplar_kode_eksemplar_key`(`kode_eksemplar`),
    INDEX `eksemplar_id_koleksi_idx`(`id_koleksi`),
    PRIMARY KEY (`id_eksemplar`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_konfigurasi` (
    `id_log` INTEGER NOT NULL AUTO_INCREMENT,
    `id_konfigurasi` INTEGER NOT NULL,
    `id_pengubah` INTEGER NOT NULL,
    `nilai_lama` VARCHAR(255) NULL,
    `nilai_baru` VARCHAR(255) NULL,
    `waktu` DATETIME(3) NULL,

    INDEX `log_konfigurasi_id_konfigurasi_idx`(`id_konfigurasi`),
    INDEX `log_konfigurasi_id_pengubah_idx`(`id_pengubah`),
    PRIMARY KEY (`id_log`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pesan_chatbot` (
    `id_pesan` INTEGER NOT NULL AUTO_INCREMENT,
    `id_anggota` INTEGER NOT NULL,
    `id_faq` INTEGER NULL,
    `pertanyaan` TEXT NULL,
    `jawaban` TEXT NULL,
    `is_fallback` BOOLEAN NULL,
    `waktu` DATETIME(3) NULL,

    INDEX `pesan_chatbot_id_anggota_idx`(`id_anggota`),
    INDEX `pesan_chatbot_id_faq_idx`(`id_faq`),
    PRIMARY KEY (`id_pesan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permintaan_layanan` (
    `id_permintaan` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pesan` INTEGER NOT NULL,
    `jenis_permintaan` VARCHAR(255) NULL,
    `isi_permintaan` TEXT NULL,
    `status` VARCHAR(255) NULL,
    `dibuat_pada` DATETIME(3) NULL,
    `diperbarui_pada` DATETIME(3) NULL,

    UNIQUE INDEX `permintaan_layanan_id_pesan_key`(`id_pesan`),
    PRIMARY KEY (`id_permintaan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tanggapan_permintaan` (
    `id_tanggapan` INTEGER NOT NULL AUTO_INCREMENT,
    `id_permintaan` INTEGER NOT NULL,
    `id_pustakawan` INTEGER NOT NULL,
    `catatan` TEXT NULL,
    `status_hasil` VARCHAR(255) NULL,
    `waktu` DATETIME(3) NULL,

    INDEX `tanggapan_permintaan_id_permintaan_idx`(`id_permintaan`),
    INDEX `tanggapan_permintaan_id_pustakawan_idx`(`id_pustakawan`),
    PRIMARY KEY (`id_tanggapan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usulan_koleksi` (
    `id_usulan` INTEGER NOT NULL AUTO_INCREMENT,
    `id_permintaan` INTEGER NOT NULL,
    `judul_usulan` VARCHAR(255) NULL,
    `pengarang_usulan` VARCHAR(255) NULL,
    `status_pengadaan` VARCHAR(255) NULL,
    `tahun_rencana` INTEGER NULL,
    `id_koleksi` INTEGER NULL,
    `diperbarui_pada` DATETIME(3) NULL,

    UNIQUE INDEX `usulan_koleksi_id_permintaan_key`(`id_permintaan`),
    INDEX `usulan_koleksi_id_koleksi_idx`(`id_koleksi`),
    PRIMARY KEY (`id_usulan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `peminjaman` (
    `id_peminjaman` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor_transaksi` VARCHAR(255) NOT NULL,
    `id_anggota` INTEGER NOT NULL,
    `id_pustakawan_peminjaman` INTEGER NULL,
    `jalur` VARCHAR(255) NULL,
    `tanggal_pinjam` DATE NULL,
    `tanggal_jatuh_tempo` DATE NULL,
    `status` VARCHAR(255) NULL,
    `kunci_idempotensi` VARCHAR(255) NULL,

    UNIQUE INDEX `peminjaman_nomor_transaksi_key`(`nomor_transaksi`),
    UNIQUE INDEX `peminjaman_kunci_idempotensi_key`(`kunci_idempotensi`),
    INDEX `peminjaman_id_anggota_idx`(`id_anggota`),
    INDEX `peminjaman_id_pustakawan_peminjaman_idx`(`id_pustakawan_peminjaman`),
    PRIMARY KEY (`id_peminjaman`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `detail_peminjaman` (
    `id_detail` INTEGER NOT NULL AUTO_INCREMENT,
    `id_peminjaman` INTEGER NOT NULL,
    `id_eksemplar` INTEGER NOT NULL,
    `id_pustakawan_pengembalian` INTEGER NULL,
    `tanggal_kembali` DATE NULL,
    `status` VARCHAR(255) NULL,

    INDEX `detail_peminjaman_id_peminjaman_idx`(`id_peminjaman`),
    INDEX `detail_peminjaman_id_eksemplar_idx`(`id_eksemplar`),
    INDEX `detail_peminjaman_id_pustakawan_pengembalian_idx`(`id_pustakawan_pengembalian`),
    PRIMARY KEY (`id_detail`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `denda` (
    `id_denda` INTEGER NOT NULL AUTO_INCREMENT,
    `id_detail` INTEGER NOT NULL,
    `hari_terlambat` INTEGER NULL,
    `tarif_per_hari` DECIMAL(10, 2) NULL,
    `nominal` DECIMAL(10, 2) NULL,
    `total_terbayar` DECIMAL(10, 2) NULL,
    `status` VARCHAR(255) NULL,
    `dibuat_pada` DATETIME(3) NULL,

    UNIQUE INDEX `denda_id_detail_key`(`id_detail`),
    PRIMARY KEY (`id_denda`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `koreksi_denda` (
    `id_koreksi` INTEGER NOT NULL AUTO_INCREMENT,
    `id_denda` INTEGER NOT NULL,
    `id_pustakawan` INTEGER NOT NULL,
    `nominal_lama` DECIMAL(10, 2) NULL,
    `nominal_baru` DECIMAL(10, 2) NULL,
    `alasan` TEXT NULL,
    `waktu` DATETIME(3) NULL,

    INDEX `koreksi_denda_id_denda_idx`(`id_denda`),
    INDEX `koreksi_denda_id_pustakawan_idx`(`id_pustakawan`),
    PRIMARY KEY (`id_koreksi`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pembayaran_denda` (
    `id_pembayaran` INTEGER NOT NULL AUTO_INCREMENT,
    `id_anggota` INTEGER NOT NULL,
    `id_pemverifikasi` INTEGER NULL,
    `nominal_bayar` DECIMAL(10, 2) NULL,
    `path_bukti` VARCHAR(255) NULL,
    `tipe_berkas` VARCHAR(255) NULL,
    `status` VARCHAR(255) NULL,
    `alasan_penolakan` TEXT NULL,
    `waktu_unggah` DATETIME(3) NULL,
    `waktu_verifikasi` DATETIME(3) NULL,

    INDEX `pembayaran_denda_id_anggota_idx`(`id_anggota`),
    INDEX `pembayaran_denda_id_pemverifikasi_idx`(`id_pemverifikasi`),
    PRIMARY KEY (`id_pembayaran`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rincian_pembayaran` (
    `id_rincian` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pembayaran` INTEGER NOT NULL,
    `id_denda` INTEGER NOT NULL,
    `nominal_dialokasikan` DECIMAL(10, 2) NULL,

    INDEX `rincian_pembayaran_id_denda_idx`(`id_denda`),
    UNIQUE INDEX `uk_rincian_bayar_denda`(`id_pembayaran`, `id_denda`),
    PRIMARY KEY (`id_rincian`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pengguna` ADD CONSTRAINT `pengguna_id_role_fkey` FOREIGN KEY (`id_role`) REFERENCES `role`(`id_role`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `koleksi` ADD CONSTRAINT `koleksi_id_kategori_fkey` FOREIGN KEY (`id_kategori`) REFERENCES `kategori`(`id_kategori`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `koleksi_pengarang` ADD CONSTRAINT `koleksi_pengarang_id_koleksi_fkey` FOREIGN KEY (`id_koleksi`) REFERENCES `koleksi`(`id_koleksi`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `koleksi_pengarang` ADD CONSTRAINT `koleksi_pengarang_id_pengarang_fkey` FOREIGN KEY (`id_pengarang`) REFERENCES `pengarang`(`id_pengarang`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eksemplar` ADD CONSTRAINT `eksemplar_id_koleksi_fkey` FOREIGN KEY (`id_koleksi`) REFERENCES `koleksi`(`id_koleksi`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_konfigurasi` ADD CONSTRAINT `log_konfigurasi_id_konfigurasi_fkey` FOREIGN KEY (`id_konfigurasi`) REFERENCES `konfigurasi_sistem`(`id_konfigurasi`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_konfigurasi` ADD CONSTRAINT `log_konfigurasi_id_pengubah_fkey` FOREIGN KEY (`id_pengubah`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pesan_chatbot` ADD CONSTRAINT `pesan_chatbot_id_anggota_fkey` FOREIGN KEY (`id_anggota`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pesan_chatbot` ADD CONSTRAINT `pesan_chatbot_id_faq_fkey` FOREIGN KEY (`id_faq`) REFERENCES `faq`(`id_faq`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permintaan_layanan` ADD CONSTRAINT `permintaan_layanan_id_pesan_fkey` FOREIGN KEY (`id_pesan`) REFERENCES `pesan_chatbot`(`id_pesan`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tanggapan_permintaan` ADD CONSTRAINT `tanggapan_permintaan_id_permintaan_fkey` FOREIGN KEY (`id_permintaan`) REFERENCES `permintaan_layanan`(`id_permintaan`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tanggapan_permintaan` ADD CONSTRAINT `tanggapan_permintaan_id_pustakawan_fkey` FOREIGN KEY (`id_pustakawan`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usulan_koleksi` ADD CONSTRAINT `usulan_koleksi_id_permintaan_fkey` FOREIGN KEY (`id_permintaan`) REFERENCES `permintaan_layanan`(`id_permintaan`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usulan_koleksi` ADD CONSTRAINT `usulan_koleksi_id_koleksi_fkey` FOREIGN KEY (`id_koleksi`) REFERENCES `koleksi`(`id_koleksi`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `peminjaman` ADD CONSTRAINT `peminjaman_id_anggota_fkey` FOREIGN KEY (`id_anggota`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `peminjaman` ADD CONSTRAINT `peminjaman_id_pustakawan_peminjaman_fkey` FOREIGN KEY (`id_pustakawan_peminjaman`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_peminjaman` ADD CONSTRAINT `detail_peminjaman_id_peminjaman_fkey` FOREIGN KEY (`id_peminjaman`) REFERENCES `peminjaman`(`id_peminjaman`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_peminjaman` ADD CONSTRAINT `detail_peminjaman_id_eksemplar_fkey` FOREIGN KEY (`id_eksemplar`) REFERENCES `eksemplar`(`id_eksemplar`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `detail_peminjaman` ADD CONSTRAINT `detail_peminjaman_id_pustakawan_pengembalian_fkey` FOREIGN KEY (`id_pustakawan_pengembalian`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `denda` ADD CONSTRAINT `denda_id_detail_fkey` FOREIGN KEY (`id_detail`) REFERENCES `detail_peminjaman`(`id_detail`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `koreksi_denda` ADD CONSTRAINT `koreksi_denda_id_denda_fkey` FOREIGN KEY (`id_denda`) REFERENCES `denda`(`id_denda`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `koreksi_denda` ADD CONSTRAINT `koreksi_denda_id_pustakawan_fkey` FOREIGN KEY (`id_pustakawan`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pembayaran_denda` ADD CONSTRAINT `pembayaran_denda_id_anggota_fkey` FOREIGN KEY (`id_anggota`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pembayaran_denda` ADD CONSTRAINT `pembayaran_denda_id_pemverifikasi_fkey` FOREIGN KEY (`id_pemverifikasi`) REFERENCES `pengguna`(`id_pengguna`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rincian_pembayaran` ADD CONSTRAINT `rincian_pembayaran_id_pembayaran_fkey` FOREIGN KEY (`id_pembayaran`) REFERENCES `pembayaran_denda`(`id_pembayaran`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rincian_pembayaran` ADD CONSTRAINT `rincian_pembayaran_id_denda_fkey` FOREIGN KEY (`id_denda`) REFERENCES `denda`(`id_denda`) ON DELETE CASCADE ON UPDATE CASCADE;
