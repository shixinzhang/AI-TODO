import fs from "fs/promises";
import path from "path";

export class Logger {
  constructor({ filePath = "./runtime.log", minLevel = "info" } = {}) {
    this.filePath = path.resolve(filePath);
    this.minLevel = minLevel;
    this._chain = Promise.resolve();
    this._levels = { debug: 10, info: 20, warn: 30, error: 40 };
  }

  setMinLevel(level) {
    this.minLevel = level;
  }

  log(level, message, meta) {
    const levelValue = this._levels[level] ?? this._levels.info;
    const minValue = this._levels[this.minLevel] ?? this._levels.info;
    if (levelValue < minValue) return;

    const ts = new Date().toISOString();
    const line =
      typeof meta === "undefined"
        ? `[${ts}] [${level.toUpperCase()}] ${message}\n`
        : `[${ts}] [${level.toUpperCase()}] ${message} ${safeJson(meta)}\n`;

    this._chain = this._chain
      .then(async () => {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.appendFile(this.filePath, line, "utf8");
      })
      .catch(() => undefined);
  }

  debug(message, meta) {
    this.log("debug", message, meta);
  }

  info(message, meta) {
    this.log("info", message, meta);
  }

  warn(message, meta) {
    this.log("warn", message, meta);
  }

  error(message, meta) {
    this.log("error", message, meta);
  }

  flush() {
    return this._chain;
  }
}

export const logger = new Logger({
  filePath: process.env.LOG_FILE || "./.local/runtime.log",
  minLevel: process.env.LOG_LEVEL || "info",
});

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"<unserializable>"';
  }
}
