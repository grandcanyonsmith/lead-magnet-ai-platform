/**
 * Centralized logging utility
 * Replaces console.log/error/warn with proper logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  level?: LogLevel
  context?: string
  error?: Error | unknown
  data?: Record<string, unknown>
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(level: LogLevel, message: string, options?: LogOptions): string {
    const context = options?.context ? `[${options.context}]` : ''
    return `${context} ${message}`
  }

  private log(level: LogLevel, message: string, options?: LogOptions): void {
    if (!this.isDevelopment && level === 'debug') {
      return
    }

    const formattedMessage = this.formatMessage(level, message, options)
    const logData = options?.data ? { ...options.data } : {}

    if (options?.error) {
      logData.error = options.error instanceof Error ? {
        message: options.error.message,
        stack: options.error.stack,
        name: options.error.name,
      } : options.error
    }

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, logData)
        break
      case 'info':
        console.info(formattedMessage, logData)
        break
      case 'warn':
        console.warn(formattedMessage, logData)
        break
      case 'error':
        console.error(formattedMessage, logData)
        // In production, you might want to send errors to an error tracking service
        // e.g., Sentry, LogRocket, etc.
        break
    }
  }

  debug(message: string, options?: LogOptions): void {
    this.log('debug', message, options)
  }

  info(message: string, options?: LogOptions): void {
    this.log('info', message, options)
  }

  warn(message: string, options?: LogOptions): void {
    this.log('warn', message, options)
  }

  error(message: string, options?: LogOptions): void {
    this.log('error', message, options)
  }
}

export const logger = new Logger()
