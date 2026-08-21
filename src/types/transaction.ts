import { z } from 'zod';

export const TransactionTypeSchema = z.enum(['EXPENSE', 'INCOME', 'TRANSFER']);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const StandardCategorySchema = z.enum([
  'Makanan & Minuman',
  'Belanja Harian & Supermarket',
  'Transportasi & Bensin',
  'Tagihan & Utilitas (Listrik/Air/Internet/Pulsa)',
  'Hiburan, Hobi & Liburan',
  'Kesehatan, Obat & Skincare',
  'Pendidikan & Kursus',
  'Keluarga & Donasi/Amal',
  'Gaji & Pendapatan Utama',
  'Pendapatan Pasif / Bisnis / Freelance',
  'Transfer Saldo / Antar Rekening',
  'Lain-lain'
]);
export type StandardCategory = z.infer<typeof StandardCategorySchema>;

export const TARGET_SHEETS = {
  ISTRI: 'Transaksi Istri',
  SUAMI: 'Transaksi Suami',
  MAKAN: 'Transaksi Makan',
  BELANJA_BULANAN: 'Transaksi Belanja Bulanan',
  TABUNGAN: 'Tabungan'
} as const;

export type TargetSheetName = typeof TARGET_SHEETS[keyof typeof TARGET_SHEETS];

export const ALL_TARGET_SHEETS: TargetSheetName[] = [
  TARGET_SHEETS.ISTRI,
  TARGET_SHEETS.SUAMI,
  TARGET_SHEETS.MAKAN,
  TARGET_SHEETS.BELANJA_BULANAN,
  TARGET_SHEETS.TABUNGAN
];

export const SHEET_TAG_MAPPINGS: Record<string, TargetSheetName> = {
  '.istri': TARGET_SHEETS.ISTRI,
  'istri': TARGET_SHEETS.ISTRI,
  '.suami': TARGET_SHEETS.SUAMI,
  'suami': TARGET_SHEETS.SUAMI,
  '.makan': TARGET_SHEETS.MAKAN,
  'makan': TARGET_SHEETS.MAKAN,
  '.belanja': TARGET_SHEETS.BELANJA_BULANAN,
  'belanja': TARGET_SHEETS.BELANJA_BULANAN,
  '.bulanan': TARGET_SHEETS.BELANJA_BULANAN,
  'bulanan': TARGET_SHEETS.BELANJA_BULANAN,
  '.belanjabulanan': TARGET_SHEETS.BELANJA_BULANAN,
  'belanjabulanan': TARGET_SHEETS.BELANJA_BULANAN,
  '.tabungan': TARGET_SHEETS.TABUNGAN,
  'tabungan': TARGET_SHEETS.TABUNGAN,
  '.nabung': TARGET_SHEETS.TABUNGAN,
  'nabung': TARGET_SHEETS.TABUNGAN
};

/**
 * Mengekstrak tag sufiks (cth: .istri, .suami, .makan, .belanja, .tabungan) dari teks/caption
 */
export function parseSheetTag(text: string): {
  targetSheet: TargetSheetName | null;
  cleanText: string;
  tagFound?: string;
} {
  if (!text || text.trim() === '') {
    return { targetSheet: null, cleanText: '' };
  }

  const trimmed = text.trim();
  // Regex mencari token berawalan titik seperti .istri, .suami, .makan, .belanja, .bulanan, .tabungan di manapun dalam teks
  const tagRegex = /(?:^|\s)(\.(?:istri|suami|makan|belanja|bulanan|belanjabulanan|tabungan|nabung))\b/i;
  const match = trimmed.match(tagRegex);

  if (match) {
    const rawTag = match[1].toLowerCase();
    const targetSheet = SHEET_TAGMAPPINGS_LOOKUP(rawTag);
    const cleanText = trimmed.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
    return { targetSheet, cleanText, tagFound: rawTag };
  }

  // Cek kata kunci perintah langsung tanpa titik (cth: "!laporan belanja" atau "!laporan istri")
  const words = trimmed.split(/\s+/);
  for (const word of words) {
    const lower = word.toLowerCase().replace(/^[!.\/]/, '');
    if (SHEET_TAG_MAPPINGS[lower]) {
      const targetSheet = SHEET_TAG_MAPPINGS[lower];
      const cleanText = trimmed.replace(word, ' ').replace(/\s+/g, ' ').trim();
      return { targetSheet, cleanText, tagFound: `.${lower}` };
    }
  }

  return { targetSheet: null, cleanText: trimmed };
}

function SHEET_TAGMAPPINGS_LOOKUP(tag: string): TargetSheetName | null {
  const clean = tag.toLowerCase();
  return SHEET_TAG_MAPPINGS[clean] || null;
}

export const ExtractedTransactionSchema = z.object({
  type: TransactionTypeSchema.default('EXPENSE'),
  amount: z.number().describe('Nominal transaksi dalam angka bersih Rupiah tanpa titik/koma (misal 50000)'),
  date: z.string().describe('Format YYYY-MM-DD'),
  time: z.string().optional().describe('Format HH:mm (opsional)'),
  category: z.string().describe('Kategori pengeluaran atau pemasukan'),
  source: z.string().describe('Sumber dana atau bank/e-wallet pengirim (misal: BCA, Mandiri, GoPay, Cash, QRIS)'),
  recipient: z.string().describe('Nama toko / merchant / penerima transfer / pihak kedua'),
  notes: z.string().describe('Deskripsi singkat mengenai apa yang dibeli atau alasan transfer'),
  isReceiptOrTransaction: z.boolean().describe('True jika gambar atau teks memang merupakan bukti transaksi/struk valid, false jika bukan.'),
  confidence: z.number().min(0).max(1).describe('Skor keyakinan ekstraksi AI dari 0.0 sampai 1.0')
});

export type ExtractedTransaction = z.infer<typeof ExtractedTransactionSchema>;

export interface TransactionRecord extends ExtractedTransaction {
  id: string;
  timestamp: string; // Waktu saat data dimasukkan
  submittedBy?: string; // Nama / nomor pengirim
  groupName?: string; // Nama grup WhatsApp (atau 'Pribadi / DM')
  targetSheet?: string; // Nama sheet tujuan (cth: 'Transaksi Istri', 'Transaksi Suami', dll.)
  sheetRowIndex?: number;
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlySummary {
  period: string; // e.g. "Agustus 2026"
  year: number;
  month: number;
  targetSheet?: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  totalTransactions: number;
  categoryBreakdown: CategorySummary[];
  recentTransactions: TransactionRecord[];
}

export interface SheetSummaryItem {
  sheetName: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  totalTransactions: number;
}

export interface ComprehensiveMonthlySummary {
  period: string; // e.g. "Agustus 2026"
  year: number;
  month: number;
  grandTotalIncome: number;
  grandTotalExpense: number;
  grandTotalSavings: number;
  grandNetCashflow: number;
  grandTotalTransactions: number;
  sheetsBreakdown: SheetSummaryItem[];
  categoryBreakdown: CategorySummary[];
  recentTransactions: TransactionRecord[];
}
