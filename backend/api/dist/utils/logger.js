"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const env_1 = require("./env");
class Logger {
    constructor() {
        this.logLevel = env_1.env.logLevel || 'info';
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }
    log(level, message, meta) {
        if (!this.shouldLog(level))
            return;
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
        };
        if (meta) {
            // Handle circular references in error objects
            try {
                JSON.stringify(meta);
                Object.assign(logEntry, meta);
            }
            catch (e) {
                // If circular reference, extract safe properties
                if (meta instanceof Error) {
                    logEntry.error = {
                        name: meta.name,
                        message: meta.message,
                        stack: meta.stack,
                    };
                }
                else {
                    logEntry.meta = { error: 'Circular reference detected' };
                }
            }
        }
        console.log(JSON.stringify(logEntry));
    }
    debug(message, meta) {
        this.log('debug', message, meta);
    }
    info(message, meta) {
        this.log('info', message, meta);
    }
    warn(message, meta) {
        this.log('warn', message, meta);
    }
    error(message, meta) {
        this.log('error', message, meta);
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map