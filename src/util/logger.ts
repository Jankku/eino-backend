import { createLogger, format, transports } from 'winston';
import { inspect } from 'node:util';
import { config } from '../config.ts';

const readableFormat = format.printf(({ timestamp, level, message, ...metadata }) => {
  const details = Object.fromEntries(Object.entries(metadata));
  const context =
    Object.keys(details).length > 0
      ? `\n${inspect(details, { depth: 6, colors: false, compact: false })}`
      : '';
  return `${String(timestamp)} ${level}: ${String(message)}${context}`;
});

export const Logger = createLogger({
  level: config.isProduction ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    config.isProduction ? format.json() : readableFormat,
  ),
  transports: [new transports.Console()],
});

Logger.on('error', () => {});

export const logError = (error: unknown): void => {
  Logger.error(error instanceof Error ? (error.stack ?? error.message) : inspect(error));
};
