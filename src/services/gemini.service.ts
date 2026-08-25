import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  ExtractedTransaction,
  ExtractedTransactionSchema,
  ComprehensiveMonthlySummary,
  MonthlySummary
} from '../types/transaction.js';
import { getCurrentDateISO, getCurrentTimeFormatted } from '../utils/formatter.js';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private fallbackModels: string[];

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    // Daftar model prioritas dengan fallback otomatis jika terjadi 429 / quota limit
    const configured = config.geminiModel;
    const defaults = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite'
    ];
    this.fallbackModels = Array.from(new Set([configured, ...defaults])).filter(Boolean);
  }

  private getModelForName(modelName: string, withJsonSchema: boolean = true) {
    if (withJsonSchema) {
      return this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              isReceiptOrTransaction: { type: SchemaType.BOOLEAN },
              type: {
                type: SchemaType.STRING,
                format: 'enum',
                enum: ['EXPENSE', 'INCOME', 'TRANSFER']
              },
              amount: { type: SchemaType.INTEGER },
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
      model: modelName,
      generationConfig: {
        temperature: 0.2
      }
    });
  }

  /**
   * Ekstraksi detail transaksi dari gambar (foto struk / mutasi bank / QRIS)
   */
  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/jpeg'
  ): Promise<ExtractedTransaction | null> {
    const today = getCurrentDateISO();
    const nowTime = getCurrentTimeFormatted();

    const systemPrompt = `
Anda adalah AI OCR Akuntan Keuangan Khusus Indonesia yang sangat teliti.
Tugas Anda: Analisis foto bukti pembayaran, struk kasir, mutasi m-banking, QRIS, e-wallet, atau transfer dana.

ATURAN EKSTRAKSI:
1. isReceiptOrTransaction: Set true jika ini adalah struk belanja, nota, bukti transfer, screenshot mutasi/e-wallet, atau invoice. Set false jika foto acak/bukan bukti transaksi.
2. type:
   - "EXPENSE": Jika pembelian barang/jasa, belanja, bayar tagihan, atau transfer keluar.
   - "INCOME": Jika ada bukti penerimaan uang, transfer masuk, gaji, atau saldo bertambah.
   - "TRANSFER": Jika transfer pemindahan dana pribadi antar rekening.
3. amount: Ambil NOMINAL TOTAL BAYAR / TOTAL AKHIR dalam Rupiah bersih (angka integer murni tanpa titik/koma).
4. date: Tanggal transaksi format "YYYY-MM-DD" (jika tidak terlihat, default "${today}").
5. time: Jam transaksi format "HH:mm" (24 jam, jika tidak ada default "${nowTime}").
6. source: Bank/E-Wallet pembayar (BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay, DANA, QRIS, Cash).
7. recipient: Nama Toko, Merchant, Penerima Transfer, atau Perusahaan.
8. category: Kategori yang sesuai ("Makanan & Minuman", "Belanja Harian & Supermarket", "Transportasi & Bensin", "Tagihan & Utilitas (Listrik/Air/Internet/Pulsa)", "Hiburan, Hobi & Liburan", "Kesehatan, Obat & Skincare", "Pendidikan & Kursus", "Keluarga & Donasi/Amal", "Gaji & Pendapatan Utama", "Pendapatan Pasif / Bisnis / Freelance", "Transfer Saldo / Antar Rekening", "Lain-lain").
9. notes: Rincian barang/jasa atau keperluan.
10. confidence: Skor keyakinan pembacaan dari 0.0 sampai 1.0.

Keluarkan dalam format JSON terstruktur.
`;

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType
      }
    };

    for (const modelName of this.fallbackModels) {
      try {
        const model = this.getModelForName(modelName, true);
        const result = await model.generateContent([systemPrompt, imagePart]);
        const responseText = result.response.text().trim();

        const parsedJson = JSON.parse(responseText);
        const validated = ExtractedTransactionSchema.safeParse(parsedJson);

        if (!validated.success || !validated.data.isReceiptOrTransaction || validated.data.amount <= 0) {
          logger.warn({ modelName }, 'Gambar tidak terdeteksi sebagai transaksi valid');
          return null;
        }

        return validated.data;
      } catch (error: any) {
        logger.warn({ modelName, error: error.message || error }, 'Gagal generate gambar dengan model, mencoba model fallback...');
      }
    }

    return null;
  }

  /**
   * Ekstraksi detail transaksi dari kalimat teks bebas
   * Contoh: "Budget skincare 500rb bca", "Masuk uang bensin 300rb cash", "beli kopi 25rb gopay"
   */
  async extractFromText(textInput: string): Promise<ExtractedTransaction | null> {
    const today = getCurrentDateISO();
    const nowTime = getCurrentTimeFormatted();

    const prompt = `
Ekstrak informasi transaksi keuangan dari kalimat bahasa Indonesia berikut: "${textInput}".
Tanggal hari ini: ${today}, Waktu sekarang: ${nowTime}.

PANDUAN TIPE & NOMINAL:
1. Jika kalimat menyatakan UANG MASUK, BUDGET MASUK, ALOKASI DANA, GAJI, TOPUP SALDO (misal: "Budget skincare", "Masuk uang bensin", "Uang jajan masuk", "Terima transfer", "Pemasukan"):
   - type: "INCOME"
   - isReceiptOrTransaction: true
2. Jika kalimat menyatakan PENGELUARAN, BELANJA, BAYAR, BELI, JAJAN, TARIK TUNAI (misal: "Beli kopi", "Makan soto", "Isi bensin", "Bayar tagihan"):
   - type: "EXPENSE"
   - isReceiptOrTransaction: true
3. amount: Nominal integer Rupiah (misal "500rb" -> 500000, "300rb" -> 300000, "50rb" -> 50000, "1.5jt" -> 1500000, "25k" -> 25000).
4. source: Sumber dana/bank/metode (BCA, Mandiri, BRI, BNI, Cash, GoPay, OVO, ShopeePay, DANA, QRIS. Jika tidak disebut, default "Cash / Lainnya").
5. recipient: Nama keperluan, toko, atau penerima.
6. category: Kategori yang sesuai ("Makanan & Minuman", "Belanja Harian & Supermarket", "Transportasi & Bensin", "Tagihan & Utilitas (Listrik/Air/Internet/Pulsa)", "Hiburan, Hobi & Liburan", "Kesehatan, Obat & Skincare", "Pendidikan & Kursus", "Keluarga & Donasi/Amal", "Gaji & Pendapatan Utama", "Pendapatan Pasif / Bisnis / Freelance", "Transfer Saldo / Antar Rekening", "Lain-lain").
7. notes: Keterangan barang atau keperluan.
8. confidence: Skor 0.8 - 1.0.

Jika teks BUKAN transaksi keuangan sama sekali, set isReceiptOrTransaction: false.
`;

    for (const modelName of this.fallbackModels) {
      try {
        const model = this.getModelForName(modelName, true);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        const parsedJson = JSON.parse(responseText);
        const validated = ExtractedTransactionSchema.safeParse(parsedJson);

        if (!validated.success || !validated.data.isReceiptOrTransaction || validated.data.amount <= 0) {
          logger.warn({ modelName, responseText }, 'Teks tidak lolos schema transaksi');
          continue;
        }

        return validated.data;
      } catch (error: any) {
        logger.warn({ modelName, error: error.message || error }, 'Gagal generate teks dengan model, mencoba model fallback...');
      }
    }

    return null;
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

    for (const modelName of this.fallbackModels) {
      try {
        const model = this.getModelForName(modelName, false);
        const result = await model.generateContent(prompt);
        return result.response.text().trim() || 'Maaf, saya tidak dapat memproses pertanyaan saat ini.';
      } catch (error: any) {
        logger.warn({ modelName, error: error.message || error }, 'Gagal generate financial advice dengan model');
      }
    }

    return 'Terjadi kendala saat menganalisis data keuangan Anda.';
  }

  /**
   * Menghasilkan analisis kesehatan cashflow dan saran praktis untuk laporan bulanan gabungan
   */
  public async generateMonthlyCashflowAnalysis(
    summary: ComprehensiveMonthlySummary
  ): Promise<string> {
    const prompt = `
Anda adalah seorang Financial Advisor Keluarga yang ramah, ringkas, dan solutif.
Berikut adalah rekap keuangan keluarga bulan ${summary.period}:

DATA RINGKASAN:
- Total Pemasukan: Rp ${summary.grandTotalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${summary.grandTotalExpense.toLocaleString('id-ID')}
- Sisa Saldo Arus Kas: Rp ${summary.grandNetCashflow.toLocaleString('id-ID')}

RINCIAN PER SHEET / POS KEUANGAN:
${summary.sheetsBreakdown
  .map(
    (s) =>
      `• ${s.sheetName}: Masuk Rp ${s.totalIncome.toLocaleString('id-ID')} | Keluar Rp ${s.totalExpense.toLocaleString('id-ID')} | Sisa Rp ${s.netCashflow.toLocaleString('id-ID')}`
  )
  .join('\n')}

TOP 3 KATEGORI PENGELUARAN TERBESAR:
${summary.categoryBreakdown
  .slice(0, 3)
  .map((c) => `• ${c.category}: Rp ${c.total.toLocaleString('id-ID')} (${c.percentage.toFixed(1)}%)`)
  .join('\n') || '- Belum ada pengeluaran'}

TUGAS:
Berikan analisis kesehatan keuangan dan saran singkat padat (maksimal 3 poin ringkas) dalam format WhatsApp yang enak dibaca:
1. 💡 *Kesehatan Cashflow:* (Beri status: SEHAT / WASPADA / PERLU EVALUASI dan rasio tabungan jika ada).
2. 🔍 *Insight Utama:* (Soroti pos/sheet mana yang menyerap dana paling banyak).
3. 🎯 *Saran Aksi Finansial:* (Beri 1-2 rekomendasi budgeting realistis untuk sisa bulan ini atau bulan depan).

Gunakan bahasa Indonesia yang ramah, santun, dan memotivasi. Jaga agar tidak terlalu panjang.
`;

    for (const modelName of this.fallbackModels) {
      try {
        const model = this.getModelForName(modelName, false);
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (error: any) {
        logger.warn({ modelName, error: error.message || error }, 'Gagal generate cashflow analysis dengan model');
      }
    }

    return '💡 *Kesehatan Cashflow:* Catatan keuangan telah tersimpan dengan rapi. Terus pertahankan kedisiplinan mencatat keuangan harian keluarga!';
  }

  /**
   * Menghasilkan analisis singkat untuk laporan sheet tunggal
   */
  public async generateSingleSheetAnalysis(
    summary: MonthlySummary,
    sheetName: string
  ): Promise<string> {
    const prompt = `
Anda adalah Financial Planner profesional.
Analisis data transaksi untuk sheet "${sheetName}" bulan ${summary.period}:
- Total Pemasukan: Rp ${summary.totalIncome.toLocaleString('id-ID')}
- Total Pengeluaran: Rp ${summary.totalExpense.toLocaleString('id-ID')}
- Arus Kas Bersih: Rp ${summary.netCashflow.toLocaleString('id-ID')}
- Top Kategori: ${summary.categoryBreakdown.slice(0, 3).map((c) => `${c.category} (${c.percentage.toFixed(1)}%)`).join(', ') || 'Belum ada'}

Berikan 1-2 kalimat analisa singkat dan 1 saran praktis untuk sheet ini. Format rapi WhatsApp dengan emoji.
`;

    for (const modelName of this.fallbackModels) {
      try {
        const model = this.getModelForName(modelName, false);
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (error: any) {
        logger.warn({ modelName, error: error.message || error }, 'Gagal generate single sheet analysis dengan model');
      }
    }

    return '';
  }
}
