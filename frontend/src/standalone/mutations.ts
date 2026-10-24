import type { Supplier, Term } from '../types'
import { emptyRating, normalize, readRealCatalog, saveRealCatalog, withDerived } from './catalog'

interface Input {
  name: string; category: string; source_url: string; website: string | null; inn: string | null
  description: string | null; city: string | null; region: string | null; address: string | null
  phone: string | null; email: string | null; delivery_info: string | null
  products: string[]; delivery_regions: string[]; terms: Omit<Term, 'source_url' | 'checked_at'>[]
  documents: { name: string; url: string }[]
}
export function publicUrl(value: string): string {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Нужен публичный HTTP(S) URL') }
  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port)) || !host.includes('.') || /\.(local|localhost|internal|example|invalid)$/.test(host) || /^\d+(\.\d+){3}$/.test(host) || host.includes(':') || !host.split('.').every(part => /^[a-z0-9-]+$/.test(part))) throw new Error('Укажите публичный домен HTTP(S) без логина, IP-адреса и нестандартного порта')
  url.hostname = host; url.hash = ''
  return url.href
}
export function validInn(value: string) {
  if (!/^([0-9]{10}|[0-9]{12})$/.test(value)) return false
  const digits = [...value].map(Number)
  const check = (weights: number[]) => weights.reduce((sum, w, i) => sum + w * digits[i], 0) % 11 % 10
  return value.length === 10 ? check([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9] : check([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[10] && check([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[11]
}
function validateInput(data: unknown): Input {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Некорректные данные поставщика')
  const value = data as Record<string, unknown>
  const text = (key: string, max: number, required = false, min = 1): string | null => {
    const entry = value[key]
    if ((entry === null || entry === undefined || entry === '') && !required) return null
    if (typeof entry !== 'string' || entry.trim().length < min || entry.trim().length > max) throw new Error(`Проверьте поле ${key}: от ${min} до ${max} символов`)
    return entry.trim()
  }
  const list = (key: string, max: number, length: number) => {
    const entry = value[key] ?? []
    if (!Array.isArray(entry) || entry.length > max || entry.some(s => typeof s !== 'string' || !s.trim() || s.trim().length > length)) throw new Error(`Проверьте список ${key}`)
    return [...new Set((entry as string[]).map(s => s.trim()))]
  }
  const name = text('name', 240, true, 2)!
  const category = text('category', 80, true)!
  if (!['dairy', 'frozen', 'packaging'].includes(category)) throw new Error('Неизвестная категория')
  const source_url = publicUrl(text('source_url', 2048, true)!)
  const website = text('website', 2048), inn = text('inn', 12), email = text('email', 254)
  if (inn && !validInn(inn)) throw new Error('Проверьте длину и контрольную сумму ИНН')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Некорректный email')
  const terms = value.terms ?? [], documents = value.documents ?? []
  if (!Array.isArray(terms) || terms.length > 20 || !Array.isArray(documents) || documents.length > 20) throw new Error('Максимум 20 условий и 20 документов')
  const cleanTerms = terms.map((term: Record<string, unknown>) => {
    if (!term || typeof term !== 'object') throw new Error('Некорректные условия')
    for (const key of ['product', 'unit', 'min_order_unit']) if (typeof term[key] !== 'string' || !(term[key] as string).trim() || (term[key] as string).length > (key === 'product' ? 160 : 40)) throw new Error('Для условия нужны товар и единицы измерения')
    for (const key of ['packaging', 'volume']) if (term[key] !== null && term[key] !== undefined && (typeof term[key] !== 'string' || (term[key] as string).length > 160)) throw new Error('Проверьте фасовку и объём')
    for (const key of ['price', 'min_order']) if (term[key] !== null && (typeof term[key] !== 'number' || !Number.isFinite(term[key]) || (term[key] as number) < 0 || (term[key] as number) > 1e12)) throw new Error('Цена и минимальный заказ должны быть числами от 0 до 10¹² либо не указаны')
    if (!['RUB', 'USD', 'EUR'].includes(String(term.currency))) throw new Error('Неизвестная валюта')
    return { product: String(term.product).trim(), unit: String(term.unit).trim(), currency: String(term.currency), price: term.price as number | null, min_order: term.min_order as number | null, min_order_unit: String(term.min_order_unit).trim(), packaging: (term.packaging as string)?.trim() || null, volume: (term.volume as string)?.trim() || null }
  })
  const cleanDocuments = documents.map((document: Record<string, unknown>) => {
    if (!document || typeof document.name !== 'string' || !document.name.trim() || document.name.length > 240 || typeof document.url !== 'string' || document.url.length > 2048) throw new Error('Нужны название и URL документа')
    return { name: document.name.trim(), url: publicUrl(document.url) }
  })
  return { name, category, source_url, website: website ? publicUrl(website) : null, inn, email, products: list('products', 40, 160), delivery_regions: list('delivery_regions', 20, 120), terms: cleanTerms, documents: cleanDocuments, description: text('description', 4000), city: text('city', 120), region: text('region', 120), address: text('address', 500), phone: text('phone', 100), delivery_info: text('delivery_info', 2000) }
}
const domain = (website: string | null) => website ? new URL(website).hostname.replace(/^www\./, '') : null
const unique = <T,>(values: T[]) => [...new Map(values.map(value => [JSON.stringify(value), value])).values()]
export function mutateSupplier(data: unknown, id?: string) {
  const input = validateInput(data), all = readRealCatalog(), now = new Date().toISOString()
  const matches = [
    { label: 'inn', items: input.inn ? all.filter(s => s.inn === input.inn) : [] },
    { label: 'domain', items: input.website ? all.filter(s => domain(s.website) === domain(input.website)) : [] },
    { label: 'name_address', items: input.address ? all.filter(s => normalize(s.name) === normalize(input.name) && s.address === input.address) : [] },
  ]
  let existing: Supplier | undefined, reason: string | null = null, ambiguous = false
  if (id) {
    existing = all.find(s => s.id === id)
    if (!existing) throw new Error('Реальная запись не найдена; демоданные не редактируются')
    if (matches.slice(0, 2).some(tier => tier.items.some(s => s.id !== id))) throw new Error('Другой поставщик уже использует этот ИНН или домен. Проверьте дубликат.')
  } else {
    const tier = matches.find(match => match.items.length)
    if (tier) {
      if (tier.items.length === 1 && !(input.inn && tier.items[0].inn && input.inn !== tier.items[0].inn)) { existing = tier.items[0]; reason = tier.label }
      else ambiguous = true
    }
  }
  const source = { url: input.source_url, name: id ? 'Изменение пользователем' : 'Добавлено пользователем', type: id ? 'manual_edit' : 'manual', retrieved_at: now, checked_at: null, status: 'unverified', claims: { ...input } }
  const contacts = (['phone', 'email'] as const).flatMap(kind => input[kind] ? [{ kind, value: input[kind]!, source_url: input.source_url, verification: 'user_supplied' }] : [])
  const terms = input.terms.map(t => ({ ...t, source_url: input.source_url, checked_at: null }))
  const documents = input.documents.map(d => ({ ...d, status: 'user_supplied' }))
  const products = [...new Set([...input.products, ...terms.map(t => t.product)])]
  let supplier: Supplier
  if (existing && !id) {
    supplier = structuredClone(existing)
    const conflictFields = ['name', 'description', 'city', 'region', 'address', 'website', 'inn', 'delivery_info'] as const
    for (const key of conflictFields) {
      if (input[key] && supplier[key] && input[key] !== supplier[key]) supplier.conflicts.push(`Различаются сведения: ${key}. См. значения в источниках.`)
      else if (input[key] && !supplier[key]) Object.assign(supplier, { [key]: input[key] })
    }
    supplier.conflicts = [...new Set(supplier.conflicts)]
    supplier.products = [...new Set([...supplier.products, ...products])]
    supplier.categories = [...new Set([...supplier.categories, input.category])]
    supplier.delivery_regions = [...new Set([...supplier.delivery_regions, ...input.delivery_regions])]
    supplier.contacts = unique([...supplier.contacts, ...contacts]); supplier.terms = unique([...supplier.terms, ...terms]); supplier.documents = unique([...supplier.documents, ...documents])
    if (!supplier.sources.some(s => s.url === source.url && JSON.stringify(s.claims) === JSON.stringify(source.claims))) supplier.sources.push(source)
  } else {
    const { phone: _phone, email: _email, category, source_url: _source, ...fields } = input
    const previous = existing ? Object.fromEntries(['name', 'description', 'city', 'region', 'address', 'website', 'inn', 'products', 'terms', 'documents', 'delivery_info', 'delivery_regions', 'contacts'].map(key => [key, existing![key as keyof Supplier]])) : null
    supplier = { ...fields, id: existing?.id || crypto.randomUUID(), categories: [category], products, contacts, terms, documents, sources: [...(existing?.sources || []), { ...source, ...(previous ? { previous } : {}) }], conflicts: existing?.conflicts || (ambiguous ? ['Возможный дубликат: требуется проверка оператором'] : []), is_demo: false, completeness: 0, checked_at: null, status: 'unverified', created_at: existing?.created_at || now, updated_at: now, rating: structuredClone(emptyRating), match: null, matched_term_index: null }
  }
  supplier.updated_at = now; supplier = withDerived(supplier)
  saveRealCatalog(existing ? all.map(s => s.id === supplier.id ? supplier : s) : [...all, supplier])
  return { supplier, created: !existing, matched_by: reason }
}
