import winston from "winston";
import env from "./env";

//~ Log levels (from highest to lowest priority)
//~ error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6

//$ Get log level from environment variable
let currentLogLevel = env.LOG_LEVEL;

//$ Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }),
);

//$ Custom format for file output (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

//$ Create the logger instance
const logger = winston.createLogger({
  level: currentLogLevel,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transport for errors
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: fileFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: "logs/combined.log",
      format: fileFormat,
    }),
  ],
});

export default logger;
