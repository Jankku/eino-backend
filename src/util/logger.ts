import { createLogger, format, transports } from 'winston';
import { config } from '../config';

export const Logger = createLogger({
  level: config.isProduction ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    config.isProduction ? format.json() : format.cli({ all: true }),
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.simple()),
    }),
  ],
});

Logger.on('error', () => {});
