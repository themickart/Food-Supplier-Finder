import { strToU8, zipSync } from 'fflate'
import type { Supplier } from '../types'
import { categoryName, minimum, price, status } from '../format'

export function safeCell(value: unknown): string {
  let text = String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '')
  if (/^[=+\-@]/.test(text.trimStart()) || /^[\t\r\n]/.test(text)) text = "'" + text
  return text.slice(0, 32000)
}
export function exportRows(items: Supplier[], notes: Record<string, string>, includeNotes: boolean): string[][] {
  const rows: unknown[][] = [['Название', 'Тип данных', 'Категории', 'Товары', 'Город', 'Регион', 'Адрес', 'Описание', 'Сайт', 'ИНН', 'Телефон', 'Email', 'Условия закупки', 'Доставка', 'Регионы доставки', 'Документы', 'Источники', 'Дата получения', 'Последняя проверка', 'Статус', 'Противоречия', 'Индекс данных / 100', 'Что означает индекс', ...(includeNotes ? ['Личная заметка'] : [])]]
  for (const s of items) rows.push([
    s.name, s.is_demo ? 'ДЕМО — вымышленная компания' : 'Ручная запись, требует проверки', s.categories.map(c => categoryName[c] || c).join(', '), s.products.join(', '), s.city, s.region, s.address, s.description, s.website, s.inn,
    s.contacts.filter(c => c.kind === 'phone').map(c => c.value).join(', '), s.contacts.filter(c => c.kind === 'email').map(c => c.value).join(', '),
    s.terms.map(t => `${t.product}: ${price(t)}; фасовка: ${t.packaging || 'Не указано'}; объём: ${t.volume || 'Не указано'}; мин. заказ: ${minimum(t)}; источник: ${t.source_url || 'Не указано'}; проверка: ${t.checked_at || 'Не проводилась'}`).join('\n'),
    s.delivery_info, s.delivery_regions.join(', '), s.documents.map(d => `${d.name}: ${d.url}`).join('\n'), s.sources.map(source => source.url).join('\n'), s.sources.map(source => source.retrieved_at).join('\n'), s.checked_at || 'Не проводилась', status(s), s.conflicts.join('\n'), s.rating.value, s.rating.disclaimer,
    ...(includeNotes ? [notes[s.id] || ''] : []),
  ])
  return rows.map(row => row.map(safeCell))
}
export const csvBytes = (rows: string[][]) => strToU8('\ufeff' + rows.map(row => row.map(value => `"${safeCell(value).replace(/"/g, '""')}"`).join(';')).join('\r\n') + '\r\n')
const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const column = (index: number): string => index < 26 ? String.fromCharCode(65 + index) : column(Math.floor(index / 26) - 1) + String.fromCharCode(65 + index % 26)
// Minimal SpreadsheetML package: every external/user cell is an inline STRING,
// never a formula, URL relationship, macro or executable attachment.
export function xlsxBytes(rows: string[][]): Uint8Array {
  const lastCell = `${column(rows[0].length - 1)}${rows.length}`
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${rows[0].length}" width="30" customWidth="1"/></cols><sheetData>${rows.map((row, ri) => `<row r="${ri + 1}">${row.map((value, ci) => `<c r="${column(ci)}${ri + 1}" t="inlineStr" s="${ri === 0 ? 1 : 0}"><is><t xml:space="preserve">${xml(safeCell(value))}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`
  const parts: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Поставщики" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6453C6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    'xl/worksheets/sheet1.xml': sheet,
  }
  return zipSync(Object.fromEntries(Object.entries(parts).map(([path, content]) => [path, strToU8(content)])), { level: 6 })
}
export function downloadFile(bytes: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob), link = document.createElement('a')
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function exportFile(format: 'csv' | 'xlsx', items: Supplier[], notes: Record<string, string>, includeNotes: boolean, demo: boolean) {
  if (!items.length) throw new Error('Нет записей для экспорта')
  const rows = exportRows(items, notes, includeNotes)
  downloadFile(format === 'csv' ? csvBytes(rows) : xlsxBytes(rows), `${demo ? 'demo-' : ''}suppliers.${format}`, format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
