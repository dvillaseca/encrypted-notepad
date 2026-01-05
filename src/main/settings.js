const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'settings.json';

const defaultSettings = {
    theme: 'dark'
};

function getConfigPath() {
    return path.join(app.getPath('userData'), CONFIG_FILE);
}

function loadSettings() {
    try {
        const configPath = getConfigPath();
        if (!fs.existsSync(configPath)) {
            return { ...defaultSettings };
        }
        const data = fs.readFileSync(configPath, 'utf8');
        return { ...defaultSettings, ...JSON.parse(data) };
    } catch {
        return { ...defaultSettings };
    }
}

function saveSettings(settings) {
    try {
        const configPath = getConfigPath();
        fs.writeFileSync(configPath, JSON.stringify(settings, null, 2));
    } catch {
        // Silently fail
    }
}

function getTheme() {
    return loadSettings().theme;
}

function setTheme(theme) {
    const settings = loadSettings();
    settings.theme = theme;
    saveSettings(settings);
}

module.exports = {
    loadSettings,
    saveSettings,
    getTheme,
    setTheme
};
