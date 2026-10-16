'use strict';

const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('recipesAPI', Object.freeze({
  getOptions: () => ipcRenderer.invoke('recipes:options'),
  listRecipes: (filters) => ipcRenderer.invoke('recipes:list', filters),
  getRecipe: (id) => ipcRenderer.invoke('recipes:detail', id),
  getRandom: () => ipcRenderer.invoke('recipes:random'),
  openVideo: (url) => ipcRenderer.invoke('recipes:video', url)
}));
