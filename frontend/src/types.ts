export type Mode = 'real' | 'demo'
export interface Source {
  name: string; url: string; type: string; retrieved_at: string; checked_at: string | null
  status: string; claims?: Record<string, unknown>
  previous?: Record<string, unknown>
}
export interface Term {
  product: string; price: number | null; currency: string; unit: string
  packaging: string | null; volume: string | null; min_order: number | null
  min_order_unit: string; source_url: string; checked_at: string | null
}
export interface Supplier {
  id: string; name: string; description: string | null; inn: string | null
  website: string | null; city: string | null; region: string | null; address: string | null
  categories: string[]; products: string[]; delivery_regions: string[]; delivery_info: string | null
  contacts: { kind: 'phone' | 'email'; value: string; source_url: string; verification: string }[]
  terms: Term[]; documents: { name: string; url: string; status: string }[]
  sources: Source[]; conflicts: string[]; is_demo: boolean; completeness: number
  checked_at: string | null; status: 'needs_review' | 'unverified' | 'source_checked'
  created_at: string; updated_at: string
  rating: Rating
  match: { value: number; reasons: string[]; label: string } | null
  matched_term_index: number | null
}
export interface Rating {
  value: number; max: number; version: string; label: string; conflict_penalty: number; disclaimer: string
  criteria: { id: string; name: string; points: number; max: number; explanation: string }[]
}
export interface Filters {
  q: string; category: string; region: string; delivery_region: string
  website: boolean; contacts: boolean; min_order: boolean; delivery: boolean; documents: boolean
  verified_contacts: boolean
  commercial: boolean
  mode: Mode; sort: 'relevance' | 'name' | 'completeness' | 'region' | 'rating' | 'updated'
  status: '' | 'needs_review' | 'unverified' | 'source_checked'; min_rating: number
  price_product: string; price_unit: string; price_currency: 'RUB' | 'USD' | 'EUR'
  price_from: number | null; price_to: number | null; order_unit: string
  order_from: number | null; order_to: number | null
}
export interface CatalogPage { items: Supplier[]; total: number; page: number; page_size: number }
export interface Meta {
  categories: { id: string; name: string; description: string }[]
  regions: string[]; counts: Record<Mode, number>; stale_days: number
}
export const defaultFilters: Filters = {
  q: '', category: '', region: '', delivery_region: '', website: false, contacts: false,
  min_order: false, delivery: false, documents: false, mode: 'real', sort: 'relevance',
  verified_contacts: false,
  commercial: false,
  status: '', min_rating: 0, price_product: '', price_unit: '', price_currency: 'RUB',
  price_from: null, price_to: null, order_unit: '', order_from: null, order_to: null,
}
export interface Overview {
  total: number; with_contacts: number; with_terms: number; needs_review: number; unverified: number
  average_rating: number | null; categories: Record<string, number>
  sources: { url: string; name: string; type: string; retrieved_at: string; checked_at: string | null; supplier_count: number }[]
}
