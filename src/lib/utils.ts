import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function getDaysUntil(date: string | Date): number {
  const target = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function getStockStatus(stock: number, minStock: number): { status: 'ok' | 'low' | 'critical'; percentage: number } {
  const percentage = minStock > 0 ? (stock / minStock) * 100 : 100
  if (stock === 0) return { status: 'critical', percentage: 0 }
  if (stock <= minStock) return { status: 'low', percentage }
  return { status: 'ok', percentage: Math.min(percentage, 100) }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value)
}
