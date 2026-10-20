import winston from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, align, json } = winston.format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

// Add colors to winston
winston.addColors(colors);

// O json() do winston serializa Error como {} (perde message e stack), então
// convertemos qualquer Error no primeiro nível dos metadados (ex: { err },
// { error }, ou o próprio erro passado como segundo argumento).
const serializeErrors = winston.format((info) => {
  for (const key of Object.keys(info)) {
    const value = (info as any)[key];
    if (value instanceof Error) {
      (info as any)[key] = {
        ...value,
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
  }
  return info;
});

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${
    Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
  }`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "http",
  levels,
  format: combine(
    winston.format.errors({ stack: true }),
    serializeErrors(),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    json(),
    align()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        consoleFormat
      ),
    }),
    // Error file transport
    new winston.transports.File({
      filename: path.join("data/logs", "error.log"),
      level: "error",
      // Rotaciona em 20MB mantendo 5 arquivos (error.log, error1.log, ...)
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
  // Exceção não tratada derruba o processo: grava o motivo antes de sair
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join("data/logs", "crash.log"),
    }),
  ],
});

// Create logs directory if it doesn't exist
import fs from "fs";
const logDir = "data/logs";
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

export default logger;
