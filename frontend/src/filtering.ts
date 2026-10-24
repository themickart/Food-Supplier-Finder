import type { Filters } from './types'
import { defaultFilters } from './types'

export const fieldNames: Partial<Record<keyof Filters, string>> = {
  q: 'Запрос', category: 'Категория', region: 'Расположение', delivery_region: 'Регион доставки',
  website: 'Есть сайт', contacts: 'Есть контакты', min_order: 'Указан мин. заказ', delivery: 'Есть доставка',
  documents: 'Есть документы', status: 'Статус проверки', min_rating: 'Индекс данных от',
  commercial: 'Есть цена или условия закупки',
  verified_contacts: 'Контакты проверены по источнику',
  price_product: 'Товар в условиях', price_unit: 'Единица цены', price_from: 'Цена от', price_to: 'Цена до',
  order_unit: 'Единица заказа', order_from: 'Заказ от', order_to: 'Заказ до',
}
export function activeFilterEntries(filters: Filters) {
  return (Object.entries(fieldNames) as [keyof Filters, string][]).filter(([key]) => filters[key] !== defaultFilters[key] && filters[key] !== '' && filters[key] !== null)
}
export function validateFilters(filters: Filters): string {
  if ((filters.price_from !== null || filters.price_to !== null) && (!filters.price_product.trim() || !filters.price_unit)) return 'Для диапазона цены укажите товар и единицу измерения.'
  if ((filters.order_from !== null || filters.order_to !== null) && !filters.order_unit) return 'Для диапазона минимального заказа выберите единицу.'
  if ((filters.price_from !== null && filters.price_to !== null && filters.price_from > filters.price_to) || (filters.order_from !== null && filters.order_to !== null && filters.order_from > filters.order_to)) return 'Значение «от» не может быть больше значения «до».'
  return ''
}
