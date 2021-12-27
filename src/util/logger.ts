import { createLogger, format, transports } from "winston";

const Logger = createLogger({
  level: "info",
  defaultMeta: { service: "eino" },
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.simple()),
    }),
  ],
});

Logger.on("error", () => {});

export default Logger;
