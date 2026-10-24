// Browser-only demonstration adapter. The FastAPI application remains authoritative
// in server builds; this module is excluded from those builds by Vite.
import fixture from './demo.json'
import type { CatalogPage, Filters, Mode, Overview, Rating, Supplier } from '../types'
import { defaultFilters } from '../types'
import { validateFilters } from '../filtering'

export const CATALOG_KEY = 'fsup.standalone.catalog.v1'
export const normalize = (value: string | null) => (value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}_]+/gu, ' ').trim()
const unitKey = (value: string) => ({ '₽': 'rub', руб: 'rub', '$': 'usd', '€': 'eur' })[value.trim().toLowerCase().replace(/\.$/, '') as '₽'] || value.trim().toLowerCase().replace(/\.$/, '')
const hasValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : Boolean(value)
export function withDerived(supplier: Supplier): Supplier {
  const s = structuredClone(supplier)
  s.checked_at = s.sources.map(source => source.checked_at).filter((v): v is string => Boolean(v)).sort().at(-1) || null
  const age = s.checked_at ? Math.max(0, (Date.now() - Date.parse(s.checked_at)) / 86400000) : null
  s.status = s.conflicts.length || (age !== null && age >= 90) ? 'needs_review' : s.checked_at ? 'source_checked' : 'unverified'
  const completeness = [s.description, s.city, s.website, s.products, s.contacts, s.terms, s.delivery_info || s.delivery_regions.length, s.documents].filter(hasValue).length / 8 * 100
  // Match Python round() at the .5 boundary for the same eight fields.
  s.completeness = completeness % 1 === 0.5 ? 2 * Math.round(completeness / 2) : Math.round(completeness)
  const criteria = s.rating.criteria.map(criterion => ({ ...criterion }))
  const commercial = Math.max(0, ...s.terms.filter(t => t.product && t.source_url).map(t => (t.price !== null && t.unit && t.currency ? 5 : 0) + (t.min_order !== null && t.min_order_unit ? 5 : 0) + (t.packaging ? 5 : 0) + (t.volume ? 5 : 0)))
  const points: Record<string, number> = {
    sources: s.sources.some(source => source.url && source.retrieved_at) ? 20 : 0,
    contacts: s.contacts.some(contact => contact.value && contact.source_url) ? 15 : 0,
    assortment: s.products.length ? 15 : 0, terms: commercial,
    delivery: (s.delivery_info ? 5 : 0) + (s.delivery_regions.length ? 5 : 0),
    documents: s.documents.some(document => document.name && document.url) ? 5 : 0,
    freshness: age === null || age >= 90 ? 0 : age < 30 ? 15 : 10,
  }
  criteria.forEach(criterion => { criterion.points = points[criterion.id] || 0 })
  const penalty = s.conflicts.length ? 20 : 0
  const value = Math.max(0, criteria.reduce((sum, criterion) => sum + criterion.points, 0) - penalty)
  s.rating = { ...s.rating, criteria, value, conflict_penalty: penalty, label: value >= 75 ? 'Много сведений' : value >= 45 ? 'Есть пробелы' : 'Мало сведений' }
  s.match = null; s.matched_term_index = null
  return s
}
export function readRealCatalog(): Supplier[] {
  let raw: string | null
  try { raw = localStorage.getItem(CATALOG_KEY) } catch { throw new Error('Браузер запретил доступ к локальному каталогу. Разрешите хранение данных.') }
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value) || value.length > 1000 || value.some(s => !s || s.is_demo !== false || typeof s.id !== 'string' || typeof s.name !== 'string' || !Array.isArray(s.sources) || !Array.isArray(s.products) || !Array.isArray(s.terms) || !s.rating)) throw new Error()
    return value.map(withDerived)
  } catch { throw new Error('Локальный каталог повреждён. Он не перезаписан. Сохраните данные браузера перед восстановлением.') }
}
export function saveRealCatalog(items: Supplier[]) {
  if (items.length > 1000) throw new Error('Автономная демонстрация ограничена 1000 записями. Для большего каталога используйте серверную версию.')
  try { localStorage.setItem(CATALOG_KEY, JSON.stringify(items)) }
  catch { throw new Error('Браузер не сохранил каталог: хранилище недоступно или заполнено. Изменения не применены.') }
}
export const suppliersFor = (mode: Mode) => mode === 'demo' ? (fixture.items as Supplier[]).map(withDerived) : readRealCatalog()
export function matchingTerm(s: Supplier, f: Filters): number | null {
  const priceFilter = Boolean(f.price_unit) || f.price_from !== null || f.price_to !== null
  const orderFilter = Boolean(f.order_unit) || f.order_from !== null || f.order_to !== null
  if (!(priceFilter || orderFilter || f.price_product)) {
    const tokens = normalize(f.q).split(' ').filter(Boolean)
    const index = tokens.length ? s.terms.findIndex(term => tokens.every(token => normalize(term.product).includes(token))) : -1
    return index < 0 ? null : index
  }
  const index = s.terms.findIndex(t => {
    if (f.price_product && !normalize(t.product).includes(normalize(f.price_product))) return false
    if (priceFilter && (t.price === null || unitKey(t.unit) !== unitKey(f.price_unit) || t.currency !== f.price_currency || (f.price_from !== null && t.price < f.price_from) || (f.price_to !== null && t.price > f.price_to))) return false
    if (orderFilter && (t.min_order === null || unitKey(t.min_order_unit) !== unitKey(f.order_unit) || (f.order_from !== null && t.min_order < f.order_from) || (f.order_to !== null && t.min_order > f.order_to))) return false
    return true
  })
  return index < 0 ? null : index
}
export function applyMatch(s: Supplier, f: Filters): Supplier {
  const result = { ...s, matched_term_index: matchingTerm(s, f) }
  if (!f.q && !f.category && !f.region && !f.delivery_region) return result
  let points = 0, max = 0
  const reasons: string[] = []
  if (f.q) {
    max += 60
    const direct = normalize([s.name, ...s.products].join(' '))
    const hit = normalize(f.q).split(' ').every(token => direct.includes(token))
    points += hit ? 60 : 30
    reasons.push(hit ? 'Запрос найден в названии или ассортименте' : 'Запрос найден в описании или категории; ассортимент уточните')
  }
  for (const [filter, hit, reason] of [[f.category, s.categories.includes(f.category), 'Совпадает категория'], [f.region, [s.city, s.region].includes(f.region), 'Совпадает расположение'], [f.delivery_region, s.delivery_regions.includes(f.delivery_region), 'Указана доставка в выбранный регион']] as const) {
    if (filter) { max += 20; if (hit) { points += 20; reasons.push(reason) } }
  }
  return { ...result, match: { value: Math.round(points / max * 100), reasons, label: 'Соответствие условиям поиска' } }
}
export function filterCatalog(items: Supplier[], f: Filters): Supplier[] {
  const error = validateFilters(f); if (error) throw new Error(error)
  const termsFilter = Boolean(f.price_product || f.price_unit || f.order_unit) || [f.price_from, f.price_to, f.order_from, f.order_to].some(value => value !== null)
  const tokens = normalize(f.q).split(' ').filter(Boolean)
  return items.filter(s => {
    const text = normalize([s.name, s.description, s.city, s.region, ...s.products, ...s.delivery_regions, ...s.categories, ...fixture.categories.filter(c => s.categories.includes(c.id)).map(c => c.name)].join(' '))
    return s.is_demo === (f.mode === 'demo') && tokens.every(t => text.includes(t)) && (!f.category || s.categories.includes(f.category)) && (!f.region || [s.city, s.region].includes(f.region)) && (!f.delivery_region || s.delivery_regions.some(r => r.includes(f.delivery_region))) && (!f.website || Boolean(s.website)) && (!f.contacts || s.contacts.length > 0) && (!f.verified_contacts || s.contacts.some(c => ['official_site', 'source_checked', 'phone_verified'].includes(c.verification) && c.source_url)) && (!f.min_order || s.terms.some(t => t.min_order !== null)) && (!f.delivery || Boolean(s.delivery_info || s.delivery_regions.length)) && (!f.documents || s.documents.length > 0) && (!f.commercial || s.terms.some(t => t.price !== null || t.min_order !== null)) && (!f.status || s.status === f.status) && s.rating.value >= f.min_rating && (!termsFilter || matchingTerm(s, f) !== null)
  }).map(s => applyMatch(s, f)).sort((a, b) => {
    const primary = f.sort === 'rating' ? b.rating.value - a.rating.value : f.sort === 'completeness' ? b.completeness - a.completeness : f.sort === 'updated' ? b.updated_at.localeCompare(a.updated_at) : f.sort === 'region' ? (a.city || '\uffff').localeCompare(b.city || '\uffff', 'ru') : f.sort === 'relevance' ? (b.match?.value || 0) - (a.match?.value || 0) : 0
    return primary || normalize(a.name).localeCompare(normalize(b.name), 'ru') || a.id.localeCompare(b.id)
  })
}
export function catalogPage(f: Filters, page: number, pageSize = 12, ids?: string[]): CatalogPage {
  const items = filterCatalog(suppliersFor(f.mode).filter(s => !ids || ids.includes(s.id)), f)
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, page_size: pageSize }
}
export function selected(ids: string[], mode: Mode, filters = { ...defaultFilters, mode }): Supplier[] {
  const items = suppliersFor(mode)
  return [...new Set(ids)].map(id => {
    const supplier = items.find(s => s.id === id)
    if (!supplier) throw new Error('Некоторые поставщики недоступны в выбранном режиме')
    return applyMatch(supplier, filters)
  })
}
export function overview(mode: Mode): Overview {
  const items = suppliersFor(mode)
  const sources = new Map<string, Overview['sources'][number] & { ids: Set<string> }>()
  items.forEach(s => s.sources.forEach(source => {
    const entry = sources.get(source.url) || { ...source, supplier_count: 0, ids: new Set<string>() }
    entry.ids.add(s.id); entry.supplier_count = entry.ids.size
    if (source.retrieved_at > entry.retrieved_at) entry.retrieved_at = source.retrieved_at
    if (source.checked_at && source.checked_at > (entry.checked_at || '')) entry.checked_at = source.checked_at
    sources.set(source.url, entry)
  }))
  return { total: items.length, with_contacts: items.filter(s => s.contacts.length).length, with_terms: items.filter(s => s.terms.some(t => t.price !== null || t.min_order !== null)).length, needs_review: items.filter(s => s.status === 'needs_review').length, unverified: items.filter(s => s.status === 'unverified').length, average_rating: items.length ? Math.round(items.reduce((sum, s) => sum + s.rating.value, 0) / items.length) : null, categories: Object.fromEntries(fixture.categories.map(c => [c.id, items.filter(s => s.categories.includes(c.id)).length])), sources: [...sources.values()].map(({ ids: _ids, ...source }) => source) }
}
export const categories = fixture.categories
export const regions = fixture.regions
export const emptyRating = structuredClone(fixture.items[0].rating) as Rating
