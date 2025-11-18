/**
 * Script per pulire i file duplicati generati durante l'upload
 * 
 * Questo script:
 * 1. Analizza i file XML, HTML, PDF
 * 2. Identifica i duplicati (stesso numero fattura + data)
 * 3. Rimuove i file duplicati mantenendo solo 1 copia
 * 4. Mostra un report
 * 
 * Esegui con: npx tsx server/cleanup-duplicates.ts
 */

import fs from "fs/promises";
import path from "path";
import { getXmlDir, getHtmlDir, getPdfDir } from "./paths";
import { storage } from "./storage";

async function cleanupDuplicates() {
  console.log("🧹 Starting cleanup of duplicate files...\n");

  const xmlDir = getXmlDir();
  const htmlDir = getHtmlDir();
  const pdfDir = getPdfDir();

  let totalDeleted = 0;
  let totalAnalyzed = 0;

  // Funzione helper per analizzare i file
  async function analyzeDirectory(
    dir: string,
    extension: string,
    dirName: string
  ) {
    console.log(`📂 Analyzing ${dirName}...`);

    const files = await fs.readdir(dir).catch(() => []);
    const filesByInvoice: { [key: string]: string[] } = {};
    let deleted = 0;

    // Raggruppa file per numero fattura
    for (const file of files) {
      if (!file.endsWith(`.${extension}`)) continue;
      totalAnalyzed++;

      // Estrai il numero fattura dal filename
      // Formato atteso: INVOICE_NUMBER_DATE.ext
      const nameParts = file.replace(`.${extension}`, "").split("_");
      
      // Presupponiamo che gli ultimi 2 segmenti siano data (YYYYMMDD)
      const dateStr = nameParts.slice(-1).join("_");
      const invoiceNum = nameParts.slice(0, -1).join("_");
      const key = `${invoiceNum}_${dateStr}`;

      if (!filesByInvoice[key]) {
        filesByInvoice[key] = [];
      }
      filesByInvoice[key].push(file);
    }

    // Rimuovi duplicati
    for (const [key, duplicateFiles] of Object.entries(filesByInvoice)) {
      if (duplicateFiles.length > 1) {
        console.log(`  ⚠️ Found ${duplicateFiles.length} files for: ${key}`);

        // Mantieni il primo, elimina gli altri
        const keep = duplicateFiles[0];
        for (let i = 1; i < duplicateFiles.length; i++) {
          const fileToDelete = duplicateFiles[i];
          const filePath = path.join(dir, fileToDelete);

          try {
            await fs.unlink(filePath);
            console.log(`     ✓ Deleted: ${fileToDelete}`);
            deleted++;
            totalDeleted++;
          } catch (err) {
            console.log(`     ✗ Error deleting: ${fileToDelete} (${err})`);
          }
        }
      }
    }

    console.log(`  → Removed ${deleted} duplicate ${extension.toUpperCase()} files\n`);
    return deleted;
  }

  try {
    // Pulisci ogni directory
    await analyzeDirectory(xmlDir, "xml", "XML Files");
    await analyzeDirectory(htmlDir, "html", "HTML Files");
    await analyzeDirectory(pdfDir, "pdf", "PDF Files");

    // Verifica che i file rimanenti siano coerenti con il DB
    console.log("✅ Cleanup completed!\n");
    console.log("📊 Summary:");
    console.log(`   - Total files analyzed: ${totalAnalyzed}`);
    console.log(`   - Total files deleted: ${totalDeleted}`);

    // Mostra statistiche finali
    const allInvoices = await storage.getAllInvoices();
    console.log(`\n📈 Database Status:`);
    console.log(`   - Total invoices in DB: ${allInvoices.length}`);

    // Verifica coerenza
    const xmlFiles = (await fs.readdir(xmlDir).catch(() => [])).filter((f) =>
      f.endsWith(".xml")
    );
    const htmlFiles = (await fs.readdir(htmlDir).catch(() => [])).filter((f) =>
      f.endsWith(".html")
    );
    const pdfFiles = (await fs.readdir(pdfDir).catch(() => [])).filter((f) =>
      f.endsWith(".pdf")
    );

    console.log(`   - XML files on disk: ${xmlFiles.length}`);
    console.log(`   - HTML files on disk: ${htmlFiles.length}`);
    console.log(`   - PDF files on disk: ${pdfFiles.length}`);

    // Idealmente, dovrebbe esserci 1 file per tipo per ogni fattura
    if (
      xmlFiles.length === allInvoices.length &&
      htmlFiles.length === allInvoices.length &&
      pdfFiles.length === allInvoices.length
    ) {
      console.log("\n✅ All files are in sync with database!");
    } else {
      console.log("\n⚠️ Warning: File count mismatch!");
      console.log(
        "   Please verify your data or run this script again."
      );
    }
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

// Run cleanup
cleanupDuplicates().catch(console.error);
