import type { Term } from './types'

const norm = (value: string) => value.trim().toLowerCase().replace(/\./g, '')
const moneyUnits: Record<string, string> = { '₽': 'RUB', руб: 'RUB', rub: 'RUB', '$': 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR' }
export function calculatePosition(term: Term, quantity: number, multiple = 1, round = false) {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9 || !Number.isFinite(multiple) || multiple <= 0 || multiple > 1e9) return null
  if (term.price === null || !Number.isFinite(term.price) || term.price < 0 || !term.unit || !term.currency) return null
  const amount = round ? Math.ceil(Number((quantity / multiple).toPrecision(12))) * multiple : quantity
  const total = Math.round((amount * term.price + Number.EPSILON) * 100) / 100
  if (!Number.isFinite(total) || total > 1e15) return null
  const minimum = term.min_order
  const currency = moneyUnits[norm(term.min_order_unit)]
  const comparable = currency === term.currency ? total : norm(term.min_order_unit) === norm(term.unit) ? amount : null
  const minimumStatus = minimum === null ? 'unknown' : comparable === null ? 'incomparable' : comparable >= minimum ? 'met' : 'below'
  return { amount, total, minimumStatus, shortfall: minimum !== null && comparable !== null ? Math.max(0, minimum - comparable) : null }
}
