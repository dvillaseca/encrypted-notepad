const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFile: () => ipcRenderer.invoke('dialog:saveFile'),
    saveFileAs: () => ipcRenderer.invoke('dialog:saveFileAs'),
    newFile: () => ipcRenderer.invoke('file:new'),
    
    unlockFile: (password) => ipcRenderer.invoke('file:unlock', password),
    getContent: () => ipcRenderer.invoke('file:getContent'),
    saveContent: (content) => ipcRenderer.invoke('file:saveContent', content),
    saveAs: (filePath, content) => ipcRenderer.invoke('file:saveAs', filePath, content),
    
    createNewFile: (filePath, password) => ipcRenderer.invoke('file:createNew', filePath, password),
    openExistingFile: (filePath, password) => ipcRenderer.invoke('file:openExisting', filePath, password),
    
    onLock: (callback) => ipcRenderer.on('app:lock', (event, reason) => callback(reason)),
    onRequestSave: (callback) => ipcRenderer.on('app:requestSave', () => callback()),
    onFileOpened: (callback) => ipcRenderer.on('file:opened', (event, data) => callback(data)),
    onNewFileRequested: (callback) => ipcRenderer.on('file:newRequested', () => callback()),
    onOpenFileRequested: (callback) => ipcRenderer.on('file:openRequested', (event, filePath) => callback(filePath)),
    onSaveAsRequested: (callback) => ipcRenderer.on('file:saveAsRequested', (event, filePath) => callback(filePath)),
    onFind: (callback) => ipcRenderer.on('edit:find', () => callback()),
    onReplace: (callback) => ipcRenderer.on('edit:replace', () => callback()),
    onChangePasswordRequested: (callback) => ipcRenderer.on('file:changePasswordRequested', () => callback()),
    
    reportActivity: () => ipcRenderer.send('user:activity'),
    lock: () => ipcRenderer.send('app:manualLock'),
    
    getSettings: () => ipcRenderer.invoke('settings:get'),
    setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
    
    getCurrentFilePath: () => ipcRenderer.invoke('file:getCurrentPath'),
    hasUnsavedChanges: () => ipcRenderer.invoke('file:hasUnsavedChanges'),
    
    quit: () => ipcRenderer.send('app:quit'),
    
    setTitle: (title) => ipcRenderer.send('window:setTitle', title),
    setUnsavedChanges: (value) => ipcRenderer.send('file:setUnsavedChanges', value),
    notifySaved: () => ipcRenderer.send('file:saved'),
    
    getRecentFiles: () => ipcRenderer.invoke('recentFiles:get'),
    removeRecentFile: (filePath) => ipcRenderer.invoke('recentFiles:remove', filePath),
    clearRecentFiles: () => ipcRenderer.invoke('recentFiles:clear'),
    
    changePassword: (newPassword, content) => ipcRenderer.invoke('file:changePassword', newPassword, content),
    hasOpenFile: () => ipcRenderer.invoke('file:hasOpenFile'),

    getTheme: () => ipcRenderer.invoke('theme:get'),
    setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
    onThemeChanged: (callback) => ipcRenderer.on('theme:changed', (event, theme) => callback(theme))
});
