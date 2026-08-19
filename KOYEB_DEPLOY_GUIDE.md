# 🚀 PANDUAN DEPLOY BOT KE KOYEB (100% GRATIS 24/7)

Panduan langkah demi langkah untuk mendeploy **WhatsApp Finance Bot** ke platform cloud **Koyeb** agar bot aktif **24 jam nonstop** tanpa perlu menyalakan laptop/komputer.

---

## 📋 DAFTAR ISI
1. [Langkah 1: Push Proyek ke GitHub (Private Repository)](#langkah-1-push-proyek-ke-github-private-repository)
2. [Langkah 2: Daftar Akun di Koyeb.com](#langkah-2-daftar-akun-di-koyebcom)
3. [Langkah 3: Buat Service Baru di Koyeb](#langkah-3-buat-service-baru-di-koyeb)
4. [Langkah 4: Masukkan Environment Variables di Dashboard Koyeb](#langkah-4-masukkan-environment-variables-di-dashboard-koyeb)
5. [Langkah 5: Scan QR Code di Koyeb Logs & Selesai!](#langkah-5-scan-qr-code-di-koyeb-logs--selesai)

---

## Langkah 1: Push Proyek ke GitHub (Private Repository)

1. Buka browser dan login ke akun **[GitHub](https://github.com/)**.
2. Klik tombol **New** (atau ikon `+` di kanan atas) untuk membuat repository baru:
   - **Repository name:** `whatsapp-finance-bot`
   - **Visibility:** Pilih **Private** 🔒 *(PENTING: agar kode Anda tidak bisa dilihat orang lain)*.
   - Klik tombol **Create repository**.
3. Di terminal komputer Anda (VS Code), jalankan perintah berikut secara berurutan:
   ```bash
   cd /Users/rizal/Documents/MyProjects/whatsapp-finance-bot

   # Inisialisasi git
   git init
   git add .
   git commit -m "feat: setup whatsapp finance bot ready for koyeb"
   git branch -M main

   # Hubungkan ke repository GitHub Anda (ganti URL dengan URL repo Anda)
   git remote add origin https://github.com/USERNAME_ANDA/whatsapp-finance-bot.git
   git push -u origin main
   ```

---

## Langkah 2: Daftar Akun di Koyeb.com

1. Kunjungi website: **[https://www.koyeb.com/](https://www.koyeb.com/)**
2. Klik tombol **Sign Up**.
3. Pilih **Sign in with GitHub** (Gratis, tanpa perlu kartu kredit).
4. Beri izin (*Authorize*) Koyeb untuk mengakses repository GitHub Anda.

---

## Langkah 3: Buat Service Baru di Koyeb

1. Di dashboard utama Koyeb, klik tombol **Create Service** (atau **Create App**).
2. Pilih deployment method: **GitHub**.
3. Pilih repository Anda: **`whatsapp-finance-bot`**.
4. Di bagian **Builder**, pilih **Dockerfile** (otomatis terdeteksi).
5. Di bagian **Instance Type / Size**, pilih:
   - **`Nano` (Free Tier)**: 512 MB RAM, 0.1 vCPU ($0 / Bulan).
6. Di bagian **Regions**, pilih yang terdekat (misal: `Singapore (sin)` atau `Frankfurt (fra)`).

---

## Langkah 4: Masukkan Environment Variables di Dashboard Koyeb

Scroll ke bagian **Environment Variables** di halaman setup Koyeb, lalu tambahkan variabel berikut satu per satu:

| Key (Nama Variabel) | Value (Nilai) |
|---|---|
| `GEMINI_API_KEY` | *(Salin API Key Gemini Anda)* |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `SPREADSHEET_ID` | *(Salin Spreadsheet ID Google Sheet Anda)* |
| `ALLOWED_NUMBERS` | `628xxxxxxxxxx` *(Nomor WhatsApp Anda)* |
| `BOT_NAME` | `FinanceBot` |
| `COMMAND_PREFIX` | `!` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | *(Buka file credentials/google-service-account.json di VS Code komputer Anda, salin SELURUH isi teks JSON mulai dari `{` sampai `}`, lalu paste ke sini)* |

---

## Langkah 5: Scan QR Code di Koyeb Logs & Selesai!

1. Klik tombol **Deploy** di pojok kanan bawah.
2. Tunggu sekitar 1–2 menit sampai proses build selesai (status berubah menjadi **Healthy** / **Running**).
3. Klik menu tab **Logs** (atau **Runtime Logs**) di dashboard Koyeb.
4. Anda akan melihat **QR Code WhatsApp** tercetak di layar logs browser!
5. Buka aplikasi **WhatsApp di HP Anda**:
   - Masuk ke **Titik Tiga** / **Pengaturan** ➔ **Perangkat Tertaut** ➔ **Tautkan Perangkat**.
   - Arahkan kamera HP Anda ke QR Code yang ada di layar logs website Koyeb.
6. Dalam hitungan detik, logs akan menampilkan:
   ```
   🎉 FINANCEBOT BERHASIL TERHUBUNG KE WHATSAPP!
   ```

---

### 🎊 Selamat! Bot WhatsApp Anda Sekarang Aktif 24 Jam Nonstop!

- Anda sekarang bisa **mematikan laptop** Anda.
- Kapanpun Anda belanja atau transfer m-banking di luar rumah, cukup kirim foto bukti transaksi ke WhatsApp, bot di cloud Koyeb akan langsung mencatatnya secara realtime ke Google Spreadsheet Anda! 🚀
