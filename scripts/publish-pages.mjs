// Publish a clean static snapshot without checking out or copying source files
// into gh-pages. Never rewrites remote history and never touches the main index.
import { execFileSync } from 'node:child_process'
import { mkdirSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
if (args.length > 1 || args.some(arg => arg !== '--push')) throw new Error('Usage: node scripts/publish-pages.mjs [--push]')
const push = args.includes('--push')
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim()
const runNode = (relative, args, cwd = root) => execFileSync(process.execPath, [path.join(root, relative), ...args], { cwd, stdio: 'inherit' })
if (git(['branch', '--show-current']) !== 'main') throw new Error('Run from main after committing the source changes.')
if (git(['status', '--porcelain'])) throw new Error('Commit all public source changes before building the release. Ignored local data can remain.')
const source = git(['rev-parse', 'HEAD'])
const gitDirectory = git(['rev-parse', '--absolute-git-dir'])
const repo = 'https://github.com/themickart/Food-Supplier-Finder'
const site = 'https://themickart.github.io/Food-Supplier-Finder/'
runNode('scripts/check-publication.mjs', [])
runNode('frontend/node_modules/typescript/bin/tsc', ['-b'], path.join(root, 'frontend'))
runNode('frontend/node_modules/vite/bin/vite.js', ['build', '--mode', 'pages'], path.join(root, 'frontend'))
runNode('scripts/check-publication.mjs', ['--pages-dir', 'frontend/dist-pages'])

const remote = git(['ls-remote', '--heads', 'origin', 'refs/heads/gh-pages']).split(/\s+/)[0]
if (remote) git(['fetch', '--no-tags', 'origin', 'refs/heads/gh-pages:refs/remotes/origin/gh-pages'])
let local = ''
try { local = git(['rev-parse', '--verify', 'refs/heads/gh-pages'], { stdio: ['pipe', 'pipe', 'ignore'] }) } catch { /* First release. */ }
const parent = remote || local
mkdirSync(path.join(root, 'artifacts'), { recursive: true })
const index = path.join(root, 'artifacts', `pages-index-${randomUUID()}`)
const options = { env: { ...process.env, GIT_INDEX_FILE: index } }
const stagedGit = args => git(args, options)
const readme = `# FSUP · FOOD SUPPLIER WORKSPACE — демонстрация

[Открыть приложение](${site}) · [Исходники и подробная документация](${repo}/tree/main)

Эта ветка содержит собранный статический сайт. Исходный код frontend/backend, тесты, миграции и инструкции находятся в main.

## Как посмотреть тестовое задание

1. Откройте приложение и нажмите «Деморежим»: 12 компаний явно вымышлены.
2. Найдите «Моцарелла» и выберите Екатеринбург. Проверьте фильтры, плитки/таблицу и раскрытие индекса данных.
3. Откройте карточку: условия, калькулятор, источники, заметка и шаблон запроса КП.
4. Сравните до пяти компаний, добавьте в избранное и выгрузите CSV/XLSX.
5. В локальном каталоге добавьте/измените свою запись со ссылкой на источник; после перезагрузки проверьте сохранение и историю правок.

## Границы демонстрации

Каталог и личные данные хранятся только в текущем браузере. Общего сервера/БД на Pages нет. Очистка данных сайта удалит локальные записи. Внешний поиск и ИИ не подключены; интернет-результаты и отправка писем не имитируются. Индекс оценивает сведения, а не надёжность компании.

## Публикация

В GitHub Settings → Pages: Deploy from a branch → gh-pages → / (root). .nojekyll отключает обработку Jekyll.

Обновление выполняется из чистой main командой node scripts/publish-pages.mjs --push после установки frontend-зависимостей. Сборка проверяется перед публикацией. README и deployment.json генерируются автоматически; содержимое ветки вручную не редактировать.

Исходный коммит: [${source}](${repo}/commit/${source}).
`
try {
  stagedGit(['read-tree', '--empty'])
  const artifact = path.join(root, 'frontend/dist-pages')
  git([`--git-dir=${gitDirectory}`, `--work-tree=${artifact}`, 'add', '--all', '--', '.'], { ...options, cwd: artifact })
  const metadata = JSON.stringify({ source_commit: source, source_branch: 'main', deployment_branch: 'gh-pages', runtime: 'standalone', site_url: site, built_at: new Date().toISOString() }, null, 2) + '\n'
  for (const [name, contents] of [['.nojekyll', ''], ['README.md', readme], ['deployment.json', metadata]]) {
    const blob = git(['hash-object', '-w', '--stdin'], { input: contents })
    stagedGit(['update-index', '--add', '--cacheinfo', '100644', blob, name])
  }
  const names = stagedGit(['ls-files']).split('\n')
  if (!names.includes('index.html') || !names.some(name => name.startsWith('assets/'))) throw new Error('The deployment tree is missing the compiled application.')
  if (names.some(name => !['index.html', '.nojekyll', 'README.md', 'deployment.json'].includes(name) && !name.startsWith('assets/'))) throw new Error('Unexpected file in the deployment tree.')
  const tree = stagedGit(['write-tree'])
  const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : [])], { input: `Deploy FSUP from ${source.slice(0, 12)}\n` })
  git(['update-ref', 'refs/heads/gh-pages', commit, local || '0'.repeat(40)])
  process.stdout.write(`Prepared gh-pages ${commit}; source ${source}; ${names.length} static release files.\n`)
  if (push) {
    execFileSync('git', ['push', '--set-upstream', 'origin', 'gh-pages:gh-pages'], { cwd: root, stdio: 'inherit' })
    process.stdout.write(`Published deployment branch. Site URL (requires Pages enabled): ${site}\n`)
  } else process.stdout.write('Local branch only. Run git push -u origin gh-pages to upload it.\n')
} finally {
  if (existsSync(index)) unlinkSync(index)
}
