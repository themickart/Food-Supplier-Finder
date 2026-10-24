import type { Supplier, Term } from './types'

export const categoryName: Record<string, string> = { dairy: 'Молочная продукция', frozen: 'Замороженные продукты', packaging: 'Упаковка и расходники' }
export const categoryLetter: Record<string, string> = { dairy: 'М', frozen: 'Я', packaging: 'У' }
export function date(value: string | null): string {
  return value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Не проводилась'
}
export const number = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
export function price(term?: Term): string {
  return term?.price != null ? `${number(term.price)} ${term.currency === 'RUB' ? '₽' : term.currency} / ${term.unit || 'ед. не указана'}` : 'Не указано'
}
export function minimum(term?: Term): string {
  return term?.min_order != null ? `${number(term.min_order)} ${term.min_order_unit}` : 'Не указано'
}
export function displayTerm(supplier: Supplier): Term | undefined {
  return supplier.terms[supplier.matched_term_index ?? 0]
}
export function status(supplier: Supplier): string {
  if (supplier.status === 'needs_review') return 'Требует перепроверки'
  if (supplier.is_demo) return 'Демонстрационные сведения'
  if (supplier.status === 'unverified') return 'Не проверено'
  return 'Проверено по источнику'
}
