import { describe, expect, it } from 'vitest'
import { defaultFilters } from './types'
import { activeFilterEntries, validateFilters } from './filtering'
import { readPreferences } from './preferences'

describe('commercial filters', () => {
  it('requires a product and unit before accepting price bounds', () => {
    expect(validateFilters({ ...defaultFilters, price_from: 0 })).toContain('товар и единицу')
    expect(validateFilters({ ...defaultFilters, price_from: 0, price_product: 'сыр', price_unit: 'кг' })).toBe('')
  })
  it('requires order units and ordered bounds', () => {
    expect(validateFilters({ ...defaultFilters, order_to: 10 })).toContain('единицу')
    expect(validateFilters({ ...defaultFilters, order_unit: 'кг', order_from: 20, order_to: 10 })).toContain('больше')
    expect(validateFilters({ ...defaultFilters, price_product: 'сыр', price_unit: 'кг', price_from: 20, price_to: 10 })).toContain('больше')
  })
  it('counts zero as an actual range bound but ignores default settings', () => {
    expect(activeFilterEntries(defaultFilters)).toHaveLength(0)
    expect(activeFilterEntries({ ...defaultFilters, price_from: 0 }).map(([key]) => key)).toEqual(['price_from'])
  })
})
describe('workspace preferences', () => {
  it('uses readable layouts for desktop and mobile', () => {
    expect(readPreferences(null).layout).toBe('cards')
    expect(readPreferences(null, true).layout).toBe('cards')
  })
  it('keeps a valid saved filter without duplicating columns', () => {
    const raw = { layout: 'table', columns: ['region', 'region', 'not-a-column'], presets: [{ id: 'one', name: 'Сыр', filters: { ...defaultFilters, q: 'сыр', min_rating: 75 } }] }
    const value = readPreferences(JSON.stringify(raw))
    expect(value.columns).toEqual(['region'])
    expect(value.presets).toHaveLength(1)
  })
  it('rejects corruption and omits malformed filter presets', () => {
    expect(() => readPreferences('{')).toThrow()
    const raw = { layout: 'cards', columns: [], presets: [{ id: 'bad', name: 'bad', filters: { min_rating: 150 } }, { id: 'wrong', name: 'wrong', filters: { price_from: 'free' } }] }
    expect(readPreferences(JSON.stringify(raw)).presets).toHaveLength(0)
  })
})
