import { useState } from 'react'
import { Bookmark, Copy, Download, FilePenLine, GitCompareArrows, Mail, MoreHorizontal, StickyNote, ArrowUpRight } from 'lucide-react'
import type { Supplier } from '../types'
import { categoryName, date, displayTerm, minimum, price, status } from '../format'
import { RatingButton } from './Rating'
import Modal from './Modal'

export const tableColumns = { region: 'Расположение', terms: 'Цена и заказ', rating: 'Индекс данных', status: 'Актуальность', contacts: 'Контакты' }
export type TableColumn = keyof typeof tableColumns
export interface SupplierActions {
  open: (supplier: Supplier, tab?: 'overview' | 'terms' | 'sources' | 'notes') => void
  rate: (supplier: Supplier) => void; favorite: (id: string) => void; compare: (supplier: Supplier) => void
  edit: (supplier: Supplier) => void; exportOne: (supplier: Supplier) => void
  favorites: string[]; compared: Supplier[]; selected: string[]; select: (id: string) => void
  copy: (text: string) => void; filterRegion: (region: string) => void
}

export default function SupplierTable({ suppliers, columns, actions }: { suppliers: Supplier[]; columns: TableColumn[]; actions: SupplierActions }) {
  const [menu, setMenu] = useState<Supplier | null>(null)
  function run(action: (supplier: Supplier) => void) { if (menu) { action(menu); setMenu(null) } }
  return <><div className="supplier-table-wrap table-scroll"><table className="supplier-table"><thead><tr><th className="selection-cell"><span className="sr-only">Выбор</span></th><th>Компания / ассортимент</th>{columns.map(column => <th key={column}>{tableColumns[column]}</th>)}<th className="actions-heading">Действия</th></tr></thead><tbody>{suppliers.map(s => <tr key={s.id} className={actions.selected.includes(s.id) ? 'is-selected' : ''}>
    <td className="selection-cell"><input type="checkbox" aria-label={`Выбрать: ${s.name}`} checked={actions.selected.includes(s.id)} onChange={() => actions.select(s.id)} /></td>
    <td className="supplier-name-cell"><div className="table-company"><div className={`company-logo ${s.categories[0]}`}>{s.name.slice(0, 1)}</div><div><button className="company-name" aria-label={s.name} onClick={() => actions.open(s)}>{s.name}{s.is_demo && <span className="demo-tag">Демо</span>}</button><span className="category-label">{categoryName[s.categories[0]]}</span></div></div><p className="table-products">{s.products.slice(0, 3).join(' · ') || 'Ассортимент не указан'}</p>{s.match && <span className="match-hint" title={s.match.reasons.join('. ')}>{s.match.value}% совпадение с запросом</span>}</td>
    {columns.map(column => <td key={column}>
      {column === 'region' && <><button className="inline-link" disabled={!s.city} onClick={() => s.city && actions.filterRegion(s.city)}>{s.city || 'Не указано'}</button><small>{s.delivery_regions.length ? `Доставка: ${s.delivery_regions.join(', ')}` : 'Доставка не указана'}</small></>}
      {column === 'terms' && <button className="table-term-link" onClick={() => actions.open(s, 'terms')}><strong>{price(displayTerm(s))}</strong><small>{displayTerm(s)?.product || 'Цена не указана'}</small><small>Мин. заказ: {minimum(displayTerm(s))}</small></button>}
      {column === 'rating' && <RatingButton supplier={s} open={() => actions.rate(s)} compact />}
      {column === 'status' && <button className="status-cell" onClick={() => actions.open(s, 'sources')}><span className={`status-label ${s.status}`}>{s.status === 'needs_review' ? 'Перепроверить' : s.is_demo ? 'Учебные сведения' : status(s)}</span><small>{s.checked_at ? date(s.checked_at) : 'Проверка не проводилась'}</small></button>}
      {column === 'contacts' && <button className="inline-link" onClick={() => actions.open(s)}><Mail size={15} />{s.contacts.length ? `${s.contacts.length} контакт` : 'Не указано'}</button>}
    </td>)}
    <td><div className="row-actions"><button className={`icon-button ${actions.favorites.includes(s.id) ? 'active' : ''}`} aria-label={`${actions.favorites.includes(s.id) ? 'Убрать из' : 'Добавить в'} избранное: ${s.name}`} aria-pressed={actions.favorites.includes(s.id)} onClick={() => actions.favorite(s.id)}><Bookmark size={18} fill={actions.favorites.includes(s.id) ? 'currentColor' : 'none'} /></button><button className={`icon-button ${actions.compared.some(item => item.id === s.id) ? 'active' : ''}`} aria-label={`Сравнить: ${s.name}`} onClick={() => actions.compare(s)}><GitCompareArrows size={18} /></button><button className="icon-button" aria-label={`Действия: ${s.name}`} onClick={() => setMenu(s)}><MoreHorizontal size={19} /></button></div></td>
  </tr>)}</tbody></table></div>{menu && <Modal title="Действия с поставщиком" subtitle={menu.name} close={() => setMenu(null)}><div className="action-menu"><button onClick={() => run(supplier => actions.open(supplier))}><ArrowUpRight size={19} />Открыть карточку</button><button onClick={() => run(supplier => actions.open(supplier, 'notes'))}><StickyNote size={19} />Личная заметка</button><button onClick={() => run(supplier => actions.copy(supplier.contacts[0]?.value || supplier.name))}><Copy size={19} />{menu.contacts.length ? 'Скопировать контакт' : 'Скопировать название'}</button><button onClick={() => run(actions.exportOne)}><Download size={19} />Экспорт CSV</button>{!menu.is_demo && <button onClick={() => run(actions.edit)}><FilePenLine size={19} />Редактировать сведения</button>}</div></Modal>}</>
}
