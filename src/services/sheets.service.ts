import { google, sheets_v4 } from 'googleapis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  TransactionRecord,
  ExtractedTransaction,
  MonthlySummary,
  CategorySummary,
  SheetSummaryItem,
  ComprehensiveMonthlySummary,
  ALL_TARGET_SHEETS,
  TARGET_SHEETS,
  TargetSheetName
} from '../types/transaction.js';
import {
  generateTransactionId,
  getIndonesianMonthName,
  getCurrentDateISO,
  normalizeSheetDate,
  normalizeSheetTime
} from '../utils/formatter.js';

export class SheetsService {
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string;
  private lastInsertedSheet: string = TARGET_SHEETS.MAKAN;

  constructor() {
    this.spreadsheetId = config.spreadsheetId;
  }

  /**
   * Inisialisasi autentikasi Google Sheets API via Service Account
   */
  public async init(): Promise<void> {
    try {
      let authConfig: any = {
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      };

      if (config.googleCredentialsJson && config.googleCredentialsJson.trim().startsWith('{')) {
        authConfig.credentials = JSON.parse(config.googleCredentialsJson);
        logger.info('Menggunakan Google Service Account dari Environment Variable JSON.');
      } else {
        authConfig.keyFile = config.googleCredentialsPath;
        logger.info(`Menggunakan Google Service Account dari file: ${config.googleCredentialsPath}`);
      }

      const auth = new google.auth.GoogleAuth(authConfig);
      const authClient = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient as any });

