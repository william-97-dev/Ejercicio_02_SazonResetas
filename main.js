'use strict';

const path = require('node:path');
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const recipes = require('./src/main/recipes-service');

let mainWindow = null;

function fromOurWindow(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
    throw new Error('Solicitud no autorizada.');
  }
}

function registerHandlers() {
  ipcMain.handle('recipes:options', async (event) => {
    fromOurWindow(event);
    return recipes.getOptions();
  });
  ipcMain.handle('recipes:list', async (event, filters) => {
    fromOurWindow(event);
    return recipes.listRecipes(filters);
  });
  ipcMain.handle('recipes:detail', async (event, id) => {
    fromOurWindow(event);
    return recipes.getRecipe(id);
  });
  ipcMain.handle('recipes:random', async (event) => {
    fromOurWindow(event);
    return recipes.getRandom();
  });
  ipcMain.handle('recipes:video', async (event, link) => {
    fromOurWindow(event);
    // Solo permitimos videos de YouTube; no aceptar direcciones arbitrarias.
    if (typeof link !== 'string') return false;
    let url;
    try { url = new URL(link); } catch { return false; }
    const trusted = new Set(['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com']);
    if (url.protocol !== 'https:' || !trusted.has(url.hostname) || url.username || url.password) return false;
    await shell.openExternal(url.href);
    return true;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#f9f5ef',
    title: 'Sazón | Explorador de recetas',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  registerHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
