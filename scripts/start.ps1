param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    Write-Error 'Сначала выполните установку по README: python -m venv .venv и установите зависимости.'
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\dist\index.html'))) {
    Write-Error 'Сначала соберите интерфейс: cd frontend; npm ci; npm run build.'
}
& $pythonPath -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port $Port
