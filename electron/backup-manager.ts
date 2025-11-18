import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import JSZip from "jszip";
import { getStorageDir, getXmlDir, getHtmlDir, getPdfDir, getMetadataFile } from "../server/paths.js";
import { getDataPath } from "./database.js";

/**
 * Sistema di backup e ripristino dati per migrazione tra PC
 */

export interface BackupOptions {
  includeXML?: boolean;
  includeHTML?: boolean;
  includePDF?: boolean;
  includeMetadata?: boolean;
  compressionLevel?: number;
}

/**
 * Esporta i dati come ZIP per backup o migrazione
 */
export async function createFullBackup(
  outputPath?: string,
  options: BackupOptions = {}
): Promise<string> {
  const {
    includeXML = true,
    includeHTML = true,
    includePDF = true,
    includeMetadata = true,
    compressionLevel = 6,
  } = options;

  console.log("[Backup] Starting full backup...");
  
  const zip = new JSZip();

  // Metadati
  if (includeMetadata) {
    try {
      const metadataFile = getMetadataFile();
      const content = await fs.readFile(metadataFile, "utf-8");
      zip.file("metadata/invoices.json", content);
      console.log("[Backup] Added metadata");
    } catch (err) {
      console.warn("[Backup] Could not add metadata:", err);
    }
  }

  // File XML
  if (includeXML) {
    const xmlDir = getXmlDir();
    try {
      const files = await fs.readdir(xmlDir);
      for (const file of files) {
        if (file.endsWith(".xml")) {
          const content = await fs.readFile(path.join(xmlDir, file));
          zip.folder("files/xml")?.file(file, content);
        }
      }
      console.log(`[Backup] Added ${files.length} XML files`);
    } catch (err) {
      console.warn("[Backup] Could not add XML files:", err);
    }
  }

  // File HTML
  if (includeHTML) {
    const htmlDir = getHtmlDir();
    try {
      const files = await fs.readdir(htmlDir);
      for (const file of files) {
        if (file.endsWith(".html")) {
          const content = await fs.readFile(path.join(htmlDir, file));
          zip.folder("files/html")?.file(file, content);
        }
      }
      console.log(`[Backup] Added ${files.length} HTML files`);
    } catch (err) {
      console.warn("[Backup] Could not add HTML files:", err);
    }
  }

  // File PDF
  if (includePDF) {
    const pdfDir = getPdfDir();
    try {
      const files = await fs.readdir(pdfDir);
      for (const file of files) {
        if (file.endsWith(".pdf")) {
          const content = await fs.readFile(path.join(pdfDir, file));
          zip.folder("files/pdf")?.file(file, content);
        }
      }
      console.log(`[Backup] Added ${files.length} PDF files`);
    } catch (err) {
      console.warn("[Backup] Could not add PDF files:", err);
    }
  }

  // Aggiungi manifest
  const manifest = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    appName: "App Fatture",
    userOs: process.platform,
    userHome: os.homedir(),
    exportedAt: new Date().toLocaleString("it-IT"),
  };
  zip.file("BACKUP_MANIFEST.json", JSON.stringify(manifest, null, 2));

  // Genera ZIP
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: compressionLevel },
  });

  // Salva il file
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = outputPath || path.join(os.homedir(), `app-fatture-backup-${timestamp}.zip`);
  
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, zipBuffer);

  console.log(`[Backup] Full backup created: ${filename}`);
  return filename;
}

/**
 * Ripristina i dati da un backup ZIP
 */
