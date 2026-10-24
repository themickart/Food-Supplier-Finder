import { describe, expect, it } from 'vitest'
import type { Term } from './types'
import { calculatePosition } from './calculator'

const term: Term = { product: 'Сыр', price: 590, currency: 'RUB', unit: 'кг', min_order: 10, min_order_unit: 'кг', packaging: null, volume: null, source_url: '', checked_at: null }
describe('position estimate', () => {
  it('calculates only the selected product and checks a matching unit minimum', () => {
    expect(calculatePosition(term, 5)).toMatchObject({ total: 2950, amount: 5, minimumStatus: 'below', shortfall: 5 })
    expect(calculatePosition(term, 10)?.minimumStatus).toBe('met')
  })
  it('checks currency minima without converting incompatible currencies or quantities', () => {
    expect(calculatePosition({ ...term, min_order: 5000, min_order_unit: '₽' }, 10)?.minimumStatus).toBe('met')
    expect(calculatePosition({ ...term, min_order_unit: '$' }, 10)?.minimumStatus).toBe('incomparable')
    expect(calculatePosition({ ...term, min_order_unit: 'уп.' }, 10)?.minimumStatus).toBe('incomparable')
  })
  it('rounds quantities only by an explicitly entered multiple and handles decimals', () => {
    expect(calculatePosition(term, 11, 5, true)).toMatchObject({ amount: 15, total: 8850 })
    expect(calculatePosition(term, 0.3, 0.1, true)?.amount).toBeCloseTo(0.3)
    expect(calculatePosition({ ...term, price: 0.1 }, 3)?.total).toBe(0.3)
  })
  it('does not invent unknown prices or accept invalid inputs', () => {
    expect(calculatePosition({ ...term, price: null }, 10)).toBeNull()
    expect(calculatePosition({ ...term, min_order: null }, 10)?.minimumStatus).toBe('unknown')
    for (const quantity of [0, -1, NaN, Infinity, 1e12]) expect(calculatePosition(term, quantity)).toBeNull()
  })
})
