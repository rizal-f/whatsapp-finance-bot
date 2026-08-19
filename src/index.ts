import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import http from 'http';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { config, validateConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import { GeminiService } from './services/gemini.service.js';
import { SheetsService } from './services/sheets.service.js';
import { ReporterService } from './services/reporter.service.js';
import { ImageHandler } from './handlers/image.handler.js';
import { TextHandler } from './handlers/text.handler.js';
import { MessageRouter } from './handlers/message.router.js';

// Server HTTP sederhana untuk Health Check Cloud (Koyeb / Render / Fly.io)
function startHealthCheckServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          bot: config.botName,
          uptime: Math.floor(process.uptime()),
          time: new Date().toISOString()
        })
      );
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(config.port, '0.0.0.0', () => {
    logger.info(`HTTP Health Check Server aktif di port ${config.port}`);
  });
}

async function startBot() {
  console.log('\n======================================================');
  console.log(`🚀 MEMULAI ${config.botName.toUpperCase()} (WHATSAPP FINANCIAL ASSISTANT)`);
  console.log('======================================================\n');

  // Jalankan health check server untuk cloud hosting
  startHealthCheckServer();

  // 1. Validasi konfigurasi awal
  const validation = validateConfig();
  if (!validation.valid) {
    logger.warn('⚠️ Konfigurasi belum lengkap:');
    validation.errors.forEach((err) => console.log(`   ❌ ${err}`));
    console.log('\n👉 Silakan ikuti petunjuk setup di file panduan: SETUP_GUIDE.md');
    console.log('👉 Lengkapi file .env atau Environment Variables di Cloud Dashboard\n');
  }

  // 2. Inisialisasi Service
  let geminiService: GeminiService | null = null;
  let sheetsService: SheetsService | null = null;

  if (config.geminiApiKey) {
    geminiService = new GeminiService();
    logger.info('Gemini AI Service siap.');
  }

  const hasCreds =
    (config.googleCredentialsJson && config.googleCredentialsJson.length > 10) ||
    fs.existsSync(config.googleCredentialsPath);

  if (config.spreadsheetId && hasCreds) {
    try {
      sheetsService = new SheetsService();
      await sheetsService.init();
    } catch (err: any) {
      logger.error({ err: err.message }, 'Gagal menghubungkan Google Sheets API');
    }
  }

  const reporterService = new ReporterService();

  // 3. Setup Handler & Router
  const imageHandler = new ImageHandler(
    geminiService || (new GeminiService() as any),
    sheetsService || (new SheetsService() as any),
    reporterService
  );

  const textHandler = new TextHandler(
    geminiService || (new GeminiService() as any),
    sheetsService || (new SheetsService() as any),
    reporterService
  );

  const messageRouter = new MessageRouter(imageHandler, textHandler);

  // 4. Inisialisasi Baileys WhatsApp Session
  const sessionDir = path.resolve(process.cwd(), 'sessions');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Menggunakan Baileys WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);

  // Socket Baileys dengan konfigurasi stabil
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }) as any,
    browser: Browsers.macOS('Desktop'),
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 500
  });

  // Event QR Code & Koneksi
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📲 SILAKAN SCAN QR CODE INI DENGAN WHATSAPP DI PONSEL ANDA:');
      console.log('(Buka WhatsApp di HP > Pengaturan / Titik 3 > Perangkat Tertaut > Tautkan Perangkat)\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      logger.warn(
        { reason: lastDisconnect?.error },
        `Koneksi WhatsApp terputus. Mencoba menghubungkan kembali: ${shouldReconnect}`
      );
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        logger.error('Session WhatsApp telah keluar (logged out). Silakan hapus folder sessions/ dan jalankan ulang bot.');
      }
    } else if (connection === 'open') {
      console.log('\n✅ ======================================================');
      console.log(`🎉 ${config.botName.toUpperCase()} BERHASIL TERHUBUNG KE WHATSAPP!`);
      console.log('Siap menerima struk belanja, capture m-banking, dan perintah chat.');
      console.log('======================================================\n');
    }
  });

  // Simpan update kredensial autentikasi WhatsApp
  sock.ev.on('creds.update', saveCreds);

  // Event pesan masuk
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        // Abaikan pesan jika dikirim oleh bot sendiri (kecuali Anda ingin test kirim ke nomor sendiri)
        // Baileys menandai pesan keluar dengan msg.key.fromMe = true
        // Untuk kemudahan testing pribadi (chat ke nomor sendiri / "Message yourself"), kita izinkan jika dari diri sendiri
        await messageRouter.routeMessage(sock, msg);
      }
    } catch (error) {
      logger.error({ error }, 'Error saat memproses messages.upsert');
    }
  });
}

// Tangani uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection terdeteksi');
});

startBot().catch((err) => {
  logger.error({ err }, 'Fatal error saat memulai bot');
});
