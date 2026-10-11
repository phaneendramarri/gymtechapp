/**
 * Date utilities for GymTech OS.
 * Defaults to 'Asia/Kolkata' timezone (IST) for India-first operations.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns YYYYMMDD integer in the specified timezone (default: Asia/Kolkata).
 * Ensures midnight/day boundaries align with local gym operating hours rather
 * than Cloudflare Workers edge node host time (UTC).
 */
export function todayYyyymmdd(date: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [year, month, day] = formatter.format(date).split('-');
  return parseInt(year, 10) * 10000 + parseInt(month, 10) * 100 + parseInt(day, 10);
}

/**
 * Safely parse a date from spreadsheet / form input into unix seconds.
 * Supports:
 * - ISO string: '2026-08-15'
 * - Indian / UK format: '15/08/2026', '15-08-2026', '15.08.2026'
 * - Excel serial number dates (e.g. 45500)
 * - Unix seconds or milliseconds
 * If invalid or unparseable, falls back to fallbackSeconds instead of returning NaN.
 */
export function parseFlexibleDateToUnix(raw: any, fallbackSeconds: number = Math.floor(Date.now() / 1000)): number {
  if (raw === undefined || raw === null || raw === '') return fallbackSeconds;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Excel serial date (typical range: 20000 to 70000, 1954 to 2091)
    if (raw > 20000 && raw < 70000) {
      const ms = Math.round((raw - 25569) * 86400 * 1000);
      return Math.floor(ms / 1000);
    }
    // Unix seconds
    if (raw > 1_000_000_000 && raw < 4_000_000_000) return Math.floor(raw);
    // Unix milliseconds
    if (raw >= 1_000_000_000_000) return Math.floor(raw / 1000);
  }
  const str = String(raw).trim();
  if (!str) return fallbackSeconds;

  // Indian / UK date format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day, 0, 0, 0));
    if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000);
  }

  // Standard date parsing
  const ms = new Date(str).getTime();
  if (Number.isFinite(ms)) return Math.floor(ms / 1000);

  return fallbackSeconds;
}
