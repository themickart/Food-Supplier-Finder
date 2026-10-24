import { categoryName, date } from './format'

export const factLabels: Record<string, string> = {
  name: 'Название', products: 'Товары', city: 'Город', region: 'Регион', description: 'Описание',
  website: 'Сайт', inn: 'ИНН', address: 'Адрес', phone: 'Телефон', email: 'Email', delivery_info: 'Доставка',
  delivery_regions: 'География доставки', category: 'Категория', categories: 'Категории', source_url: 'Источник',
  terms: 'Коммерческие условия', documents: 'Документы', contacts: 'Контакты', previous_value: 'Предыдущее значение',
  product: 'Товар', price: 'Цена', currency: 'Валюта', unit: 'Единица', packaging: 'Фасовка', volume: 'Объём',
  min_order: 'Минимальный заказ', min_order_unit: 'Единица заказа', checked_at: 'Дата проверки',
}
export function factText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Не указано'
  if (Array.isArray(value)) return value.length ? value.map(factText).join('\n') : 'Не указано'
  if (typeof value !== 'object') return categoryName[String(value)] || String(value)
  const item = value as Record<string, unknown>
  if (item.product) return [String(item.product), item.price != null ? `Цена: ${item.price} ${item.currency === 'RUB' ? '₽' : item.currency || ''} / ${item.unit || 'единица не указана'}` : 'Цена не указана', item.min_order != null ? `Минимальный заказ: ${item.min_order} ${item.min_order_unit || ''}` : 'Минимальный заказ не указан', `Фасовка: ${item.packaging || 'Не указано'}`, `Объём: ${item.volume || 'Не указано'}`].join(' · ')
  if (item.kind && item.value) return `${item.kind === 'email' ? 'Email' : 'Телефон'}: ${item.value}`
  if (item.name && item.url) return `${item.name} — ${item.url}`
  return Object.entries(item).map(([key, entry]) => `${factLabels[key] || key}: ${key === 'checked_at' ? date(typeof entry === 'string' ? entry : null) : factText(entry)}`).join('\n')
}
