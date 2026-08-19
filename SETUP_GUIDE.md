# 📘 PANDUAN LENGKAP SETUP BOT WHATSAPP KEUANGAN

Panduan langkah demi langkah untuk menyiapkan **Google Gemini API**, **Google Cloud Service Account (Google Sheets)**, dan **WhatsApp Bot**.

---

## 📑 DAFTAR ISI
1. [Langkah 1: Dapatkan Google Gemini API Key (Gratis - 1 Menit)](#1-dapatkan-google-gemini-api-key)
2. [Langkah 2: Buat Google Spreadsheet](#2-buat-google-spreadsheet)
3. [Langkah 3: Setup Google Cloud Service Account](#3-setup-google-cloud-service-account)
4. [Langkah 4: Bagikan Spreadsheet ke Service Account](#4-bagikan-spreadsheet-ke-service-account)
5. [Langkah 5: Konfigurasi File .env](#5-konfigurasi-file-env)
6. [Langkah 6: Uji Coba & Jalankan Bot WhatsApp](#6-uji-coba--jalankan-bot-whatsapp)

---

## 1. Dapatkan Google Gemini API Key
Gemini API digunakan untuk membaca foto struk, mutasi m-banking, dan mengkategorikan transaksi.

1. Buka browser dan kunjungi: **[https://aistudio.google.com/](https://aistudio.google.com/)**
2. Login dengan akun Google Anda.
3. Klik tombol biru **"Get API key"** di menu sebelah kiri atas.
4. Klik **"Create API key"** -> pilih **"Create API key in new project"** (atau pilih project yang ada).
5. Salin (copy) kode API Key yang muncul.
6. Simpan kode tersebut untuk diisikan ke file `.env` pada variabel `GEMINI_API_KEY`.

---

## 2. Buat Google Spreadsheet
Tempat semua data transaksi Anda akan disimpan dan dianalisis secara rapi.

1. Buka **[https://sheets.new](https://sheets.new)** di browser untuk membuat spreadsheet baru.
2. Beri nama spreadsheet Anda, misalnya: `Laporan Keuangan Pribadi`.
3. Perhatikan URL di address bar browser Anda:
   ```
   https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
   ```
4. **Spreadsheet ID** adalah deretan kode acak di antara `/d/` dan `/edit`.
   - Pada contoh di atas, ID-nya adalah: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`
5. Salin ID tersebut untuk diisikan ke file `.env` pada variabel `SPREADSHEET_ID`.

---

## 3. Setup Google Cloud Service Account
Service Account adalah "robot akun" resmi dari Google yang bertugas menulis dan membaca data di Google Sheet Anda secara otomatis tanpa perlu login manual.

1. Buka **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Di bagian atas layar, pilih atau buat Project baru (misal diberi nama `Finance-Bot`).
3. **Aktifkan Google Sheets API:**
   - Di kolom pencarian atas, ketik `Google Sheets API`.
   - Klik **Google Sheets API** dari hasil pencarian, lalu klik tombol **Enable (Aktifkan)**.
4. **Buat Service Account:**
   - Masuk ke menu **APIs & Services** > **Credentials** (Kredensial).
   - Klik tombol **+ CREATE CREDENTIALS** di bagian atas, lalu pilih **Service Account**.
   - Masukkan nama service account, misal: `finance-bot-service`.
   - Klik tombol **CREATE AND CONTINUE**, lalu klik **DONE** (bagian role bisa langsung dilewati).
5. **Download Kunci Kredensial JSON:**
   - Di halaman *Credentials*, klik email Service Account yang baru saja dibuat (berformat `finance-bot-service@xxx.iam.gserviceaccount.com`).
   - Masuk ke tab **KEYS** (di bagian atas).
   - Klik **ADD KEY** > **Create new key**.
   - Pilih format **JSON**, lalu klik **CREATE**.
   - File JSON akan otomatis terdownload ke komputer Anda.
6. **Pindahkan File Kunci ke Proyek:**
   - Ubah nama file yang baru terdownload tersebut menjadi: `google-service-account.json`
   - Pindahkan file tersebut ke dalam folder:
     ```
     whatsapp-finance-bot/credentials/google-service-account.json
     ```

---

## 4. Bagikan Spreadsheet ke Service Account (PENTING!)
Agar bot memiliki izin untuk menulis ke Google Sheet Anda:

1. Buka file `google-service-account.json` yang telah Anda download tadi dengan text editor / VS Code.
2. Cari baris `"client_email"`, contoh nilainya:
   ```json
   "client_email": "finance-bot-service@project-id-12345.iam.gserviceaccount.com"
   ```
3. Salin (copy) alamat email tersebut.
4. Buka kembali tab **Google Spreadsheet** yang Anda buat di Langkah 2.
5. Klik tombol **Bagikan (Share)** di pojok kanan atas.
6. Tempel (paste) alamat email service account tadi ke kolom input bagikan.
7. Pastikan role hak aksesnya dipilih sebagai **Editor**.
8. Hapus centang "Kirim notifikasi" (opsional), lalu klik **Bagikan (Share / Save)**.

---

## 5. Konfigurasi File .env

1. Di dalam folder `whatsapp-finance-bot`, copy file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
2. Buka file `.env` dan isi variabel yang dibutuhkan:
   ```env
   # Gemini API Key dari Langkah 1
   GEMINI_API_KEY=AIzaSyAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

   # Spreadsheet ID dari Langkah 2
   SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

   # Path kredensial (default sudah sesuai)
   GOOGLE_APPLICATION_CREDENTIALS=credentials/google-service-account.json

   # Nomor WhatsApp Anda untuk keamanan (gunakan format internasional 628xxx)
   ALLOWED_NUMBERS=6281234567890

   BOT_NAME="FinanceBot"
   COMMAND_PREFIX="!"
   ```

---

## 6. Uji Coba & Jalankan Bot WhatsApp

### A. Uji Koneksi Gemini AI
Jalankan script pengetesan Gemini AI untuk memastikan API Key aktif:
```bash
npm run test-gemini
```
*Jika berhasil, Gemini akan memproses contoh transaksi dalam hitungan detik.*

### B. Uji Koneksi Google Sheets
Jalankan script pengetesan Google Sheets untuk memastikan bot bisa menulis dan membaca sheet:
```bash
npm run test-sheets
```
*Jika berhasil, Anda akan melihat header tabel dan baris transaksi uji coba langsung muncul di Google Spreadsheet Anda!*

### C. Menjalankan Bot WhatsApp
Jalankan bot dengan perintah:
```bash
npm run dev
```

1. Di terminal akan muncul **QR Code**.
2. Buka aplikasi **WhatsApp di HP Anda**.
3. Masuk ke **Menu Titik Tiga (Android)** atau **Pengaturan (iPhone)** > **Perangkat Tertaut (Linked Devices)**.
4. Klik **Tautkan Perangkat** dan scan QR Code yang ada di terminal komputer.
5. Setelah terhubung, status di terminal akan menampilkan:
   ```
   🎉 FINANCEBOT BERHASIL TERHUBUNG KE WHATSAPP!
   ```

---

## 📱 CARA PENGGUNAAN DI WHATSAPP

### 1. Mencatat via Foto / Screenshot:
- Kirim foto struk belanja (Indomaret, Alfamart, restoran, SPBU, dll.)
- Kirim capture bukti transfer m-banking (BCA, Mandiri Livin, BRImo, BNI, Jago, Seabank, dll.)
- Kirim screenshot mutasi QRIS / e-wallet (GoPay, OVO, ShopeePay, DANA)
- Bot akan otomatis membaca nominal, merchant, tanggal, kategori, dan mencatatnya ke Google Sheet.

### 2. Mencatat via Teks Manual:
Ketik kalimat bebas di chat, contoh:
- `Makan siang warteg 25rb cash`
- `Beli bensin pertamax 50rb pake qris bca`
- `Terima pembayaran freelance 1.5jt di bca`

### 3. Perintah Rekap & Laporan:
- `!laporan` : Menampilkan ringkasan total pemasukan, pengeluaran, sisa kas, dan breakdown per kategori bulan ini.
- `!hari-ini` : Menampilkan semua transaksi hari ini.
- `!batal` : Membatalkan atau menghapus transaksi terakhir yang salah catat.
- `!link` : Mengirimkan link Google Spreadsheet Anda.
- `!bantuan` : Menampilkan panduan lengkap bot.
