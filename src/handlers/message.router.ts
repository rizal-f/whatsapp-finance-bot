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

// Cache nama grup agar tidak sering memanggil groupMetadata
const groupCache = new Map<string, { name: string; time: number }>();

async function resolveGroupName(sock: WASocket, groupJid: string): Promise<string> {
  const cached = groupCache.get(groupJid);
  if (cached && Date.now() - cached.time < 1000 * 60 * 30) {
    return cached.name;
  }
  try {
    const meta = await sock.groupMetadata(groupJid);
    const name = meta.subject || groupJid;
    groupCache.set(groupJid, { name, time: Date.now() });
    return name;
  } catch {
    return 'Grup WhatsApp';
  }
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

    const chatJid = msg.key.remoteJid;
    if (!chatJid) return;

    const isGroup = chatJid.endsWith('@g.us');

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

    // Identifikasi nomor dan nama pengirim asli (di grup vs DM)
    const participantJid = isGroup
      ? (msg.key.participant || (msg as any).participant || chatJid)
      : chatJid;

    const senderNumber = cleanPhoneNumber(participantJid);
    const senderName = msg.pushName || senderNumber;

    // Dapatkan nama grup jika dari grup
    const groupName = isGroup ? await resolveGroupName(sock, chatJid) : 'Direct Message';

    // 1. Filter Keamanan Grup (Hanya proses grup yang ada di ALLOWED_GROUPS)
    if (isGroup) {
      const isGroupAllowed = config.allowedGroups.length > 0 && config.allowedGroups.includes(chatJid);

      if (!isGroupAllowed) {
        // Pengecualian: Jika Owner (nomor terdaftar di ALLOWED_NUMBERS) mengetik !groupid untuk melihat ID grup
        const inner = unwrapMessage(msg.message);
        const text = (inner?.conversation || inner?.extendedTextMessage?.text || '').trim().toLowerCase();
        const p = config.commandPrefix;
        const isOwner = config.allowedNumbers.length === 0 || config.allowedNumbers.includes(senderNumber);

        if (isOwner && (text === `${p}groupid` || text === `${p}id` || text === '!groupid' || text === '!id')) {
          await this.textHandler.handleTextMessage(
            sock,
            msg,
            chatJid,
            participantJid,
            senderName,
            groupName,
            text,
            isGroup
          );
          return;
        }

        logger.debug({ chatJid, groupName, senderNumber }, 'Pesan grup diabaikan: Grup tidak terdaftar di ALLOWED_GROUPS');
        return;
      }
    }

    // 2. Filter Keamanan Nomor (Jika di DM dan ALLOWED_NUMBERS diisi)
    if (!isGroup && config.allowedNumbers.length > 0) {
      const isAllowed = config.allowedNumbers.includes(senderNumber);
      if (!isAllowed) {
        logger.warn({ senderNumber }, 'Pesan DM diabaikan: nomor pengirim tidak ada dalam ALLOWED_NUMBERS');
        return;
      }
    }

    const inner = unwrapMessage(msg.message);

    // Periksa apakah pesan mengandung gambar
    const isImage =
      !!inner?.imageMessage ||
      (!!inner?.documentMessage && String(inner.documentMessage.mimetype || '').startsWith('image/'));

    if (isImage) {
      logger.info({ senderNumber, senderName, isGroup, groupName }, 'Menerima pesan gambar bukti transaksi');
      await this.imageHandler.handleImageMessage(
        sock,
        msg,
        chatJid,
        participantJid,
        senderName,
        groupName
      );
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
      logger.info({ senderNumber, senderName, isGroup, text: textContent }, 'Menerima pesan teks');
      await this.textHandler.handleTextMessage(
        sock,
        msg,
        chatJid,
        participantJid,
        senderName,
        groupName,
        textContent,
        isGroup
      );
      return;
    }
  }
}
