import { WAMessage, WASocket, downloadMediaMessage } from '@whiskeysockets/baileys';
import { GeminiService } from '../services/gemini.service.js';
import { SheetsService } from '../services/sheets.service.js';
import { ReporterService } from '../services/reporter.service.js';
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
    senderJid: string
  ): Promise<void> {
    try {
      // 1. Beri respon awal bahwa gambar sedang dianalisis
      await sock.sendMessage(
        senderJid,
        {
          text: '⏳ *Sedang membaca struk / bukti transaksi...*\n_Mohon tunggu sebentar ya..._'
        },
        { quoted: msg }
      );

      // 2. Download buffer gambar dari WhatsApp
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
          senderJid,
          {
            text: '❌ Gagal mengunduh gambar bukti transaksi. Silakan kirim ulang gambarnya.'
          },
          { quoted: msg }
        );
        return;
      }

      // Deteksi mime type
      const rawMsg = msg.message;
      const inner =
        rawMsg?.viewOnceMessage?.message ||
        rawMsg?.viewOnceMessageV2?.message ||
        rawMsg?.ephemeralMessage?.message ||
        rawMsg;

      const mimeType =
        inner?.imageMessage?.mimetype ||
        inner?.documentMessage?.mimetype ||
        'image/jpeg';

      // 3. Ekstrak data transaksi dengan Gemini Vision AI
      const extracted = await this.geminiService.extractFromImage(buffer, mimeType);

      if (!extracted) {
        await sock.sendMessage(
          senderJid,
          {
            text: '⚠️ Gambar tidak terdeteksi sebagai bukti transaksi/struk pembayaran yang jelas.\n\nPastikan foto tidak buram, nominal transaksi dan nama merchant terlihat jelas.'
          },
          { quoted: msg }
        );
        return;
      }

      // 4. Simpan ke Google Spreadsheet
      const record = await this.sheetsService.appendTransaction(extracted);

      // 5. Kirim konfirmasi hasil pencatatan
      const replyMessage = this.reporterService.formatTransactionSavedMessage(record);
      await sock.sendMessage(senderJid, { text: replyMessage }, { quoted: msg });
    } catch (error: any) {
      logger.error({ error }, 'Error pada pemrosesan ImageHandler');
      await sock.sendMessage(
        senderJid,
        {
          text: `❌ Terjadi kesalahan saat memproses gambar transaksi:\n_${error.message || 'Unknown error'}_`
        },
        { quoted: msg }
      );
    }
  }
}
