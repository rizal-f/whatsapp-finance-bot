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

export function cleanPhoneNumber(jid: string): string {
  // Membersihkan format WA JID misal 628123456789@s.whatsapp.net -> 628123456789
  return jid.replace(/@.*$/, '').replace(/[^0-9]/g, '');
}
