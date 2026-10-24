import { ArrowUpRight, CircleHelp, AlertTriangle } from 'lucide-react'
import type { Supplier } from '../types'
import Modal from './Modal'

export function RatingButton({ supplier, open, compact = false }: { supplier: Supplier; open: () => void; compact?: boolean }) {
  const score = supplier.rating.value
  return <button className={`rating-button ${score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low'} ${compact ? 'compact' : ''}`} onClick={open} aria-label={`Индекс данных: ${supplier.name}, ${score} из 100`} title="Посмотреть расчёт индекса данных">
    <span className="score-number">{score}<small>/100</small></span>{!compact && <span>Индекс данных<CircleHelp size={13} /></span>}
  </button>
}

export default function RatingModal({ supplier, close }: { supplier: Supplier; close: () => void }) {
  const rating = supplier.rating
  return <Modal title="Из чего складывается оценка" subtitle={supplier.name} close={close} wide>
    <div className="rating-explanation">
      <div className="rating-hero"><div className="rating-total">{rating.value}<span>/ 100</span></div><div><h3>Индекс данных</h3><p>{rating.label}. Чем выше балл, тем больше сведений для первичного решения о контакте.</p></div></div>
      <div className="notice neutral"><CircleHelp size={18} />{rating.disclaimer}{supplier.is_demo && ' Расчёт демонстрационный: компания и её сведения вымышлены.'}</div>
      <div className="rating-criteria">{rating.criteria.map(criterion => <div className="rating-criterion" key={criterion.id}><div><strong>{criterion.name}</strong><p>{criterion.explanation}</p><div className="criterion-track"><span style={{ width: `${criterion.points / criterion.max * 100}%` }} /></div></div><strong className="criterion-points">{criterion.points}<span> / {criterion.max}</span></strong></div>)}</div>
      {rating.conflict_penalty > 0 && <div className="notice amber"><AlertTriangle size={18} />−{rating.conflict_penalty} баллов: в источниках есть противоречия.</div>}
      <p className="rating-footnote">Формула {rating.version} открыта и одинакова для всех компаний. Оплата, избранное и заметки на неё не влияют. Отсутствующие данные дают 0 баллов, но не означают плохую работу поставщика.</p>
      <button className="button primary" onClick={close}>Вернуться к работе<ArrowUpRight size={17} /></button>
    </div>
  </Modal>
}