export async function restoreFromBackup(
  backupPath: string,
  options: BackupOptions = {}
): Promise<{
  success: boolean;
  message: string;
  imported: number;
  errors: string[];
  manifest?: any;
}> {
  const {
    includeXML = true,
    includeHTML = true,
    includePDF = true,
    includeMetadata = true,
  } = options;

  console.log(`[Restore] Starting restore from: ${backupPath}`);

  if (!fsSync.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  // Leggi il backup ZIP
  const backupBuffer = await fs.readFile(backupPath);
  const zip = new JSZip();
  await zip.loadAsync(backupBuffer);

  // Crea backup dei dati attuali
  const backupTimestamp = new Date().getTime();
  const backupDirs = [
    {
      original: getMetadataFile(),
      isFile: true,
    },
    { original: getXmlDir() },
    { original: getHtmlDir() },
    { original: getPdfDir() },
  ];

  console.log("[Restore] Creating backup of current data...");
  for (const backup of backupDirs) {
    try {
      if (backup.isFile) {
        if (fsSync.existsSync(backup.original)) {
          const backupPath = `${backup.original}.backup-${backupTimestamp}`;
          await fs.copyFile(backup.original, backupPath);
          console.log(`[Restore] Backed up: ${backup.original}`);
        }
      } else {
        if (fsSync.existsSync(backup.original)) {
          const backupPath = `${backup.original}.backup-${backupTimestamp}`;
          await fs.cp(backup.original, backupPath, { recursive: true });
          console.log(`[Restore] Backed up: ${backup.original}`);
        }
      }
    } catch (err) {
      console.warn(`[Restore] Failed to backup ${backup.original}:`, err);
    }
  }

  // Ripristina i file
  let importedCount = 0;
  const errors: string[] = [];

  // Metadati
  if (includeMetadata) {
    const metadataEntry = zip.file("metadata/invoices.json");
    if (metadataEntry) {
      try {
        const content = await metadataEntry.async("string");
        const metadataFile = getMetadataFile();
        await fs.mkdir(path.dirname(metadataFile), { recursive: true });
        await fs.writeFile(metadataFile, content, "utf-8");
        importedCount++;
        console.log("[Restore] Restored metadata");
      } catch (err) {
        const errMsg = `Failed to restore metadata: ${err}`;
        console.error(`[Restore] ${errMsg}`);
        errors.push(errMsg);
      }
    }
  }

  // XML files
  if (includeXML) {
    const xmlDir = getXmlDir();
    let xmlCount = 0;
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (filePath.startsWith("files/xml/") && !file.dir && filePath.endsWith(".xml")) {
        try {
          const content = await file.async("nodebuffer");
          const fileName = path.basename(filePath);
          await fs.mkdir(xmlDir, { recursive: true });
          await fs.writeFile(path.join(xmlDir, fileName), content);
          importedCount++;
          xmlCount++;
        } catch (err) {
          const errMsg = `Failed to restore ${filePath}: ${err}`;
          console.error(`[Restore] ${errMsg}`);
          errors.push(errMsg);
        }
      }
    }
    console.log(`[Restore] Restored ${xmlCount} XML files`);
  }

  // HTML files
  if (includeHTML) {
    const htmlDir = getHtmlDir();
    let htmlCount = 0;
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (filePath.startsWith("files/html/") && !file.dir && filePath.endsWith(".html")) {
        try {
          const content = await file.async("nodebuffer");
          const fileName = path.basename(filePath);
          await fs.mkdir(htmlDir, { recursive: true });
          await fs.writeFile(path.join(htmlDir, fileName), content);
          importedCount++;
          htmlCount++;
        } catch (err) {
          const errMsg = `Failed to restore ${filePath}: ${err}`;
          console.error(`[Restore] ${errMsg}`);
          errors.push(errMsg);
        }
      }
    }
    console.log(`[Restore] Restored ${htmlCount} HTML files`);
  }

  // PDF files
  if (includePDF) {
    const pdfDir = getPdfDir();
    let pdfCount = 0;
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (filePath.startsWith("files/pdf/") && !file.dir && filePath.endsWith(".pdf")) {
        try {
          const content = await file.async("nodebuffer");
          const fileName = path.basename(filePath);
          await fs.mkdir(pdfDir, { recursive: true });
          await fs.writeFile(path.join(pdfDir, fileName), content);
          importedCount++;
          pdfCount++;
        } catch (err) {
          const errMsg = `Failed to restore ${filePath}: ${err}`;
          console.error(`[Restore] ${errMsg}`);
          errors.push(errMsg);
        }
      }
    }
    console.log(`[Restore] Restored ${pdfCount} PDF files`);
  }

  // Leggi manifest
  let manifest = null;
  const manifestEntry = zip.file("BACKUP_MANIFEST.json");
  if (manifestEntry) {
    try {
      const content = await manifestEntry.async("string");
      manifest = JSON.parse(content);
      console.log("[Restore] Read backup manifest:", manifest);
    } catch (err) {
      console.warn("[Restore] Failed to read manifest:", err);
    }
  }

  console.log(`[Restore] Restore completed. Imported: ${importedCount}, Errors: ${errors.length}`);

  return {
    success: errors.length === 0,
    message: errors.length === 0 ? "Backup restored successfully" : "Backup restored with errors",
    imported: importedCount,
    errors,
    manifest,
  };
}

/**
 * Cancella backup precedenti conservando solo gli ultimi N backup
 */
export async function cleanOldBackups(
  backupDir: string = os.homedir(),
  keepCount: number = 5
): Promise<void> {
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter((f) => f.startsWith("app-fatture-backup-") && f.endsWith(".zip"))
      .sort()
      .reverse();

    if (backupFiles.length > keepCount) {
      const filesToDelete = backupFiles.slice(keepCount);
      for (const file of filesToDelete) {
        const filePath = path.join(backupDir, file);
        await fs.unlink(filePath);
        console.log(`[Backup] Deleted old backup: ${file}`);
      }
    }
  } catch (err) {
    console.warn("[Backup] Could not clean old backups:", err);
  }
}

/**
 * Esegui backup periodico (da usare con setInterval o cron)
 */
export async function scheduleAutoBackup(
  intervalHours: number = 24,
  backupDir: string = path.join(os.homedir(), "AppData", "Local", "app-fatture-backups")
): Promise<NodeJS.Timer> {
  console.log(`[Backup] Auto-backup scheduled every ${intervalHours} hours`);

  // Esegui backup subito
  await createFullBackup(path.join(backupDir, `app-fatture-backup-${Date.now()}.zip`));

  // Poi periodicamente
  return setInterval(async () => {
    try {
      await createFullBackup(path.join(backupDir, `app-fatture-backup-${Date.now()}.zip`));
      await cleanOldBackups(backupDir);
    } catch (err) {
      console.error("[Backup] Auto-backup failed:", err);
    }
  }, intervalHours * 60 * 60 * 1000);
}
