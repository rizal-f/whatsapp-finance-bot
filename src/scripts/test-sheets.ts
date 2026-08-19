import { SheetsService } from '../services/sheets.service.js';
import { config } from '../config/env.js';

async function testSheets() {
  console.log('🧪 Menguji koneksi Google Sheets...');

  if (!config.spreadsheetId) {
    console.error('❌ SPREADSHEET_ID belum diatur di file .env');
    process.exit(1);
  }

  try {
    const service = new SheetsService();
    await service.init();
    console.log('✅ Berhasil terhubung ke Google Sheets API!');

    console.log('\nMencoba mencatat 1 baris transaksi uji coba...');
    const result = await service.appendTransaction({
      isReceiptOrTransaction: true,
      type: 'EXPENSE',
      amount: 25000,
      date: new Date().toISOString().slice(0, 10),
      time: '12:30',
      category: 'Makanan & Minuman',
      source: 'QRIS BCA',
      recipient: 'Kedai Kopi Test',
      notes: 'Uji coba koneksi sistem',
      confidence: 1.0
    });

    console.log('✅ Transaksi uji coba berhasil ditulis:');
    console.log(`- ID: ${result.id}`);
    console.log(`- Nominal: Rp ${result.amount}`);
    console.log(`- Kategori: ${result.category}`);

    console.log('\nMengambil rekapan bulanan...');
    const now = new Date();
    const summary = await service.getMonthlySummary(now.getFullYear(), now.getMonth() + 1);
    console.log(`✅ Rekap ${summary.period}:`);
    console.log(`- Total Pengeluaran: Rp ${summary.totalExpense}`);
    console.log(`- Total Transaksi: ${summary.totalTransactions}`);

    console.log('\n🎉 SEMUA PENGUJIAN GOOGLE SHEETS BERHASIL!');
  } catch (error: any) {
    console.error('\n❌ Gagal terhubung ke Google Sheets:', error.message || error);
    console.log('\n💡 TIPS PERBAIKAN:');
    console.log('1. Pastikan Anda sudah membagikan (Share) Google Sheet ke email Service Account sebagai "Editor".');
    console.log('2. Pastikan file credentials/google-service-account.json valid.');
    console.log('3. Pastikan Google Sheets API sudah di-enable di Google Cloud Console.');
  }
}

testSheets();
