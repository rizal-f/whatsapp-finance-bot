/**
 * Utilitas pemformatan uang, tanggal, dan teks untuk bot WhatsApp
 */

export function formatRupiah(amount: number): string {
  if (isNaN(amount)) return 'Rp 0';
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absAmount);

  return isNegative ? `-${formatted}` : formatted;
}

export function formatDateIndonesian(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    if (!year || !month || !day || month < 1 || month > 12) return dateStr;
    return `${day} ${months[month - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}

export function getIndonesianMonthName(monthIndex: number): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[monthIndex] || `Bulan ${monthIndex + 1}`;
}

export function getCurrentDateISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

export function generateTransactionId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TX-${datePart}-${randomPart}`;
}

export function cleanPhoneNumber(jidOrNumber: string): string {
  if (!jidOrNumber) return '';
  const withoutSuffix = jidOrNumber.replace(/@.*$/, '');
  return withoutSuffix.replace(/[^0-9]/g, '');
}

/**
 * Menormalkan tanggal dari Google Sheets yang mungkin berupa serial number Excel (cth: 46255)
 * atau string (cth: "2026-08-21", "21/08/2026") menjadi format ISO YYYY-MM-DD
 */
export function normalizeSheetDate(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();

  // 1. Format standar YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. Format DD/MM/YYYY atau DD-MM-YYYY (cth: 21/08/2026 atau 21/8/2026)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Format Serial Number Google Sheets / Excel (cth: 46255 -> 2026-08-21)
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const utcDays = num - 25569;
    const dateObj = new Date(utcDays * 86400 * 1000);
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 4. Fallback jika parse Date standar JS
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str;
}

/**
 * Menormalkan waktu dari Google Sheets yang mungkin berupa desimal Excel (cth: 0.73333 -> 17:36)
 */
export function normalizeSheetTime(raw: any): string {
  if (!raw || raw === '-') return '';
  const str = String(raw).trim();

  // Jika format HH:mm
  if (/^\d{1,2}:\d{2}/.test(str)) {
    return str;
  }

  const num = Number(str);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  return str;
}
