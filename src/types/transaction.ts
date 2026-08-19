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
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  totalTransactions: number;
  categoryBreakdown: CategorySummary[];
  recentTransactions: TransactionRecord[];
}
