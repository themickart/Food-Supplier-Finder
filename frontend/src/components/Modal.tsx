import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, subtitle, children, close, wide = false }: { title: string; subtitle?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const active = document.activeElement as HTMLElement
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = document.querySelector('dialog[open]') ? 'hidden' : ''; if (active?.isConnected) active.focus() }
  }, [])
  return <dialog className={`modal ${wide ? 'modal-wide' : ''}`} ref={dialog} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Закрыть окно" onClick={close}><X size={20} /></button></div>
    {children}
  </dialog>
}
