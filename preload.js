const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximized: (cb) => ipcRenderer.on('window:maximized', (_e, v) => cb(v)),

  pickAttachments: (taskId) => ipcRenderer.invoke('attach:pick', taskId),
  addDroppedFiles: (taskId, files) =>
    ipcRenderer.invoke('attach:addPaths', taskId, Array.from(files, (f) => webUtils.getPathForFile(f))),
  openAttachment: (taskId, file) => ipcRenderer.invoke('attach:open', taskId, file),
  revealAttachment: (taskId, file) => ipcRenderer.invoke('attach:reveal', taskId, file),
  removeAttachment: (taskId, file) => ipcRenderer.invoke('attach:remove', taskId, file),
  purgeAttachments: (taskIds) => ipcRenderer.invoke('attach:purge', taskIds),
});
