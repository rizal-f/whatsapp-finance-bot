import { WAMessage, WASocket, downloadMediaMessage } from '@whiskeysockets/baileys';
import { GeminiService } from '../services/gemini.service.js';
import { SheetsService } from '../services/sheets.service.js';
import { ReporterService } from '../services/reporter.service.js';
import { parseSheetTag, parseIstriCategory, TARGET_SHEETS } from '../types/transaction.js';
import { cleanPhoneNumber } from '../utils/formatter.js';
import { logger } from '../utils/logger.js';

export class ImageHandler {
  constructor(
    private geminiService: GeminiService,
    private sheetsService: SheetsService,
    private reporterService: ReporterService
  ) {}

  public async handleImageMessage(
    sock: WASocket,
    msg: WAMessage,
    chatJid: string,
    senderJid: string,
    senderName: string,
    groupName: string = 'Direct Message'
  ): Promise<void> {
    try {
      const rawMsg = msg.message;
      const inner =
        rawMsg?.viewOnceMessage?.message ||
        rawMsg?.viewOnceMessageV2?.message ||
        rawMsg?.ephemeralMessage?.message ||
        rawMsg;

      const caption = (
        inner?.imageMessage?.caption ||
        inner?.documentMessage?.caption ||
        ''
      ).trim();

      // 1. Validasi Wajib Tag Sufiks pada Caption Foto (.istri, .suami, .makan, .belanja, .tabungan)
      const { targetSheet } = parseSheetTag(caption);

      if (!targetSheet) {
        logger.info({ senderName, chatJid, caption }, 'Foto struk ditolak: Tidak memiliki caption tag sheet yang valid');
        await sock.sendMessage(
          chatJid,
          { text: this.reporterService.formatMissingTagErrorMessage() },
          { quoted: msg }
        );
        return;
      }

      // 2. Validasi Khusus Transaksi Istri: Wajib menyertakan /jajan, /skincare, /bensin, /darurat
      let istriCategory: string | null = null;
      if (targetSheet === TARGET_SHEETS.ISTRI) {
        const parsedIstri = parseIstriCategory(caption);
        if (!parsedIstri.category) {
          logger.info({ senderName, chatJid, caption }, 'Foto struk Istri ditolak: Tidak menyertakan tag slash kategori (/jajan, /skincare, dll.)');
          await sock.sendMessage(
            chatJid,
            { text: this.reporterService.formatMissingIstriTagErrorMessage() },
            { quoted: msg }
          );
          return;
        }
        istriCategory = parsedIstri.category;
      }

      // 3. Beri respon awal bahwa gambar sedang dianalisis
      await sock.sendMessage(
        chatJid,
        {
          text: `⏳ *Sedang membaca struk untuk Sheet '${targetSheet}'${istriCategory ? ` (Pos: ${istriCategory})` : ''}...*\n_Mohon tunggu sebentar ya..._`
        },
        { quoted: msg }
      );

      // 4. Download buffer gambar dari WhatsApp
      const buffer = (await downloadMediaMessage(
        msg,
        'buffer',
        {},
        {
          logger: logger as any,
          reuploadRequest: sock.updateMediaMessage
        }
      )) as Buffer;

      if (!buffer || buffer.length === 0) {
        await sock.sendMessage(
          chatJid,
          {
            text: '❌ Gagal mengunduh gambar bukti transaksi. Silakan kirim ulang gambarnya.'
          },
          { quoted: msg }
        );
        return;
      }

      const mimeType =
        inner?.imageMessage?.mimetype ||
        inner?.documentMessage?.mimetype ||
        'image/jpeg';

      // 5. Ekstrak data transaksi dengan Gemini Vision AI
      const extracted = await this.geminiService.extractFromImage(buffer, mimeType);

      if (!extracted) {
        await sock.sendMessage(
          chatJid,
          {
            text: '⚠️ Gambar tidak terdeteksi sebagai bukti transaksi/struk pembayaran yang jelas.\n\nPastikan foto tidak buram, nominal transaksi dan nama merchant terlihat jelas.'
          },
          { quoted: msg }
        );
        return;
      }

      // Jika transaksi istri, pasang kategori khusus yang sudah dipilih (/jajan, /skincare, dll.)
      if (targetSheet === TARGET_SHEETS.ISTRI && istriCategory) {
        extracted.category = istriCategory;
      }

      // 6. Simpan ke Google Spreadsheet pada Tab Sheet yang Dituju
      const submittedBy = senderName ? `${senderName} (${cleanPhoneNumber(senderJid)})` : cleanPhoneNumber(senderJid);
      const record = await this.sheetsService.appendTransaction(extracted, submittedBy, groupName, targetSheet);

      // 7. Kirim konfirmasi hasil pencatatan
      const replyMessage = this.reporterService.formatTransactionSavedMessage(record);
      await sock.sendMessage(chatJid, { text: replyMessage }, { quoted: msg });
    } catch (error: any) {
      logger.error({ error }, 'Error pada pemrosesan ImageHandler');
      await sock.sendMessage(
        chatJid,
        {
          text: `❌ Terjadi kesalahan saat memproses gambar transaksi:\n_${error.message || 'Unknown error'}_`
        },
        { quoted: msg }
      );
    }
  }
}
