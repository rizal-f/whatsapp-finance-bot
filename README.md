# 🤖 WhatsApp Finance Bot (Gemini Vision AI + Google Sheets)

Bot WhatsApp cerdas untuk mencatat dan mengelola keuangan pribadi secara otomatis dari foto struk belanja, screenshot bukti transfer/mutasi m-banking, struk QRIS, dan input teks, terintegrasi langsung dengan Google Spreadsheet.

---

## 🌟 Fitur Utama

- 📸 **Vision OCR Super Akurat (Gemini 2.5 Flash):** Membaca bukti transfer BCA, Livin Mandiri, BRImo, BNI, GoPay, OVO, ShopeePay, DANA, struk kasir Indomaret/Alfamart, dan struk parkir/SPBU.
- 🏷️ **Auto-Categorization:** AI otomatis mengelompokkan ke kategori: *Makanan & Minuman*, *Belanja Harian*, *Transportasi*, *Tagihan & Utilitas*, *Kesehatan*, *Hiburan*, *Pemasukan/Gaji*, dll.
- 📊 **Google Spreadsheet Auto Sync:** Mencatat data langsung ke Sheet `Transactions` beserta formula rekapitulasi.
- 💬 **Laporan Keuangan Interaktif di WhatsApp:**
  - `!laporan` -> Ringkasan pengeluaran & pemasukan bulanan + visual progress bar per kategori.
  - `!hari-ini` -> Daftar transaksi hari ini.
  - `!batal` -> Batalkan catatan transaksi terakhir (undo).
  - `!link` -> Kirim tautan Google Spreadsheet.
  - `!bantuan` -> Bantuan perintah bot.
- ⚡ **Input Teks Alami:** Bisa ketik biasa, contoh: *"Beli kopi 25rb bayar bca"* atau *"Gaji 5jt bca"*.
- 🔒 **Security Whitelist:** Bisa batasi bot hanya merespon nomor WhatsApp pemilik saja (`ALLOWED_NUMBERS`).

---

## 🚀 Panduan Instalasi & Penggunaan

- 📘 **[Panduan Setup Lokal: SETUP_GUIDE.md](./SETUP_GUIDE.md)**
- ☁️ **[Panduan Deploy Cloud 24/7 Gratis (Koyeb): KOYEB_DEPLOY_GUIDE.md](./KOYEB_DEPLOY_GUIDE.md)**

### Langkah Cepat (Quickstart):

```bash
# 1. Masuk ke folder proyek
cd whatsapp-finance-bot

# 2. Salin template konfigurasi
cp .env.example .env

# 3. Edit .env dan masukkan GEMINI_API_KEY, SPREADSHEET_ID, dan letakkan google-service-account.json di folder credentials/

# 4. Tes koneksi API
npm run test-gemini
npm run test-sheets

# 5. Jalankan bot WhatsApp
npm run dev
```

Scan QR code yang muncul di terminal menggunakan WhatsApp di ponsel Anda. Selesai! 🎉
