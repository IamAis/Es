import fs from "fs/promises";
import path from "path";
import { ELECTRON_CONFIG } from "../config";
import { logInfo, logError } from "./logger";

/**
 * Gestisce le operazioni di storage locale
 */

export class StorageManager {
  /**
   * Inizializza tutte le directory di storage
   */
  static async initialize(): Promise<void> {
    const dirs = [
      ELECTRON_CONFIG.DATA_DIR,
      ELECTRON_CONFIG.STORAGE_DIR,
      ELECTRON_CONFIG.XML_DIR,
      ELECTRON_CONFIG.HTML_DIR,
      ELECTRON_CONFIG.PDF_DIR,
      ELECTRON_CONFIG.LOGS_DIR,
      ELECTRON_CONFIG.BACKUP_DIR,
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        logInfo(`Created/verified directory: ${dir}`);
      } catch (error) {
        logError(`Failed to create directory ${dir}`, error as Error);
      }
    }
  }

  /**
   * Salva un file XML
   */
  static async saveXMLFile(filename: string, content: string | Buffer): Promise<string> {
    const filepath = path.join(ELECTRON_CONFIG.XML_DIR, filename);
    try {
      await fs.writeFile(filepath, content);
      logInfo(`Saved XML file: ${filename}`);
      return filepath;
    } catch (error) {
      logError(`Failed to save XML file ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Salva un file HTML
   */
  static async saveHTMLFile(filename: string, content: string): Promise<string> {
    const filepath = path.join(ELECTRON_CONFIG.HTML_DIR, filename);
    try {
      await fs.writeFile(filepath, content);
      logInfo(`Saved HTML file: ${filename}`);
      return filepath;
    } catch (error) {
      logError(`Failed to save HTML file ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Salva un file PDF
   */
  static async savePDFFile(filename: string, content: Buffer): Promise<string> {
    const filepath = path.join(ELECTRON_CONFIG.PDF_DIR, filename);
    try {
      await fs.writeFile(filepath, content);
      logInfo(`Saved PDF file: ${filename}`);
      return filepath;
    } catch (error) {
      logError(`Failed to save PDF file ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Legge un file XML
   */
  static async readXMLFile(filename: string): Promise<Buffer> {
    const filepath = path.join(ELECTRON_CONFIG.XML_DIR, filename);
    try {
      return await fs.readFile(filepath);
    } catch (error) {
      logError(`Failed to read XML file ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Legge un file HTML
   */
  static async readHTMLFile(filename: string): Promise<string> {
    const filepath = path.join(ELECTRON_CONFIG.HTML_DIR, filename);
    try {
      return await fs.readFile(filepath, "utf-8");
    } catch (error) {
      logError(`Failed to read HTML file ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Legge un file PDF
   */
  static async readPDFFile(filename: string): Promise<Buffer> {
    const filepath = path.join(ELECTRON_CONFIG.PDF_DIR, filename);
    try {
      return await fs.readFile(filepath);
    } catch (error) {
      logError(`Failed to read PDF file ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Elimina un file
   */
  static async deleteFile(filename: string, type: "xml" | "html" | "pdf"): Promise<void> {
    const dir =
      type === "xml"
        ? ELECTRON_CONFIG.XML_DIR
        : type === "html"
          ? ELECTRON_CONFIG.HTML_DIR
          : ELECTRON_CONFIG.PDF_DIR;

    const filepath = path.join(dir, filename);
    try {
      await fs.unlink(filepath);
      logInfo(`Deleted ${type.toUpperCase()} file: ${filename}`);
    } catch (error) {
      logError(`Failed to delete ${type} file ${filename}`, error as Error);
      throw error;
    }
  }

  /**
   * Ottiene lo spazio disponibile
   */
  static async getStorageStats(): Promise<{
    xmlCount: number;
    htmlCount: number;
    pdfCount: number;
    totalSize: number;
  }> {
    try {
      const xmlFiles = await fs.readdir(ELECTRON_CONFIG.XML_DIR);
      const htmlFiles = await fs.readdir(ELECTRON_CONFIG.HTML_DIR);
      const pdfFiles = await fs.readdir(ELECTRON_CONFIG.PDF_DIR);

      let totalSize = 0;

      for (const file of [...xmlFiles, ...htmlFiles, ...pdfFiles]) {
        try {
          const stats = await fs.stat(file);
          totalSize += stats.size;
        } catch {
          // Ignore
        }
      }

      return {
        xmlCount: xmlFiles.length,
        htmlCount: htmlFiles.length,
        pdfCount: pdfFiles.length,
        totalSize,
      };
    } catch (error) {
      logError("Failed to get storage stats", error as Error);
      throw error;
    }
  }

  /**
   * Verifica se un file esiste
   */
  static async fileExists(filename: string, type: "xml" | "html" | "pdf"): Promise<boolean> {
    const dir =
      type === "xml"
        ? ELECTRON_CONFIG.XML_DIR
        : type === "html"
          ? ELECTRON_CONFIG.HTML_DIR
          : ELECTRON_CONFIG.PDF_DIR;

    const filepath = path.join(dir, filename);
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}
