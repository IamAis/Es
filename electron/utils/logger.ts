import fs from "fs/promises";
import path from "path";
import { ELECTRON_CONFIG } from "../config";

let logFile: string | null = null;

/**
 * Inizializza il sistema di logging
 */
export async function initializeLogging(): Promise<void> {
  try {
    // Crea la directory logs se non esiste
    await fs.mkdir(ELECTRON_CONFIG.LOGS_DIR, { recursive: true });

    // Crea il file log con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    logFile = path.join(ELECTRON_CONFIG.LOGS_DIR, `app-${timestamp}.log`);

    log("Logging initialized");
  } catch (error) {
    console.error("Failed to initialize logging:", error);
  }
}

/**
 * Log a message
 */
export function log(message: string, level: "info" | "warn" | "error" = "info"): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  // Console log
  switch (level) {
    case "warn":
      console.warn(logMessage);
      break;
    case "error":
      console.error(logMessage);
      break;
    default:
      console.log(logMessage);
  }

  // File log
  if (logFile) {
    fs.appendFile(logFile, logMessage + "\n").catch((error) => {
      console.error("Failed to write to log file:", error);
    });
  }
}

/**
 * Log info
 */
export function logInfo(message: string): void {
  log(message, "info");
}

/**
 * Log warning
 */
export function logWarn(message: string): void {
  log(message, "warn");
}

/**
 * Log error
 */
export function logError(message: string, error?: Error): void {
  const errorMessage = error ? `${message}: ${error.message}` : message;
  log(errorMessage, "error");
}
