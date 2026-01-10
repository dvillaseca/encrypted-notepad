const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const cryptoModule = require('./crypto');

const RECOVERY_DIR = path.join(app.getPath('userData'), 'recovery');
const DEBOUNCE_MS = 2000;

let debounceTimer = null;

function ensureRecoveryDir() {
    if (!fs.existsSync(RECOVERY_DIR)) {
        fs.mkdirSync(RECOVERY_DIR, { recursive: true });
    }
}

function getRecoveryFilePath(originalFilePath) {
    const hash = crypto.createHash('sha256').update(originalFilePath).digest('hex').slice(0, 16);
    return path.join(RECOVERY_DIR, `${hash}.recovery`);
}

function getMetaFilePath(originalFilePath) {
    const hash = crypto.createHash('sha256').update(originalFilePath).digest('hex').slice(0, 16);
    return path.join(RECOVERY_DIR, `${hash}.meta`);
}

function saveRecoveryFile(originalFilePath, editHistory, password) {
    ensureRecoveryDir();
    
    const recoveryPath = getRecoveryFilePath(originalFilePath);
    const metaPath = getMetaFilePath(originalFilePath);
    
    const data = {
        editHistory: editHistory || [],
        timestamp: Date.now()
    };
    
    const encrypted = cryptoModule.encrypt(JSON.stringify(data), password);
    fs.writeFileSync(recoveryPath, encrypted);
    
    const meta = {
        originalPath: originalFilePath,
        timestamp: Date.now()
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta));
}

function saveRecoveryFileDebounced(originalFilePath, editHistory, password) {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
        saveRecoveryFile(originalFilePath, editHistory, password);
        debounceTimer = null;
    }, DEBOUNCE_MS);
}

function hasRecoveryFile(originalFilePath) {
    const recoveryPath = getRecoveryFilePath(originalFilePath);
    const metaPath = getMetaFilePath(originalFilePath);
    return fs.existsSync(recoveryPath) && fs.existsSync(metaPath);
}

function getRecoveryInfo(originalFilePath) {
    const metaPath = getMetaFilePath(originalFilePath);
    if (!fs.existsSync(metaPath)) return null;
    
    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        return meta;
    } catch {
        return null;
    }
}

function loadRecoveryFile(originalFilePath, password) {
    const recoveryPath = getRecoveryFilePath(originalFilePath);
    
    if (!fs.existsSync(recoveryPath)) return null;
    
    try {
        const encrypted = fs.readFileSync(recoveryPath);
        const decrypted = cryptoModule.decrypt(encrypted, password);
        return JSON.parse(decrypted);
    } catch {
        return null;
    }
}

function deleteRecoveryFile(originalFilePath) {
    const recoveryPath = getRecoveryFilePath(originalFilePath);
    const metaPath = getMetaFilePath(originalFilePath);
    
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    
    try {
        if (fs.existsSync(recoveryPath)) fs.unlinkSync(recoveryPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    } catch {
        // Ignore errors
    }
}

function clearAllRecoveryFiles() {
    ensureRecoveryDir();
    
    try {
        const files = fs.readdirSync(RECOVERY_DIR);
        files.forEach(file => {
            fs.unlinkSync(path.join(RECOVERY_DIR, file));
        });
    } catch {
        // Ignore errors
    }
}

module.exports = {
    saveRecoveryFile,
    saveRecoveryFileDebounced,
    hasRecoveryFile,
    getRecoveryInfo,
    loadRecoveryFile,
    deleteRecoveryFile,
    clearAllRecoveryFiles,
    DEBOUNCE_MS
};
