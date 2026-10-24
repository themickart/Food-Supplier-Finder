import { useState } from 'react'

export interface LocalData {
  version: 1; favorites: string[]; notes: Record<string, string>; history: { q: string; region: string; at: string }[]
}
const EMPTY: LocalData = { version: 1, favorites: [], notes: {}, history: [] }
export const STORAGE_KEY = 'postavka.personal.v1'
export const LOCAL_ERROR = 'Браузер не разрешил сохранить данные. Избранное и заметки доступны только до закрытия страницы.'

export function readLocal(raw: string | null): LocalData {
  if (!raw) return { ...EMPTY, favorites: [], notes: {}, history: [] }
  try {
    const value = JSON.parse(raw)
    if (value.version !== 1 || !Array.isArray(value.favorites) || !value.notes || typeof value.notes !== 'object' || !Array.isArray(value.history)) throw new Error()
    return { version: 1,
      favorites: value.favorites.filter((id: unknown) => typeof id === 'string' && id.length <= 36).slice(0, 500),
      notes: Object.fromEntries(Object.entries(value.notes).filter(([id, note]) => id.length <= 36 && typeof note === 'string' && note.length <= 5000)) as Record<string, string>,
      history: value.history.filter((item: { q: unknown; region: unknown; at: unknown }) => typeof item.q === 'string' && item.q.length <= 400 && typeof item.region === 'string' && typeof item.at === 'string').slice(0, 10),
    }
  } catch { throw new Error('Локальные данные повреждены. Они не перезаписаны. Можно скачать резервную копию и очистить их в настройках браузера.') }
}

export function useLocalData() {
  const [initial] = useState(() => {
    try { return { data: readLocal(localStorage.getItem(STORAGE_KEY)), error: '' } }
    catch (error) { return { data: { ...EMPTY }, error: (error as Error).message } }
  })
  const [data, setData] = useState<LocalData>(initial.data)
  const [error, setError] = useState(initial.error)
  function save(next: LocalData) {
    setData(next)
    if (initial.error) { setError(initial.error); return false }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setError(''); return true }
    catch { setError(LOCAL_ERROR); return false }
  }
  function toggle(id: string) {
    if (!data.favorites.includes(id) && data.favorites.length >= 500) throw new Error('В избранном максимум 500 поставщиков')
    save({ ...data, favorites: data.favorites.includes(id) ? data.favorites.filter(value => value !== id) : [...data.favorites, id] })
  }
  function note(id: string, content: string) {
    const notes = { ...data.notes }
    if (content.trim()) notes[id] = content.trim().slice(0, 5000)
    else delete notes[id]
    return save({ ...data, notes })
  }
  function history(q: string, region: string) {
    if (!q.trim()) return
    save({ ...data, history: [{ q: q.trim(), region, at: new Date().toISOString() }, ...data.history.filter(item => item.q !== q.trim() || item.region !== region)].slice(0, 10) })
  }
  function bulkFavorites(ids: string[], add: boolean) {
    const next = add ? [...new Set([...data.favorites, ...ids])] : data.favorites.filter(id => !ids.includes(id))
    if (next.length > 500) throw new Error('В избранном максимум 500 поставщиков')
    return save({ ...data, favorites: next })
  }
  function clearHistory() { return save({ ...data, history: [] }) }
  return { data, error, toggle, note, history, bulkFavorites, clearHistory }
}
