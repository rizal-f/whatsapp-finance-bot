import { GeminiService } from '../src/services/gemini.service.js';

async function main() {
  const gemini = new GeminiService();

  const inputs = [
    'Budget skincare 500rb bca',
    'Masuk Uang bensin 300rb cash',
    'Uang jajan 500rb bca',
    'Beli seblak 25rb cash'
  ];

  for (const input of inputs) {
    console.log(`\nTesting input: "${input}"`);
    try {
      const result = await gemini.extractFromText(input);
      console.log('Result:', result);
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

main();
