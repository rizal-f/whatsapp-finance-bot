import { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { GeminiService } from '../services/gemini.service.js';
import { SheetsService } from '../services/sheets.service.js';
import { ReporterService } from '../services/reporter.service.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class TextHandler {
  constructor(
    private geminiService: GeminiService,
    private sheetsService: SheetsService,
    private reporterService: ReporterService
  ) {}

  public async handleTextMessage(
    sock: WASocket,
    msg: WAMessage,
    senderJid: string,
    rawText: string
  ): Promise<void> {
    const text = rawText.trim();
    const lower = text.toLowerCase();
    const p = config.commandPrefix;

    try {
      // 1. Perintah Menu / Bantuan
      if (
        lower === `${p}bantuan` ||
        lower === `${p}help` ||
        lower === `${p}menu` ||
        lower === 'menu' ||
        lower === 'bantuan'
      ) {
        await sock.sendMessage(
          senderJid,
          { text: this.reporterService.formatHelpMessage() },
          { quoted: msg }
        );
        return;
      }

      // 2. Perintah Laporan Bulanan
      if (
        lower === `${p}laporan` ||
        lower === 'laporan' ||
        lower.includes('laporan bulan ini') ||
        lower.includes('rekap bulanan')
      ) {
        await sock.sendMessage(senderJid, { text: '📊 *Sedang menyusun laporan keuangan Anda...*' });
        const now = new Date();
        const summary = await this.sheetsService.getMonthlySummary(
          now.getFullYear(),
          now.getMonth() + 1
        );
        const reportText = this.reporterService.formatMonthlyReportMessage(summary);
        await sock.sendMessage(senderJid, { text: reportText }, { quoted: msg });
        return;
      }

      // 3. Perintah Laporan Hari Ini
      if (
        lower === `${p}hari-ini` ||
        lower === 'hari ini' ||
        lower.includes('pengeluaran hari ini') ||
        lower.includes('transaksi hari ini')
      ) {
        const todayTxs = await this.sheetsService.getTodayTransactions();
        const reportText = this.reporterService.formatTodayReportMessage(todayTxs);
        await sock.sendMessage(senderJid, { text: reportText }, { quoted: msg });
        return;
      }

      // 4. Perintah Batal / Undo
      if (lower === `${p}batal` || lower === `${p}undo` || lower === 'batal') {
        const success = await this.sheetsService.deleteLastTransaction();
        if (success) {
          await sock.sendMessage(
            senderJid,
            { text: '🗑️ *Catatan transaksi terakhir berhasil dibatalkan dan dihapus dari spreadsheet.*' },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            senderJid,
            { text: '⚠️ Tidak ada transaksi yang dapat dibatalkan.' },
            { quoted: msg }
          );
        }
        return;
      }

      // 5. Perintah Link Google Sheets
      if (lower === `${p}link` || lower === `${p}sheet` || lower === 'link') {
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`;
        await sock.sendMessage(
          senderJid,
          {
            text: `📊 *Google Spreadsheet Keuangan Anda:*\n\n🔗 ${sheetUrl}\n\n_Pastikan Google Sheet sudah di-share akses 'Editor' ke Service Account Google Cloud Anda._`
          },
          { quoted: msg }
        );
        return;
      }

      // 6. Coba ekstraksi sebagai transaksi manual lewat AI (cth: "makan soto 25rb cash")
      const extracted = await this.geminiService.extractFromText(text);
      if (extracted) {
        const record = await this.sheetsService.appendTransaction(extracted);
        const replyMessage = this.reporterService.formatTransactionSavedMessage(record);
        await sock.sendMessage(senderJid, { text: replyMessage }, { quoted: msg });
        return;
      }

      // 7. Jika berupa pertanyaan umum tentang keuangan/budgeting
      if (text.length > 5 && (lower.includes('?') || lower.includes('bagaimana') || lower.includes('apakah') || lower.includes('tips') || lower.includes('saran') || lower.includes('analisis'))) {
        const now = new Date();
        const summary = await this.sheetsService.getMonthlySummary(
          now.getFullYear(),
          now.getMonth() + 1
        );
        const context = `Bulan: ${summary.period}, Total Masuk: Rp ${summary.totalIncome}, Total Keluar: Rp ${summary.totalExpense}, Sisa: Rp ${summary.netCashflow}. Kategori: ${JSON.stringify(summary.categoryBreakdown)}`;
        const aiAnswer = await this.geminiService.generateFinancialAdviceOrAnswer(text, context);
        await sock.sendMessage(senderJid, { text: aiAnswer }, { quoted: msg });
        return;
      }

      // 8. Pesan tidak dikenali -> berikan petunjuk singkat
      await sock.sendMessage(
        senderJid,
        {
          text: `🤖 Kirim foto struk/screenshot transfer, ketik catatan transaksi (cth: _"Beli kopi 25rb cash"_), atau ketik *${p}bantuan* untuk melihat daftar perintah.`
        },
        { quoted: msg }
      );
    } catch (error: any) {
      logger.error({ error }, 'Error pada pemrosesan TextHandler');
      await sock.sendMessage(
        senderJid,
        {
          text: `❌ Terjadi kesalahan saat memproses pesan:\n_${error.message || 'Unknown error'}_`
        },
        { quoted: msg }
      );
    }
  }
}
