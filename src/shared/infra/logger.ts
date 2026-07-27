import "server-only";

import { getRequestContext } from "./request-context";

type LogFields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, fields: LogFields = {}) {
  const context = getRequestContext();
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ?? {}),
    ...fields,
  };

  const serialized = JSON.stringify(entry);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.info(serialized);
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
