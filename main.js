const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const PAGE = path.join(__dirname, 'src', 'index.html');
const PAGE_URL = pathToFileURL(PAGE).href;
const dataFile = () => path.join(app.getPath('userData'), 'todo-data.json');

const RISKY_EXT = new Set([
  '.exe', '.msi', '.msix', '.appx', '.bat', '.cmd', '.com', '.scr', '.pif', '.cpl', '.ps1', '.psm1',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta', '.lnk', '.url', '.reg', '.jar', '.dll',
  '.sh', '.bash', '.run', '.appimage', '.deb', '.rpm', '.desktop', '.py', '.pl',
]);

function attachDir(taskId) {
  if (typeof taskId !== 'string' || !/^[a-z0-9]+$/i.test(taskId)) throw new Error('Invalid task id');
  return path.join(app.getPath('userData'), 'attachments', taskId);
}
const storedPath = (taskId, file) => path.join(attachDir(taskId), path.basename(String(file)));

function copyIn(taskId, paths) {
  const dir = attachDir(taskId);
  fs.mkdirSync(dir, { recursive: true });
  const added = [];
  for (const src of paths) {
    if (typeof src !== 'string') continue;
    let stat;
    try {
      stat = fs.statSync(src);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const name = path.basename(src);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const file = `${id}-${name}`;
    fs.copyFileSync(src, path.join(dir, file));
    added.push({ id, name, size: stat.size, file });
  }
  return added;
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    frame: false,
    backgroundColor: '#0f0f1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  win.loadFile(PAGE);
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));
}

function trusted(e) {
  return e.senderFrame?.url === PAGE_URL;
}
function handle(channel, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e)) throw new Error('Untrusted sender');
    return fn(...args);
  });
}
function on(channel, fn) {
  ipcMain.on(channel, (e, ...args) => {
    if (trusted(e)) fn(...args);
  });
}

handle('data:load', () => {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return null;
  }
});

handle('data:save', (data) => {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tasks) || !Array.isArray(data.lists)) {
    throw new Error('Invalid data');
  }
  const file = dataFile();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return true;
});

handle('attach:pick', async (taskId) => {
  const res = await dialog.showOpenDialog(win, { title: 'Attach files', properties: ['openFile', 'multiSelections'] });
  return res.canceled ? [] : copyIn(taskId, res.filePaths);
});
handle('attach:addPaths', (taskId, paths) => copyIn(taskId, Array.isArray(paths) ? paths : []));
handle('attach:open', async (taskId, file) => {
  const target = storedPath(taskId, file);
  if (RISKY_EXT.has(path.extname(target).toLowerCase())) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Open anyway'],
      defaultId: 0,
      cancelId: 0,
      title: 'Open attachment?',
      message: `"${path.basename(target).replace(/^[a-z0-9]+-/i, '')}" can run programs on your computer.`,
      detail: 'Only open it if you trust where it came from.',
    });
    if (response !== 1) return '';
  }
  return shell.openPath(target);
});
handle('attach:reveal', (taskId, file) => shell.showItemInFolder(storedPath(taskId, file)));
handle('attach:remove', (taskId, file) => fs.rmSync(storedPath(taskId, file), { force: true }));
handle('attach:purge', (taskIds) => {
  for (const id of Array.isArray(taskIds) ? taskIds : []) {
    fs.rmSync(attachDir(id), { recursive: true, force: true });
  }
});

on('window:minimize', () => win.minimize());
on('window:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
on('window:close', () => win.close());

app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (e) => e.preventDefault());
  contents.on('will-attach-webview', (e) => e.preventDefault());
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    createWindow();
  });
}
app.on('window-all-closed', () => app.quit());
