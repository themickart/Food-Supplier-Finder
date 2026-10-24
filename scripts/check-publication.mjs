// Read-only checks for the public repository and optional Pages artifact.
// Reports filenames/reasons only; never prints potential secret values.
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const split = value => value.split('\0').filter(Boolean)
const errors = []
const fail = (name, reason) => errors.push(`${name}: ${reason}`)
const files = [...new Set(split(git('ls-files', '-z', '--cached', '--others', '--exclude-standard')))]
const publicFiles = new Set(files)
const privateDirectories = new Set(['.git', '.agents', '.codex', '.claude', '.aws', '.ssh', '.idea', '.vscode', '.venv', 'venv', 'env', 'private', 'local', 'secrets', 'node_modules', '.npm-cache', '.browsers', '__pycache__', '.pytest_cache', '.ruff_cache', '.mypy_cache', '.cache', '.vite', 'dist', 'dist-pages', 'build', 'data', 'backups', 'exports', 'local-data', 'artifacts', 'test-results', 'test-results-pages', 'playwright-report', 'blob-report', 'coverage', 'htmlcov'])
function privatePath(name) {
  const lower = name.toLowerCase(), parts = lower.split('/'), base = parts.at(-1)
  if (base === 'task.md' || lower === 'docs/task-audit.md') return 'локальное задание или его внутренняя сверка'
  if (parts.slice(0, -1).some(part => privateDirectories.has(part))) return 'локальные данные, настройки, зависимости или артефакты'
  if (/^\.env(?:\.|$)/.test(base) && lower !== 'frontend/.env.pages' && base !== '.env.example' && !base.endsWith('.example')) return 'приватная конфигурация окружения'
  if (['.npmrc', '.pypirc', '.netrc', '.git-credentials', 'credentials.json'].includes(base) || /^service-account.*\.json$/.test(base)) return 'файл учётных данных'
  if (/\.(?:pem|key|p12|pfx|jks|keystore|db|sqlite|sqlite3|dump|csv|xlsx|xls|xlsm|zip|7z|tar|log|tmp|bak|tsbuildinfo)$/.test(base) || /\.(?:db|sqlite|sqlite3)-/.test(base) || /\.(?:sql|tar)\.gz$/.test(base)) return 'секрет, база данных, выгрузка или сгенерированный файл'
  return ''
}
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
  /\bsk-or-v1-[a-fA-F0-9]{32,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
]
function checkSecrets(name, contents) {
  if (secretPatterns.some(pattern => pattern.test(contents))) fail(name, 'похожее на приватный ключ/токен значение; содержимое не выводится')
}
for (const name of files) {
  const reason = privatePath(name)
  if (reason) fail(name, reason)
  const location = path.join(root, name), info = lstatSync(location)
  if (info.isSymbolicLink()) { fail(name, 'символическая ссылка требует отдельной проверки'); continue }
  if (info.size > 5 * 1024 * 1024) { fail(name, 'файл больше 5 МиБ; проверьте необходимость публикации'); continue }
  const data = readFileSync(location)
  if (!data.includes(0)) checkSecrets(name, data.toString('utf8'))
}
for (const name of split(git('ls-files', '-z', '--cached', '--ignored', '--exclude-standard'))) fail(name, 'уже отслеживается Git, хотя исключён .gitignore')

