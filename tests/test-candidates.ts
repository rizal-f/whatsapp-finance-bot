import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const candidates = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash'
];

async function test() {
  for (const m of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Halo');
      console.log(`✅ SUCCESS ${m}:`, res.response.text().trim());
    } catch (e: any) {
      console.log(`❌ FAIL ${m}:`, e.message.slice(0, 100));
    }
  }
}

test();
