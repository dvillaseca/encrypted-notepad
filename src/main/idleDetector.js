const { powerMonitor } = require('electron');

class IdleDetector {
    constructor(timeoutMs = 2 * 60 * 60 * 1000) {
        this.timeoutMs = timeoutMs;
        this.timer = null;
        this.onLockCallback = null;
        this.isLocked = true;
        this.suspended = false;
    }

    setLockCallback(callback) {
        this.onLockCallback = callback;
    }

    setTimeout(timeoutMs) {
        this.timeoutMs = timeoutMs;
        if (!this.isLocked) {
            this.resetTimer();
        }
    }

    start() {
        this.setupPowerMonitor();
        this.resetTimer();
        this.isLocked = false;
    }

    stop() {
        this.clearTimer();
        this.isLocked = true;
    }

    resetTimer() {
        this.clearTimer();
        if (!this.isLocked && this.timeoutMs > 0) {
            this.timer = setTimeout(() => {
                this.triggerLock('idle_timeout');
            }, this.timeoutMs);
        }
    }

    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    setupPowerMonitor() {
        powerMonitor.on('suspend', () => {
            this.suspended = true;
            this.triggerLock('suspend');
        });

        powerMonitor.on('resume', () => {
            this.suspended = false;
        });

        powerMonitor.on('lock-screen', () => {
            this.triggerLock('screen_lock');
        });
    }

    triggerLock(reason) {
        if (this.isLocked) return;
        
        this.clearTimer();
        this.isLocked = true;
        
        if (this.onLockCallback) {
            this.onLockCallback(reason);
        }
    }

    onUserActivity() {
        if (!this.isLocked) {
            this.resetTimer();
        }
    }

    unlock() {
        this.isLocked = false;
        this.resetTimer();
    }

    getIsLocked() {
        return this.isLocked;
    }
}

module.exports = IdleDetector;
