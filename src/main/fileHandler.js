const fs = require('fs');
const path = require('path');
const crypto = require('./crypto');

let currentFilePath = null;
let currentPassword = null;

function setCurrentFile(filePath, password) {
    currentFilePath = filePath;
    currentPassword = password;
}

function getCurrentFilePath() {
    return currentFilePath;
}

function hasOpenFile() {
    return currentFilePath !== null && currentPassword !== null;
}

async function readEncryptedFile(filePath, password) {
    const buffer = fs.readFileSync(filePath);
    const content = crypto.decrypt(buffer, password);
    setCurrentFile(filePath, password);
    return content;
}

async function writeEncryptedFile(filePath, content, password) {
    const encrypted = crypto.encrypt(content, password);
    fs.writeFileSync(filePath, encrypted);
    setCurrentFile(filePath, password);
}

async function saveCurrentFile(content) {
    if (!hasOpenFile()) {
        throw new Error('No file is currently open');
    }
    await writeEncryptedFile(currentFilePath, content, currentPassword);
}

async function saveAsFile(filePath, content) {
    if (!currentPassword) {
        throw new Error('No password available');
    }
    await writeEncryptedFile(filePath, content, currentPassword);
}

async function createNewEncryptedFile(filePath, password) {
    const encrypted = crypto.createNewFile(password);
    fs.writeFileSync(filePath, encrypted);
    setCurrentFile(filePath, password);
}

function clearSession() {
    if (currentPassword) {
        currentPassword = null;
    }
    currentFilePath = null;
}

function encryptPendingContent(content) {
    if (!currentPassword) return null;
    return crypto.encrypt(content, currentPassword);
}

function decryptPendingContent(encryptedBuffer, password) {
    try {
        return crypto.decrypt(encryptedBuffer, password);
    } catch {
        return null;
    }
}

async function changePassword(newPassword, content) {
    if (!hasOpenFile()) {
        throw new Error('No file is currently open');
    }
    await writeEncryptedFile(currentFilePath, content, newPassword);
    currentPassword = newPassword;
}

function getFileExtension() {
    return '.etxt';
}

function isEncryptedFile(filePath) {
    return path.extname(filePath).toLowerCase() === '.etxt';
}

module.exports = {
    readEncryptedFile,
    writeEncryptedFile,
    saveCurrentFile,
    saveAsFile,
    createNewEncryptedFile,
    clearSession,
    getCurrentFilePath,
    hasOpenFile,
    getFileExtension,
    isEncryptedFile,
    setCurrentFile,
    changePassword,
    encryptPendingContent,
    decryptPendingContent
};
