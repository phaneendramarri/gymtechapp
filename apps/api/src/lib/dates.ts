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
