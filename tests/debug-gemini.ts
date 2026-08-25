import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

async function debug() {
  const prompt = `
Ekstrak informasi transaksi keuangan dari kalimat bahasa Indonesia berikut: "Budget skincare 500rb bca".
Tanggal hari ini: 2026-08-25, Waktu sekarang: 12:25.

Jika teks menyatakan transaksi keuangan (misal pengeluaran/pemasukan/budget), isi:
- isReceiptOrTransaction: true
- type: "EXPENSE" | "INCOME" | "TRANSFER"
- amount: angka integer Rupiah (misal "50rb" -> 50000, "1.5jt" -> 1500000, "35k" -> 35000)
- date: "2026-08-25"
- time: "12:25"
- source: Sumber dana (misal BCA, Cash, GoPay, QRIS, dll. Jika tidak disebut, default "Cash / Lainnya")
- recipient: Nama merchant / toko / orang / keperluan
- category: Kategori
- notes: Rincian barang atau keperluan
- confidence: skor 0.0 - 1.0

Jika teks BUKAN transaksi keuangan, set isReceiptOrTransaction: false.
Keluarkan dalam format JSON.
`;

  try {
    const res = await model.generateContent(prompt);
    console.log('Raw Response:', res.response.text());
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

debug();
