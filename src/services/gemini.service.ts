import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ExtractedTransaction, ExtractedTransactionSchema } from '../types/transaction.js';
import { getCurrentDateISO, getCurrentTimeFormatted } from '../utils/formatter.js';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.modelName = config.geminiModel || 'gemini-1.5-flash';
  }

  private getModel(withJsonSchema: boolean = true) {
    if (withJsonSchema) {
      return this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              isReceiptOrTransaction: { type: SchemaType.BOOLEAN },
              type: {
                type: SchemaType.STRING,
                format: 'enum',
                enum: ['EXPENSE', 'INCOME', 'TRANSFER']
              },
              amount: { type: SchemaType.NUMBER },
              date: { type: SchemaType.STRING },
              time: { type: SchemaType.STRING },
              category: { type: SchemaType.STRING },
              source: { type: SchemaType.STRING },
              recipient: { type: SchemaType.STRING },
              notes: { type: SchemaType.STRING },
              confidence: { type: SchemaType.NUMBER }
            },
            required: [
              'isReceiptOrTransaction',
              'type',
              'amount',
              'date',
              'category',
              'source',
              'recipient',
              'notes',
              'confidence'
            ]
          }
        }
      });
    }

    return this.genAI.getGenerativeModel({
      model: this.modelName
    });
  }

  /**
   * Ekstraksi detail transaksi dari gambar (struk belanja fisik, screenshot m-banking, QRIS, e-wallet)
   */
  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<ExtractedTransaction | null> {
    const today = getCurrentDateISO();
    const nowTime = getCurrentTimeFormatted();

    const systemPrompt = `
Anda adalah asisten AI akuntan keuangan pribadi super teliti khusus transaksi Indonesia.
Tugas Anda adalah membaca dan mengekstrak informasi keuangan dari gambar yang diberikan (bisa berupa struk belanja kasir, screenshot aplikasi m-banking seperti BCA/Livin Mandiri/BRImo/BNI/Seabank/Jago, mutasi e-wallet GoPay/OVO/ShopeePay/DANA, bukti transfer, atau struk QRIS).

Panduan Ekstraksi:
1. isReceiptOrTransaction: Set true jika gambar adalah bukti pembayaran/transfer/struk/mutasi. Jika gambar bukan tentang keuangan/struk (misal selfie, meme, gambar acak), set false.
2. type:
   - "EXPENSE": Jika uang keluar, pembayaran belanja, pembayaran QRIS, debit, pembelian pulsa, tagihan, transfer keluar.
   - "INCOME": Jika uang masuk, transfer masuk, gaji, cashback masuk, top up saldo masuk.
   - "TRANSFER": Jika transfer pemindahan dana antar rekening pribadi.
3. amount: Ambil NOMINAL TOTAL AKHIR / TOTAL BAYAR yang dibayarkan dalam Rupiah bersih (angka integer murni tanpa titik, koma, atau Rp). Jika ada diskon/biaya admin, gunakan total akhir yang dibayarkan.
4. date: Tanggal transaksi dalam format "YYYY-MM-DD". Jika di gambar hanya ada tanggal tanpa tahun (cth: "18 Aug"), asumsikan tahun adalah ${today.slice(0, 4)}. Jika tanggal tidak terlihat sama sekali di gambar, gunakan default: "${today}".
5. time: Waktu transaksi dalam format "HH:mm" (24 jam). Jika tidak ada, gunakan default: "${nowTime}".
6. source: Bank / E-Wallet / Metode pembayaran yang dipakai pembayar (contoh: "BCA", "Mandiri", "BRI", "BNI", "GoPay", "OVO", "ShopeePay", "DANA", "QRIS", "Cash / Tunai").
7. recipient: Nama Toko, Merchant, Penerima Transfer, atau Perusahaan Tagihan (contoh: "Indomaret Point Kemang", "Kopi Kenangan", "PLN Prabayar", "Bpk. Bambang Pamungkas", "SPBU Pertamina 34-xxx").
8. category: Pilih kategori yang paling akurat dari daftar berikut:
   - "Makanan & Minuman"
   - "Belanja Harian & Supermarket"
   - "Transportasi & Bensin"
   - "Tagihan & Utilitas (Listrik/Air/Internet/Pulsa)"
   - "Hiburan, Hobi & Liburan"
   - "Kesehatan, Obat & Skincare"
   - "Pendidikan & Kursus"
   - "Keluarga & Donasi/Amal"
   - "Gaji & Pendapatan Utama"
   - "Pendapatan Pasif / Bisnis / Freelance"
   - "Transfer Saldo / Antar Rekening"
   - "Lain-lain"
9. notes: Rincian singkat barang/jasa yang dibeli atau catatan transfer (misal: "Beli beras 5kg & minyak goreng", "Makan siang 2 porsi bebek goreng", "Bayar tagihan listrik token 100rb").
10. confidence: Skor keyakinan pembacaan Anda dari 0.0 sampai 1.0 (misal: 0.95 untuk screenshot jelas, 0.6 untuk struk buram).

Keluarkan output dalam format JSON terstruktur sesuai skema.
`;

    try {
      const model = this.getModel(true);
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType
        }
      };

      const result = await model.generateContent([systemPrompt, imagePart]);
      const responseText = result.response.text().trim();
      logger.debug({ responseText }, 'Raw Gemini Vision Response');

      const parsedJson = JSON.parse(responseText);
      const validated = ExtractedTransactionSchema.safeParse(parsedJson);

      if (!validated.success) {
        logger.error({ errors: validated.error.format() }, 'Gagal validasi schema Gemini');
        return null;
      }

      if (!validated.data.isReceiptOrTransaction || validated.data.amount <= 0) {
        logger.warn('Gambar tidak terdeteksi sebagai bukti transaksi yang valid atau nominal 0');
        return null;
      }

      return validated.data;
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error saat mengekstrak transaksi via Gemini Vision');
      throw error;
    }
  }

  /**
   * Ekstraksi detail transaksi dari kalimat teks bebas
   * Contoh: "ngopi di starbucks 58000 bayar bca" atau "beli bensin 50rb cash tadi siang"
   */
  async extractFromText(textInput: string): Promise<ExtractedTransaction | null> {
    const today = getCurrentDateISO();
    const nowTime = getCurrentTimeFormatted();

    const prompt = `
Ekstrak informasi transaksi keuangan dari kalimat bahasa Indonesia berikut: "${textInput}".
Tanggal hari ini: ${today}, Waktu sekarang: ${nowTime}.

Jika teks menyatakan transaksi keuangan (misal pengeluaran/pemasukan), isi:
- isReceiptOrTransaction: true
- type: "EXPENSE" | "INCOME" | "TRANSFER"
- amount: angka integer Rupiah (misal "50rb" -> 50000, "1.5jt" -> 1500000, "35k" -> 35000)
- date: "${today}" (atau tanggal yang disebutkan)
- time: "${nowTime}"
- source: Sumber dana (misal BCA, Cash, GoPay, QRIS, dll. Jika tidak disebut, default "Cash / Lainnya")
- recipient: Nama merchant / toko / orang / keperluan
- category: Kategori yang sesuai ("Makanan & Minuman", "Belanja Harian & Supermarket", "Transportasi & Bensin", "Tagihan & Utilitas (Listrik/Air/Internet/Pulsa)", "Hiburan, Hobi & Liburan", "Kesehatan, Obat & Skincare", "Pendidikan & Kursus", "Keluarga & Donasi/Amal", "Gaji & Pendapatan Utama", "Pendapatan Pasif / Bisnis / Freelance", "Transfer Saldo / Antar Rekening", "Lain-lain")
- notes: Rincian barang atau keperluan
- confidence: skor 0.0 - 1.0

Jika teks BUKAN transaksi keuangan (misal cuma menyapa "halo", bertanya "siapa kamu", dll), set isReceiptOrTransaction: false.
`;

    try {
      const model = this.getModel(true);
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      const parsedJson = JSON.parse(responseText);
      const validated = ExtractedTransactionSchema.safeParse(parsedJson);

      if (!validated.success || !validated.data.isReceiptOrTransaction || validated.data.amount <= 0) {
        return null;
      }

      return validated.data;
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error saat mengekstrak transaksi via text input Gemini');
      return null;
    }
  }

  /**
   * Tanya jawab cerdas / analisis keuangan berdasarkan data sheet
   */
  async generateFinancialAdviceOrAnswer(
    userQuestion: string,
    financialContext: string
  ): Promise<string> {
    const prompt = `
Anda adalah asisten keuangan pribadi yang ramah, ringkas, dan cerdas di WhatsApp.
Berikut adalah data keuangan pengguna:
=== DATA KEUANGAN ===
${financialContext}
=====================

Pertanyaan pengguna: "${userQuestion}"

Instruksi:
- Jawab secara ringkas, to the point, dan gunakan format teks WhatsApp (gunakan *bold*, _italic_, bullet points).
- Berikan saran atau insight praktis jika diminta.
- Gunakan bahasa Indonesia yang santun, bersahabat, dan jelas.
`;

    try {
      const model = this.getModel(false);
      const result = await model.generateContent(prompt);
      return result.response.text().trim() || 'Maaf, saya tidak dapat memproses pertanyaan saat ini.';
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error saat generate financial advice Gemini');
      return 'Terjadi kendala saat menganalisis data keuangan Anda.';
    }
  }
}
