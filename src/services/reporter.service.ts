import { TransactionRecord, MonthlySummary } from '../types/transaction.js';
import { formatRupiah, formatDateIndonesian } from '../utils/formatter.js';
import { config } from '../config/env.js';

export class ReporterService {
  /**
   * Format pesan balasan saat transaksi berhasil dicatat dari foto/teks
   */
  public formatTransactionSavedMessage(record: TransactionRecord): string {
    const isIncome = record.type === 'INCOME';
    const isTransfer = record.type === 'TRANSFER';
    const icon = isIncome ? '🟢 *PEMASUKAN*' : isTransfer ? '🔄 *TRANSFER*' : '🔴 *PENGELUARAN*';

    return `✅ *TRANSAKSI BERHASIL DICATAT*

${icon}
━━━━━━━━━━━━━━━━━━━━
💰 *Nominal:* ${formatRupiah(record.amount)}
🏷️ *Kategori:* ${record.category}
🏪 *Merchant / Toko:* ${record.recipient || '-'}
💳 *Sumber Dana:* ${record.source || '-'}
📅 *Tanggal:* ${formatDateIndonesian(record.date)} ${record.time ? `(${record.time})` : ''}
📝 *Keterangan:* ${record.notes || '-'}
━━━━━━━━━━━━━━━━━━━━
🆔 _Ref: ${record.id}_
_Ketik *${config.commandPrefix}batal* dalam 2 menit jika ingin membatalkan transaksi ini._`;
  }

  /**
   * Format pesan ringkasan bulanan lengkap
   */
  public formatMonthlyReportMessage(summary: MonthlySummary): string {
    const cashflowSign = summary.netCashflow >= 0 ? '🟢' : '🔴';

    let categoryText = '';
    if (summary.categoryBreakdown.length > 0) {
      categoryText = summary.categoryBreakdown
        .map((cat, idx) => {
          const bar = this.generateProgressBar(cat.percentage);
          return `${idx + 1}. *${cat.category}*\n   ├ 💰 ${formatRupiah(cat.total)} (${cat.percentage.toFixed(1)}%)\n   └ 📊 ${bar} _[${cat.count}x]_`;
        })
        .join('\n\n');
    } else {
      categoryText = '_Belum ada data pengeluaran di periode ini._';
    }

    return `📊 *LAPORAN KEUANGAN: ${summary.period.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━

📈 *Total Pemasukan:*  ${formatRupiah(summary.totalIncome)}
📉 *Total Pengeluaran:* ${formatRupiah(summary.totalExpense)}
${cashflowSign} *Arus Kas Bersih:*   ${formatRupiah(summary.netCashflow)}
🔢 *Total Transaksi:*   ${summary.totalTransactions} transaksi

━━━━━━━━━━━━━━━━━━━━
🏷️ *Rincian Pengeluaran per Kategori:*

${categoryText}

━━━━━━━━━━━━━━━━━━━━
💡 _Ketik *${config.commandPrefix}hari-ini* untuk daftar pengeluaran hari ini._
🌐 _Data tersinkron otomatis ke Google Sheets._`;
  }

  /**
   * Format daftar pengeluaran hari ini
   */
  public formatTodayReportMessage(transactions: TransactionRecord[]): string {
    const todayStr = formatDateIndonesian(new Date().toISOString().slice(0, 10));

    if (transactions.length === 0) {
      return `📅 *PENGELUARAN HARI INI (${todayStr})*
━━━━━━━━━━━━━━━━━━━━
_Belum ada transaksi yang dicatat hari ini._

Kirim foto struk / screenshot m-banking, atau ketik langsung seperti:
_\"Makan soto 25rb cash\"_`;
    }

    let totalExpense = 0;
    let totalIncome = 0;

    const listText = transactions
      .map((tx, idx) => {
        if (tx.type === 'INCOME') totalIncome += tx.amount;
        else totalExpense += tx.amount;

        const icon = tx.type === 'INCOME' ? '🟢' : '🔴';
        return `${idx + 1}. ${icon} *${formatRupiah(tx.amount)}* - ${tx.recipient || tx.category}
   └ _${tx.notes || tx.source}_ ${tx.time ? `(${tx.time})` : ''}`;
      })
      .join('\n\n');

    return `📅 *TRANSAKSI HARI INI (${todayStr})*
━━━━━━━━━━━━━━━━━━━━

${listText}

━━━━━━━━━━━━━━━━━━━━
🔴 *Total Pengeluaran:* ${formatRupiah(totalExpense)}
🟢 *Total Pemasukan:*   ${formatRupiah(totalIncome)}
📊 *Total Catatan:*     ${transactions.length} transaksi`;
  }

  /**
   * Format bantuan daftar perintah
   */
  public formatHelpMessage(): string {
    const p = config.commandPrefix;
    return `🤖 *${config.botName.toUpperCase()} - ASISTEN KEUANGAN PRIBADI*

Saya siap membantu mencatat dan merekap keuangan Anda secara otomatis.

📸 *Cara Pakai OCR Gambar:*
Cukup kirim foto struk belanja, screenshot m-banking (BCA, Mandiri, BRI, BNI, Jago, Seabank), QRIS, atau mutasi e-wallet (GoPay, OVO, ShopeePay, DANA). AI akan otomatis membaca nominal, tanggal, merchant, dan kategorinya!

✍️ *Cara Pakai Input Teks Manual:*
Ketik kalimat bebas, contoh:
• _"Beli kopi kenangan 24rb pake gopay"_
• _"Isi bensin motor 35000 cash"_
• _"Gaji freelance masuk 2.5jt ke bca"_

📋 *Daftar Perintah:*
• *${p}laporan* : Lihat rekap keuangan bulan berjalan
• *${p}hari-ini* : Lihat semua transaksi hari ini
• *${p}batal* : Batalkan/hapus catatan transaksi terakhir
• *${p}link* : Tampilkan link Google Spreadsheet Anda
• *${p}bantuan* : Menampilkan pesan panduan ini`;
  }

  /**
   * Generate visual progress bar untuk persentase kategori
   */
  private generateProgressBar(percentage: number): string {
    const totalBlocks = 10;
    const filledBlocks = Math.min(totalBlocks, Math.max(0, Math.round((percentage / 100) * totalBlocks)));
    const emptyBlocks = totalBlocks - filledBlocks;
    return '🟩'.repeat(filledBlocks) + '⬜'.repeat(emptyBlocks);
  }
}
