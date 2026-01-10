const { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } = require('electron');
const path = require('path');
const fileHandler = require('./fileHandler');
const IdleDetector = require('./idleDetector');
const recentFiles = require('./recentFiles');
const settings = require('./settings');
const recoveryManager = require('./recoveryManager');

let mainWindow = null;
let idleDetector = null;
let pendingFilePath = null;
let currentContent = '';
let isUnlocked = false;
let hasUnsavedChanges = false;
let pendingUnsavedContent = null;

const DEFAULT_IDLE_TIMEOUT = 2 * 60 * 60 * 1000;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false
        },
        title: 'Encrypted Notepad',
        icon: path.join(__dirname, '..', '..', 'assets', 'icon.png')
    });
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    
    mainWindow.on('close', (e) => {
        if (!hasUnsavedChanges) return;
        
        e.preventDefault();
        dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: ['Save', "Don't Save", 'Cancel'],
            defaultId: 0,
            cancelId: 2,
            title: 'Unsaved Changes',
            message: 'You have unsaved changes. Do you want to save before closing?'
        }).then(({ response }) => {
            if (response === 0) {
                mainWindow.webContents.send('app:requestSave');
                mainWindow.webContents.once('ipc-message', (event, channel) => {
                    if (channel === 'file:saved') {
                        hasUnsavedChanges = false;
                        mainWindow.destroy();
                    }
                });
            } else if (response === 1) {
                hasUnsavedChanges = false;
                mainWindow.destroy();
            }
        });
    });
    
    createMenu();
    setupIdleDetector();
    setupIpcHandlers();

    const fileArg = process.argv.find(arg => arg.endsWith('.etxt'));
    if (fileArg) {
        pendingFilePath = path.resolve(fileArg);
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('file:openRequested', pendingFilePath);
        });
    }
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow.webContents.send('file:newRequested')
                },
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => handleOpenFile()
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow.webContents.send('app:requestSave')
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => handleSaveAs()
                },
                { type: 'separator' },
                {
                    label: 'Change Password',
                    click: () => mainWindow.webContents.send('file:changePasswordRequested')
                },
                {
                    label: 'Lock',
                    accelerator: 'CmdOrCtrl+L',
                    click: () => triggerLock('manual')
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Find',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => mainWindow.webContents.send('edit:find')
                },
                {
                    label: 'Replace',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => mainWindow.webContents.send('edit:replace')
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Theme',
                    submenu: [
                        {
                            label: 'Dark',
                            type: 'radio',
                            id: 'theme-dark',
                            checked: settings.getTheme() === 'dark',
                            click: () => setTheme('dark')
                        },
                        {
                            label: 'Light',
                            type: 'radio',
                            id: 'theme-light',
                            checked: settings.getTheme() === 'light',
                            click: () => setTheme('light')
                        }
                    ]
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function setupIdleDetector() {
    idleDetector = new IdleDetector(DEFAULT_IDLE_TIMEOUT);
    idleDetector.setLockCallback((reason) => {
        triggerLock(reason);
    });
}

async function triggerLock(reason) {
    if (!isUnlocked) return;
    
    if (hasUnsavedChanges && mainWindow && !mainWindow.isDestroyed()) {
        const content = await new Promise(resolve => {
            ipcMain.once('editor:content', (event, c) => resolve(c));
            mainWindow.webContents.send('editor:requestContent');
            setTimeout(() => resolve(null), 1000);
        });
        pendingUnsavedContent = content ? fileHandler.encryptPendingContent(content) : null;
    } else {
        pendingUnsavedContent = null;
    }
    
    isUnlocked = false;
    currentContent = '';
    fileHandler.clearSession();
    
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:lock', reason);
    }
    
    idleDetector.stop();
}

