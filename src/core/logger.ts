import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';
let colorsEnabled = true;
let quietMode = false;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function setColorsEnabled(enabled: boolean): void {
  colorsEnabled = enabled;
}

export function setQuietMode(quiet: boolean): void {
  quietMode = quiet;
}

function shouldLog(level: LogLevel): boolean {
  if (quietMode && level !== 'error') return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, msg: string): string {
  if (!colorsEnabled) {
    return level === 'debug' ? `[DEBUG] ${msg}` : msg;
  }

  switch (level) {
    case 'debug': return chalk.gray(`[DEBUG] ${msg}`);
    case 'info': return msg;
    case 'warn': return chalk.yellow(msg);
    case 'error': return chalk.red(msg);
  }
}

export const logger = {
  debug(msg: string): void {
    if (shouldLog('debug')) {
      console.error(formatMessage('debug', msg));
    }
  },

  info(msg: string): void {
    if (shouldLog('info')) {
      console.log(formatMessage('info', msg));
    }
  },

  warn(msg: string): void {
    if (shouldLog('warn')) {
      console.error(formatMessage('warn', msg));
    }
  },

  error(msg: string): void {
    if (shouldLog('error')) {
      console.error(formatMessage('error', msg));
    }
  },
};
