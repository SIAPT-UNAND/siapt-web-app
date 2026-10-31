# SIAPT UNAND

Sistem Informasi Perpustakaan Terpadu Universitas Andalas untuk mendukung
pengelolaan layanan perpustakaan, koleksi, sirkulasi, repositori, dan
integrasi data antar sistem.

## Struktur Proyek

```text
siapt-web-app/
├── frontend/              # Aplikasi web SIAPT berbasis React
├── backend/
│   ├── app/               # REST API dan logika bisnis aplikasi
│   └── slims-sync/        # Integrasi sinkronisasi data dengan SLiMS
├── .github/               # Konfigurasi repository
├── CONTRIBUTING.md        # Panduan kontribusi dan standar pengembangan
├── package.json           # Konfigurasi monorepo dan script utama
└── README.md              # Dokumentasi proyek
```

## Teknologi

### Frontend

- React 19
- Vite
- Vitest
- React Testing Library

### Backend (App)

- Node.js
- Express 4
- Vitest
- Supertest

## Prasyarat

Pastikan perangkat berikut sudah terpasang sebelum melakukan instalasi:

- Node.js 22.12.0 atau versi yang lebih baru pada major version 22.
- npm 10 atau versi yang lebih baru.
- Git.

Node.js 22 LTS digunakan karena versi Vite yang dipakai membutuhkan
Node.js 20.19.0 atau versi 22.12.0 ke atas. npm 10 sudah disertakan pada
Node.js 22. Periksa versi yang terpasang:

```bash
node --version
npm --version
git --version
```

## Instalasi

Unduh repository dan pasang seluruh dependensi dari root proyek:

```bash
git clone https://github.com/SIAPT-UNAND/siapt-web-app.git
cd siapt-web-app
npm install
```

Salin file environment contoh ke file environment lokal:

```bash
cp backend/app/.env.example backend/app/.env
```

Jangan commit file `.env` atau nilai konfigurasi yang bersifat rahasia.

## Menjalankan Aplikasi

Jalankan frontend dan backend secara bersamaan:

```bash
npm run dev
```

Atau jalankan salah satu service:

```bash
npm run dev:frontend
npm run dev:app
```

## Pengujian dan Validasi

Jalankan lint:

```bash
npm run lint
```

Jalankan seluruh test:

```bash
npm test
```

Stack pengujian:

- **Vitest** untuk unit test frontend dan backend.
- **React Testing Library** untuk menguji perilaku komponen React dari sudut
  pandang pengguna.
- **Supertest** untuk menguji endpoint dan integrasi HTTP Express.

Test frontend tidak boleh bergantung pada server backend atau database nyata.
Test backend menggunakan fixture atau test double untuk unit test, sedangkan
Supertest digunakan untuk memvalidasi kontrak HTTP aplikasi Express.

Jalankan build frontend:

```bash
npm run build
```

Jalankan seluruh pemeriksaan sebelum membuat Pull Request:

```bash
npm run check
```

## Kontrak API

Endpoint API utama tersedia di bawah namespace `/api`. Response sukses
menggunakan format:

```json
{
  "success": true,
  "data": {}
}
```

Response error menggunakan format:

```json
{
  "success": false,
  "message": "Penjelasan error"
}
```

Endpoint pemeriksaan kesehatan layanan tersedia di `/api/health`.

## Kontribusi

Baca [`CONTRIBUTING.md`](./CONTRIBUTING.md) sebelum membuat perubahan.
Dokumen tersebut menjelaskan standar branch, Pull Request, Conventional
Commits, testing, database migration, dan keamanan.
