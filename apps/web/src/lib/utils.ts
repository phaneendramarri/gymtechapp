import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formats an amount stored in paise (₹1 = 100 paise) as an Indian Rupee string.
export function formatCurrency(paise: number): string {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;
}


