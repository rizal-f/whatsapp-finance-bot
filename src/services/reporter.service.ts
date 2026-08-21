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

    const groupInfo = record.groupName && record.groupName !== 'Direct Message' ? `👥 *Grup:* ${record.groupName}\n` : '';
    const submitterInfo = record.submittedBy && record.submittedBy !== 'Pribadi' ? `👤 *Oleh:* ${record.submittedBy}\n` : '';
    const sheetInfo = record.targetSheet ? `📑 *Sheet:* ${record.targetSheet}\n` : '';

    return `✅ *TRANSAKSI BERHASIL DICATAT*

${icon}
━━━━━━━━━━━━━━━━━━━━
💰 *Nominal:* ${formatRupiah(record.amount)}
${sheetInfo}🏷️ *Kategori:* ${record.category}
🏪 *Merchant / Toko:* ${record.recipient || '-'}
💳 *Sumber Dana:* ${record.source || '-'}
📅 *Tanggal:* ${formatDateIndonesian(record.date)} ${record.time ? `(${record.time})` : ''}
${submitterInfo}${groupInfo}📝 *Keterangan:* ${record.notes || '-'}
━━━━━━━━━━━━━━━━━━━━
🆔 _Ref: ${record.id}_
_Ketik *${config.commandPrefix}batal* dalam 2 menit jika ingin membatalkan transaksi ini._`;
  }

  /**
   * Format pesan ringkasan bulanan lengkap (per sheet atau gabungan)
   */
  public formatMonthlyReportMessage(summary: MonthlySummary, targetSheet?: string): string {
    const cashflowSign = summary.netCashflow >= 0 ? '🟢' : '🔴';
    const sheetHeader = targetSheet ? targetSheet.toUpperCase() : 'SEMUA SHEET';

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

    return `📊 *LAPORAN KEUANGAN: ${sheetHeader}*
📅 *Periode:* ${summary.period.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━

📈 *Total Pemasukan:*  ${formatRupiah(summary.totalIncome)}
📉 *Total Pengeluaran:* ${formatRupiah(summary.totalExpense)}
${cashflowSign} *Arus Kas Bersih:*   ${formatRupiah(summary.netCashflow)}
🔢 *Total Transaksi:*   ${summary.totalTransactions} transaksi

━━━━━━━━━━━━━━━━━━━━
🏷️ *Rincian Pengeluaran per Kategori:*

${categoryText}

━━━━━━━━━━━━━━━━━━━━
💡 _Gunakan tag spesifik seperti *${config.commandPrefix}laporan .istri* atau *${config.commandPrefix}laporan .belanja*_
🌐 _Data tersinkron otomatis ke Google Sheets._`;
  }

  /**
   * Format daftar pengeluaran hari ini (per sheet atau gabungan)
   */
  public formatTodayReportMessage(transactions: TransactionRecord[], targetSheet?: string): string {
    const todayStr = formatDateIndonesian(new Date().toISOString().slice(0, 10));
    const titleSheet = targetSheet ? ` - ${targetSheet}` : '';

    if (transactions.length === 0) {
      return `📅 *PENGELUARAN HARI INI${titleSheet} (${todayStr})*
━━━━━━━━━━━━━━━━━━━━
_Belum ada transaksi yang dicatat untuk sheet ini hari ini._

Kirim foto struk dengan caption tag (cth: \`.makan\`), atau ketik:
_\"Makan soto 25rb cash .makan\"_`;
    }

    let totalExpense = 0;
    let totalIncome = 0;

    const listText = transactions
      .map((tx, idx) => {
        if (tx.type === 'INCOME') totalIncome += tx.amount;
        else totalExpense += tx.amount;

        const icon = tx.type === 'INCOME' ? '🟢' : '🔴';
        const tag = tx.targetSheet ? ` [${tx.targetSheet}]` : '';
        return `${idx + 1}. ${icon} *${formatRupiah(tx.amount)}* - ${tx.recipient || tx.category}${tag}
   └ _${tx.notes || tx.source}_ ${tx.time ? `(${tx.time})` : ''}`;
      })
      .join('\n\n');

    return `📅 *TRANSAKSI HARI INI${titleSheet} (${todayStr})*
━━━━━━━━━━━━━━━━━━━━

${listText}

━━━━━━━━━━━━━━━━━━━━
🔴 *Total Pengeluaran:* ${formatRupiah(totalExpense)}
🟢 *Total Pemasukan:*   ${formatRupiah(totalIncome)}
📊 *Total Catatan:*     ${transactions.length} transaksi`;
  }

  /**
   * Peringatan jika pengiriman foto struk tidak menyertakan caption tag
   */
  public formatMissingTagErrorMessage(): string {
    return `⚠️ *MOHON SERTAKAN TAG SHEET PADA CAPTION FOTO*

Untuk memastikan data tercatat di tab yang tepat, setiap foto bukti/struk transaksi *wajib menyertakan caption tag* di bawah ini:

🏷️ *Pilihan Tag Sheet:*
• *.istri* ➔ Transaksi Istri
• *.suami* ➔ Transaksi Suami
• *.makan* ➔ Transaksi Makan
• *.belanja* ➔ Transaksi Belanja Bulanan
• *.tabungan* ➔ Tabungan

_Contoh:_ Kirim ulang foto struk dengan caption \`*.makan*\` atau \`*makan siang soto .suami*\``;
  }

  /**
   * Format bantuan daftar perintah
   */
  public formatHelpMessage(): string {
    const p = config.commandPrefix;
    return `🤖 *${config.botName.toUpperCase()} - ASISTEN KEUANGAN MULTI-SHEET*

Saya siap membantu mencatat transaksi ke dalam *5 Sheet* terpisah secara otomatis.

🏷️ *DAFTAR 5 SHEET & TAG SUFIKS:*
• *.istri* ➔ Sheet *Transaksi Istri*
• *.suami* ➔ Sheet *Transaksi Suami*
• *.makan* ➔ Sheet *Transaksi Makan*
• *.belanja* ➔ Sheet *Transaksi Belanja Bulanan*
• *.tabungan* ➔ Sheet *Tabungan*

📸 *Cara Pakai OCR Foto (Wajib Pakai Caption Tag):*
Kirim foto struk / screenshot m-banking dengan caption tag, contoh:
• Kirim foto struk dengan caption: \`.makan\`
• Kirim bukti transfer dengan caption: \`Transfer bulanan .istri\`

✍️ *Cara Pakai Input Teks Manual:*
Ketik transaksi diakhiri tag, contoh:
• _"Makan siang 25rb cash .makan"_
• _"Beli skincare 150rb bca .istri"_
• _"Beli bensin 50rb cash .suami"_
• _"Belanja bulanan superindo 350rb bca .belanja"_
• _"Nabung reksadana 500rb bca .tabungan"_

📋 *Daftar Perintah Laporan:*
• *${p}laporan* : Rekap gabungan semua sheet
• *${p}laporan .istri* : Rekap khusus Transaksi Istri
• *${p}laporan .makan* : Rekap khusus Transaksi Makan
• *${p}laporan .belanja* : Rekap khusus Belanja Bulanan
• *${p}hari-ini* : Transaksi hari ini (semua sheet)
• *${p}hari-ini .makan* : Transaksi hari ini khusus sheet makan
• *${p}batal* : Batalkan transaksi terakhir
• *${p}link* : Tampilkan link Google Spreadsheet`;
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