function setupIpcHandlers() {
    ipcMain.handle('dialog:openFile', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            filters: [{ name: 'Encrypted Text', extensions: ['etxt'] }],
            properties: ['openFile']
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
            return result.filePaths[0];
        }
        return null;
    });

    ipcMain.handle('dialog:saveFile', async () => {
        if (fileHandler.hasOpenFile()) {
            return fileHandler.getCurrentFilePath();
        }
        return await showSaveDialog();
    });

    ipcMain.handle('dialog:saveFileAs', async () => {
        return await showSaveDialog();
    });

    ipcMain.handle('file:openExisting', async (event, filePath, password, useRecovery = false) => {
        try {
            const savedContent = await fileHandler.readEncryptedFile(filePath, password);
            let hasPendingChanges = false;
            let recoveryEditHistory = null;
            
            if (pendingUnsavedContent) {
                const decrypted = fileHandler.decryptPendingContent(pendingUnsavedContent, password);
                if (decrypted !== null) {
                    recoveryEditHistory = [{ 
                        changes: [{ 
                            range: { startLineNumber: 1, startColumn: 1, endLineNumber: Infinity, endColumn: Infinity },
                            text: decrypted 
                        }]
                    }];
                    hasPendingChanges = true;
                }
            } else if (useRecovery && recoveryManager.hasRecoveryFile(filePath)) {
                const recoveryData = recoveryManager.loadRecoveryFile(filePath, password);
                if (recoveryData && recoveryData.editHistory) {
                    recoveryEditHistory = recoveryData.editHistory;
                    hasPendingChanges = true;
                }
            }
            
            pendingUnsavedContent = null;
            isUnlocked = true;
            idleDetector.unlock();
            idleDetector.start();
            updateWindowTitle(filePath);
            recentFiles.addRecentFile(filePath);
            return { 
                success: true, 
                content: savedContent, 
                editHistory: recoveryEditHistory,
                hasUnsavedChanges: hasPendingChanges 
            };
        } catch (error) {
            pendingUnsavedContent = null;
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('recovery:check', (event, filePath) => {
        if (!recoveryManager.hasRecoveryFile(filePath)) return null;
        const info = recoveryManager.getRecoveryInfo(filePath);
        return info;
    });

    ipcMain.handle('recovery:save', (event, filePath, editHistory) => {
        const password = fileHandler.getCurrentPassword();
        if (!password) return false;
        recoveryManager.saveRecoveryFileDebounced(filePath, editHistory, password);
        return true;
    });

    ipcMain.handle('recovery:delete', (event, filePath) => {
        recoveryManager.deleteRecoveryFile(filePath);
        return true;
    });

    ipcMain.handle('file:createNew', async (event, filePath, password) => {
        try {
            await fileHandler.createNewEncryptedFile(filePath, password);
            currentContent = '';
            isUnlocked = true;
            idleDetector.unlock();
            idleDetector.start();
            updateWindowTitle(filePath);
            recentFiles.addRecentFile(filePath);
            return { success: true, content: '' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('file:saveContent', async (event, content) => {
        try {
            currentContent = content;
            await fileHandler.saveCurrentFile(content);
            const filePath = fileHandler.getCurrentFilePath();
            if (filePath) {
                recoveryManager.deleteRecoveryFile(filePath);
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('file:saveAs', async (event, filePath, content) => {
        try {
            currentContent = content;
            await fileHandler.saveAsFile(filePath, content);
            updateWindowTitle(filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('file:getCurrentPath', () => {
        return fileHandler.getCurrentFilePath();
    });

    ipcMain.handle('settings:get', () => {
        return {
            idleTimeout: DEFAULT_IDLE_TIMEOUT
        };
    });

    ipcMain.handle('settings:set', (event, settings) => {
        if (settings.idleTimeout) {
            idleDetector.setTimeout(settings.idleTimeout);
        }
        return true;
    });

    ipcMain.on('user:activity', () => {
        if (idleDetector && isUnlocked) {
            idleDetector.onUserActivity();
        }
    });

    ipcMain.on('app:manualLock', () => {
        triggerLock('manual');
    });

    ipcMain.on('app:quit', () => {
        app.quit();
    });

    ipcMain.on('window:setTitle', (event, title) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setTitle(title);
        }
    });

    ipcMain.on('file:setUnsavedChanges', (event, value) => {
        hasUnsavedChanges = value;
    });

    ipcMain.on('file:saved', () => {
        hasUnsavedChanges = false;
    });

    ipcMain.handle('recentFiles:get', () => {
        return recentFiles.getRecentFiles();
    });

    ipcMain.handle('recentFiles:remove', (event, filePath) => {
        recentFiles.removeRecentFile(filePath);
        return recentFiles.getRecentFiles();
    });

    ipcMain.handle('recentFiles:clear', () => {
        recentFiles.clearRecentFiles();
        return [];
    });

    ipcMain.handle('file:changePassword', async (event, newPassword, content) => {
        try {
            await fileHandler.changePassword(newPassword, content);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('file:hasOpenFile', () => {
        return fileHandler.hasOpenFile();
    });

    ipcMain.handle('theme:get', () => {
        return settings.getTheme();
    });

    ipcMain.handle('theme:set', (event, theme) => {
        setTheme(theme);
        return true;
    });
}

async function showSaveDialog() {
    const result = await dialog.showSaveDialog(mainWindow, {
        filters: [{ name: 'Encrypted Text', extensions: ['etxt'] }],
        defaultPath: 'untitled.etxt'
    });
    
    if (!result.canceled) {
        return result.filePath;
    }
    return null;
}

async function handleOpenFile() {
    const filePath = await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: 'Encrypted Text', extensions: ['etxt'] }],
        properties: ['openFile']
    });
    
    if (!filePath.canceled && filePath.filePaths.length > 0) {
        mainWindow.webContents.send('file:openRequested', filePath.filePaths[0]);
    }
}

async function handleSaveAs() {
    const filePath = await showSaveDialog();
    if (filePath) {
        mainWindow.webContents.send('file:saveAsRequested', filePath);
    }
}

function updateWindowTitle(filePath) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const fileName = path.basename(filePath);
        mainWindow.setTitle(`${fileName} - Encrypted Notepad`);
    }
}

function setTheme(theme) {
    settings.setTheme(theme);
    nativeTheme.themeSource = theme;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('theme:changed', theme);
    }
}

function applyInitialTheme() {
    const theme = settings.getTheme();
    nativeTheme.themeSource = theme;
}

app.whenReady().then(() => {
    applyInitialTheme();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    currentContent = '';
    fileHandler.clearSession();
});

app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow) {
        mainWindow.webContents.send('file:openRequested', filePath);
    } else {
        pendingFilePath = filePath;
    }
});
