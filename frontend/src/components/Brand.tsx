import { Layers3 } from 'lucide-react'

// Keep the original brand available until the FSUP preview is approved.
export type BrandVariant = 'fsup' | 'postavka'
export function SoupMark() {
  return <svg viewBox="0 0 40 40" width="29" height="29" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 22h24v5a9 9 0 0 1-9 9h-6a9 9 0 0 1-9-9zM4 24h4m24 0h4M7 18h26" />
    <path d="m24 18 6-13a3 3 0 0 1 5 3l-4 8M16 6c-4 3 3 5-1 8M9 8c-3 2 2 3 0 6" />
    <path d="M23 22a5 4 0 0 0 10 0" />
  </svg>
}
export default function Brand({ variant, open }: { variant: BrandVariant; open: () => void }) {
  return <button className={`brand brand-${variant}`} onClick={open} aria-label={variant === 'fsup' ? 'FSUP — каталог поставщиков' : 'Поставка — каталог поставщиков'}>
    <span className="brand-mark">{variant === 'fsup' ? <SoupMark /> : <Layers3 size={25} />}</span>
    <span>{variant === 'fsup' ? 'FSUP' : 'Поставка'}<span className="brand-subtitle">{variant === 'fsup' ? <>FOOD <strong>SUPPLIER WORKSPACE</strong></> : 'SUPPLIER WORKSPACE'}</span></span>
  </button>
}
