let editor = null;
let isMonacoLoaded = false;
let currentMode = 'unlock';
let pendingFilePath = null;
let currentFilePath = null;
let hasUnsavedChanges = false;
let currentTheme = 'dark';

const passwordOverlay = document.getElementById('password-overlay');
const passwordInput = document.getElementById('password-input');
const passwordConfirm = document.getElementById('password-confirm');
const confirmGroup = document.getElementById('confirm-group');
const errorMessage = document.getElementById('error-message');
const dialogTitle = document.getElementById('dialog-title');
const dialogMessage = document.getElementById('dialog-message');
const btnSubmit = document.getElementById('btn-submit');
const btnCancel = document.getElementById('btn-cancel');
const btnNewFile = document.getElementById('btn-new-file');
const btnOpenFile = document.getElementById('btn-open-file');
const togglePassword = document.getElementById('toggle-password');
const editorContainer = document.getElementById('editor-container');
const recentFilesSection = document.getElementById('recent-files-section');
const recentFilesList = document.getElementById('recent-files-list');
const btnClearRecent = document.getElementById('btn-clear-recent');
const changePasswordOverlay = document.getElementById('change-password-overlay');
const newPasswordInput = document.getElementById('new-password-input');
const newPasswordConfirm = document.getElementById('new-password-confirm');
const changePasswordError = document.getElementById('change-password-error');
const changePasswordSuccess = document.getElementById('change-password-success');
const btnChangePassword = document.getElementById('btn-change-password');
const btnCancelChangePassword = document.getElementById('btn-cancel-change-password');
const toggleNewPassword = document.getElementById('toggle-new-password');

let monacoLoadPromise = null;

async function initMonaco() {
    if (isMonacoLoaded) return;
    if (monacoLoadPromise) return monacoLoadPromise;
    
    monacoLoadPromise = (async () => {
        const script = document.createElement('script');
        script.src = '../../node_modules/monaco-editor/min/vs/loader.js';
        script.async = true;
        document.head.appendChild(script);
        
        await new Promise((resolve) => {
            script.onload = resolve;
        });
        
        window.require.config({
            paths: { vs: '../../node_modules/monaco-editor/min/vs' },
            'vs/nls': { availableLanguages: {} }
        });
        
        await new Promise((resolve) => {
            window.require(['vs/editor/editor.main'], resolve);
        });
        
        isMonacoLoaded = true;
    })();
    
    return monacoLoadPromise;
}

function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    if (editor && isMonacoLoaded) {
        const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';
        monaco.editor.setTheme(monacoTheme);
    }
}

async function loadTheme() {
    const theme = await window.electronAPI.getTheme();
    applyTheme(theme);
}

async function loadRecentFiles() {
    const files = await window.electronAPI.getRecentFiles();
    renderRecentFiles(files);
}

