import { standalone } from '../runtime'
import { ArrowDownToLine, ArrowRight, Check, CirclePause, Layers3, PlugZap, ShieldCheck } from 'lucide-react'

export const requirements = [
  { name: 'Каталог и поиск', state: 'ready', text: 'Товары, категории, расположение и доставка. Таблица и карточки, фильтры, сортировка, пагинация, сохранённые наборы условий.', action: 'Открыть каталог', target: 'catalog' },
  { name: 'Сбор и происхождение данных', state: 'limited', text: 'Ручное добавление, редактирование и дедупликация с историей источников работают. Автоматический сбор ожидает подключения внешнего поиска.', action: 'Посмотреть источники', target: 'sources' },
  { name: 'Карточки поставщиков', state: 'ready', text: 'Ассортимент, контакты, документы, доставка, условия по конкретному товару, калькулятор позиции, источники и даты. Неизвестные значения обозначены явно.', action: 'Открыть каталог', target: 'catalog' },
  { name: 'Объяснимая оценка', state: 'ready', text: 'Индекс данных 0–100 с семью критериями, датой проверки и штрафом за противоречия. Надёжность компании автоматически не оценивается.', action: 'Сравнить поставщиков', target: 'compare' },
  { name: 'Сравнение до 5 компаний', state: 'ready', text: 'Таблица ассортимента, условий, единиц, фасовки, документов и источников. Без искусственного победителя.', action: 'Открыть сравнение', target: 'compare' },
  { name: 'Избранное и заметки', state: 'ready', text: 'Добавление, изменение и удаление. Хранение в браузере, изоляция между его профилями, предупреждение об ошибке сохранения.', action: 'Открыть избранное', target: 'favorites' },
  { name: 'Экспорт CSV и XLSX', state: 'ready', text: 'Выбранные записи или вся отфильтрованная выдача, источники и даты, заметки по желанию. UTF-8 и защита ячеек от формул.', action: 'Перейти к выгрузке', target: 'catalog' },
  { name: 'Запрос коммерческого предложения', state: 'ready', text: 'Контакты, ссылки на сайты и копирование шаблона письма. Отправка от имени пользователя не выполняется.', action: 'Открыть каталог', target: 'catalog' },
  { name: 'Адаптивность и ошибки', state: 'ready', text: 'Мобильный интерфейс, состояния загрузки и пустого результата, повтор запроса, обработка неполных сведений и конфликтов.', action: 'Открыть каталог', target: 'catalog' },
  { name: 'Внешний поиск', state: 'waiting', text: 'Не подключён. Подходящий бесплатный источник с разрешённым хранением результатов пока не подтверждён. Демоданные не выдаются за реальные находки.', action: 'Проверить статус', target: 'sources' },
  { name: 'ИИ и платные проверки', state: 'later', text: 'Отложены по решению пользователя. Основные функции работают без ИИ, платные API не вызываются.', action: 'Статус интеграций', target: 'sources' },
  { name: 'Развёртывание и восстановление', state: 'limited', text: standalone ? 'Автономная версия GitHub Pages: каталог и личные данные только в браузере, CSV/XLSX формируются на устройстве. Серверной БД нет.' : 'Локальный SQLite и резервная копия проверены. Docker Compose с PostgreSQL подготовлен; контейнеры и VPS требуют отдельной проверки.', action: 'Статус инфраструктуры', target: 'sources' },
]
const labels: Record<string, string> = { ready: 'Работает', limited: 'С ограничениями', waiting: 'Не подключено', later: 'Отложено' }

export default function ProjectStatus({ navigate }: { navigate: (target: string) => void }) {
  function download() {
    const text = '# Food Supplier Finder: состояние функций\n\n' + requirements.map(item => `## ${item.name} — ${labels[item.state]}\n\n${item.text}\n`).join('\n') + '\nСтатус: прототип. Критерий MVP с реальным внешним поиском не выполнен.\n'
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'food-supplier-finder-checklist.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="project-status"><div className="scope-intro"><span className="scope-icon"><Layers3 size={28} /></span><div><h2>Что уже можно проверить</h2><p>Работающий прототип без ИИ и платных сервисов. Все ограничения видны здесь — готовность интерфейса не подменяет подключение реальных источников.</p></div><button className="button secondary" onClick={download}><ArrowDownToLine size={17} />Скачать чек-лист</button></div><div className="scope-grid">{requirements.map(item => <article className="scope-card" key={item.name}><div><span className={`scope-badge ${item.state}`}>{item.state === 'ready' ? <Check size={14} /> : item.state === 'waiting' ? <PlugZap size={14} /> : <CirclePause size={14} />}{labels[item.state]}</span></div><h3>{item.name}</h3><p>{item.text}</p><button className="inline-link" onClick={() => navigate(item.target)}>{item.action}<ArrowRight size={16} /></button></article>)}</div><div className="notice neutral"><ShieldCheck size={19} />Регистрация, организации, роли, CRM и автоматическое расписание — следующий этап, а не скрытые заглушки этой версии.</div></section>
}
