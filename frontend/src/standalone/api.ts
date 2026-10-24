import type { Filters, Mode } from '../types'
import { catalogPage, categories, filterCatalog, overview, readRealCatalog, regions, selected, suppliersFor } from './catalog'
import { mutateSupplier } from './mutations'

// Keep the same public interface as the server adapter. No API is simulated:
// operations below really read/write this browser's explicitly local catalogue.
export const browserApi = {
  meta: async () => ({ categories, regions: [...new Set([...regions, ...readRealCatalog().flatMap(s => s.city ? [s.city] : [])])].sort(), counts: { real: readRealCatalog().length, demo: suppliersFor('demo').length }, stale_days: 90 }),
  overview: async (mode: Mode) => overview(mode),
  catalog: async (filters: Filters, page: number, _signal?: AbortSignal, pageSize = 12) => catalogPage(filters, page, pageSize),
  detail: async (id: string, mode: Mode) => selected([id], mode)[0],
  compare: async (ids: string[], mode: Mode, filters?: Filters) => {
    if (!ids.length || new Set(ids).size > 5) throw new Error('Выберите от 1 до 5 поставщиков')
    return { items: selected(ids, mode, filters), notice: 'Сопоставляйте одинаковые товары и единицы. Данные не подтверждают готовность к поставке.' }
  },
  collection: async (ids: string[], filters: Filters, page: number, pageSize = 12) => catalogPage(filters, page, pageSize, ids),
  import: async (data: unknown) => mutateSupplier(data),
  edit: async (id: string, data: unknown) => mutateSupplier(data, id),
  search: async (_filters: Filters) => ({ status: 'partial', external: { message: 'Внешний поиск не подключён. GitHub Pages показывает автономную демонстрацию. Выдача содержит только каталог этого браузера или явно вымышленные демоданные.' } }),
  export: async (format: 'csv' | 'xlsx', filters: Filters, ids: string[], notes: Record<string, string>, includeNotes: boolean) => {
    const { exportFile } = await import('./export')
    const items = ids.length ? selected(ids, filters.mode) : filterCatalog(suppliersFor(filters.mode), filters)
    exportFile(format, items, notes, includeNotes, filters.mode === 'demo')
  },
}
