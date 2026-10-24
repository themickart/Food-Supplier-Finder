import { HardDrive } from 'lucide-react'

export default function HostingNotice() {
  return <details className="hosting-notice"><summary><HardDrive size={19} /><strong>Автономная демонстрация · данные в этом браузере</strong><span>Подробнее</span></summary><p>GitHub Pages: каталог, изменения и личные данные хранятся только в этом браузере. Общей серверной базы здесь нет. Сохраняйте важные сведения через CSV/XLSX: очистка данных браузера удалит записи. Внешний поиск и ИИ не подключены.</p></details>
}
