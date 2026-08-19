const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

function readLaunchMeta() {
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.dsfLaunch || {};
  } catch {
    return {};
  }
}

function buildLaunchUrl(meta) {
  const base = String(meta.baseUrl || process.env.DSF_BASE_URL || 'https://dev.d-me.ly').replace(/\/+$/, '');
  const appId = String(meta.appId || process.env.DSF_APP_ID || 'maintenance');
  const scope = String(meta.scope || process.env.DSF_SCOPE || 'maintenance');
  const redirect = String(meta.redirect || process.env.DSF_REDIRECT || '/dashboard');

  const url = new URL('/entry', base);
  url.searchParams.set('auto', '1');
  url.searchParams.set('app', appId);
  url.searchParams.set('scope', scope);
  url.searchParams.set('redirect', redirect);
  return url.toString();
}

function createMainWindow() {
  const meta = readLaunchMeta();
  const startUrl = buildLaunchUrl(meta);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    autoHideMenuBar: true,
    title: String(meta.name || app.getName() || 'DSF Dashboard'),
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
    },
  });

  // Force links that open new windows to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const safePrefix = String(meta.baseUrl || process.env.DSF_BASE_URL || 'https://dev.d-me.ly').replace(/\/+$/, '');
    if (!url.startsWith(safePrefix)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(startUrl);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
