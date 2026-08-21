import { TransactionRecord, MonthlySummary, ComprehensiveMonthlySummary } from '../types/transaction.js';
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
   * Format laporan keuangan komprehensif seluruh 5 sheet dengan rincian per pos & analisis AI
   */
  public formatComprehensiveMonthlyReportMessage(
    summary: ComprehensiveMonthlySummary,
    aiAnalysis?: string
  ): string {
    const cashflowSign = summary.grandNetCashflow >= 0 ? '🟢' : '🔴';

    // Rincian per sheet
    const sheetsText = summary.sheetsBreakdown
      .map((s) => {
        let icon = '📁';
        if (s.sheetName.includes('Istri')) icon = '👩';
        else if (s.sheetName.includes('Suami')) icon = '👨';
        else if (s.sheetName.includes('Makan')) icon = '🍲';
        else if (s.sheetName.includes('Belanja')) icon = '🛒';
        else if (s.sheetName.includes('Tabungan')) icon = '💰';

        if (s.sheetName.includes('Tabungan')) {
          return `${icon} *${s.sheetName}:*
   └ 📥 Disimpan: *${formatRupiah(s.totalIncome + s.totalExpense)}* _[${s.totalTransactions}x]_`;
        }

        return `${icon} *${s.sheetName}:*
   ├ 🟢 Masuk : ${formatRupiah(s.totalIncome)}
   ├ 🔴 Keluar: ${formatRupiah(s.totalExpense)}
   └ 📊 Sisa  : *${formatRupiah(s.netCashflow)}* _[${s.totalTransactions}x]_`;
      })
      .join('\n\n');

    // Rincian kategori pengeluaran terbesar
    let categoryText = '';
    if (summary.categoryBreakdown.length > 0) {
      categoryText = summary.categoryBreakdown
        .slice(0, 5)
        .map((cat, idx) => {
          const bar = this.generateProgressBar(cat.percentage);
          return `${idx + 1}. *${cat.category}*\n   ├ 💰 ${formatRupiah(cat.total)} (${cat.percentage.toFixed(1)}%)\n   └ 📊 ${bar} _[${cat.count}x]_`;
        })
        .join('\n\n');
    } else {
      categoryText = '_Belum ada data pengeluaran di periode ini._';
    }

    const aiBlock = aiAnalysis
      ? `\n━━━━━━━━━━━━━━━━━━━━\n🤖 *ANALISIS & SARAN KEUANGAN KELUARGA:*\n\n${aiAnalysis}\n`
      : '';

    return `📊 *LAPORAN KEUANGAN KELUARGA*
📅 *Periode:* ${summary.period.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━

📑 *RINCIAN KEUANGAN PER SHEET:*

${sheetsText}

━━━━━━━━━━━━━━━━━━━━
📈 *TOTAL GABUNGAN KELUARGA:*
💵 *Total Pemasukan:*  ${formatRupiah(summary.grandTotalIncome)}
💸 *Total Pengeluaran:* ${formatRupiah(summary.grandTotalExpense)}
🏦 *Total Tabungan:*    ${formatRupiah(summary.grandTotalSavings)}
${cashflowSign} *Sisa Arus Kas:*     ${formatRupiah(summary.grandNetCashflow)}
🔢 *Total Transaksi:*    ${summary.grandTotalTransactions} transaksi

━━━━━━━━━━━━━━━━━━━━
🏷️ *Top 5 Kategori Pengeluaran:*

${categoryText}
${aiBlock}━━━━━━━━━━━━━━━━━━━━
💡 _Gunakan perintah seperti *${config.commandPrefix}laporan .istri* atau *${config.commandPrefix}laporan .belanja* untuk rincian sheet tertentu._
🌐 _Data tersinkron otomatis ke Google Sheets._`;
  }

  /**
   * Format pesan ringkasan bulanan untuk sheet tertentu
   */
  public formatMonthlyReportMessage(
    summary: MonthlySummary,
    targetSheet?: string,
    aiAnalysis?: string
  ): string {
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

    const aiBlock = aiAnalysis
      ? `\n━━━━━━━━━━━━━━━━━━━━\n🤖 *ANALISIS & SARAN AI:*\n\n${aiAnalysis}\n`
      : '';

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
${aiBlock}━━━━━━━━━━━━━━━━━━━━
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
