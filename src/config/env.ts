import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

export interface AppConfig {
  port: number;
  geminiApiKey: string;
  geminiModel: string;
  spreadsheetId: string;
  googleCredentialsPath: string;
  googleCredentialsJson: string;
  allowedNumbers: string[];
  allowedGroups: string[];
  botName: string;
  commandPrefix: string;
}

function resolveGoogleCredentials(): string {
  const customPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (customPath) {
    const resolved = path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
    if (fs.existsSync(resolved)) return resolved;
  }

  const defaultPath = path.resolve(process.cwd(), 'credentials/google-service-account.json');
  if (fs.existsSync(defaultPath)) return defaultPath;

  // Auto-detect file .json apapun di dalam folder credentials/
  const credsDir = path.resolve(process.cwd(), 'credentials');
  if (fs.existsSync(credsDir)) {
    const jsonFiles = fs.readdirSync(credsDir).filter((f) => f.endsWith('.json') && !f.startsWith('.'));
    if (jsonFiles.length > 0) {
      return path.join(credsDir, jsonFiles[0]);
    }
  }

  return defaultPath;
}

function parseAllowedNumbers(raw?: string): string[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((num) => num.replace(/[^0-9]/g, ''))
    .filter((num) => num.length > 5);
}

function parseAllowedGroups(raw?: string): string[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8000', 10),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  spreadsheetId: process.env.SPREADSHEET_ID || '',
  googleCredentialsPath: resolveGoogleCredentials(),
  googleCredentialsJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CREDENTIALS_JSON || '',
  allowedNumbers: parseAllowedNumbers(process.env.ALLOWED_NUMBERS),
  allowedGroups: parseAllowedGroups(process.env.ALLOWED_GROUPS),
  botName: process.env.BOT_NAME || 'FinanceBot',
  commandPrefix: process.env.COMMAND_PREFIX || '!'
};

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.geminiApiKey) {
    errors.push('GEMINI_API_KEY belum diisi di file .env');
  }

  if (!config.spreadsheetId) {
    errors.push('SPREADSHEET_ID belum diisi di file .env');
  }

  const hasCredentialsJson = !!config.googleCredentialsJson && config.googleCredentialsJson.trim().length > 10;
  const hasCredentialsFile = fs.existsSync(config.googleCredentialsPath);

  if (!hasCredentialsJson && !hasCredentialsFile) {
    errors.push(
      `File kredensial Google Service Account tidak ditemukan di: ${config.googleCredentialsPath} dan GOOGLE_SERVICE_ACCOUNT_JSON belum diisi.`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
