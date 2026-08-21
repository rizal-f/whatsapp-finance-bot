import { parseSheetTag } from '../src/types/transaction.js';

console.log('Testing parseSheetTag helper...');

const tests = [
  { input: 'makan 20k bca .istri', expectedSheet: 'Transaksi Istri', expectedClean: 'makan 20k bca' },
  { input: 'beli bensin 50000 .suami', expectedSheet: 'Transaksi Suami', expectedClean: 'beli bensin 50000' },
  { input: 'kopi kenangan 25rb gopay .makan', expectedSheet: 'Transaksi Makan', expectedClean: 'kopi kenangan 25rb gopay' },
  { input: 'belanja bulanan superindo 350rb bca .belanja', expectedSheet: 'Transaksi Belanja Bulanan', expectedClean: 'belanja bulanan superindo 350rb bca' },
  { input: 'nabung reksadana 500rb .tabungan', expectedSheet: 'Tabungan', expectedClean: 'nabung reksadana 500rb' },
  { input: '.makan', expectedSheet: 'Transaksi Makan', expectedClean: '' },
  { input: '!laporan .istri', expectedSheet: 'Transaksi Istri', expectedClean: '!laporan' },
  { input: '!laporan .belanja', expectedSheet: 'Transaksi Belanja Bulanan', expectedClean: '!laporan' },
  { input: '!hari-ini .makan', expectedSheet: 'Transaksi Makan', expectedClean: '!hari-ini' },
  { input: 'foto struk tanpa tag', expectedSheet: null, expectedClean: 'foto struk tanpa tag' }
];

let allPassed = true;
for (const t of tests) {
  const result = parseSheetTag(t.input);
  const sheetMatches = result.targetSheet === t.expectedSheet;
  const cleanMatches = result.cleanText === t.expectedClean;
  if (!sheetMatches || !cleanMatches) {
    console.error(`❌ FAILED for input "${t.input}": got sheet "${result.targetSheet}" (expected "${t.expectedSheet}"), cleanText "${result.cleanText}" (expected "${t.expectedClean}")`);
    allPassed = false;
  } else {
    console.log(`✅ PASSED: "${t.input}" -> ${result.targetSheet}`);
  }
}

if (allPassed) {
  console.log('\n🎉 ALL TAG PARSING TESTS PASSED SUCCESSFULLY!');
} else {
  process.exit(1);
}
