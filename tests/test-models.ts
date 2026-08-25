import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const modelsToTest = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-pro'
];

async function testModels() {
  for (const m of modelsToTest) {
    try {
      console.log(`\nTesting model: ${m}...`);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Hai apa kabar? Jawab 3 kata saja.');
      console.log(`✅ SUCCESS ${m}:`, res.response.text().trim());
    } catch (err: any) {
      console.error(`❌ FAILED ${m}:`, err.message);
    }
  }
}

testModels();
