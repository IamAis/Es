import { ipcMain, dialog, shell } from "electron";
import path from "path";
import fs from "fs/promises";
import { getDataPath } from "../database";

/**
 * Registra tutti i handler IPC per la comunicazione tra main e renderer process
 */
export function registerIPCHandlers(): void {
  /**
   * File dialog handlers
   */
  ipcMain.handle("file:open", async (_event, options: any) => {
    const result = await dialog.showOpenDialog({
      properties: options?.properties || ["openFile", "multiSelections"],
      filters: options?.filters,
      title: options?.title || "Apri File",
      buttonLabel: options?.buttonLabel || "Apri",
    });

    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
    };
  });

  ipcMain.handle("file:save", async (_event, options: any) => {
    const result = await dialog.showSaveDialog({
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      title: options?.title || "Salva File",
      buttonLabel: options?.buttonLabel || "Salva",
    });

    return {
      canceled: result.canceled,
      filePath: result.filePath,
    };
  });

  /**
   * Storage handlers
   */
  ipcMain.handle("storage:get-path", async () => {
    return getDataPath();
  });

  ipcMain.handle("storage:open-folder", async () => {
    const dataPath = getDataPath();
    await shell.openPath(dataPath);
    return dataPath;
  });

  /**
   * PDF handlers
   */
  ipcMain.handle("pdf:open", async (_event, invoiceId: string) => {
    const dataPath = getDataPath();
    const pdfPath = path.join(dataPath, "pdfs", `${invoiceId}.pdf`);

    if (await fileExists(pdfPath)) {
      await shell.openPath(pdfPath);
      return true;
    }
    return false;
  });

  ipcMain.handle(
    "pdf:download",
    async (_event, { invoiceId, savePath }: { invoiceId: string; savePath: string }) => {
      const dataPath = getDataPath();
      const pdfPath = path.join(dataPath, "pdfs", `${invoiceId}.pdf`);

      if (await fileExists(pdfPath)) {
        const pdfData = await fs.readFile(pdfPath);
        await fs.writeFile(savePath, pdfData);
        return true;
      }
      return false;
    }
  );

  /**
   * Invoices handlers
   */
  ipcMain.handle("invoice:upload", async (_event, files: any[]) => {
    // Questa funzione verrà chiamata dal renderer per caricare fatture
    // Il caricamento vero avviene tramite HTTP/API
    console.log(`Uploading ${files.length} files`);
    return {
      success: true,
      message: `${files.length} file pronti per il caricamento`,
    };
  });

  ipcMain.handle("invoice:get-progress", async (_event, jobId: string) => {
    // Ottieni il progresso del caricamento dal server Express
    try {
      const response = await fetch(`http://localhost:5000/api/invoices/upload/progress/${jobId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Error fetching progress:", error);
    }
    return null;
  });
}

/**
 * Utility functions
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
