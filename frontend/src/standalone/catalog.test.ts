import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import fixture from './demo.json'
import { defaultFilters } from '../types'
import { CATALOG_KEY, filterCatalog, readRealCatalog, suppliersFor } from './catalog'
import { mutateSupplier, publicUrl, validInn } from './mutations'
import { csvBytes, exportRows, safeCell, xlsxBytes } from './export'

const sample = { name: 'Компания для теста', source_url: 'https://supplier-test.ru/contacts', website: 'https://supplier-test.ru', category: 'dairy', city: 'Казань', address: 'Тестовый адрес', products: ['Сыр'], phone: '+7 000 000-00-00', terms: [{ product: 'Сыр', price: 590, currency: 'RUB', unit: 'кг', min_order: 10, min_order_unit: 'кг', packaging: null, volume: null }] }
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) })
})
describe('autonomous browser catalogue', () => {
  it('keeps all demo records separate from an initially empty real catalogue', () => {
    expect(readRealCatalog()).toHaveLength(0)
    expect(suppliersFor('demo')).toHaveLength(12)
    expect(filterCatalog(suppliersFor('demo'), defaultFilters)).toHaveLength(0)
    expect(filterCatalog(suppliersFor('demo'), { ...defaultFilters, mode: 'demo', q: 'МОЦАРЕЛЛА', region: 'Екатеринбург' })).toHaveLength(2)
  })
  it('matches prices and minimum order on the same product in matching units', () => {
    const filters = { ...defaultFilters, mode: 'demo' as const, price_product: 'моцарелла', price_unit: 'кг', price_from: 500, price_to: 700 }
    const items = filterCatalog(suppliersFor('demo'), filters)
    expect(items.map(s => s.id)).toEqual(['demo-02'])
    expect(items[0].matched_term_index).toBe(0)
    expect(filterCatalog(suppliersFor('demo'), { ...filters, order_unit: '₽' })).toHaveLength(0)
  })
  it('does not label manual/demo contacts as verified', () => {
    mutateSupplier(sample)
    expect(filterCatalog(readRealCatalog(), { ...defaultFilters, contacts: true })).toHaveLength(1)
    expect(filterCatalog(readRealCatalog(), { ...defaultFilters, verified_contacts: true })).toHaveLength(0)
    expect(filterCatalog(suppliersFor('demo'), { ...defaultFilters, mode: 'demo', verified_contacts: true })).toHaveLength(0)
  })
  it('deduplicates by domain, preserves contradictory sources and records edit history', () => {
    const original = mutateSupplier(sample)
    expect(original.created).toBe(true)
    expect(mutateSupplier(sample).created).toBe(false)
    expect(readRealCatalog()[0].sources).toHaveLength(1)
    mutateSupplier({ ...sample, city: 'Москва', source_url: 'https://supplier-test.ru/other' })
    expect(readRealCatalog()).toHaveLength(1)
    expect(readRealCatalog()[0].conflicts).toHaveLength(1)
    const edit = mutateSupplier({ ...sample, city: 'Екатеринбург' }, original.supplier.id)
    expect(edit.supplier.sources.at(-1)?.previous?.city).toBe('Казань')
    expect(readRealCatalog()[0].city).toBe('Екатеринбург')
    expect(readRealCatalog()[0].checked_at).toBeNull()
  })
  it('does not merge different legal entities using a shared domain', () => {
    expect(validInn('7707083893')).toBe(true)
    mutateSupplier({ ...sample, inn: '7707083893' })
    const result = mutateSupplier({ ...sample, inn: '7736050003' })
    expect(result.created).toBe(true)
    expect(result.supplier.conflicts[0]).toContain('дубликат')
  })
  it('rejects unsafe URLs, invalid INN and an edit colliding with another company', () => {
    for (const url of ['javascript:alert(1)', 'https://127.0.0.1', 'http://localhost/a', 'https://test.local', 'https://test.ru:1234', 'https://user:password@test.ru']) expect(() => publicUrl(url)).toThrow()
    expect(() => mutateSupplier({ ...sample, inn: '1111111111' })).toThrow('ИНН')
    const first = mutateSupplier(sample)
    mutateSupplier({ ...sample, website: 'https://another-test.ru', address: 'Другой адрес' })
    expect(() => mutateSupplier({ ...sample, website: 'https://another-test.ru' }, first.supplier.id)).toThrow('дубликат')
  })
  it('preserves a corrupt catalogue and refuses to claim success when storage is blocked', () => {
    localStorage.setItem(CATALOG_KEY, '{broken')
    expect(() => mutateSupplier(sample)).toThrow('повреждён')
    expect(localStorage.getItem(CATALOG_KEY)).toBe('{broken')
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('blocked') } })
    expect(() => mutateSupplier(sample)).toThrow('не сохранил')
  })
  it('keeps scoring criteria consistent with the server fixture at the snapshot date', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(fixture.items[0].sources[0].retrieved_at))
    expect(suppliersFor('demo').map(s => s.rating.value)).toEqual(fixture.items.map(s => s.rating.value))
    expect(suppliersFor('demo').map(s => s.completeness)).toEqual(fixture.items.map(s => s.completeness))
    vi.restoreAllMocks()
  })
})
describe('browser exports', () => {
  it('produces UTF-8 CSV with quoting and safe formula-like values', () => {
    for (const input of ['=1+1', '  +SUM(A1)', '\t@evil', '-2', '\n=4']) expect(safeCell(input).startsWith("'")).toBe(true)
    const result = strFromU8(csvBytes([['Название', 'Заметка'], ['Поставщик; "1"', safeCell('=1+1')]]))
    expect(result).toContain('"Поставщик; ""1"""')
    expect(result).toContain("'=" )
  })
  it('creates an XLSX package with string cells, source/date fields and opt-in notes', () => {
    const items = suppliersFor('demo').slice(0, 1)
    const rows = exportRows(items, { [items[0].id]: '=1+1' }, true)
    const archive = unzipSync(xlsxBytes(rows))
    const sheet = strFromU8(archive['xl/worksheets/sheet1.xml'])
    expect(sheet).toContain('inlineStr')
    expect(sheet).toContain('Источники')
    expect(sheet).toContain('Личная заметка')
    expect(sheet).toContain('&apos;=1+1')
    expect(sheet).not.toContain('<f>')
    expect(exportRows(items, { [items[0].id]: 'secret' }, false)[0]).not.toContain('Личная заметка')
  })
})
