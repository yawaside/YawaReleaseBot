'use strict';

// Electron main process for YawaReleaseBot (portable .exe).
//
// How it works:
//  1. The portable exe ships a bundled Node.js runtime
//     (resources/standalone/bin/node.exe, packed by CI) plus the
//     Next.js standalone server and an embedded SQLite database.
//  2. On launch we spawn the server with the bundled node.exe —
//     no system Node.js / npm / PostgreSQL required on the user's PC.
//  3. The panel opens in a desktop window; user data lives in the
//     per-user %APPDATA% folder and survives restarts.

const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const DEFAULT_PORT = 31999;
let mainWindow = null;
let serverChild = null;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log('[YawaReleaseBot]', ...args);
  try {
    const dir = app.getPath('userData');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'main.log'), line + '\n');
  } catch (_) {
    /* ignore logging errors */
  }
}

function resolveServerDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'standalone');
  }
  return path.join(__dirname, '..', '.next', 'standalone');
}

function resolveDbFile() {
  // Persistent per-user DB — survives app restarts, zero configuration.
  if (process.env.DB_FILE) return process.env.DB_FILE;
  return path.join(app.getPath('userData'), 'yawareleasebot.db');
}

// In the packaged .exe we MUST use the bundled node.exe — the embedded
// Next.js server loads a native SQLite module that only works with a
// real Node.js runtime (not with Electron's internal Node build).
function resolveNodeRuntime() {
  if (!app.isPackaged) {
    return 'node'; // dev mode: use the system Node.js from PATH
  }
  const exeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const bundled = path.join(process.resourcesPath, 'standalone', 'bin', exeName);
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  throw new Error(
    'Не найден встроенный Node.js в пакете приложения:\n' +
      bundled +
      '\n\n.exe собран некорректно — пересоберите его через GitHub Actions (Release workflow).'
  );
}

function isServerUp(port) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/api/health', timeout: 1500 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(port, triesLeft = 90) {
  return new Promise((resolve, reject) => {
    const attempt = async (left) => {
      if (left <= 0) {
        return reject(
          new Error(
            'Встроенный сервер не успел запуститься (таймаут 45 сек).\n' +
              'Подробности — в файле main.log рядом с данными приложения.'
          )
        );
      }
      if (await isServerUp(port)) return resolve(true);
      setTimeout(() => attempt(left - 1), 500);
    };
    attempt(triesLeft);
  });
}

function startServer() {
  const serverDir = resolveServerDir();
  const serverJs = path.join(serverDir, 'server.js');

  if (!fs.existsSync(serverJs)) {
    throw new Error(
      'Не найдена встроенная сборка сервера:\n' +
        serverJs +
        '\n\nСначала выполните "npm run build" в корне проекта.'
    );
  }

  const port = Number(process.env.PORT || DEFAULT_PORT);
  const nodeBin = resolveNodeRuntime();
  log('Using Node.js runtime:', nodeBin);

  serverChild = spawn(nodeBin, [serverJs], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      DB_FILE: resolveDbFile(),
      NEXT_TELEMETRY_DISABLED: '1',
    },
    windowsHide: true,
  });

  serverChild.stdout.on('data', (d) => log('[server]', String(d).trimEnd()));
  serverChild.stderr.on('data', (d) => log('[server:err]', String(d).trimEnd()));
  serverChild.on('error', (err) => log('[server] spawn error:', err && err.message));
  serverChild.on('exit', (code, signal) =>
    log(`[server] exited code=${code} signal=${signal}`)
  );

  return { port };
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'YawaReleaseBot',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function boot() {
  try {
    log('Starting YawaReleaseBot…');
    const { port } = startServer();
    log('Waiting for embedded server on port', port);
    await waitForServer(port);
    log('Server ready. Opening window.');
    createWindow(port);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    log('FATAL:', msg);
    dialog.showErrorBox('YawaReleaseBot — ошибка запуска', msg);
    app.quit();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on('before-quit', () => {
    if (serverChild) {
      try {
        serverChild.kill();
      } catch (_) {
        /* ignore */
      }
      serverChild = null;
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
