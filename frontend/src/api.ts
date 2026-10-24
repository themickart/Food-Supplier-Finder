import type { CatalogPage, Filters, Meta, Mode, Overview, Supplier } from './types'
import { standalone } from './runtime'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch('/api/v1' + path, options) }
  catch { throw new Error('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.') }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.details?.join('\n') || body?.error?.message || `Ошибка сервера (${response.status})`)
  }
  return response.json() as Promise<T>
}
const json = (data: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
const serverApi = {
  meta: () => request<Meta>('/meta'),
  overview: (mode: Mode) => request<Overview>(`/overview?mode=${mode}`),
  catalog: (filters: Filters, page: number, signal?: AbortSignal, pageSize = 12) => request<CatalogPage>('/suppliers?' + new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== null).map(([k, v]) => [k, String(v)])), page: String(page), page_size: String(pageSize) }), { signal }),
  detail: (id: string, mode: Mode) => request<Supplier>(`/suppliers/${encodeURIComponent(id)}?mode=${mode}`),
  compare: (ids: string[], mode: Mode, filters?: Filters) => request<{ items: Supplier[]; notice: string }>('/compare', json({ ids, mode, filters })),
  collection: (ids: string[], filters: Filters, page: number, page_size = 12) => request<CatalogPage>('/collection', json({ ids, filters, page, page_size })),
  import: (data: unknown) => request<{ supplier: Supplier; created: boolean; matched_by: string | null }>('/suppliers/import', json(data)),
  edit: (id: string, data: unknown) => request<{ supplier: Supplier; created: boolean; matched_by: string | null }>(`/suppliers/${encodeURIComponent(id)}`, { ...json(data), method: 'PATCH' }),
  search: (filters: Filters) => request<{ external: { message: string }; status: string }>('/search', json({ filters, external: true })),
  async export(format: 'csv' | 'xlsx', filters: Filters, ids: string[], notes: Record<string, string>, include_notes: boolean) {
    const response = await fetch('/api/v1/export', json({ format, filters, ids, notes: include_notes ? notes : {}, include_notes }))
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.error?.message || 'Не удалось сформировать выгрузку')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `${filters.mode === 'demo' ? 'demo-' : ''}suppliers.${format}`
    document.body.append(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}

// Load the browser engine only in the static build. Server mode retains its
// existing API and database, and excludes the Pages fixture from its bundle.
export const api: typeof serverApi = standalone ? (await import('./standalone/api')).browserApi : serverApi
