import { config } from '../config/env.js';

async function listGeminiModels() {
  console.log('🔍 Mengambil daftar model Gemini yang tersedia untuk API Key Anda...');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiApiKey}`;

  try {
    const res = await fetch(url);
    const data: any = await res.json();

    if (data.error) {
      console.error('❌ Error dari Google API:', JSON.stringify(data.error, null, 2));
      return;
    }

    console.log('✅ Model yang didukung untuk API Key Anda:');
    const models = data.models || [];
    models
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .forEach((m: any) => {
        console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
      });
  } catch (err: any) {
    console.error('❌ Error fetch models:', err.message || err);
  }
}

listGeminiModels();
