import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: 'gemini-3.5-flash-lite',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.1,
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ['EXPENSE', 'INCOME', 'TRANSFER'] },
        amount: { type: SchemaType.INTEGER },
        date: { type: SchemaType.STRING },
        time: { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
        source: { type: SchemaType.STRING },
        recipient: { type: SchemaType.STRING },
        notes: { type: SchemaType.STRING },
        isReceiptOrTransaction: { type: SchemaType.BOOLEAN },
        confidence: { type: SchemaType.NUMBER }
      },
      required: [
        'type',
        'amount',
        'date',
        'category',
        'source',
        'recipient',
        'notes',
        'isReceiptOrTransaction',
        'confidence'
      ]
    }
  }
});

async function testPrompt() {
  const inputs = [
    'Budget skincare 500rb bca',
    'Masuk Uang bensin 300rb cash',
    'Beli seblak 25rb cash'
  ];

  for (const input of inputs) {
    console.log(`\nTesting: "${input}"`);
    const prompt = `
Ekstrak informasi transaksi keuangan dari kalimat bahasa Indonesia berikut: "${input}".
Tanggal hari ini: 2026-08-25, Waktu sekarang: 12:28.

Instruksi:
1. Jika teks menyatakan pemasukan uang, budget masuk, top up, gaji, atau uang masuk (misal: "budget skincare", "masuk uang", "pemasukan"):
   - type: "INCOME"
   - amount: nominal bersih dalam angka Rupiah
2. Jika teks menyatakan belanja, beli, bayar, jajan, pengeluaran:
   - type: "EXPENSE"
   - amount: nominal bersih dalam angka Rupiah
3. isReceiptOrTransaction: true
4. source: sumber dana (misal BCA, Cash, dll.)
5. recipient: nama keperluan/toko/penerima
6. category: kategori
7. notes: keterangan
8. confidence: 0.95
`;

    try {
      const res = await model.generateContent(prompt);
      console.log('Result JSON:', res.response.text());
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  }
}

testPrompt();
