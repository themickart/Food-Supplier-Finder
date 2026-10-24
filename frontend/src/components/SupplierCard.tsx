import { ArrowUpRight, Bookmark, Check, GitCompareArrows, MapPin, StickyNote } from 'lucide-react'
import type { Supplier } from '../types'
import { categoryName, date, displayTerm, minimum, price } from '../format'
import { RatingButton } from './Rating'
import type { SupplierActions } from './SupplierTable'

export default function SupplierCard({ supplier: s, actions }: { supplier: Supplier; actions: SupplierActions }) {
  const favorite = actions.favorites.includes(s.id)
  const compared = actions.compared.some(item => item.id === s.id)
  return <article className={`supplier-card ${actions.selected.includes(s.id) ? 'is-selected' : ''}`}>
    <div className="card-top"><input type="checkbox" aria-label={`Выбрать: ${s.name}`} checked={actions.selected.includes(s.id)} onChange={() => actions.select(s.id)} /><span className="category-label">{categoryName[s.categories[0]]}</span>{s.is_demo && <span className="demo-tag">Демо</span>}<button className={`icon-button bookmark ${favorite ? 'active' : ''}`} aria-label={`${favorite ? 'Убрать из' : 'Добавить в'} избранное: ${s.name}`} aria-pressed={favorite} onClick={() => actions.favorite(s.id)}><Bookmark size={18} fill={favorite ? 'currentColor' : 'none'} /></button></div>
    <div className="card-company"><div className={`company-logo ${s.categories[0]}`}>{s.name.slice(0, 1)}</div><div><button className="company-name" onClick={() => actions.open(s)}>{s.name}</button><button className="company-place" onClick={() => s.city && actions.filterRegion(s.city)}><MapPin size={14} />{s.city || 'Расположение не указано'}</button></div></div>
    <p className="card-description">{s.description || 'Описание деятельности не указано.'}</p>
    <div className="product-tags">{s.products.slice(0, 3).map(product => <span key={product}>{product}</span>)}</div>
    <button className="card-terms" onClick={() => actions.open(s, 'terms')}><div><span>Цена · {displayTerm(s)?.product || 'нет сведений'}</span><strong>{price(displayTerm(s))}</strong></div><div><span>Минимальный заказ</span><strong>{minimum(displayTerm(s))}</strong></div><ArrowUpRight size={17} /></button>
    <div className="card-information"><RatingButton supplier={s} open={() => actions.rate(s)} /><button className="card-verification" onClick={() => actions.open(s, 'sources')}><span className={`status-label ${s.status}`}>{s.status === 'needs_review' ? 'Перепроверить' : s.checked_at ? 'Есть дата проверки' : 'Не проверено'}</span><small>{s.checked_at ? date(s.checked_at) : 'Посмотреть источники'}</small></button></div>
    {s.match && <div className="match-hint">{s.match.value}% совпадение · {s.match.reasons[0]}</div>}
    <div className="card-actions"><button className={`compare-toggle ${compared ? 'selected' : ''}`} aria-pressed={compared} onClick={() => actions.compare(s)}>{compared ? <Check size={17} /> : <GitCompareArrows size={17} />}{compared ? 'В сравнении' : 'Сравнить'}</button><button className="icon-button" aria-label={`Заметка: ${s.name}`} onClick={() => actions.open(s, 'notes')}><StickyNote size={17} /></button><button className="detail-link" onClick={() => actions.open(s)}>Карточка<ArrowUpRight size={16} /></button></div>
  </article>
}
