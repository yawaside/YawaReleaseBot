# YawaReleaseBot — Desktop (.exe)

Electron-обёртка, которая превращает веб-панель в **один portable `.exe`-файл для Windows**.

## Что внутри exe

- **Electron-оболочка** — окно приложения;
- **Next.js standalone-сервер** (папка `.next/standalone` из корня проекта);
- **Встроенный Node.js** (`standalone/bin/node.exe`) — сервер запускается им, системный Node.js не нужен;
- **SQLite-база** — создаётся автоматически в `%APPDATA%/YawaReleaseBot/`, настраивать ничего не нужно.

## Сборка локально (на Windows)

```powershell
# 1. В корне проекта — собрать веб-приложение
npm install
npm run build

# 2. Скопировать статику в standalone (как делает CI)
Copy-Item -Recurse .next\static .next\standalone\.next\ -Force
Copy-Item .env.example .next\standalone\.env.example -Force
Remove-Item .next\standalone\.env -ErrorAction SilentlyContinue

# 3. Положить node.exe внутрь пакета
$nodeVer = (node -v).TrimStart('v')
Invoke-WebRequest "https://nodejs.org/dist/v$nodeVer/node-v$nodeVer-win-x64.zip" -OutFile "$env:TEMP\node.zip"
Expand-Archive "$env:TEMP\node.zip" "$env:TEMP\node-portable" -Force
New-Item -ItemType Directory -Force -Path '.next\standalone\bin' | Out-Null
Copy-Item (Get-ChildItem "$env:TEMP\node-portable" -Recurse -Filter node.exe | Select-Object -First 1).FullName '.next\standalone\bin\node.exe' -Force

# 4. Собрать portable exe
cd desktop
npm install
npm run build:win
```

Готовый файл: `desktop/dist/YawaReleaseBot-<версия>-portable.exe`.

## Запуск из исходников (разработка)

```powershell
cd desktop
npm install
npm start   # использует системный node + ../.next/standalone (сначала npm run build в корне)
```

## Диагностика

При проблемах смотрите лог: `%APPDATA%/YawaReleaseBot/main.log`.
