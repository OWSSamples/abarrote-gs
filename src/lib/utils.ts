import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: 'MXN' | 'USD' = 'MXN'): string {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Formats a number as a `$`-prefixed amount with grouped thousands and two
 * decimals (es-MX). Unlike {@link formatCurrency}, the sign stays before the
 * `$` (e.g. `$-5.00`).
 */
export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Convert MXN to USD using the store's configured exchange rate.
 * Falls back to 17.5 if no rate is provided.
 */
export function convertMxnToUsd(amountMxn: number, exchangeRate = 17.5): number {
  if (exchangeRate <= 0) return 0;
  return Math.round((amountMxn / exchangeRate) * 100) / 100;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function getDaysUntil(date: string | Date): number {
  const target = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getStockStatus(
  stock: number,
  minStock: number,
): { status: 'ok' | 'low' | 'critical'; percentage: number } {
  const percentage = minStock > 0 ? (stock / minStock) * 100 : 100;
  if (stock === 0) return { status: 'critical', percentage: 0 };
  if (stock <= minStock) return { status: 'low', percentage };
  return { status: 'ok', percentage: Math.min(percentage, 100) };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}
