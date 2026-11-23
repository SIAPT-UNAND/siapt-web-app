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
- MySQL 8.4 atau versi yang kompatibel.

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

Sesuaikan nilai database pada `backend/app/.env`:

| Variabel | Contoh | Keterangan |
|---|---|---|
| `DB_HOST` | `localhost` | Host MySQL lokal |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_NAME` | `siapt` | Nama database |
| `DB_USER` | `siapt` | Pengguna MySQL |
| `DB_PASSWORD` | `<password>` | Password pengguna MySQL |

Database tidak dibuat atau dimigrasikan secara otomatis saat menjalankan
aplikasi secara lokal. Buat database terlebih dahulu, lalu jalankan migrasi:

```sql
CREATE DATABASE siapt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
npm run migrate:deploy -w @siapt/backend-app
```

Untuk mengisi data awal yang dibutuhkan aplikasi, jalankan seed setelah
migrasi berhasil:

```bash
npm run seed -w @siapt/backend-app
```

Untuk lingkungan pengembangan yang perlu membuat atau memperbarui migrasi
Prisma berdasarkan perubahan schema:

```bash
npm run migrate -w @siapt/backend-app
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

## CI/CD dan Deployment

Pipeline GitHub Actions menjalankan CI lint, test, coverage minimum 75%, build
frontend, dan build Docker untuk Pull Request ke `main` atau `staging` serta
push branch `feat/*`, `fix/*`, `chore/*`, `test/*`, dan `docs/*`.

Deployment dipisahkan berdasarkan branch:

- Push langsung atau merge ke `staging` langsung menjalankan deployment staging.
- Push langsung atau merge ke `main` langsung menjalankan deployment production.
- Deployment branch utama tidak menjalankan ulang job coverage; gate coverage
  hanya diperlukan pada PR dan branch pengembangan.

Pasang satu GitHub Actions runner Linux pada setiap server:

```bash
# Jalankan perintah ini di server sebagai pengguna yang terdaftar sebagai
# runner dan memiliki akses Docker.
./config.sh --url https://github.com/SIAPT-UNAND/siapt-web-app --token <RUNNER_TOKEN>
```

Daftarkan runner staging dengan label `siapt-staging`, `linux`, dan
`self-hosted`. Daftarkan runner production dengan label `siapt-production`,
`linux`, dan `self-hosted`.

Buat GitHub Environments `staging` dan `production`. Konfigurasikan variabel
serta secret pada masing-masing Environment, sehingga password kedua server
tidak tercampur:

| Environment | Variables | Secrets |
|---|---|---|
| `staging` | `MYSQL_DATABASE`, `MYSQL_USER`, `APP_PORT` | `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` |
| `production` | `MYSQL_DATABASE`, `MYSQL_USER`, `APP_PORT` | `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` |

Docker Compose menjalankan tiga service:

- `app`: Express API sekaligus aset build frontend.
- `db`: MySQL yang hanya dapat diakses pada jaringan Compose.
- `caddy`: reverse proxy lokal yang meneruskan request ke `app`.
Backend dan database tidak dipublikasikan ke host. Caddy hanya bind ke loopback
pada port `APP_PORT` (default `8080`). Cloudflare Tunnel, jika dipasang,
menjadi service atau instalasi terpisah di luar repository dan harus mengarah
ke `http://127.0.0.1:8080`.

Salin `.env.deploy.example` menjadi `.env.deploy` di server lalu ubah nilai
password dan domain. Jalankan lokal untuk memverifikasi Compose:

```bash
docker compose --env-file .env.deploy up -d --build
curl --fail http://127.0.0.1:8080/api/health
docker compose --env-file .env.deploy ps
```

GitHub Actions runner otomatis membaca `Caddyfile`, build image, menjalankan
migrasi Prisma saat kontainer `app` start, lalu mengganti service dengan
Compose tanpa perlu mengubah atau mengekspos backend ke internet.

Deployment Docker menjalankan `prisma migrate deploy` saat start, sehingga
database baru dibuat oleh MySQL lalu langsung dimigrasikan oleh Prisma. Seed
awal tidak dijalankan otomatis. Untuk mengeksekusi seed pada kontainer yang
sedang berjalan:

```bash
docker compose --env-file .env.deploy exec app npm run seed -w @siapt/backend-app
```

Untuk langkah server yang lengkap, gunakan
[runbook deployment staging](./docs/DEPLOYMENT_STAGING_RUNBOOK.md).

Baca [`CONTRIBUTING.md`](./CONTRIBUTING.md) sebelum membuat perubahan.
Dokumen tersebut menjelaskan standar branch, Pull Request, Conventional
Commits, testing, database migration, dan keamanan.
