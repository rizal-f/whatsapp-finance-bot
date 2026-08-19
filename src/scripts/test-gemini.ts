import { GeminiService } from '../services/gemini.service.js';
import { config, validateConfig } from '../config/env.js';

async function testGemini() {
  console.log('🧪 Menguji koneksi Gemini AI...');

  if (!config.geminiApiKey) {
    console.error('❌ GEMINI_API_KEY belum diatur di file .env');
    process.exit(1);
  }

  try {
    const service = new GeminiService();
    const testSentence = 'Beli kopi janji jiwa 28000 bayar pake QRIS BCA barusan';
    console.log(`\nInput teks uji coba: "${testSentence}"`);
    console.log(`Mengirim ke Gemini (${config.geminiModel})...`);

    const result = await service.extractFromText(testSentence);

    if (result) {
      console.log('\n✅ Gemini Berhasil Mengekstrak Transaksi:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('⚠️ Gemini tidak mengembalikan hasil transaksi yang valid.');
    }
  } catch (error: any) {
    console.error('❌ Error detail saat memanggil Gemini:', error);
    if (error?.response) {
      console.error('Response data:', error.response);
    }
  }
}

testGemini();
