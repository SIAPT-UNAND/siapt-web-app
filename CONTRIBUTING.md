# Panduan Kontribusi

Panduan singkat untuk berkontribusi pada SIAPT UNAND.

## Struktur Proyek

```text
frontend/       Aplikasi web React
backend/app/    REST API Express
backend/slims-sync/  Integrasi sinkronisasi SLiMS
```

`backend/app` menangani API dan logika bisnis aplikasi. Integrasi SLiMS dan
webhook ditempatkan di `backend/slims-sync`.

## Persiapan

Gunakan Node.js 22.12.0 atau versi yang lebih baru pada major version 22,
npm 10 atau versi yang lebih baru, dan Git.

Pasang dependensi dari root repository:

```bash
npm install
```

Untuk menambahkan dependensi:

```bash
npm install <package> -w frontend
npm install <package> -w @siapt/backend-app
```

Jangan commit file `.env`, credentials, token, atau data pribadi.

## Branch

- `main`: kode yang siap dirilis.
- `staging`: integrasi sebelum rilis.
- `feat/<nama>`: fitur baru.
- `fix/<nama>`: perbaikan bug.
- `chore/<nama>`: pemeliharaan atau refactoring.
- `docs/<nama>`: perubahan dokumentasi.
- `test/<nama>`: perubahan test.

Branch pekerjaan dibuat dari `staging`:

```bash
git switch staging
git pull --ff-only
git switch -c feat/nama-fitur
```

Perubahan ke `main` dan `staging` dilakukan melalui Pull Request. Pull
Request harus menjelaskan tujuan, perubahan, dan hasil test.

## Commit

Gunakan format Conventional Commits:

```text
feat(app): add book search
fix(frontend): handle api error
test(app): add health endpoint test
docs: update setup guide
chore: update dependencies
```

Gunakan `BREAKING CHANGE:` atau tanda `!` untuk perubahan yang memutus
kompatibilitas.

## Test dan Validasi

Jalankan perintah berikut dari root repository:

```bash
npm run lint
npm run build
npm test
npm run check
```

Tambahkan test untuk fitur baru dan perbaikan bug:

- Frontend menggunakan Vitest dan React Testing Library.
- Backend menggunakan Vitest dan Supertest.
- Test frontend tidak memanggil backend atau database nyata.
- Test backend tidak bergantung pada service eksternal.

## API dan Database

Response API menggunakan format berikut:

```json
{
  "success": true,
  "data": {}
}
```

Response error:

```json
{
  "success": false,
  "message": "Penjelasan error"
}
```

Perubahan struktur database harus menggunakan migration. Dokumentasikan
perubahan API, konfigurasi, atau database di Pull Request.

## Checklist

- [ ] Branch dibuat dari `staging`.
- [ ] Perubahan tidak mengandung secret atau data pribadi.
- [ ] Test yang relevan sudah ditambahkan atau diperbarui.
- [ ] `npm run check` berhasil.
- [ ] Dokumentasi diperbarui jika diperlukan.
