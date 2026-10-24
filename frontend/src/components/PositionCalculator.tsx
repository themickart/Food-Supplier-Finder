import { useState } from 'react'
import { Calculator } from 'lucide-react'
import type { Supplier } from '../types'
import { calculatePosition } from '../calculator'
import { date, minimum, price } from '../format'

export default function PositionCalculator({ supplier }: { supplier: Supplier }) {
  const [index, setIndex] = useState(supplier.matched_term_index ?? 0)
  const [quantity, setQuantity] = useState('')
  const [multiple, setMultiple] = useState('1')
  const [round, setRound] = useState(false)
  const term = supplier.terms[index]
  const result = term && calculatePosition(term, Number(quantity), Number(multiple), round)
  const money = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: term.currency }).format(amount)
  return <section className="position-calculator detail-section" aria-label="Калькулятор позиции">
    <h3><Calculator size={18} />Калькулятор позиции</h3>
    <p className="muted">Предварительная стоимость одного товара по указанной цене. Расчёт не является предложением поставщика.</p>
    {!term ? <p>Для расчёта нужны товар, цена, валюта и единица. Добавьте условия из источника.</p> : <>
      <div className="form-grid"><label>Позиция<select aria-label="Позиция для расчёта" value={index} onChange={event => { setIndex(Number(event.target.value)); setQuantity(''); setRound(false); setMultiple('1') }}>{supplier.terms.map((item, i) => <option key={i} value={i}>{item.product} · {price(item)}</option>)}</select></label><label>Количество ({term.unit || 'единица не указана'})<input aria-label="Количество для расчёта" type="number" min="0.001" max="1000000000" step="any" placeholder="Введите объём" value={quantity} onChange={event => setQuantity(event.target.value)} /></label></div>
      <p className="field-hint">Фасовка: {term.packaging || 'Не указано'}. Объём: {term.volume || 'Не указано'}. Минимальный заказ: {minimum(term)}.</p>
      <label className="calculator-round"><input type="checkbox" checked={round} onChange={event => setRound(event.target.checked)} />Округлить до кратности закупки</label>
      {round && <label>Кратность в единицах цены ({term.unit})<input aria-label="Кратность закупки" type="number" min="0.001" max="1000000000" step="any" value={multiple} onChange={event => setMultiple(event.target.value)} /><small className="field-hint">Укажите самостоятельно по условиям поставщика. Текст фасовки автоматически не пересчитывается.</small></label>}
      {result ? <div className="calculator-result" role="status"><span>{result.amount.toLocaleString('ru-RU')} {term.unit} × {price(term)}</span><strong>{money(result.total)}</strong><p>{result.minimumStatus === 'met' ? 'Указанный минимум достигнут для этой позиции.' : result.minimumStatus === 'below' ? `Ниже минимума на ${result.shortfall?.toLocaleString('ru-RU')} ${term.min_order_unit}. Минимум может относиться ко всей поставке — уточните у компании.` : result.minimumStatus === 'incomparable' ? 'Минимум задан в другой единице или валюте: автоматически сопоставить нельзя.' : 'Минимальный заказ не указан.'}</p></div> : <p className="calculator-placeholder">{term.price === null ? 'Цена не указана — стоимость рассчитать нельзя.' : quantity ? 'Введите положительное количество и корректную кратность.' : 'Укажите количество, чтобы увидеть стоимость.'}</p>}
      <p className="field-hint">Доставка, скидки, налоги и сборы дополнительно не рассчитаны: их состав не указан. Источник цены: {supplier.is_demo ? 'учебные данные' : term.source_url || 'Не указано'}. Проверка: {date(term.checked_at)}.</p>
    </>}
  </section>
}
