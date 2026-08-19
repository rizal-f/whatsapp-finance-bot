import { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { ImageHandler } from './image.handler.js';
import { TextHandler } from './text.handler.js';
import { config } from '../config/env.js';
import { cleanPhoneNumber } from '../utils/formatter.js';
import { logger } from '../utils/logger.js';

function unwrapMessage(message: any): any {
  let m = message;
  while (
    m?.viewOnceMessage?.message ||
    m?.viewOnceMessageV2?.message ||
    m?.viewOnceMessageV2Extension?.message ||
    m?.ephemeralMessage?.message ||
    m?.documentWithCaptionMessage?.message
  ) {
    m =
      m?.viewOnceMessage?.message ||
      m?.viewOnceMessageV2?.message ||
      m?.viewOnceMessageV2Extension?.message ||
      m?.ephemeralMessage?.message ||
      m?.documentWithCaptionMessage?.message;
  }
  return m || message;
}

export class MessageRouter {
  constructor(
    private imageHandler: ImageHandler,
    private textHandler: TextHandler
  ) {}

  public async routeMessage(sock: WASocket, msg: WAMessage): Promise<void> {
    // Abaikan pesan status / broadcast
    if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
      return;
    }

    const senderJid = msg.key.remoteJid;
    if (!senderJid) return;

    // Hindari loop: abaikan pesan hasil balasan bot sendiri
    if (msg.key.fromMe) {
      const inner = unwrapMessage(msg.message);
      const text = inner?.conversation || inner?.extendedTextMessage?.text || '';
      if (
        text.startsWith('✅') ||
        text.startsWith('📊') ||
        text.startsWith('⏳') ||
        text.startsWith('🤖') ||
        text.startsWith('❌') ||
        text.startsWith('⚠️') ||
        text.startsWith('🗑️')
      ) {
        return;
      }
    }

    // Nomor pengirim
    const senderNumber = cleanPhoneNumber(senderJid);

    // Keamanan: Filter nomor yang diizinkan (jika dikonfigurasi di ALLOWED_NUMBERS)
    if (config.allowedNumbers.length > 0) {
      const isAllowed = config.allowedNumbers.includes(senderNumber);
      if (!isAllowed) {
        logger.warn({ senderNumber }, 'Pesan diabaikan: nomor pengirim tidak ada dalam ALLOWED_NUMBERS');
        return;
      }
    }

    const inner = unwrapMessage(msg.message);

    // Periksa apakah pesan mengandung gambar (langsung atau via dokumen gambar)
    const isImage =
      !!inner?.imageMessage ||
      (!!inner?.documentMessage && String(inner.documentMessage.mimetype || '').startsWith('image/'));

    if (isImage) {
      logger.info({ senderNumber }, 'Menerima pesan gambar dari WhatsApp');
      await this.imageHandler.handleImageMessage(sock, msg, senderJid);
      return;
    }

    // Periksa apakah pesan mengandung teks
    const textContent =
      inner?.conversation ||
      inner?.extendedTextMessage?.text ||
      inner?.imageMessage?.caption ||
      inner?.documentMessage?.caption ||
      '';

    if (textContent.trim()) {
      logger.info({ senderNumber, text: textContent }, 'Menerima pesan teks dari WhatsApp');
      await this.textHandler.handleTextMessage(sock, msg, senderJid, textContent);
      return;
    }
  }
}
