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

export const ISTRI_CATEGORIES = ['Jajan', 'Skincare', 'Darurat', 'Bensin'] as const;
export type IstriCategory = typeof ISTRI_CATEGORIES[number];

export const ISTRI_CATEGORY_TAGS: Record<string, IstriCategory> = {
  '/jajan': 'Jajan',
  'jajan': 'Jajan',
  '/skincare': 'Skincare',
  'skincare': 'Skincare',
  '/skin': 'Skincare',
  'skin': 'Skincare',
  '/darurat': 'Darurat',
  'darurat': 'Darurat',
  '/bensin': 'Bensin',
  'bensin': 'Bensin'
};

/**
 * Mengekstrak tag kategori khusus istri (cth: /jajan, /skincare, /darurat, /bensin)
 */
export function parseIstriCategory(text: string): {
  category: IstriCategory | null;
  cleanText: string;
  tagFound?: string;
} {
  if (!text || text.trim() === '') {
    return { category: null, cleanText: '' };
  }

  const trimmed = text.trim();
  // Regex mencari token berawalan slash seperti /jajan, /skincare, /skin, /darurat, /bensin
  const slashRegex = /(?:^|\s)(\/(?:jajan|skincare|skin|darurat|bensin))\b/i;
  const match = trimmed.match(slashRegex);

  if (match) {
    const rawTag = match[1].toLowerCase();
    const category = ISTRI_CATEGORY_TAGS[rawTag] || null;
    const cleanText = trimmed.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
    return { category, cleanText, tagFound: rawTag };
  }

  return { category: null, cleanText: trimmed };
}

export interface IstriPocketSummary {
  category: IstriCategory;
  initialBalance: number; // Saldo bawaan bulan lalu
  totalIncome: number;    // Pemasukan bulan ini
  totalExpense: number;   // Pengeluaran bulan ini
  netCashflow: number;    // Selisih bulan ini (Masuk - Keluar)
  finalBalance: number;   // Sisa saldo akhir (Saldo Awal + Masuk - Keluar)
  totalTransactions: number;
}

export interface IstriMonthlySummary extends MonthlySummary {
  pockets: IstriPocketSummary[];
}

export interface SheetSummaryItem {
  sheetName: string;
  initialBalance: number; // Saldo bawaan bulan lalu
  totalIncome: number;    // Pemasukan bulan ini
  totalExpense: number;   // Pengeluaran bulan ini
  netCashflow: number;    // Selisih bulan ini (Masuk - Keluar)
  finalBalance: number;   // Sisa saldo akhir (Saldo Awal + Masuk - Keluar)
  totalTransactions: number;
  istriPockets?: IstriPocketSummary[];
}

export interface MonthlySummary {
  period: string; // e.g. "Agustus 2026"
  year: number;
  month: number;
  targetSheet?: string;
  initialBalance: number; // Saldo bawaan bulan lalu
  totalIncome: number;    // Pemasukan bulan ini
  totalExpense: number;   // Pengeluaran bulan ini
  netCashflow: number;    // Selisih bulan ini (Masuk - Keluar)
  finalBalance: number;   // Sisa saldo akhir (Saldo Awal + Masuk - Keluar)
  totalTransactions: number;
  categoryBreakdown: CategorySummary[];
  recentTransactions: TransactionRecord[];
}

export interface ComprehensiveMonthlySummary {
  period: string; // e.g. "Agustus 2026"
  year: number;
  month: number;
  grandInitialBalance: number; // Total saldo awal gabungan bawaan bulan lalu
  grandTotalIncome: number;     // Total pemasukan bulan ini
  grandTotalExpense: number;    // Total pengeluaran bulan ini
  grandTotalSavings: number;
  grandNetCashflow: number;     // Selisih bulan ini (Total Masuk - Total Keluar)
  grandFinalBalance: number;    // Total saldo akhir (Saldo Awal + Masuk - Keluar)
  grandTotalTransactions: number;
  sheetsBreakdown: SheetSummaryItem[];
  categoryBreakdown: CategorySummary[];
  recentTransactions: TransactionRecord[];
}

/**
 * Parsing periode laporan (bulan & tahun) dari perintah pesan teks (cth: "!laporan agustus", "!laporan bulan-lalu", "!laporan 07-2026")
 */
export function parseReportPeriod(text: string): {
  year: number;
  month: number;
  cleanText: string;
  isSpecificPeriod: boolean;
} {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // default bulan saat ini
  let isSpecificPeriod = false;

  const trimmed = text.trim();

  // Cek kata kunci "bulan lalu" / "bulan-lalu" / "kemarin" / "last month" / "prev"
  const prevMonthRegex = /(?:^|\s)(?:bulan[\s-]lalu|kemarin|last[\s-]month|prev)\b/i;
  if (prevMonthRegex.test(trimmed)) {
    let prevMonth = now.getMonth(); // 0-11
    let prevYear = now.getFullYear();
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    return {
      year: prevYear,
      month: prevMonth,
      cleanText: trimmed.replace(prevMonthRegex, ' ').replace(/\s+/g, ' ').trim(),
      isSpecificPeriod: true
    };
  }

  // Cek pola angka tanggal seperti MM-YYYY, YYYY-MM, MM/YYYY (cth: "08-2026", "2026-08", "8/2026")
  const numMatch = trimmed.match(/\b(?:(\d{4})[-/](\d{1,2})|(\d{1,2})[-/](\d{4}))\b/);
  if (numMatch) {
    if (numMatch[1] && numMatch[2]) {
      year = parseInt(numMatch[1], 10);
      month = parseInt(numMatch[2], 10);
    } else if (numMatch[3] && numMatch[4]) {
      month = parseInt(numMatch[3], 10);
      year = parseInt(numMatch[4], 10);
    }
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return {
        year,
        month,
        cleanText: trimmed.replace(numMatch[0], ' ').replace(/\s+/g, ' ').trim(),
        isSpecificPeriod: true
      };
    }
  }

  // Cek nama bulan Indonesia dengan tahun opsional (cth: "agustus 2026", "juli", "januari 2025")
  const monthNamesMap: Record<string, number> = {
    januari: 1, jan: 1,
    februari: 2, feb: 2,
    maret: 3, mar: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, jun: 6,
    juli: 7, jul: 7,
    agustus: 8, agu: 8, agt: 8, ags: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10, oct: 10,
    november: 11, nov: 11,
    desember: 12, des: 12, dec: 12
  };

  const monthRegex = /\b(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|ags|september|sep|sept|oktober|okt|oct|november|nov|desember|des|dec)(?:\s+(\d{4}))?\b/i;
  const mMatch = trimmed.match(monthRegex);
  if (mMatch) {
    const mStr = mMatch[1].toLowerCase();
    if (monthNamesMap[mStr]) {
      month = monthNamesMap[mStr];
      if (mMatch[2]) {
        year = parseInt(mMatch[2], 10);
      }
      return {
        year,
        month,
        cleanText: trimmed.replace(mMatch[0], ' ').replace(/\s+/g, ' ').trim(),
        isSpecificPeriod: true
      };
    }
  }

  return {
    year,
    month,
    cleanText: trimmed,
    isSpecificPeriod: false
  };
}
