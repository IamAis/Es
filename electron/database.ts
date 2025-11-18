import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import os from "os";
import fs from "fs";

// Path per il database locale
const DATA_DIR = path.join(os.homedir(), ".app-fatture");
const DB_PATH = path.join(DATA_DIR, "app.db");

let db: any = null;

/**
 * Inizializza il database SQLite
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Crea la directory di dati se non esiste
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`Created data directory: ${DATA_DIR}`);
    }

    // Apri la connessione al database
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    });

    // Abilita foreign keys
    await db.exec("PRAGMA foreign_keys = ON");

    // Esegui le migrazioni (tabelle)
    await runMigrations();

    console.log(`Database initialized at: ${DB_PATH}`);
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

/**
 * Esegue le migrazioni (crea le tabelle)
 */
async function runMigrations(): Promise<void> {
  if (!db) {
    throw new Error("Database not initialized");
  }

  try {
    // Crea tabella invoices se non esiste
    await db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        numero_protocollo TEXT,
        data_fattura TEXT,
        importo_totale REAL,
        stato TEXT DEFAULT 'active',
        xmlPath TEXT,
        htmlPath TEXT,
        pdfPath TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Database migrations completed");
  } catch (error) {
    console.error("Failed to run migrations:", error);
    throw error;
  }
}

/**
 * Ottiene l'istanza del database
 */
export function getDatabase(): any {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

/**
 * Chiude il database
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    try {
      // Chiudi la connessione
      db = null;
      console.log("Database closed");
    } catch (error) {
      console.error("Failed to close database:", error);
    }
  }
}

/**
 * Ottiene il path del database
 */
export function getDatabasePath(): string {
  return DB_PATH;
}

/**
 * Ottiene il path della directory di dati
 */
export function getDataPath(): string {
  return DATA_DIR;
}