      await this.ensureSheetSetup();
      logger.info('Google Sheets API berhasil terhubung ke 5 sheets.');
    } catch (error) {
      logger.error({ error }, 'Gagal menghubungkan Google Sheets API');
      throw error;
    }
  }

  private getClient(): sheets_v4.Sheets {
    if (!this.sheets) {
      throw new Error('Google Sheets client belum diinisialisasi. Panggil init() terlebih dahulu.');
    }
    return this.sheets;
  }

  /**
   * Memastikan ke-5 Sheet (Transaksi Istri, Transaksi Suami, Transaksi Makan, Transaksi Belanja Bulanan, Tabungan) telah tersedia
   */
  public async ensureSheetSetup(): Promise<void> {
    const client = this.getClient();

    try {
      const spreadsheet = await client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const existingSheetTitles = new Set(
        (spreadsheet.data.sheets || []).map((s) => s.properties?.title || '')
      );

      const addSheetRequests: sheets_v4.Schema$Request[] = [];

      for (const sheetTitle of ALL_TARGET_SHEETS) {
        if (!existingSheetTitles.has(sheetTitle)) {
          addSheetRequests.push({
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          });
        }
      }

      if (addSheetRequests.length > 0) {
        await client.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: addSheetRequests
          }
        });
        logger.info(`Berhasil membuat ${addSheetRequests.length} tab sheet baru di Google Spreadsheet.`);
      }

      const headers = [
        'ID Transaksi',
        'Timestamp Input',
        'Tanggal Transaksi',
        'Jam',
        'Tipe',
        'Kategori',
        'Nominal (Rp)',
        'Sumber Dana',
        'Penerima / Merchant',
        'Keterangan',
        'Dicatat Oleh',
        'Grup / Chat',
        'AI Confidence'
      ];

      // Periksa dan isi header di setiap tab sheet
      for (const sheetTitle of ALL_TARGET_SHEETS) {
        try {
          const headerResponse = await client.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `'${sheetTitle}'!A1:M1`
          });

          const existingHeaders = headerResponse.data.values?.[0];
          if (!existingHeaders || existingHeaders.length === 0) {
            await client.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range: `'${sheetTitle}'!A1:M1`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [headers]
              }
            });
            logger.info(`Header kolom sheet '${sheetTitle}' berhasil diisi.`);
          }
        } catch (err) {
          logger.warn({ sheetTitle, err }, 'Gagal memeriksa header sheet');
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error saat memastikan setup multi-sheet');
      throw error;
    }
  }

  /**
   * Menyimpan satu transaksi baru ke baris paling bawah pada sheet tertentu
   */
  public async appendTransaction(
    extracted: ExtractedTransaction,
    submittedBy: string = 'Pribadi',
    groupName: string = 'Direct Message',
    targetSheet: string = TARGET_SHEETS.MAKAN
  ): Promise<TransactionRecord> {
    const client = this.getClient();
    const id = generateTransactionId();
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const row = [
      id,
      timestamp,
      extracted.date,
      extracted.time || '-',
      extracted.type === 'INCOME' ? 'Pemasukan' : extracted.type === 'TRANSFER' ? 'Transfer' : 'Pengeluaran',
      extracted.category,
      extracted.amount,
      extracted.source,
      extracted.recipient,
      extracted.notes,
      submittedBy,
      groupName,
      Math.round(extracted.confidence * 100) + '%'
    ];

    await client.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `'${targetSheet}'!A:M`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });

    this.lastInsertedSheet = targetSheet;

    const record: TransactionRecord = {
      ...extracted,
      id,
      timestamp,
      submittedBy,
      groupName,
      targetSheet
    };

    logger.info({ id, nominal: extracted.amount, kategori: extracted.category, targetSheet, submittedBy }, 'Transaksi berhasil dicatat ke Sheets');
    return record;
  }

  /**
   * Mengambil baris transaksi dari sheet tertentu atau dari semua sheet
   */
  public async getAllTransactions(targetSheet?: string): Promise<TransactionRecord[]> {
    const client = this.getClient();

    const sheetsToQuery = targetSheet ? [targetSheet] : ALL_TARGET_SHEETS;
    const records: TransactionRecord[] = [];

    for (const sheetName of sheetsToQuery) {
      try {
        const response = await client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `'${sheetName}'!A2:M`
        });

        const rows = response.data.values || [];

        rows.forEach((row, index) => {
          if (!row || row.length < 7) return;

          const rawType = String(row[4] || '').toUpperCase();
          let type: 'EXPENSE' | 'INCOME' | 'TRANSFER' = 'EXPENSE';
          if (rawType.includes('PEMASUKAN') || rawType === 'INCOME') {
            type = 'INCOME';
          } else if (rawType.includes('TRANSFER')) {
            type = 'TRANSFER';
          }

          const rawAmount = String(row[6] || '0').replace(/[^0-9.-]+/g, '');
          const amount = parseFloat(rawAmount) || 0;

          const normalizedDate = normalizeSheetDate(row[2]);
          const normalizedTime = normalizeSheetTime(row[3]);

          records.push({
            id: String(row[0] || `ROW-${index + 2}`),
            timestamp: String(row[1] || ''),
            date: normalizedDate,
            time: normalizedTime,
            type,
            category: String(row[5] || 'Lain-lain'),
            amount,
            source: String(row[7] || ''),
            recipient: String(row[8] || ''),
            notes: String(row[9] || ''),
            submittedBy: String(row[10] || 'Pribadi'),
            groupName: String(row[11] || 'Direct Message'),
            targetSheet: sheetName,
            confidence: 1.0,
            isReceiptOrTransaction: true,
            sheetRowIndex: index + 2
          });
        });
      } catch (err) {
        logger.warn({ sheetName, err }, 'Gagal mengambil baris dari sheet');
      }
    }

    return records;
  }

  /**
   * Mengambil transaksi hari ini (berdasarkan tanggal transaksi di struk)
   */
  public async getTodayTransactions(targetSheet?: string): Promise<TransactionRecord[]> {
    const today = getCurrentDateISO();
    const all = await this.getAllTransactions(targetSheet);
    return all.filter((tx) => tx.date === today);
  }

  /**
   * Menghitung rekapan bulanan
   */
  public async getMonthlySummary(year: number, month: number, targetSheet?: string): Promise<MonthlySummary> {
    const all = await this.getAllTransactions(targetSheet);
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const monthTransactions = all.filter((tx) => tx.date.startsWith(prefix));

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap: Record<string, { total: number; count: number }> = {};

    for (const tx of monthTransactions) {
      if (tx.type === 'INCOME') {
        totalIncome += tx.amount;
      } else if (tx.type === 'EXPENSE') {
        totalExpense += tx.amount;
        if (!categoryMap[tx.category]) {
          categoryMap[tx.category] = { total: 0, count: 0 };
        }
        categoryMap[tx.category].total += tx.amount;
        categoryMap[tx.category].count += 1;
      }
    }

    const categoryBreakdown: CategorySummary[] = Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return {
      period: `${getIndonesianMonthName(month - 1)} ${year}`,
      year,
      month,
      targetSheet,
      totalIncome,
      totalExpense,
      netCashflow: totalIncome - totalExpense,
      totalTransactions: monthTransactions.length,
      categoryBreakdown,
      recentTransactions: monthTransactions.slice(-5).reverse()
    };
  }

  /**
   * Menghitung rekapan komprehensif seluruh 5 sheet untuk laporan keuangan keluarga
   */
  public async getComprehensiveMonthlySummary(
    year: number,
    month: number
  ): Promise<ComprehensiveMonthlySummary> {
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const sheetsBreakdown: SheetSummaryItem[] = [];
    const allMonthTransactions: TransactionRecord[] = [];
    let grandTotalIncome = 0;
    let grandTotalExpense = 0;
    let grandTotalSavings = 0;
    const categoryMap: Record<string, { total: number; count: number }> = {};

    for (const sheetName of ALL_TARGET_SHEETS) {
      const sheetTxs = await this.getAllTransactions(sheetName);
      const filtered = sheetTxs.filter((tx) => tx.date.startsWith(prefix));

      let sheetIncome = 0;
      let sheetExpense = 0;

      for (const tx of filtered) {
        allMonthTransactions.push(tx);

        if (tx.type === 'INCOME') {
          sheetIncome += tx.amount;
        } else if (tx.type === 'EXPENSE' || tx.type === 'TRANSFER') {
          sheetExpense += tx.amount;

          // Hitung breakdown kategori
          if (!categoryMap[tx.category]) {
            categoryMap[tx.category] = { total: 0, count: 0 };
          }
          categoryMap[tx.category].total += tx.amount;
          categoryMap[tx.category].count += 1;
        }
      }

      if (sheetName === TARGET_SHEETS.TABUNGAN) {
        grandTotalSavings += sheetIncome + sheetExpense;
      } else {
        grandTotalIncome += sheetIncome;
        grandTotalExpense += sheetExpense;
      }

      sheetsBreakdown.push({
        sheetName,
        totalIncome: sheetIncome,
        totalExpense: sheetExpense,
        netCashflow: sheetIncome - sheetExpense,
        totalTransactions: filtered.length
      });
    }

    const categoryBreakdown: CategorySummary[] = Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: grandTotalExpense > 0 ? (data.total / grandTotalExpense) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);

    return {
      period: `${getIndonesianMonthName(month - 1)} ${year}`,
      year,
      month,
      grandTotalIncome,
      grandTotalExpense,
      grandTotalSavings,
      grandNetCashflow: grandTotalIncome - grandTotalExpense - grandTotalSavings,
      grandTotalTransactions: allMonthTransactions.length,
      sheetsBreakdown,
      categoryBreakdown,
      recentTransactions: allMonthTransactions.slice(-5).reverse()
    };
  }

  /**
   * Menghapus baris transaksi terakhir jika user ingin membatalkan
   */
  public async deleteLastTransaction(targetSheet?: string): Promise<boolean> {
    const client = this.getClient();
    const sheetToTarget = targetSheet || this.lastInsertedSheet || TARGET_SHEETS.MAKAN;

    const all = await this.getAllTransactions(sheetToTarget);
    if (all.length === 0) return false;

    const lastRowIndex = all.length + 1; // +1 karena ada header row 1

    const spreadsheet = await client.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });
    const sheetObj = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetToTarget
    );
    const sheetId = sheetObj?.properties?.sheetId ?? 0;

    await client.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: lastRowIndex - 1,
                endIndex: lastRowIndex
              }
            }
          }
        ]
      }
    });

    logger.info(`Baris ${lastRowIndex} di sheet '${sheetToTarget}' berhasil dihapus.`);
    return true;
  }
}
