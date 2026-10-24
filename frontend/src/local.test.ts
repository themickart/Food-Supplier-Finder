import { describe, expect, it } from 'vitest'
import { readLocal } from './local'
import { minimum, price } from './format'

describe('local personal data', () => {
  it('starts empty and keeps valid data', () => {
    expect(readLocal(null).favorites).toEqual([])
    const data = { version: 1, favorites: ['demo-01'], notes: { 'demo-01': 'Запросить прайс' }, history: [{ q: 'сыр', region: 'Казань', at: '2026-10-24' }] }
    expect(readLocal(JSON.stringify(data))).toEqual(data)
  })
  it('rejects corruption without silently overwriting it', () => {
    expect(() => readLocal('{bad')).toThrow('повреждены')
    expect(() => readLocal(JSON.stringify({ version: 2 }))).toThrow('повреждены')
  })
  it('drops malformed and oversized entries', () => {
    const data = readLocal(JSON.stringify({ version: 1, favorites: [7, 'demo-01'], notes: { bad: 5, long: 'x'.repeat(5001) }, history: [false] }))
    expect(data.favorites).toEqual(['demo-01'])
    expect(data.notes).toEqual({})
    expect(data.history).toEqual([])
  })
})
it('does not turn missing commercial terms into zero', () => {
  expect(price()).toBe('Не указано')
  expect(minimum()).toBe('Не указано')
})
