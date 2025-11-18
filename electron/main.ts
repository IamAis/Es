import { app, BrowserWindow, Menu, ipcMain, dialog } from "electron";
import * as path from "path";
import * as url from "url";
import { startServer } from "./server.js";
import { initializeDatabase } from "./database.js";
import { registerIPCHandlers } from "./utils/ipc-handlers.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let serverReady = false;

const isDev = process.env.NODE_ENV === "development";
const PORT = 5000;

/**
 * Crea la finestra principale dell'applicazione
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "electron", "favicon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? `http://localhost:5173` // Vite dev server
    : `file://${path.join(__dirname, "../public/index.html")}`;

  // Attendi che il server Vite sia pronto (in development)
  if (isDev && serverReady === false) {
    console.log("Waiting for Vite server to be ready...");
  }

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Crea il menu dell'applicazione
  createMenu();
}

/**
 * Crea il menu dell'applicazione
 */
function createMenu(): void {
  const template: any[] = [
    {
      label: "File",
      submenu: [
        {
          label: "Esci",
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Modifica",
      submenu: [
        { label: "Annulla", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Ripeti", accelerator: "CmdOrCtrl+Y", role: "redo" },
        { type: "separator" },
        { label: "Taglia", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copia", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Incolla", accelerator: "CmdOrCtrl+V", role: "paste" },
      ],
    },
    {
      label: "Visualizza",
      submenu: [
        { label: "Ricarica", accelerator: "CmdOrCtrl+R", role: "reload" },
        {
          label: "Ricarica Forzato",
          accelerator: "CmdOrCtrl+Shift+R",
          role: "forceReload",
        },
        { label: "DevTools", accelerator: "F12", role: "toggleDevTools" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Avvia il server Express nel main process
 */
async function initializeApp(): Promise<void> {
  try {
    // Inizializza il database SQLite
    console.log("Initializing database...");
    await initializeDatabase();

    // Avvia il server Express
    console.log("Starting Express server...");
    await startServer(PORT);
    serverReady = true;
    console.log(`Server started on port ${PORT}`);

    // Registra gli handler IPC
    registerIPCHandlers();

    // Crea la finestra principale
    if (!mainWindow) {
      createWindow();
    }
  } catch (error) {
    console.error("Failed to initialize app:", error);
    dialog.showErrorBox(
      "Errore di Avvio",
      "Errore durante l'inizializzazione dell'applicazione",
    );
    app.quit();
  }
}

/**
 * Quando Electron ha finito di inizializzarsi
 */
app.on("ready", () => {
  initializeApp();
});

/**
 * Quit when all windows are closed
 */
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * Re-create window when app is activated (macOS)
 */
app.on("activate", () => {
  if (!mainWindow) {
    createWindow();
  }
});

/**
 * Handle any uncaught exceptions
 */
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  dialog.showErrorBox("Errore Fatale", error.message);
});

/**
 * Listen for when the app is ready to quit
 */
ipcMain.handle("app:ready-to-quit", async () => {
  app.quit();
});

/**
 * Check if server is ready
 */
ipcMain.handle("app:server-ready", async () => {
  return serverReady;
});
