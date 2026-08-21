import { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { GeminiService } from '../services/gemini.service.js';
import { SheetsService } from '../services/sheets.service.js';
import { ReporterService } from '../services/reporter.service.js';
import { config } from '../config/env.js';
import { parseSheetTag } from '../types/transaction.js';
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

      // 3. Perintah Laporan Bulanan (bisa spesifik per sheet atau laporan komprehensif keluarga)
      if (
        lower.startsWith(`${p}laporan`) ||
        (!isGroup && lower.startsWith('laporan')) ||
        lower.includes('laporan bulan ini') ||
        lower.includes('rekap bulanan')
      ) {
        const { targetSheet } = parseSheetTag(text);
        const now = new Date();

        if (targetSheet) {
          // Laporan untuk Sheet Spesifik
          await sock.sendMessage(
            chatJid,
            { text: `📊 *Sedang menyusun laporan sheet '${targetSheet}' & analisis AI...*` }
          );

          const summary = await this.sheetsService.getMonthlySummary(
            now.getFullYear(),
            now.getMonth() + 1,
            targetSheet
          );
          const aiAnalysis = await this.geminiService.generateSingleSheetAnalysis(summary, targetSheet);
          const reportText = this.reporterService.formatMonthlyReportMessage(
            summary,
            targetSheet,
            aiAnalysis
          );
          await sock.sendMessage(chatJid, { text: reportText }, { quoted: msg });
        } else {
          // Laporan Komprehensif Seluruh Sheet Keluarga
          await sock.sendMessage(
            chatJid,
            { text: '📊 *Sedang menyusun laporan keuangan keluarga & analisis AI...*' }
          );

          const comprehensiveSummary = await this.sheetsService.getComprehensiveMonthlySummary(
            now.getFullYear(),
            now.getMonth() + 1
          );
          const aiAnalysis = await this.geminiService.generateMonthlyCashflowAnalysis(
            comprehensiveSummary
          );
          const reportText = this.reporterService.formatComprehensiveMonthlyReportMessage(
            comprehensiveSummary,
            aiAnalysis
          );
          await sock.sendMessage(chatJid, { text: reportText }, { quoted: msg });
        }
        return;
      }

      // 4. Perintah Laporan Hari Ini (bisa spesifik per sheet atau gabungan)
      if (
        lower.startsWith(`${p}hari-ini`) ||
        (!isGroup && lower.startsWith('hari ini')) ||
        lower.includes('pengeluaran hari ini') ||
        lower.includes('transaksi hari ini')
      ) {
        const { targetSheet } = parseSheetTag(text);
        const todayTxs = await this.sheetsService.getTodayTransactions(targetSheet || undefined);
        const reportText = this.reporterService.formatTodayReportMessage(
          todayTxs,
          targetSheet || undefined
        );
        await sock.sendMessage(chatJid, { text: reportText }, { quoted: msg });
        return;
      }

      // 5. Perintah Batal / Undo
      if (lower.startsWith(`${p}batal`) || lower.startsWith(`${p}undo`) || (!isGroup && lower.startsWith('batal'))) {
        const { targetSheet } = parseSheetTag(text);
        const success = await this.sheetsService.deleteLastTransaction(targetSheet || undefined);
        if (success) {
          await sock.sendMessage(
            chatJid,
            { text: `🗑️ *Catatan transaksi terakhir${targetSheet ? ` pada sheet '${targetSheet}'` : ''} berhasil dibatalkan dan dihapus.*` },
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
            text: `📊 *Google Spreadsheet Keuangan (5 Sheet):*\n\n🔗 ${sheetUrl}`
          },
          { quoted: msg }
        );
        return;
      }

      // 7. Coba ekstraksi sebagai transaksi manual lewat AI (cth: "makan soto 25rb cash .makan")
      const { targetSheet, cleanText } = parseSheetTag(text);

      if (targetSheet) {
        // Tag sheet valid ditemukan ➔ Proses ekstraksi
        const inputForAI = cleanText.startsWith(p) ? cleanText.slice(p.length) : cleanText;
        const extracted = await this.geminiService.extractFromText(inputForAI);
        if (extracted) {
          const submittedBy = senderName
            ? `${senderName} (${cleanPhoneNumber(senderJid)})`
            : cleanPhoneNumber(senderJid);
          const record = await this.sheetsService.appendTransaction(
            extracted,
            submittedBy,
            groupName,
            targetSheet
          );
          const replyMessage = this.reporterService.formatTransactionSavedMessage(record);
          await sock.sendMessage(chatJid, { text: replyMessage }, { quoted: msg });
          return;
        }
      }

      // 8. Jika input berupa transaksi tapi lupa menyertakan tag
      const looksLikeTransaction =
        lower.startsWith('catat') ||
        lower.startsWith('beli') ||
        lower.startsWith('bayar') ||
        lower.startsWith('makan') ||
        lower.startsWith('ngopi') ||
        lower.startsWith('isi bensin') ||
        lower.startsWith('transfer') ||
        lower.startsWith('gaji') ||
        lower.startsWith('nabung') ||
        /\b\d+\s*(?:rb|ribu|k|jt|juta)\b/i.test(text);

      if (looksLikeTransaction && !targetSheet) {
        await sock.sendMessage(
          chatJid,
          {
            text: `⚠️ *MOHON SERTAKAN TAG SHEET DI AKHIR PESAN*\n\nContoh:\n• _"${text} .makan"_\n• _"${text} .istri"_\n• _"${text} .suami"_\n• _"${text} .belanja"_\n• _"${text} .tabungan"_`
          },
          { quoted: msg }
        );
        return;
      }

      // 9. Jika berupa pertanyaan umum tentang keuangan di DM
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

      // 10. Default DM handler
      if (!isGroup) {
        await sock.sendMessage(
          chatJid,
          {
            text: `🤖 Kirim foto struk dengan caption tag (cth: \`.makan\`), ketik catatan transaksi (cth: _"Makan soto 25rb .makan"_), atau ketik *${p}bantuan* untuk panduan lengkap.`
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
