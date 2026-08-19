import { google, sheets_v4 } from 'googleapis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { TransactionRecord, ExtractedTransaction, MonthlySummary, CategorySummary } from '../types/transaction.js';
import { generateTransactionId, getIndonesianMonthName, getCurrentDateISO } from '../utils/formatter.js';

export class SheetsService {
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string;
  private transactionsSheetName = 'Transactions';

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
      logger.info('Google Sheets API berhasil terhubung.');
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
   * Memastikan Sheet 'Transactions' dan header kolom telah tersedia
   */
  public async ensureSheetSetup(): Promise<void> {
    const client = this.getClient();

    try {
      const spreadsheet = await client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      const sheetExists = spreadsheet.data.sheets?.some(
        (s) => s.properties?.title === this.transactionsSheetName
      );

      if (!sheetExists) {
        // Buat sheet baru jika belum ada
        await client.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.transactionsSheetName,
                    gridProperties: {
                      frozenRowCount: 1
                    }
                  }
                }
              }
            ]
          }
        });
        logger.info(`Sheet '${this.transactionsSheetName}' berhasil dibuat.`);
      }

      // Periksa header
      const headerResponse = await client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.transactionsSheetName}!A1:K1`
      });

      const existingHeaders = headerResponse.data.values?.[0];
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
        'AI Confidence'
      ];

      if (!existingHeaders || existingHeaders.length === 0) {
        await client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.transactionsSheetName}!A1:K1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers]
          }
        });
        logger.info('Header kolom Google Sheets berhasil diisi.');
      }
    } catch (error) {
      logger.error({ error }, 'Error saat memastikan setup sheet');
      throw error;
    }
  }

  /**
   * Menyimpan satu transaksi baru ke baris paling bawah sheet
   */
  public async appendTransaction(
    extracted: ExtractedTransaction
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
      Math.round(extracted.confidence * 100) + '%'
    ];

    await client.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${this.transactionsSheetName}!A:K`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row]
      }
    });

    const record: TransactionRecord = {
      ...extracted,
      id,
      timestamp
    };

    logger.info({ id, nominal: extracted.amount, kategori: extracted.category }, 'Transaksi berhasil dicatat ke Sheets');
    return record;
  }

  /**
   * Mengambil seluruh baris transaksi dari Google Sheet
   */
  public async getAllTransactions(): Promise<TransactionRecord[]> {
    const client = this.getClient();

    const response = await client.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.transactionsSheetName}!A2:K`
    });

    const rows = response.data.values || [];
    const records: TransactionRecord[] = [];

    rows.forEach((row, index) => {
      if (!row || row.length < 7) return;

      const rawType = String(row[4] || '').toUpperCase();
      let type: 'EXPENSE' | 'INCOME' | 'TRANSFER' = 'EXPENSE';
      if (rawType.includes('PEMASUKAN') || rawType === 'INCOME') {
        type = 'INCOME';
      } else if (rawType.includes('TRANSFER')) {
        type = 'TRANSFER';
      }

      // Bersihkan nominal dari karakter titik/koma/spasi/Rp
      const rawAmount = String(row[6] || '0').replace(/[^0-9.-]+/g, '');
      const amount = parseFloat(rawAmount) || 0;

      records.push({
        id: String(row[0] || `ROW-${index + 2}`),
        timestamp: String(row[1] || ''),
        date: String(row[2] || ''),
        time: String(row[3] || ''),
        type,
        category: String(row[5] || 'Lain-lain'),
        amount,
        source: String(row[7] || ''),
        recipient: String(row[8] || ''),
        notes: String(row[9] || ''),
        confidence: 1.0,
        isReceiptOrTransaction: true,
        sheetRowIndex: index + 2
      });
    });

    return records;
  }

  /**
   * Mengambil transaksi hari ini
   */
  public async getTodayTransactions(): Promise<TransactionRecord[]> {
    const today = getCurrentDateISO();
    const all = await this.getAllTransactions();
    return all.filter((tx) => tx.date === today);
  }

  /**
   * Menghitung rekapan bulanan
   */
  public async getMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
    const all = await this.getAllTransactions();
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
      totalIncome,
      totalExpense,
      netCashflow: totalIncome - totalExpense,
      totalTransactions: monthTransactions.length,
      categoryBreakdown,
      recentTransactions: monthTransactions.slice(-5).reverse()
    };
  }

  /**
   * Menghapus baris transaksi terakhir jika user ingin membatalkan
   */
  public async deleteLastTransaction(): Promise<boolean> {
    const client = this.getClient();
    const all = await this.getAllTransactions();
    if (all.length === 0) return false;

    const lastRowIndex = all.length + 1; // +1 karena ada header row 1

    // Dapatkan sheetId untuk sheet Transactions
    const spreadsheet = await client.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });
    const sheetObj = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === this.transactionsSheetName
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

    logger.info(`Baris ${lastRowIndex} berhasil dihapus dari Google Sheets.`);
    return true;
  }
}
