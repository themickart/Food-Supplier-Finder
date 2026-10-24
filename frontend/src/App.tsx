import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, CircleHelp, Clock3, Columns3, Database, GitCompareArrows, Grid2X2, Info, Layers3, List, LoaderCircle, Menu, Package, Plus, RefreshCw, Save, Search, ShieldCheck, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { api } from './api'
import { useLocalData } from './local'
import { usePreferences } from './preferences'
import { categoryName } from './format'
import { activeFilterEntries, validateFilters } from './filtering'
import type { CatalogPage, Filters, Meta, Mode, Overview, Supplier } from './types'
import { defaultFilters } from './types'
import SupplierCard from './components/SupplierCard'
import SupplierTable, { tableColumns, type SupplierActions, type TableColumn } from './components/SupplierTable'
import SupplierDetail, { type DetailTab } from './components/SupplierDetail'
import Compare from './components/Compare'
import ImportForm from './components/ImportForm'
import Modal from './components/Modal'
import RatingModal from './components/Rating'
import FilterPanel from './components/FilterPanel'
import ProjectStatus from './components/ProjectStatus'
import Sources from './components/Sources'
import Brand from './components/Brand'
import HostingNotice from './components/HostingNotice'
import { standalone } from './runtime'

type View = 'catalog' | 'favorites' | 'compare' | 'history' | 'scope' | 'sources'
const titles: Record<View, string> = { catalog: 'Каталог поставщиков', favorites: 'Избранные поставщики', compare: 'Сравнение поставщиков', history: 'История поиска', scope: 'Возможности проекта', sources: 'Источники и интеграции' }
const descriptions: Record<View, string> = {
  catalog: 'Ищите, проверяйте сведения и собирайте свой список для закупки.', favorites: 'Компании, которые вы сохранили. Только в этом браузере.',
  compare: 'Ассортимент, условия и происхождение сведений в одной таблице.', history: 'Вернитесь к предыдущим запросам или начните новый поиск.',
  scope: 'Открытый чек-лист функций, ограничений и следующих этапов.', sources: 'Откуда берутся сведения и что действительно подключено.',
}
const emptyPage: CatalogPage = { items: [], total: 0, page: 1, page_size: 12 }

