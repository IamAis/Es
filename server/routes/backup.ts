import { Router, type Request, type Response } from "express";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import multer from "multer";
import JSZip from "jszip";
import { storage } from "../storage.js";
import {
  getStorageDir,
  getXmlDir,
  getHtmlDir,
  getPdfDir,
  getMetadataFile,
} from "../paths.js";
import { getDatabasePath, getDataPath } from "../../electron/database.js";

const router = Router();

// Configurazione multer per upload di backup files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit per backup files
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are allowed"));
    }
  },
});

/**
 * GET /api/backup/export
 * Esporta il database, i metadati e tutti i file (XML, HTML, PDF)
 * come un singolo archivio ZIP per trasferimento tra PC
 */
router.get("/export", async (req: Request, res: Response) => {
  try {
    const zip = new JSZip();

    // 1. Aggiungi il file di metadati (invoices.json)
    try {
      const metadataFile = getMetadataFile();
      const metadataContent = await fs.readFile(metadataFile, "utf-8");
      zip.file("metadata/invoices.json", metadataContent);
    } catch (err) {
      console.warn("Metadata file not found, continuing without it");
    }

    // 2. Aggiungi tutti i file XML
    const xmlDir = getXmlDir();
    try {
      const xmlFiles = await fs.readdir(xmlDir);
      for (const file of xmlFiles) {
        if (file.endsWith(".xml")) {
          const filePath = path.join(xmlDir, file);
          const content = await fs.readFile(filePath);
          zip.folder("files/xml")?.file(file, content);
        }
      }
    } catch (err) {
      console.warn("XML directory error:", err);
    }

    // 3. Aggiungi tutti i file HTML
    const htmlDir = getHtmlDir();
    try {
      const htmlFiles = await fs.readdir(htmlDir);
      for (const file of htmlFiles) {
        if (file.endsWith(".html")) {
          const filePath = path.join(htmlDir, file);
          const content = await fs.readFile(filePath);
          zip.folder("files/html")?.file(file, content);
        }
      }
    } catch (err) {
      console.warn("HTML directory error:", err);
    }

    // 4. Aggiungi tutti i file PDF
    const pdfDir = getPdfDir();
    try {
      const pdfFiles = await fs.readdir(pdfDir);
      for (const file of pdfFiles) {
        if (file.endsWith(".pdf")) {
          const filePath = path.join(pdfDir, file);
          const content = await fs.readFile(filePath);
          zip.folder("files/pdf")?.file(file, content);
        }
      }
    } catch (err) {
      console.warn("PDF directory error:", err);
    }

    // 5. Aggiungi un manifest con info di backup
    const manifest = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      appName: "App Fatture",
      totalInvoices: (await storage.getAllInvoices()).length,
      exportedAt: new Date().toLocaleString("it-IT"),
    };
    zip.file("BACKUP_MANIFEST.json", JSON.stringify(manifest, null, 2));

    // Genera l'archivio ZIP
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    // Invia il file
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `app-fatture-backup-${timestamp}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", zipBuffer.length);

    res.send(zipBuffer);
  } catch (error: any) {
    console.error("Error exporting backup:", error);
    res.status(500).json({
      error: "Failed to export backup",
      details: error.message,
    });
  }
});

/**
 * POST /api/backup/import
 * Importa un backup precedente (ZIP file) con database, metadati e file
 */
router.post("/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No backup file provided" });
    }

    if (!req.file.originalname.endsWith(".zip")) {
      return res.status(400).json({
        error: "Invalid file format. Only .zip files are allowed",
      });
    }

    // Parse il ZIP
    const zip = new JSZip();
    await zip.loadAsync(req.file.buffer);

    // Backup dei dati attuali
    const backupTimestamp = new Date().getTime();
    const dataPath = getDataPath();
    const storageDir = getStorageDir();
    const xmlDir = getXmlDir();
    const htmlDir = getHtmlDir();
    const pdfDir = getPdfDir();
    const metadataFile = getMetadataFile();

    const backupDirs = [
      {
        original: metadataFile,
        backup: `${metadataFile}.backup-${backupTimestamp}`,
        isFile: true,
      },
      { original: xmlDir, backup: `${xmlDir}.backup-${backupTimestamp}` },
      { original: htmlDir, backup: `${htmlDir}.backup-${backupTimestamp}` },
      { original: pdfDir, backup: `${pdfDir}.backup-${backupTimestamp}` },
    ];

    // Crea backup dei dati attuali
    for (const backup of backupDirs) {
      try {
        if (backup.isFile) {
          if (fsSync.existsSync(backup.original)) {
            await fs.copyFile(backup.original, backup.backup);
            console.log(`Backed up: ${backup.original}`);
          }
        } else {
          if (fsSync.existsSync(backup.original)) {
            await fs.cp(backup.original, backup.backup, { recursive: true });
            console.log(`Backed up: ${backup.original}`);
          }
        }
      } catch (err) {
        console.warn(`Failed to backup ${backup.original}:`, err);
      }
    }

    // Estrai i file dal ZIP
    let importedCount = 0;
    const errors: string[] = [];

    // Importa metadati
    const metadataEntry = zip.file("metadata/invoices.json");
    if (metadataEntry) {
      try {
        const metadataContent = await metadataEntry.async("string");
        await fs.mkdir(path.dirname(metadataFile), { recursive: true });
        await fs.writeFile(metadataFile, metadataContent, "utf-8");
        console.log("Imported metadata");
        importedCount++;
      } catch (err) {
        console.error("Error importing metadata:", err);
        errors.push(`Failed to import metadata: ${err}`);
      }
    }

    // Importa XML files
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (
        filePath.startsWith("files/xml/") &&
        !file.dir &&
        filePath.endsWith(".xml")
      ) {
        try {
          const content = await file.async("nodebuffer");
          const fileName = path.basename(filePath);
          const destPath = path.join(xmlDir, fileName);
          await fs.mkdir(xmlDir, { recursive: true });
          await fs.writeFile(destPath, content);
          importedCount++;
        } catch (err) {
          console.error(`Error importing XML ${filePath}:`, err);
          errors.push(`Failed to import ${filePath}`);
        }
      }
    }

    // Importa HTML files
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (
        filePath.startsWith("files/html/") &&
        !file.dir &&
        filePath.endsWith(".html")
      ) {
        try {
          const content = await file.async("nodebuffer");
          const fileName = path.basename(filePath);
          const destPath = path.join(htmlDir, fileName);
          await fs.mkdir(htmlDir, { recursive: true });
          await fs.writeFile(destPath, content);
          importedCount++;
        } catch (err) {
          console.error(`Error importing HTML ${filePath}:`, err);
          errors.push(`Failed to import ${filePath}`);
        }
      }
    }

    // Importa PDF files
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (
        filePath.startsWith("files/pdf/") &&
        !file.dir &&
        filePath.endsWith(".pdf")
      ) {
        try {
          const content = await file.async("nodebuffer");
          const fileName = path.basename(filePath);
          const destPath = path.join(pdfDir, fileName);
          await fs.mkdir(pdfDir, { recursive: true });
          await fs.writeFile(destPath, content);
          importedCount++;
        } catch (err) {
          console.error(`Error importing PDF ${filePath}:`, err);
          errors.push(`Failed to import ${filePath}`);
        }
      }
    }

    // Leggi il manifest se presente
    let manifestInfo = null;
    const manifestEntry = zip.file("BACKUP_MANIFEST.json");
    if (manifestEntry) {
      try {
        const manifestContent = await manifestEntry.async("string");
        manifestInfo = JSON.parse(manifestContent);
      } catch (err) {
        console.warn("Failed to parse manifest:", err);
      }
    }

    // Ripristina la cache di storage per caricare i nuovi dati
    (storage as any).clearCache();

    res.json({
      success: true,
      message: "Backup imported successfully. Please restart the application.",
      imported: importedCount,
      errors: errors.length > 0 ? errors : undefined,
      manifest: manifestInfo,
      backupLocation: {
        metadataFile: `${metadataFile}.backup-${backupTimestamp}`,
        xmlDir: `${xmlDir}.backup-${backupTimestamp}`,
        htmlDir: `${htmlDir}.backup-${backupTimestamp}`,
        pdfDir: `${pdfDir}.backup-${backupTimestamp}`,
      },
    });
  } catch (error: any) {
    console.error("Error importing backup:", error);
    res.status(500).json({
      error: "Failed to import backup",
      details: error.message,
    });
  }
});

/**
 * GET /api/backup/status
 * Restituisce lo stato attuale del backup (numero di file, spazio utilizzato, ecc.)
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const xmlDir = getXmlDir();
    const htmlDir = getHtmlDir();
    const pdfDir = getPdfDir();

    const getDirectorySize = async (dir: string): Promise<number> => {
      try {
        const files = await fs.readdir(dir, { recursive: true, withFileTypes: true });
        let size = 0;
        for (const file of files) {
          if (file.isFile()) {
            const stats = await fs.stat(path.join(dir, file.name));
            size += stats.size;
          }
        }
        return size;
      } catch {
        return 0;
      }
    };

    const xmlSize = await getDirectorySize(xmlDir);
    const htmlSize = await getDirectorySize(htmlDir);
    const pdfSize = await getDirectorySize(pdfDir);
    const totalSize = xmlSize + htmlSize + pdfSize;

    const invoices = await storage.getAllInvoices();

    // Conta solo i file veri (non le directory)
    const countFiles = async (dir: string): Promise<number> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.filter((entry) => entry.isFile()).length;
      } catch {
        return 0;
      }
    };

    const xmlCount = await countFiles(xmlDir);
    const htmlCount = await countFiles(htmlDir);
    const pdfCount = await countFiles(pdfDir);

    res.json({
      status: "ok",
      invoices: {
        total: invoices.length,
        byStatus: {
          printed: invoices.filter((i) => i.status === "printed").length,
          not_printed: invoices.filter((i) => i.status === "not_printed").length,
        },
      },
      storage: {
        xml: {
          count: xmlCount,
          size: xmlSize,
          sizeHuman: formatBytes(xmlSize),
        },
        html: {
          count: htmlCount,
          size: htmlSize,
          sizeHuman: formatBytes(htmlSize),
        },
        pdf: {
          count: pdfCount,
          size: pdfSize,
          sizeHuman: formatBytes(pdfSize),
        },
        total: {
          size: totalSize,
          sizeHuman: formatBytes(totalSize),
        },
      },
      lastBackup: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error getting backup status:", error);
    res.status(500).json({
      error: "Failed to get backup status",
      details: error.message,
    });
  }
});

/**
 * Helper: formatta i bytes in formato leggibile (KB, MB, GB)
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default router;
