import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload script per Electron
 * Fornisce un'interfaccia sicura tra il renderer process e il main process
 */

interface FileFilter {
  name: string;
  extensions: string[];
}

interface FileDialogOptions {
  title?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
}

interface SaveFileOptions extends FileDialogOptions {
  defaultPath?: string;
}

interface OpenFileOptions extends FileDialogOptions {
  properties?: ("openFile" | "openDirectory" | "multiSelections")[];
}

const electronAPI = {
  // File operations
  openFile: (options?: OpenFileOptions) =>
    ipcRenderer.invoke("file:open", options),
  saveFile: (options?: SaveFileOptions) =>
    ipcRenderer.invoke("file:save", options),

  // Invoice operations
  uploadInvoices: (files: { path: string; name: string }[]) =>
    ipcRenderer.invoke("invoice:upload", files),
  getInvoiceProgress: (jobId: string) =>
    ipcRenderer.invoke("invoice:get-progress", jobId),
  onUploadProgress: (callback: (data: any) => void) => {
    ipcRenderer.on("invoice:progress-update", (_event, data) => callback(data));
  },

  // PDF operations
  generatePDF: (invoiceId: string) =>
    ipcRenderer.invoke("pdf:generate", invoiceId),
  openPDF: (invoiceId: string) =>
    ipcRenderer.invoke("pdf:open", invoiceId),
  downloadPDF: (invoiceId: string, savePath: string) =>
    ipcRenderer.invoke("pdf:download", { invoiceId, savePath }),

  // App operations
  readyToQuit: () => ipcRenderer.invoke("app:ready-to-quit"),
  serverReady: () => ipcRenderer.invoke("app:server-ready"),

  // Storage operations
  getStoragePath: () => ipcRenderer.invoke("storage:get-path"),
  openStorageFolder: () => ipcRenderer.invoke("storage:open-folder"),
};

// Espone l'API al renderer process
contextBridge.exposeInMainWorld("electron", electronAPI);

// Esporta i tipi TypeScript
export type ElectronAPI = typeof electronAPI;
