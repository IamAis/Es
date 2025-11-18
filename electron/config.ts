/**
 * Configurazione globale per Electron
 */

import path from "path";
import os from "os";

export const ELECTRON_CONFIG = {
  // App Info
  APP_NAME: "App Fatture",
  APP_VERSION: "2.0.0",
  
  // Paths
  DATA_DIR: path.join(os.homedir(), ".app-fatture"),
  DB_PATH: path.join(os.homedir(), ".app-fatture", "app.db"),
  STORAGE_DIR: path.join(os.homedir(), ".app-fatture", "storage"),
  XML_DIR: path.join(os.homedir(), ".app-fatture", "storage", "xml"),
  HTML_DIR: path.join(os.homedir(), ".app-fatture", "storage", "html"),
  PDF_DIR: path.join(os.homedir(), ".app-fatture", "storage", "pdf"),
  LOGS_DIR: path.join(os.homedir(), ".app-fatture", "logs"),

  // Server
  SERVER_HOST: "localhost",
  SERVER_PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,

  // Dev
  DEV_SERVER_URL: "http://localhost:5173",
  ENABLE_DEV_TOOLS: process.env.NODE_ENV === "development",

  // Window
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  WINDOW_MIN_WIDTH: 800,
  WINDOW_MIN_HEIGHT: 600,

  // Features
  ENABLE_AUTO_UPDATE: false, // TODO: Enable in production
  ENABLE_NATIVE_NOTIFICATIONS: true,

  // Database
  DB_DIALECT: "sqlite",
  DB_POOL_SIZE: 5,

  // Upload
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PARALLEL: 5,

  // Storage
  BACKUP_DIR: path.join(os.homedir(), ".app-fatture", "backups"),
  BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * IPC Channel Names
 */
export const IPC_CHANNELS = {
  // File operations
  FILE_OPEN: "file:open",
  FILE_SAVE: "file:save",

  // Invoice operations
  INVOICE_UPLOAD: "invoice:upload",
  INVOICE_GET_PROGRESS: "invoice:get-progress",
  INVOICE_PROGRESS_UPDATE: "invoice:progress-update",

  // PDF operations
  PDF_GENERATE: "pdf:generate",
  PDF_OPEN: "pdf:open",
  PDF_DOWNLOAD: "pdf:download",

  // Storage operations
  STORAGE_GET_PATH: "storage:get-path",
  STORAGE_OPEN_FOLDER: "storage:open-folder",

  // App operations
  APP_READY_TO_QUIT: "app:ready-to-quit",
  APP_SERVER_READY: "app:server-ready",
} as const;

/**
 * Environment Variables
 */
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  IS_DEV: process.env.NODE_ENV === "development",
  IS_PROD: process.env.NODE_ENV === "production",
};
