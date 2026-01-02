const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX_RECENT_FILES = 10;
const CONFIG_FILE = 'recent-files.json';

function getConfigPath() {
    return path.join(app.getPath('userData'), CONFIG_FILE);
}

function loadRecentFiles() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return [];
        }
        const data = fs.readFileSync(configPath, 'utf8');
        const files = JSON.parse(data);
        return files.filter(f => fs.existsSync(f.path));
    } catch {
        return [];
    }
}

function saveRecentFiles(files) {
    try {
        const configPath = getConfigPath();
        fs.writeFileSync(configPath, JSON.stringify(files, null, 2));
    } catch {
        // Silently fail
    }
}

function addRecentFile(filePath) {
    const files = loadRecentFiles();
    const existingIndex = files.findIndex(f => f.path === filePath);
    
    if (existingIndex !== -1) {
        files.splice(existingIndex, 1);
    }
    
    files.unshift({
        path: filePath,
        name: path.basename(filePath),
        openedAt: Date.now()
    });
    
    if (files.length > MAX_RECENT_FILES) {
        files.length = MAX_RECENT_FILES;
    }
    
    saveRecentFiles(files);
}

function getRecentFiles() {
    return loadRecentFiles();
}

function removeRecentFile(filePath) {
    const files = loadRecentFiles();
    const filtered = files.filter(f => f.path !== filePath);
    saveRecentFiles(filtered);
}

function clearRecentFiles() {
    saveRecentFiles([]);
}

module.exports = {
    addRecentFile,
    getRecentFiles,
    removeRecentFile,
    clearRecentFiles
};