export default function App() {
  const local = useLocalData()
  const preferences = usePreferences()
  const [meta, setMeta] = useState<Meta | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [overviewError, setOverviewError] = useState('')
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters })
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('catalog')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [result, setResult] = useState<CatalogPage>(emptyPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [compared, setCompared] = useState<Supplier[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [detail, setDetail] = useState<{ supplier: Supplier; tab: DetailTab } | null>(null)
  const [rating, setRating] = useState<Supplier | null>(null)
  const [editor, setEditor] = useState<Supplier | 'new' | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [presetDraft, setPresetDraft] = useState<Filters | null>(null)
  const [presetName, setPresetName] = useState('')
  const [toast, setToast] = useState('')
  const [externalNotice, setExternalNotice] = useState('')
  const [externalBusy, setExternalBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState('')
  const [includeNotes, setIncludeNotes] = useState(false)
  const [exportScope, setExportScope] = useState<'selected' | 'filtered'>('filtered')
  const compareRevision = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const catalogView = view === 'catalog' || view === 'favorites'
  const mode = filters.mode

  useEffect(() => { document.title = `${preferences.value.brand === 'fsup' ? 'FSUP' : 'Поставка'} — каталог поставщиков` }, [preferences.value.brand])
  useEffect(() => { api.meta().then(setMeta).catch(() => {}) }, [revision])
  useEffect(() => {
    let active = true; setOverview(null); setOverviewError('')
    api.overview(mode).then(value => { if (active) setOverview(value) }).catch(() => { if (active) setOverviewError('Не удалось получить сводку каталога') })
    return () => { active = false }
  }, [mode, revision])
  useEffect(() => {
    if (!catalogView) { setLoading(false); return }
    let active = true
    const controller = new AbortController()
    setLoading(true); setError('')
    const request = view === 'favorites' ? api.collection(local.data.favorites, filters, page, pageSize) : api.catalog(filters, page, controller.signal, pageSize)
    request.then(data => { if (active) { if (page > 1 && data.items.length === 0) setPage(1); else setResult(data) } }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [filters, page, pageSize, view, catalogView, revision, local.data.favorites])
  useEffect(() => {
    if (query.trim() === filters.q || !catalogView) return
    const timer = setTimeout(() => changeFilters({ q: query.trim() }), 400)
    return () => clearTimeout(timer)
  }, [query, filters.q, catalogView])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer) }, [toast])
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); navigate('catalog'); setTimeout(() => input.current?.focus(), 0) }
      if (event.key === 'Escape') setMobileMenu(false)
    }
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut)
  }, [])

  function changeFilters(patch: Partial<Filters>) { setFilters(current => ({ ...current, ...patch })); setPage(1); setSelected([]) }
  function navigate(next: View) { setView(next); setPage(1); setSelected([]); setError(''); setMobileMenu(false); setExternalNotice('') }
  function switchMode(next: Mode) { compareRevision.current++; setCompared([]); setDetail(null); changeFilters({ mode: next }); if (view === 'compare') navigate('catalog') }
  function applyFilters(next: Filters) { const problem = validateFilters(next); if (problem) { setToast(problem); return }; setQuery(next.q); changeFilters(next); setFiltersOpen(false); if (next.q) local.history(next.q, next.region) }
  function resetFilters() { setQuery(''); changeFilters({ ...defaultFilters, mode }); setExternalNotice('') }
  function favorite(id: string) { try { local.toggle(id) } catch (error) { setToast((error as Error).message) } }
  function toggleCompare(supplier: Supplier) {
    compareRevision.current++
    if (compared.some(item => item.id === supplier.id)) { setCompared(current => current.filter(item => item.id !== supplier.id)); return }
    if (compared.length >= 5) { setToast('Можно сравнить до 5 поставщиков. Уберите одну компанию, чтобы добавить другую.'); return }
    setCompared(current => [...current, supplier])
  }
  async function openCompare(ids = compared.map(supplier => supplier.id)) {
    const unique = [...new Set(ids)]
    if (unique.length > 5) { setToast('Для сравнения выберите максимум 5 поставщиков'); return }
    const currentRevision = ++compareRevision.current
    try { if (unique.length) { const data = await api.compare(unique, mode, filters); if (currentRevision !== compareRevision.current) return; setCompared(data.items) }; navigate('compare') }
    catch (error) { setToast((error as Error).message) }
  }
  function search(event: FormEvent) { event.preventDefault(); changeFilters({ q: query.trim() }); local.history(query, filters.region) }
  function select(id: string) { setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 1000 ? [...current, id] : current) }
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setToast('Скопировано в буфер обмена') } catch { setToast('Браузер не разрешил копирование. Скопируйте текст вручную.') } }
  async function externalSearch() {
    if (!filters.q && !filters.category && !filters.region) { setExternalNotice('Для внешнего поиска укажите товар, категорию или регион. Источник пока не подключён.'); return }
    setExternalBusy(true)
    try { const response = await api.search(filters); setExternalNotice(response.external.message) } catch (error) { setExternalNotice((error as Error).message) } finally { setExternalBusy(false) }
  }
  function openExport() { setExportScope(selected.length ? 'selected' : 'filtered'); setExportError(''); setExportOpen(true) }
  async function exportFile(format: 'csv' | 'xlsx') {
    setExportBusy(true); setExportError('')
    try {
      let ids = exportScope === 'selected' ? selected : []
      if (exportScope === 'filtered' && view === 'favorites') {
        const pages = await Promise.all(Array.from({ length: Math.ceil(result.total / pageSize) }, (_, i) => api.collection(local.data.favorites, filters, i + 1, pageSize)))
        ids = pages.flatMap(value => value.items.map(supplier => supplier.id)); if (!ids.length) throw new Error('Нет записей для экспорта')
      }
      await api.export(format, filters, ids, local.data.notes, includeNotes); setExportOpen(false); setToast(`Выгрузка ${format.toUpperCase()} подготовлена`)
    } catch (error) { setExportError((error as Error).message) } finally { setExportBusy(false) }
  }
  async function exportOne(supplier: Supplier) {
    try { await api.export('csv', { ...defaultFilters, mode: supplier.is_demo ? 'demo' : 'real' }, [supplier.id], {}, false); setToast('Поставщик экспортирован в CSV') }
    catch (error) { setToast((error as Error).message) }
  }
  function savePreset(event: FormEvent) {
    event.preventDefault(); if (!presetDraft || !presetName.trim()) return
    if (preferences.value.presets.length >= 12) { setToast('Можно сохранить до 12 наборов фильтров'); return }
    const success = preferences.update({ presets: [...preferences.value.presets, { id: crypto.randomUUID(), name: presetName.trim(), filters: presetDraft }] })
    setPresetDraft(null); setPresetName(''); setToast(success ? 'Набор фильтров сохранён в браузере' : 'Набор доступен только до закрытия страницы: браузер не сохранил настройки')
  }
  const filterEntries = activeFilterEntries(filters)
  const allPageSelected = result.items.length > 0 && result.items.every(supplier => selected.includes(supplier.id))
  const favoriteCount = local.data.favorites.filter(id => mode === 'demo' ? id.startsWith('demo-') : !id.startsWith('demo-')).length
  const categoryTotal = view === 'favorites' ? favoriteCount : overview?.total
  const actions: SupplierActions = {
    open: (supplier, tab = 'overview') => setDetail({ supplier, tab }), rate: setRating, favorite, compare: toggleCompare,
    edit: supplier => { setDetail(null); setEditor(supplier) }, exportOne: supplier => void exportOne(supplier), favorites: local.data.favorites,
    compared, selected, select, copy: value => void copy(value), filterRegion: region => changeFilters({ region }),
  }
  const navigation = [
    { id: 'catalog' as View, name: 'Каталог поставщиков', icon: Database, count: meta?.counts[mode] },
    { id: 'favorites' as View, name: 'Избранное', icon: Bookmark, count: favoriteCount },
    { id: 'compare' as View, name: 'Сравнение', icon: GitCompareArrows, count: compared.length },
    { id: 'history' as View, name: 'История поиска', icon: Clock3, count: local.data.history.length },
  ]

  return <div className={`app-shell ${preferences.value.spacious ? '' : 'compact-density'}`}>
    {mobileMenu && <button className="sidebar-backdrop" aria-label="Закрыть меню" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <Brand variant={preferences.value.brand} open={() => navigate('catalog')} />
      <div className="workspace"><div className="workspace-icon"><Package size={19} /></div><div><strong>Закупки и поставщики</strong><small>Рабочее пространство</small></div></div>
      <div className="nav-label">РАБОЧИЕ ИНСТРУМЕНТЫ</div><nav className="main-nav" aria-label="Основная навигация">{navigation.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => item.id === 'compare' ? void openCompare() : navigate(item.id)}><item.icon size={19} />{item.name}{!!item.count && <span className="nav-count">{item.count}</span>}</button>)}</nav>
      <div className="nav-label">ДАННЫЕ И ПРОДУКТ</div><nav className="main-nav secondary-nav"><button className={view === 'sources' ? 'active' : ''} onClick={() => navigate('sources')}><ShieldCheck size={19} />Источники и интеграции</button><button className={view === 'scope' ? 'active' : ''} onClick={() => navigate('scope')}><Layers3 size={19} />Возможности проекта<span className="new-badge">ОБЗОР</span></button></nav>
      <div className="sidebar-bottom"><div className="scope-promo"><div className="scope-promo-icon"><Check size={18} /></div><strong>Всё прозрачно</strong><p>Что работает, что ограничено и что будет дальше.</p><button onClick={() => navigate('scope')}>Посмотреть чек-лист<ArrowUpRight size={16} /></button></div><button className="help-link" onClick={() => { setMobileMenu(false); setAboutOpen(true) }}><CircleHelp size={18} />О сервисе и хранении</button><div className="local-profile"><div>В</div><span><strong>Ваше пространство</strong><small>Один пользователь · локально</small></span><span className="online-dot" /></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Открыть меню" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><span>Рабочее пространство</span><span>/</span><strong>{titles[view]}</strong></div><div className="topbar-right"><button className="topbar-shortcut" onClick={() => { navigate('catalog'); setTimeout(() => input.current?.focus(), 0) }}><Search size={17} />Быстрый поиск<kbd>Ctrl K</kbd></button><button className="icon-button" aria-label="О сервисе" onClick={() => setAboutOpen(true)}><CircleHelp size={20} /></button><div className="avatar">В</div></div></header>
      <div className={`page-content view-${view}`}><div className="page-heading"><div><div className="eyebrow">{preferences.value.brand === 'fsup' ? 'FOOD SUPPLIER WORKSPACE' : 'FOOD SUPPLIER FINDER'}<span className="version-tag">ПРОТОТИП</span></div><h1>{titles[view]}</h1><p>{descriptions[view]}</p></div><div className="heading-actions"><button className="button secondary" onClick={() => { setRevision(value => value + 1); setToast('Данные каталога обновляются') }} aria-label="Обновить каталог"><RefreshCw size={17} /></button><button className="button primary add-supplier" onClick={() => setEditor('new')}><Plus size={18} />Добавить поставщика</button></div></div>
        {standalone && <HostingNotice />}<div className="mode-row"><div className="mode-switch" role="group" aria-label="Режим каталога"><button className={mode === 'real' ? 'active' : ''} onClick={() => switchMode('real')}><span className="mode-dot" />{standalone ? 'Локальный каталог' : 'Реальный каталог'}<span>{meta?.counts.real ?? '…'}</span></button><button className={mode === 'demo' ? 'active' : ''} onClick={() => switchMode('demo')}>Деморежим<span>{meta?.counts.demo ?? '…'}</span></button></div><button className="mode-caption" onClick={() => navigate('sources')}><ShieldCheck size={16} />Источники и даты в каждой карточке<ArrowUpRight size={14} /></button></div>
        {mode === 'demo' && <div className="demo-banner"><Info size={19} /><span><strong>Демонстрационный каталог.</strong> Компании, контакты и цены вымышлены. Все инструменты можно попробовать.</span><button onClick={() => switchMode('real')}>К реальным данным<ArrowRight size={15} /></button></div>}
        {(local.error || preferences.error) && <div className="notice danger" role="alert">{local.error || preferences.error}</div>}
        {catalogView && <>
          {view === 'catalog' && <div className="metrics-grid" aria-label="Сводка по всему каталогу"><button className={`metric-card ${!filters.contacts && !filters.commercial && !filters.status ? 'current' : ''}`} onClick={resetFilters}><div><span>Всего поставщиков</span><Database size={18} /></div><strong>{categoryTotal ?? '—'}</strong><small>{mode === 'demo' ? 'Во всём демокаталоге' : 'Во всём реальном каталоге'}</small></button><button className={`metric-card ${filters.contacts ? 'current' : ''}`} onClick={() => changeFilters({ contacts: !filters.contacts })}><div><span>С контактами</span><Bookmark size={18} /></div><strong>{overview?.with_contacts ?? '—'}<ArrowUpRight size={19} /></strong><small>Перейти к контактам и запросу КП</small></button><button className={`metric-card ${filters.commercial ? 'current' : ''}`} onClick={() => changeFilters({ commercial: !filters.commercial })}><div><span>С условиями закупки</span><Package size={18} /></div><strong>{overview?.with_terms ?? '—'}<ArrowUpRight size={19} /></strong><small>Есть цена или минимальный заказ</small></button><button className={`metric-card attention ${filters.status === 'needs_review' ? 'current' : ''}`} onClick={() => changeFilters({ status: filters.status === 'needs_review' ? '' : 'needs_review' })}><div><span>Требуют перепроверки</span><Clock3 size={18} /></div><strong>{overview?.needs_review ?? '—'}<ArrowUpRight size={19} /></strong><small>Устаревшие сведения или конфликт</small></button></div>}
          {overviewError && <div className="notice neutral">{overviewError}<button className="inline-link" onClick={() => setRevision(value => value + 1)}>Повторить</button></div>}
          <section className="catalog-workbench" aria-label="Поиск и фильтры каталога">
            <div className="catalog-topline"><div className="catalog-tabs"><button className={!filters.category ? 'active' : ''} onClick={() => changeFilters({ category: '' })}>Все категории<span>{categoryTotal ?? '—'}</span></button>{Object.entries(categoryName).map(([id, name]) => <button className={filters.category === id ? 'active' : ''} key={id} onClick={() => changeFilters({ category: filters.category === id ? '' : id })}>{name}<span>{overview?.categories[id] ?? '—'}</span></button>)}</div></div>
            <div className="catalog-search-row"><form className="catalog-search" onSubmit={search}><Search size={20} /><input ref={input} aria-label="Товар или компания" placeholder="Название компании, товар или категория…" maxLength={400} value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" className="icon-button" aria-label="Очистить запрос" onClick={() => { setQuery(''); changeFilters({ q: '' }) }}><X size={17} /></button>}<button className="search-submit" aria-label="Найти поставщиков"><ArrowRight size={18} /></button></form><select aria-label="Регион поиска" value={filters.region} onChange={event => changeFilters({ region: event.target.value })}><option value="">Все регионы</option>{meta?.regions.map(region => <option key={region}>{region}</option>)}</select><button className={`button ${filtersOpen ? 'primary' : 'secondary'} filter-trigger`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(current => !current)}><SlidersHorizontal size={18} />Фильтры{filterEntries.length > 0 && <span className="filter-count">{filterEntries.length}</span>}</button><button className="button secondary save-search" title="Сохранить текущие условия поиска" onClick={() => { setPresetName(''); setPresetDraft(filters) }}><Save size={17} />Сохранить поиск</button></div>
            <div className="quick-filters"><span>Быстрые фильтры</span>{([['contacts', 'С контактами'], ['delivery', 'С доставкой'], ['documents', 'С документами']] as const).map(([key, name]) => <button className={filters[key] ? 'active' : ''} key={key} aria-pressed={filters[key]} onClick={() => changeFilters({ [key]: !filters[key] })}>{filters[key] && <Check size={13} />}{name}</button>)}<button className={filters.min_rating === 75 ? 'active' : ''} aria-pressed={filters.min_rating === 75} onClick={() => changeFilters({ min_rating: filters.min_rating === 75 ? 0 : 75 })}>Индекс 75+</button><button className="filter-help-button" onClick={() => setAboutOpen(true)}><CircleHelp size={15} />Как искать</button></div>
            {preferences.value.presets.length > 0 && <div className="saved-searches"><span><Save size={14} />Мои поиски</span>{preferences.value.presets.map(preset => <div className="saved-search" key={preset.id}><button onClick={() => applyFilters({ ...defaultFilters, ...preset.filters, mode })}>{preset.name}</button><button aria-label={`Удалить поиск: ${preset.name}`} onClick={() => preferences.update({ presets: preferences.value.presets.filter(item => item.id !== preset.id) })}><X size={13} /></button></div>)}</div>}
          </section>
          {filtersOpen && <FilterPanel key={JSON.stringify(filters)} initial={filters} meta={meta} apply={applyFilters} close={() => setFiltersOpen(false)} savePreset={next => { setPresetName(''); setPresetDraft(next) }} />}
          {filterEntries.length > 0 && <div className="active-filters"><span>Применено:</span>{filterEntries.map(([key, name]) => <button key={key} onClick={() => { if (key === 'q') setQuery(''); if (key === 'price_unit' || key === 'price_product') changeFilters({ [key]: defaultFilters[key], price_from: null, price_to: null }); else if (key === 'order_unit') changeFilters({ order_unit: '', order_from: null, order_to: null }); else changeFilters({ [key]: defaultFilters[key] }) }}>{typeof filters[key] === 'boolean' ? name : `${name}: ${key === 'category' ? categoryName[String(filters[key])] : key === 'status' ? ({ needs_review: 'перепроверить', unverified: 'не проверено', source_checked: 'есть проверка' })[filters.status as 'needs_review'] : filters[key]}`}<X size={13} /></button>)}<button className="clear-all" onClick={resetFilters}>Сбросить всё</button></div>}
          <section className="results-section" aria-label="Результаты поиска"><div className="results-toolbar"><div className="result-count"><h2>{view === 'favorites' ? 'Сохранённые компании' : 'Найденные поставщики'}<span>{loading ? '…' : result.total}</span></h2><span>{filterEntries.length ? 'По текущим условиям' : 'Все записи выбранного каталога'}</span></div><div className="results-controls"><select aria-label="Сортировка" value={filters.sort} onChange={event => changeFilters({ sort: event.target.value as Filters['sort'] })}><option value="relevance">По релевантности</option><option value="rating">По индексу данных</option><option value="name">По названию</option><option value="completeness">По полноте сведений</option><option value="region">По расположению</option><option value="updated">Недавно обновлённые</option></select><div className="view-switch" role="group" aria-label="Вид каталога"><button className={preferences.value.layout === 'cards' ? 'active' : ''} aria-label="Карточки" aria-pressed={preferences.value.layout === 'cards'} onClick={() => preferences.update({ layout: 'cards' })}><Grid2X2 size={18} /></button><button className={preferences.value.layout === 'table' ? 'active' : ''} aria-label="Таблица" aria-pressed={preferences.value.layout === 'table'} onClick={() => preferences.update({ layout: 'table' })}><List size={19} /></button></div><button className="button secondary columns-button" aria-label="Настроить столбцы" onClick={() => setColumnsOpen(true)}><Columns3 size={17} /></button><button className="button secondary" disabled={loading || !!error || result.total === 0} onClick={openExport}><ArrowDownToLine size={17} />Экспорт</button></div></div>
            {!loading && !error && result.total > 0 && <div className={`selection-line ${selected.length ? 'has-selection' : ''}`}><label><input type="checkbox" aria-label="Выбрать поставщиков на странице" checked={allPageSelected} onChange={() => setSelected(current => allPageSelected ? current.filter(id => !result.items.some(supplier => supplier.id === id)) : [...new Set([...current, ...result.items.map(supplier => supplier.id)])].slice(0, 1000))} />{selected.length ? `Выбрано: ${selected.length}` : 'Выбрать на странице'}</label>{selected.length > 0 ? <div className="bulk-actions"><button onClick={() => void openCompare(selected)}><GitCompareArrows size={16} />Сравнить</button><button onClick={() => { try { const success = local.bulkFavorites(selected, view !== 'favorites'); setToast(success ? view === 'favorites' ? 'Выбранные компании убраны из избранного' : 'Выбранные компании добавлены в избранное' : 'Изменение доступно до закрытия страницы: браузер не сохранил данные') } catch (error) { setToast((error as Error).message) } }}><Bookmark size={16} />{view === 'favorites' ? 'Убрать из избранного' : 'В избранное'}</button><button onClick={openExport}><ArrowDownToLine size={16} />Выгрузить выбранное</button><button aria-label="Снять выбор" onClick={() => setSelected([])}><X size={16} /></button></div> : <span>Выберите компании для сравнения, избранного или экспорта</span>}</div>}
            {error ? <div className="empty-state error-state" role="alert"><Info size={34} /><h3>Не удалось загрузить каталог</h3><p>{error}</p><button className="button primary" onClick={() => setRevision(value => value + 1)}>Повторить</button></div> : loading ? <div className="catalog-loading" aria-busy="true"><LoaderCircle className="spin" size={25} /><span>Загружаем поставщиков…</span></div> : result.total === 0 ? <div className="empty-state"><div className="empty-icon">{view === 'favorites' ? <Bookmark size={31} /> : <Search size={31} />}</div><h3>{view === 'favorites' ? 'Здесь будут ваши поставщики' : filterEntries.length ? 'Совпадений пока нет' : 'Добавьте первого поставщика'}</h3><p>{view === 'favorites' ? 'Сохраните компании из каталога с помощью закладки. Они останутся в этом браузере.' : filterEntries.length ? 'Измените товар, регион или уберите часть условий. Неизвестные сведения не проходят фильтры наличия.' : 'Начните с реальной компании и ссылки на источник. Или откройте деморежим, чтобы проверить все инструменты.'}</p><div className="empty-actions"><button className="button secondary" onClick={() => filterEntries.length ? resetFilters() : setEditor('new')}>{filterEntries.length ? 'Сбросить фильтры' : 'Добавить поставщика'}</button>{mode === 'real' ? <button className="button primary" onClick={() => { resetFilters(); switchMode('demo'); navigate('catalog') }}>Посмотреть демокаталог<ArrowRight size={17} /></button> : view === 'favorites' && <button className="button primary" onClick={() => navigate('catalog')}>Открыть каталог<ArrowRight size={17} /></button>}</div></div> : preferences.value.layout === 'table' ? <SupplierTable suppliers={result.items} columns={preferences.value.columns} actions={actions} /> : <div className="card-grid">{result.items.map(supplier => <SupplierCard supplier={supplier} actions={actions} key={supplier.id} />)}</div>}
            {!loading && !error && result.total > 0 && <div className="pagination"><label>На странице<select aria-label="Количество на странице" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option>12</option><option>24</option><option>48</option></select></label><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, result.total)} из {result.total}</span><div><button className="icon-button" aria-label="Предыдущая страница" disabled={page === 1} onClick={() => setPage(value => value - 1)}><ArrowLeft size={17} /></button><span>{page}</span><button className="icon-button" aria-label="Следующая страница" disabled={page * pageSize >= result.total} onClick={() => setPage(value => value + 1)}><ArrowRight size={17} /></button></div></div>}
            <div className="external-search"><div className="external-icon"><Database size={20} /></div><div><strong>Поиск по вашему каталогу</strong><p>Внешний источник пока не подключён. Реальные и демонстрационные данные разделены.</p></div><button className="button text" disabled={externalBusy} onClick={() => void externalSearch()}>{externalBusy ? <LoaderCircle className="spin" size={16} /> : <Info size={16} />}Статус подключения</button></div>{externalNotice && <div className="notice neutral" role="status">{externalNotice}</div>}
          </section>
        </>}
        {view === 'compare' && (compared.length ? <Compare items={compared} remove={id => { compareRevision.current++; setCompared(current => current.filter(supplier => supplier.id !== id)) }} open={supplier => setDetail({ supplier, tab: 'overview' })} favorite={local.data.favorites} toggleFavorite={favorite} rate={setRating} /> : <div className="empty-state"><div className="empty-icon"><GitCompareArrows size={32} /></div><h3>Выберите компании для сравнения</h3><p>Добавьте до пяти поставщиков из таблицы или карточек каталога.</p><button className="button primary" onClick={() => navigate('catalog')}>Открыть каталог<ArrowRight size={17} /></button></div>)}
        {view === 'history' && <section className="history-list"><div className="section-title"><div><h2>Последние запросы</h2><p>До 10 запросов. История хранится локально.</p></div><button className="button secondary" disabled={!local.data.history.length} onClick={() => setToast(local.clearHistory() ? 'История поиска очищена' : 'Браузер не сохранил очистку истории')}><Trash2 size={16} />Очистить историю</button></div>{local.data.history.length ? local.data.history.map((item, i) => <button className="history-row" key={i} onClick={() => { setQuery(item.q); changeFilters({ q: item.q, region: item.region }); navigate('catalog') }}><span className="history-icon"><Clock3 size={19} /></span><span><strong>{item.q}</strong><small>{item.region || 'Все регионы'} · {new Date(item.at).toLocaleDateString('ru-RU')}</small></span><ArrowUpRight size={19} /></button>) : <div className="empty-state"><Clock3 size={32} /><h3>Пока без истории</h3><p>Выполните поиск — запрос появится здесь.</p><button className="button primary" onClick={() => navigate('catalog')}>Перейти к поиску</button></div>}</section>}
        {view === 'scope' && <ProjectStatus navigate={target => navigate(target as View)} />}
        {view === 'sources' && <>{overviewError && <div className="notice danger" role="alert">{overviewError}</div>}<Sources overview={overview} mode={mode} copy={value => void copy(value)} /></>}
        <footer className="page-footer"><span>{preferences.value.brand === 'fsup' ? 'FSUP' : 'Поставка'}<span>Инструменты закупщика</span></span><button onClick={() => navigate('scope')}>Возможности и ограничения<ArrowUpRight size={14} /></button></footer>
      </div>
    </main>
    {compared.length > 0 && view !== 'compare' && <div className="compare-bar"><span className="compare-bar-icon"><GitCompareArrows size={23} /></span><div><strong>В сравнении {compared.length} из 5</strong><span>{compared.map(supplier => supplier.name).join(', ')}</span></div><button className="button primary" onClick={() => void openCompare()}>Сравнить поставщиков<ArrowRight size={17} /></button><button className="icon-button" aria-label="Очистить сравнение" onClick={() => { compareRevision.current++; setCompared([]) }}><X size={19} /></button></div>}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button aria-label="Скрыть уведомление" onClick={() => setToast('')}><X size={17} /></button></div>}
    {detail && <SupplierDetail key={detail.supplier.id} supplier={detail.supplier} initialTab={detail.tab} note={local.data.notes[detail.supplier.id] || ''} saveNote={text => local.note(detail.supplier.id, text)} favorite={local.data.favorites.includes(detail.supplier.id)} toggleFavorite={() => favorite(detail.supplier.id)} compare={() => { if (!compared.some(supplier => supplier.id === detail.supplier.id)) toggleCompare(detail.supplier); setDetail(null) }} close={() => setDetail(null)} edit={() => { setEditor(detail.supplier); setDetail(null) }} rate={() => setRating(detail.supplier)} />}
    {rating && <RatingModal supplier={rating} close={() => setRating(null)} />}
    {editor && <ImportForm supplier={editor === 'new' ? undefined : editor} close={() => setEditor(null)} saved={(message, supplier) => { if (editor === 'new') { switchMode('real'); navigate('catalog'); setQuery(''); changeFilters({ ...defaultFilters, mode: 'real', sort: 'updated' }) }; setRevision(value => value + 1); setToast(message); if (editor !== 'new') setDetail({ supplier, tab: 'overview' }) }} />}
    {exportOpen && <Modal title="Экспорт поставщиков" subtitle="Сведения, источники, даты и индекс данных" close={() => { if (!exportBusy) setExportOpen(false) }}><div className="export-body">{mode === 'demo' && <div className="notice amber">В файле будут вымышленные компании с маркировкой «ДЕМО».</div>}<label className="radio-line"><input type="radio" name="export-scope" checked={exportScope === 'filtered'} onChange={() => setExportScope('filtered')} />Текущая отфильтрованная выдача ({result.total})</label><label className="radio-line"><input type="radio" name="export-scope" disabled={!selected.length} checked={exportScope === 'selected'} onChange={() => setExportScope('selected')} />Только выбранные поставщики ({selected.length})</label><label className="check-line export-notes"><input type="checkbox" checked={includeNotes} onChange={event => setIncludeNotes(event.target.checked)} />Включить мои заметки</label><p className="muted">Заметки передаются серверу только для формирования файла и не сохраняются в каталоге.</p>{exportError && <div role="alert" className="notice danger">{exportError}</div>}<div className="export-buttons"><button className="button secondary" disabled={exportBusy} onClick={() => void exportFile('csv')}><ArrowDownToLine size={17} />Скачать CSV</button><button className="button primary" disabled={exportBusy} onClick={() => void exportFile('xlsx')}>{exportBusy ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />}Скачать XLSX</button></div><small className="muted">UTF-8 · формулы в текстовых значениях обезврежены</small></div></Modal>}
    {presetDraft && <Modal title="Сохранить условия поиска" subtitle="Набор будет доступен в этом браузере" close={() => setPresetDraft(null)}><form className="preset-form" onSubmit={savePreset}><label>Название набора<input required maxLength={60} value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="Например, молочные с доставкой" /></label><p>{activeFilterEntries(presetDraft).length} условий. Режим real/demo остаётся выбранным при применении набора.</p><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setPresetDraft(null)}>Отмена</button><button className="button primary"><Save size={17} />Сохранить набор</button></div></form></Modal>}
    {columnsOpen && <Modal title="Настроить представление" subtitle="Состав таблицы и плотность строк" close={() => setColumnsOpen(false)}><div className="columns-settings"><h3>Столбцы таблицы</h3><p className="muted">Название компании и действия отображаются всегда.</p>{(Object.entries(tableColumns) as [TableColumn, string][]).map(([key, name]) => <label className="check-line" key={key}><input type="checkbox" checked={preferences.value.columns.includes(key)} onChange={event => preferences.update({ columns: event.target.checked ? [...preferences.value.columns, key] : preferences.value.columns.filter(column => column !== key) })} />{name}</label>)}<h3>Плотность</h3><label className="check-line"><input type="checkbox" checked={preferences.value.spacious} onChange={event => preferences.update({ spacious: event.target.checked })} />Просторные строки</label><button className="button primary" onClick={() => setColumnsOpen(false)}>Готово</button></div></Modal>}
    {aboutOpen && <Modal title="Как работать с каталогом" subtitle="Прозрачные сведения для первичного отбора" close={() => setAboutOpen(false)}><div className="about-body"><h3>Пробный фирменный стиль</h3><p>FSUP: поварёшка и кастрюля супа. Прежнее название и логотип сохранены.</p><div className="brand-options"><button className="button secondary" aria-pressed={preferences.value.brand === 'fsup'} onClick={() => preferences.update({ brand: 'fsup' })}>FSUP</button><button className="button secondary" aria-pressed={preferences.value.brand === 'postavka'} onClick={() => preferences.update({ brand: 'postavka' })}>Вернуть «Поставку»</button></div><h3>Поиск и фильтры</h3><p>Введите товар или название — выдача обновится автоматически. Выберите регион, категорию, быстрые фильтры или откройте расширенные условия. Диапазон цены требует товар и единицу. Наборы условий можно сохранять.</p><h3>Что означает индекс данных</h3><p>От 0 до 100 баллов за источники, контакты, ассортимент, условия, доставку, документы и актуальность. Нажмите на число, чтобы увидеть формулу. Это не рейтинг надёжности компании.</p><h3>Локальное хранение</h3><p>Избранное, заметки, история и настройки остаются в этом браузере. Они не синхронизируются и могут быть потеряны при очистке данных. {standalone ? 'В этой демонстрации весь каталог также хранится в браузере, экспорт формируется на устройстве.' : 'Заметки передаются серверу только по выбору при экспорте.'}</p><h3>Текущий статус</h3><p>Внешний поиск не подключён. ИИ отложен. Платные API не вызываются. Деморежим содержит вымышленные сведения и отделён от реальных записей.</p><button className="button primary" onClick={() => { setAboutOpen(false); navigate('scope') }}>Открыть полный чек-лист<ArrowRight size={17} /></button></div></Modal>}
  </div>
}