const probes = ['Task.md', 'task.md', 'docs/task-audit.md', '.env', '.env.production', 'frontend/.env.local', 'frontend/.env.pages.local', '.aws/credentials', '.codex/session.json', 'secrets/private.pem', 'data/catalog.db', 'catalog.sqlite3-wal', 'backups/catalog.dump', 'suppliers.csv', 'suppliers.xlsx', 'artifacts/overpass-spike.json', 'frontend/node_modules/package/index.js', 'frontend/dist/index.html', 'frontend/dist-pages/index.html', 'frontend/test-results/trace.zip', 'frontend/test-results-pages/trace.zip', 'frontend/playwright-report/index.html', '.venv/pyvenv.cfg', '.browsers/chrome.exe']
const ignored = new Set(split(execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], { cwd: root, encoding: 'utf8', input: probes.join('\0') + '\0' })))
for (const probe of probes) if (!ignored.has(probe)) fail(probe, 'не защищён правилами .gitignore')
for (const required of ['.env.example', '.github/workflows/pages.yml', 'README.md', 'docs/github-pages.md', 'docs/publishing.md', 'frontend/.env.pages', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/src/standalone/demo.json', 'backend/requirements.lock.txt']) if (!publicFiles.has(required)) fail(required, 'обязательный публичный файл не входит в состав репозитория')

// Prevent broken documentation links to deliberately excluded local files.
for (const name of files.filter(file => file.endsWith('.md'))) {
  const markdown = readFileSync(path.join(root, name), 'utf8').replace(/```[\s\S]*?```/g, '')
  for (const match of markdown.matchAll(/\[[^\]]+\]\(([^\s)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0]
    if (!target || /^(?:[a-z]+:|\/\/)/i.test(target)) continue
    const relative = path.relative(root, path.resolve(root, path.dirname(name), decodeURIComponent(target))).split(path.sep).join('/')
    if (!publicFiles.has(relative)) fail(name, `ссылка ведёт в неопубликованный файл ${relative}`)
  }
}

const config = Object.fromEntries(readFileSync(path.join(root, 'frontend/.env.pages'), 'utf8').split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)] }))
if (config.VITE_RUNTIME_MODE !== 'standalone' || !/^\/.+\/$/.test(config.VITE_BASE_PATH) && config.VITE_BASE_PATH !== '/' || Object.keys(config).some(key => !['VITE_RUNTIME_MODE', 'VITE_BASE_PATH'].includes(key))) fail('frontend/.env.pages', 'разрешены только публичные параметры standalone и base path')
const fixture = JSON.parse(readFileSync(path.join(root, 'frontend/src/standalone/demo.json'), 'utf8'))
if (!fixture.items?.length || fixture.items.some(s => s.is_demo !== true || !s.id.startsWith('demo-') || !s.sources?.length || s.sources.some(source => !new URL(source.url).hostname.endsWith('.example')) || s.website && !new URL(s.website).hostname.endsWith('.example'))) fail('frontend/src/standalone/demo.json', 'в публичном снимке разрешены только явно вымышленные записи с .example источниками')

const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--pages-dir')) throw new Error('Usage: node scripts/check-publication.mjs [--pages-dir frontend/dist-pages]')
let artifactCount = 0
if (args[0] === '--pages-dir') {
  const directory = path.resolve(root, args[1])
  const relative = path.relative(root, directory)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Pages directory must be inside the workspace and separate from its root')
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const location = path.join(current, entry.name), name = path.relative(directory, location).split(path.sep).join('/')
      if (entry.isSymbolicLink()) { fail(name, 'символическая ссылка в Pages-артефакте'); continue }
      if (entry.isDirectory()) { walk(location); continue }
      artifactCount++
      if (!(name === 'index.html' || name.startsWith('assets/') || ['favicon.svg', 'robots.txt', '.nojekyll'].includes(name)) || /\.(?:md|py|ts|tsx|map|db|sql|pem|key)$/.test(name) || privatePath(name)) fail(name, 'лишний файл в Pages-артефакте')
      const data = readFileSync(location)
      if (!data.includes(0)) checkSecrets(name, data.toString('utf8'))
    }
  }
  walk(directory)
  const html = readFileSync(path.join(directory, 'index.html'), 'utf8')
  if (!html.includes(`${config.VITE_BASE_PATH}assets/`)) fail('index.html', 'пути ресурсов не соответствуют VITE_BASE_PATH')
}
if (errors.length) {
  for (const error of [...new Set(errors)]) process.stderr.write(`ERROR: ${error}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Publication check passed: ${files.length} repository files, ${probes.length} ignore checks${artifactCount ? `, ${artifactCount} Pages files` : ''}. No local brief/data or recognized private-key/token patterns found.\n`)
}