function renderRecentFiles(files) {
    recentFilesList.innerHTML = '';
    
    if (files.length === 0) {
        recentFilesSection.classList.add('hidden');
        return;
    }
    
    recentFilesSection.classList.remove('hidden');
    
    files.forEach(file => {
        const li = document.createElement('li');
        li.className = 'recent-file-item';
        li.innerHTML = `
            <svg class="recent-file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div class="recent-file-info">
                <div class="recent-file-name">${escapeHtml(file.name)}</div>
                <div class="recent-file-path">${escapeHtml(getDirectory(file.path))}</div>
            </div>
            <button class="recent-file-remove" title="Remove from list">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        
        li.addEventListener('click', (e) => {
            if (!e.target.closest('.recent-file-remove')) {
                setMode('unlock', file.path);
            }
        });
        
        const removeBtn = li.querySelector('.recent-file-remove');
        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const updatedFiles = await window.electronAPI.removeRecentFile(file.path);
            renderRecentFiles(updatedFiles);
        });
        
        recentFilesList.appendChild(li);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getDirectory(filePath) {
    const parts = filePath.split(/[/\\]/);
    parts.pop();
    return parts.join('/');
}

async function createEditor(content = '') {
    await initMonaco();
    
    if (editor) {
        editor.dispose();
    }
    
    const monacoTheme = currentTheme === 'light' ? 'vs' : 'vs-dark';
    editor = monaco.editor.create(editorContainer, {
        value: content,
        language: 'plaintext',
        theme: monacoTheme,
        lineNumbers: 'on',
        wordWrap: 'on',
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Consolas', 'Monaco', monospace",
        padding: { top: 16, bottom: 16 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderLineHighlight: 'line',
        cursorBlinking: 'blink',
        smoothScrolling: false,
        contextmenu: true,
        folding: true,
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 4
    });
    
    editor.onDidChangeModelContent(() => {
        if (!hasUnsavedChanges) {
            hasUnsavedChanges = true;
            updateWindowTitle();
        }
        reportActivity();
    });
    
    editor.onKeyDown(() => reportActivity());
    editor.onMouseDown(() => reportActivity());
    
    window.addEventListener('resize', () => {
        if (editor) editor.layout();
    });
}

function showOverlay() {
    passwordOverlay.classList.add('active');
    editorContainer.style.filter = 'blur(10px)';
    passwordInput.focus();
}

function hideOverlay() {
    passwordOverlay.classList.remove('active');
    editorContainer.style.filter = 'none';
    clearPasswordFields();
}

function clearPasswordFields() {
    passwordInput.value = '';
    passwordConfirm.value = '';
    hideError();
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    passwordInput.focus();
    passwordInput.select();
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function setMode(mode, filePath = null) {
    currentMode = mode;
    pendingFilePath = filePath;
    clearPasswordFields();
    hideError();
    
    switch (mode) {
        case 'new':
            dialogTitle.textContent = 'Create New Encrypted File';
            dialogMessage.textContent = 'Set a strong password to protect your file';
            confirmGroup.classList.remove('hidden');
            btnSubmit.textContent = 'Create File';
            btnCancel.classList.remove('hidden');
            btnNewFile.parentElement.classList.add('hidden');
            break;
            
        case 'unlock':
            dialogTitle.textContent = 'Encrypted Notepad';
            dialogMessage.textContent = filePath 
                ? `Enter password to unlock: ${getFileName(filePath)}`
                : 'Enter password to unlock your file';
            confirmGroup.classList.add('hidden');
            btnSubmit.textContent = 'Unlock';
            btnCancel.classList.remove('hidden');
            btnNewFile.parentElement.classList.add('hidden');
            break;
            
        case 'initial':
        default:
            dialogTitle.textContent = 'Encrypted Notepad';
            dialogMessage.textContent = 'Create or open an encrypted file to begin';
            confirmGroup.classList.add('hidden');
            btnSubmit.textContent = 'Unlock';
            btnSubmit.classList.add('hidden');
            btnCancel.classList.add('hidden');
            btnNewFile.parentElement.classList.remove('hidden');
            loadRecentFiles();
            break;
    }
    
    if (mode !== 'initial') {
        btnSubmit.classList.remove('hidden');
        recentFilesSection.classList.add('hidden');
    }
    
    showOverlay();
}

function getFileName(filePath) {
    return filePath.split(/[/\\]/).pop();
}

function updateWindowTitle() {
    if (!currentFilePath) return;
    const fileName = getFileName(currentFilePath);
    const prefix = hasUnsavedChanges ? '*' : '';
    window.electronAPI.setTitle(`${prefix}${fileName} - Encrypted Notepad`);
    window.electronAPI.setUnsavedChanges(hasUnsavedChanges);
}

async function handleSubmit() {
    const password = passwordInput.value;
    
    if (!password) {
        showError('Please enter a password');
        return;
    }
    
    if (currentMode === 'new') {
        const confirm = passwordConfirm.value;
        if (password !== confirm) {
            showError('Passwords do not match');
            return;
        }
        if (password.length < 1) {
            showError('Password cannot be empty');
            return;
        }
        
        let filePath = pendingFilePath;
        if (!filePath) {
            filePath = await window.electronAPI.saveFileAs();
            if (!filePath) return;
        }
        
        const result = await window.electronAPI.createNewFile(filePath, password);
        if (result.success) {
            currentFilePath = filePath;
            await createEditor('');
            hideOverlay();
            hasUnsavedChanges = false;
        } else {
            showError(result.error || 'Failed to create file');
        }
        return;
    }
    
    if (currentMode === 'unlock' && pendingFilePath) {
        const result = await window.electronAPI.openExistingFile(pendingFilePath, password);
        if (result.success) {
            currentFilePath = pendingFilePath;
            await createEditor(result.content);
            hideOverlay();
            hasUnsavedChanges = false;
        } else {
            showError('Incorrect password or corrupted file');
        }
    }
}

async function handleNewFile() {
    const filePath = await window.electronAPI.saveFileAs();
    if (filePath) {
        setMode('new', filePath);
    }
}

async function handleOpenFile() {
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
        setMode('unlock', filePath);
    }
}

async function handleSave() {
    if (!editor) return;
    
    const content = editor.getValue();
    const result = await window.electronAPI.saveContent(content);
    
    if (result.success) {
        hasUnsavedChanges = false;
        updateWindowTitle();
        window.electronAPI.notifySaved();
    } else {
        console.error('Save failed:', result.error);
    }
}

function handleLock(reason) {
    if (editor) {
        editor.setValue('');
    }
    hasUnsavedChanges = false;
    
    let message = 'Session locked';
    switch (reason) {
        case 'idle_timeout':
            message = 'Locked due to inactivity';
            break;
        case 'suspend':
            message = 'Locked due to system suspend';
            break;
        case 'screen_lock':
            message = 'Locked due to screen lock';
            break;
        case 'manual':
            message = 'Manually locked';
            break;
    }
    
    if (currentFilePath) {
        setMode('unlock', currentFilePath);
        dialogMessage.textContent = message;
    } else {
        dialogMessage.textContent = message;
        setMode('initial');
    }
}

function reportActivity() {
    window.electronAPI.reportActivity();
}

function triggerFind() {
    if (editor) {
        editor.getAction('actions.find').run();
    }
}

function triggerReplace() {
    if (editor) {
        editor.getAction('editor.action.startFindReplaceAction').run();
    }
}

function showChangePasswordDialog() {
    newPasswordInput.value = '';
    newPasswordConfirm.value = '';
    changePasswordError.classList.add('hidden');
    changePasswordSuccess.classList.add('hidden');
    changePasswordOverlay.classList.add('active');
    editorContainer.style.filter = 'blur(10px)';
    newPasswordInput.focus();
}

function hideChangePasswordDialog() {
    changePasswordOverlay.classList.remove('active');
    editorContainer.style.filter = 'none';
    newPasswordInput.value = '';
    newPasswordConfirm.value = '';
}

function showChangePasswordError(message) {
    changePasswordError.textContent = message;
    changePasswordError.classList.remove('hidden');
    changePasswordSuccess.classList.add('hidden');
}

function showChangePasswordSuccess(message) {
    changePasswordSuccess.textContent = message;
    changePasswordSuccess.classList.remove('hidden');
    changePasswordError.classList.add('hidden');
}

async function handleChangePassword() {
    const newPassword = newPasswordInput.value;
    const confirmPassword = newPasswordConfirm.value;
    
    if (!newPassword) {
        showChangePasswordError('Please enter a new password');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showChangePasswordError('Passwords do not match');
        return;
    }
    
    const hasFile = await window.electronAPI.hasOpenFile();
    if (!hasFile) {
        showChangePasswordError('No file is currently open');
        return;
    }
    
    const content = editor ? editor.getValue() : '';
    const result = await window.electronAPI.changePassword(newPassword, content);
    
    if (result.success) {
        showChangePasswordSuccess('Password changed successfully');
        hasUnsavedChanges = false;
        updateWindowTitle();
        setTimeout(() => {
            hideChangePasswordDialog();
        }, 1500);
    } else {
        showChangePasswordError(result.error || 'Failed to change password');
    }
}

btnSubmit.addEventListener('click', handleSubmit);

btnCancel.addEventListener('click', () => {
    setMode('initial');
});

btnNewFile.addEventListener('click', handleNewFile);
btnOpenFile.addEventListener('click', handleOpenFile);

btnClearRecent.addEventListener('click', async () => {
    const files = await window.electronAPI.clearRecentFiles();
    renderRecentFiles(files);
});

btnChangePassword.addEventListener('click', handleChangePassword);

btnCancelChangePassword.addEventListener('click', hideChangePasswordDialog);

toggleNewPassword.addEventListener('click', () => {
    const type = newPasswordInput.type === 'password' ? 'text' : 'password';
    newPasswordInput.type = type;
    newPasswordConfirm.type = type;
});

newPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        newPasswordConfirm.focus();
    }
});

newPasswordConfirm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleChangePassword();
    }
});

passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (currentMode === 'new') {
            passwordConfirm.focus();
        } else {
            handleSubmit();
        }
    }
});

passwordConfirm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleSubmit();
    }
});

togglePassword.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    passwordConfirm.type = type;
});

window.electronAPI.onLock(handleLock);

window.electronAPI.onRequestSave(handleSave);

window.electronAPI.onNewFileRequested(() => {
    handleNewFile();
});

window.electronAPI.onOpenFileRequested((filePath) => {
    setMode('unlock', filePath);
});

window.electronAPI.onSaveAsRequested(async (filePath) => {
    if (!editor) return;
    const content = editor.getValue();
    const result = await window.electronAPI.saveAs(filePath, content);
    if (result.success) {
        currentFilePath = filePath;
        hasUnsavedChanges = false;
        updateWindowTitle();
    }
});

window.electronAPI.onFind(() => {
    triggerFind();
});

window.electronAPI.onReplace(() => {
    triggerReplace();
});

window.electronAPI.onChangePasswordRequested(async () => {
    const hasFile = await window.electronAPI.hasOpenFile();
    if (hasFile) {
        showChangePasswordDialog();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && changePasswordOverlay.classList.contains('active')) {
        hideChangePasswordDialog();
        return;
    }
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f') {
            e.preventDefault();
            triggerFind();
        } else if (e.key === 'h') {
            e.preventDefault();
            triggerReplace();
        } else if (e.key === 'l') {
            e.preventDefault();
            window.electronAPI.lock();
        }
    }
    reportActivity();
});

window.electronAPI.onThemeChanged((theme) => {
    applyTheme(theme);
});

setMode('initial');
loadRecentFiles();
loadTheme();

setTimeout(() => initMonaco(), 100);
