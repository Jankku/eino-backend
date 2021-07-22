/* eslint-disable security/detect-non-literal-fs-filename */
import { createLogger, format, transports } from 'winston';
import fs from 'fs';
import path from 'path';

const logDir = 'logs';

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const Logger = createLogger({
  level: 'info',
  defaultMeta: { service: 'eino' },
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  transports: [
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    new transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(logDir, 'combined.log') }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(logDir, 'exceptions.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  Logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple(),
    ),
  }));
}

Logger.on('error', () => {});

export default Logger;
