export type LogLevel = 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG' | 'UNKNOWN';
export type LevelFilter = 'all' | 'highlights' | 'errors';

export type ContentType = 'text' | 'json' | 'html' | 'markdown' | 'structured_log';

export interface ParsedLog {
  content: any;
  type: ContentType;
  meta?: {
    timestamp?: string;
    level?: string;
    logger?: string;
  };
  extra?: Record<string, any>;
}

export interface NormalizedLog {
  raw: string;
  parsed: ParsedLog;
  level: LogLevel;
  messageText: string;
  searchText: string;
  stepIndex?: number;
  stepName?: string;
  logger?: string;
  service?: string;
  fingerprint: string;
  repeatCount: number;
}
