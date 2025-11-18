import path from "path";
import os from "os";

/**
 * Detect if we're running in Electron environment
 */
function isElectron(): boolean {
  // Check if we're in an Electron process
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    !!process.versions.electron
  );
}

/**
 * Get the base data directory based on environment
 */
function getDataDirectory(): string {
  if (isElectron()) {
    // Electron: use user's home directory
    return path.join(os.homedir(), ".app-fatture");
  } else {
    // Standard Node.js: use project directory
    return process.cwd();
  }
}

/**
 * Get the storage directory path
 */
export function getStorageDir(): string {
  if (isElectron()) {
    return path.join(getDataDirectory(), "storage");
  } else {
    return path.join(getDataDirectory(), "invoice_storage");
  }
}

/**
 * Get the XML directory path
 */
export function getXmlDir(): string {
  return path.join(getStorageDir(), "xml");
}

/**
 * Get the HTML directory path
 */
export function getHtmlDir(): string {
  return path.join(getStorageDir(), "html");
}

/**
 * Get the PDF directory path
 */
export function getPdfDir(): string {
  return path.join(getStorageDir(), "pdf");
}

/**
 * Get the metadata file path (invoices.json)
 */
export function getMetadataFile(): string {
  if (isElectron()) {
    return path.join(getDataDirectory(), "storage", "invoices.json");
  } else {
    return path.join(getStorageDir(), "invoices.json");
  }
}

/**
 * Get all storage paths
 */
export function getStoragePaths() {
  return {
    storageDir: getStorageDir(),
    xmlDir: getXmlDir(),
    htmlDir: getHtmlDir(),
    pdfDir: getPdfDir(),
    metadataFile: getMetadataFile(),
    isElectron: isElectron(),
  };
}

/**
 * Log current storage configuration (useful for debugging)
 */
export function logStorageConfig(): void {
  const paths = getStoragePaths();
  console.log("Storage Configuration:");
  console.log(`  Environment: ${paths.isElectron ? "Electron" : "Standard Node.js"}`);
  console.log(`  Storage Dir: ${paths.storageDir}`);
  console.log(`  XML Dir: ${paths.xmlDir}`);
  console.log(`  HTML Dir: ${paths.htmlDir}`);
  console.log(`  PDF Dir: ${paths.pdfDir}`);
  console.log(`  Metadata File: ${paths.metadataFile}`);
}
