type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  // IMPORTANT: Do not import `env` here.
  // `env.ts` logs during module initialization and imports this logger, so importing `env`
  // would create a circular dependency (env -> logger -> env) that breaks in Jest/runtime.
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    if (!this.shouldLog(level)) return;

    const logEntry: any = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (meta) {
      // Handle circular references in error objects
      try {
        JSON.stringify(meta);
        Object.assign(logEntry, meta);
      } catch (e) {
        // If circular reference, extract safe properties
        if (meta instanceof Error) {
          logEntry.error = {
            name: meta.name,
            message: meta.message,
            stack: meta.stack,
          };
        } else {
          logEntry.meta = { error: "Circular reference detected" };
        }
      }
    }

    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, meta?: any): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: any): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: any): void {
    this.log("error", message, meta);
  }
}

export const logger = new Logger();
