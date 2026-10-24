import { Bookmark, X } from 'lucide-react'
import type { Supplier } from '../types'
import { date, displayTerm, minimum, price, status } from '../format'
import { RatingButton } from './Rating'

export default function Compare({ items, remove, open, favorite, toggleFavorite, rate }: {
  items: Supplier[]; remove: (id: string) => void; open: (s: Supplier) => void
  favorite: string[]; toggleFavorite: (id: string) => void
  rate: (supplier: Supplier) => void
}) {
  const rows: [string, (s: Supplier) => string][] = [
    ['Ассортимент', s => s.products.join(', ') || 'Не указано'], ['Расположение', s => s.city || 'Не указано'],
    ['Доставка в регионы', s => s.delivery_regions.join(', ') || 'Не указано'],
    ['Товар для сравнения цены', s => displayTerm(s)?.product || 'Не указано'],
    ['Цена и единица', s => price(displayTerm(s))], ['Фасовка', s => displayTerm(s)?.packaging || 'Не указано'],
    ['Объём закупки', s => displayTerm(s)?.volume || 'Не указано'], ['Минимальный заказ', s => minimum(displayTerm(s))],
    ['Условия доставки', s => s.delivery_info || 'Не указано'], ['Контакты', s => s.contacts.map(c => c.value).join(', ') || 'Не указано'],
    ['Документы', s => s.documents.map(d => d.name).join(', ') || 'Не указано'],
    ['Полнота карточки', s => `${s.completeness}% полей заполнено`], ['Дата проверки', s => date(s.checked_at)],
    ['Индекс данных (не надёжность)', s => `${s.rating.value} / 100`],
    ['Статус сведений', s => status(s)], ['Источники', s => s.sources.map(source => source.url).join('\n')],
  ]
  return <><div className="notice neutral">Цены сопоставимы только для одинаковых товаров, единиц, фасовки и объёма. Отсутствие сведений не означает отсутствие услуги.</div><div className="comparison table-scroll"><table><thead><tr><th>Характеристика</th>{items.map(s => <th key={s.id}><button className="remove-compare icon-button" aria-label={`Убрать из сравнения: ${s.name}`} onClick={() => remove(s.id)}><X size={16} /></button>{s.is_demo && <span className="demo-tag">Демо</span>}<button className="company-name" onClick={() => open(s)}>{s.name}</button><button className="compare-favorite" onClick={() => toggleFavorite(s.id)}><Bookmark size={14} fill={favorite.includes(s.id) ? 'currentColor' : 'none'} />{favorite.includes(s.id) ? 'В избранном' : 'Сохранить'}</button><RatingButton supplier={s} open={() => rate(s)} compact /></th>)}</tr></thead><tbody>{rows.map(([name, render]) => <tr key={name}><th>{name}</th>{items.map(s => <td key={s.id} className={render(s) === 'Не указано' ? 'unknown' : ''}>{render(s)}</td>)}</tr>)}</tbody></table></div></>
}
