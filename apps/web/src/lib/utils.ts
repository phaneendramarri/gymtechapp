import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formats an amount stored in paise (₹1 = 100 paise) as an Indian Rupee string.
export function formatCurrency(paise: number): string {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;
}

// Builds a wa.me click-to-chat URL with a pre-filled message for an Indian mobile number.
export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
}
