import { useState } from 'react'
import type { Filters } from './types'
import { defaultFilters } from './types'
import { validateFilters } from './filtering'
import type { TableColumn } from './components/SupplierTable'
import type { BrandVariant } from './components/Brand'

export const PREFERENCES_KEY = 'postavka.workspace.v2'
export interface SavedFilter { id: string; name: string; filters: Filters }
interface Preferences { layout: 'table' | 'cards'; columns: TableColumn[]; presets: SavedFilter[]; spacious: boolean; brand: BrandVariant }
const defaults: Preferences = { layout: 'cards', columns: ['region', 'terms', 'rating', 'status'], presets: [], spacious: true, brand: 'fsup' }
export function readPreferences(raw: string | null, _mobile = false): Preferences {
  if (!raw) return { ...defaults }
  const value = JSON.parse(raw)
  if (!value || !['table', 'cards'].includes(value.layout) || !Array.isArray(value.columns) || !Array.isArray(value.presets)) throw new Error('Повреждены настройки рабочего пространства')
  const columns: TableColumn[] = [...new Set<TableColumn>(value.columns.filter((column: unknown) => ['region', 'terms', 'rating', 'status', 'contacts'].includes(String(column))))]
  const presets = value.presets.filter((preset: SavedFilter) => {
    if (!preset || typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 60 || typeof preset.id !== 'string' || !preset.filters || typeof preset.filters !== 'object') return false
    const candidate = { ...defaultFilters, ...preset.filters }
    for (const [key, fallback] of Object.entries(defaultFilters)) {
      const entry = candidate[key as keyof Filters]
      if (fallback === null) { if (entry !== null && (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0 || entry > 1e12)) return false }
      else if (typeof entry !== typeof fallback) return false
      if (typeof entry === 'string' && entry.length > 400) return false
    }
    if (!['real', 'demo'].includes(candidate.mode) || !['relevance', 'name', 'completeness', 'region', 'rating', 'updated'].includes(candidate.sort) || !['', 'needs_review', 'unverified', 'source_checked'].includes(candidate.status) || !['RUB', 'USD', 'EUR'].includes(candidate.price_currency) || !Number.isInteger(candidate.min_rating) || candidate.min_rating < 0 || candidate.min_rating > 100) return false
    return !validateFilters(candidate)
  }).slice(0, 12)
  return { layout: value.layout, columns, presets, spacious: value.spacious !== false, brand: value.brand === 'postavka' ? 'postavka' : 'fsup' }
}
export function usePreferences() {
  const [initial] = useState(() => { try { return { value: readPreferences(localStorage.getItem(PREFERENCES_KEY), window.matchMedia('(max-width: 700px)').matches), error: '' } } catch { return { value: defaults, error: 'Не удалось прочитать настройки браузера. Они не будут перезаписаны.' } } })
  const [value, setValue] = useState(initial.value)
  const [error, setError] = useState(initial.error)
  function update(patch: Partial<Preferences>) {
    const next = { ...value, ...patch }
    setValue(next)
    if (initial.error) return false
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next)); setError(''); return true }
    catch { setError('Браузер не сохранил настройки. Они действуют только до закрытия страницы.'); return false }
  }
  return { value, update, error }
}
