import { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { GeminiService } from '../services/gemini.service.js';
import { SheetsService } from '../services/sheets.service.js';
import { ReporterService } from '../services/reporter.service.js';
import { config } from '../config/env.js';
import { cleanPhoneNumber } from '../utils/formatter.js';
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
    chatJid: string,
    senderJid: string,
    senderName: string,
    groupName: string = 'Direct Message',
    rawText: string = '',
    isGroup: boolean = false
  ): Promise<void> {
    const text = rawText.trim();
    const lower = text.toLowerCase();
    const p = config.commandPrefix;

    try {
      // 1. Perintah ID Grup / Info
      if (
        lower === `${p}groupid` ||
        lower === `${p}id` ||
        lower === `${p}info`
      ) {
        const infoMsg = isGroup
          ? `👥 *INFORMASI GRUP WHATSAPP*\n━━━━━━━━━━━━━━━━━━━━\n🏷️ *Nama Grup:* ${groupName}\n🆔 *ID Grup:* \`${chatJid}\`\n👤 *Pengirim:* ${senderName} (${cleanPhoneNumber(senderJid)})`
          : `👤 *INFORMASI CHAT PRIBADI*\n━━━━━━━━━━━━━━━━━━━━\n🆔 *ID Anda:* \`${chatJid}\``;

        await sock.sendMessage(chatJid, { text: infoMsg }, { quoted: msg });
        return;
      }

      // 2. Perintah Menu / Bantuan
      if (
        lower === `${p}bantuan` ||
        lower === `${p}help` ||
        lower === `${p}menu` ||
        (!isGroup && (lower === 'menu' || lower === 'bantuan'))
      ) {
        await sock.sendMessage(
          chatJid,
          { text: this.reporterService.formatHelpMessage() },
          { quoted: msg }
        );
        return;
      }

      // 3. Perintah Laporan Bulanan
      if (
        lower === `${p}laporan` ||
        (!isGroup && lower === 'laporan') ||
        lower.includes('laporan bulan ini') ||
        lower.includes('rekap bulanan')
      ) {
        await sock.sendMessage(chatJid, { text: '📊 *Sedang menyusun laporan keuangan...*' });
        const now = new Date();
        const summary = await this.sheetsService.getMonthlySummary(
          now.getFullYear(),
          now.getMonth() + 1
        );
        const reportText = this.reporterService.formatMonthlyReportMessage(summary);
        await sock.sendMessage(chatJid, { text: reportText }, { quoted: msg });
        return;
      }

      // 4. Perintah Laporan Hari Ini
      if (
        lower === `${p}hari-ini` ||
        (!isGroup && lower === 'hari ini') ||
        lower.includes('pengeluaran hari ini') ||
        lower.includes('transaksi hari ini')
      ) {
        const todayTxs = await this.sheetsService.getTodayTransactions();
        const reportText = this.reporterService.formatTodayReportMessage(todayTxs);
        await sock.sendMessage(chatJid, { text: reportText }, { quoted: msg });
        return;
      }

      // 5. Perintah Batal / Undo
      if (lower === `${p}batal` || lower === `${p}undo` || (!isGroup && lower === 'batal')) {
        const success = await this.sheetsService.deleteLastTransaction();
        if (success) {
          await sock.sendMessage(
            chatJid,
            { text: '🗑️ *Catatan transaksi terakhir berhasil dibatalkan dan dihapus dari spreadsheet.*' },
            { quoted: msg }
          );
        } else {
          await sock.sendMessage(
            chatJid,
            { text: '⚠️ Tidak ada transaksi yang dapat dibatalkan.' },
            { quoted: msg }
          );
        }
        return;
      }

      // 6. Perintah Link Google Sheets
      if (lower === `${p}link` || lower === `${p}sheet` || (!isGroup && lower === 'link')) {
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`;
        await sock.sendMessage(
          chatJid,
          {
            text: `📊 *Google Spreadsheet Keuangan:*\n\n🔗 ${sheetUrl}`
          },
          { quoted: msg }
        );
        return;
      }

      // 7. Coba ekstraksi sebagai transaksi manual lewat AI (cth: "makan soto 25rb cash")
      const shouldTryExtract =
        !isGroup ||
        text.startsWith(p) ||
        lower.startsWith('catat') ||
        lower.startsWith('beli') ||
        lower.startsWith('bayar') ||
        lower.startsWith('makan') ||
        lower.startsWith('ngopi') ||
        lower.startsWith('isi bensin') ||
        lower.startsWith('transfer') ||
        lower.startsWith('gaji') ||
        lower.includes('rb') ||
        lower.includes('k') ||
        lower.includes('jt');

      if (shouldTryExtract) {
        const cleanInput = text.startsWith(p) ? text.slice(p.length) : text;
        const extracted = await this.geminiService.extractFromText(cleanInput);
        if (extracted) {
          const submittedBy = senderName
            ? `${senderName} (${cleanPhoneNumber(senderJid)})`
            : cleanPhoneNumber(senderJid);
          const record = await this.sheetsService.appendTransaction(
            extracted,
            submittedBy,
            groupName
          );
          const replyMessage = this.reporterService.formatTransactionSavedMessage(record);
          await sock.sendMessage(chatJid, { text: replyMessage }, { quoted: msg });
          return;
        }
      }

      // 8. Jika berupa pertanyaan umum tentang keuangan/budgeting di DM
      if (!isGroup && text.length > 5 && (lower.includes('?') || lower.includes('bagaimana') || lower.includes('apakah') || lower.includes('tips') || lower.includes('saran') || lower.includes('analisis'))) {
        const now = new Date();
        const summary = await this.sheetsService.getMonthlySummary(
          now.getFullYear(),
          now.getMonth() + 1
        );
        const context = `Bulan: ${summary.period}, Total Masuk: Rp ${summary.totalIncome}, Total Keluar: Rp ${summary.totalExpense}, Sisa: Rp ${summary.netCashflow}. Kategori: ${JSON.stringify(summary.categoryBreakdown)}`;
        const aiAnswer = await this.geminiService.generateFinancialAdviceOrAnswer(text, context);
        await sock.sendMessage(chatJid, { text: aiAnswer }, { quoted: msg });
        return;
      }

      // 9. Jika di DM dan pesan tidak dikenali -> berikan petunjuk singkat (Jangan respon di grup agar tidak spam)
      if (!isGroup) {
        await sock.sendMessage(
          chatJid,
          {
            text: `🤖 Kirim foto struk/screenshot transfer, ketik catatan transaksi (cth: _"Beli kopi 25rb cash"_), atau ketik *${p}bantuan* untuk melihat daftar perintah.`
          },
          { quoted: msg }
        );
      }
    } catch (error: any) {
      logger.error({ error }, 'Error pada pemrosesan TextHandler');
      await sock.sendMessage(
        chatJid,
        {
          text: `❌ Terjadi kesalahan saat memproses pesan:\n_${error.message || 'Unknown error'}_`
        },
        { quoted: msg }
      );
    }
  }
}
