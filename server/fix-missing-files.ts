/**
 * Script per fixare il mismatch tra DB e file fisici
 * 
 * Problema: Il DB dice 2 fatture ma mancano i file XML e HTML
 * 
 * Questo script:
 * 1. Legge tutte le invoice dal DB
 * 2. Verifica se i file (XML, HTML, PDF) esistono fisicamente
 * 3. Se mancano i file, rimuove l'invoice dal DB
 * 4. Mostra un report
 * 
 * Esegui con: npx tsx server/fix-missing-files.ts
 */

import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { getXmlDir, getHtmlDir, getPdfDir } from "./paths";

async function fixMissingFiles() {
  console.log("🔧 Starting file integrity check...\n");

  const xmlDir = getXmlDir();
  const htmlDir = getHtmlDir();
  const pdfDir = getPdfDir();

  const invoices = await storage.getAllInvoices();
  console.log(`📊 Total invoices in DB: ${invoices.length}\n`);

  let fixed = 0;
  let orphaned = 0;
  const report: {
    invoiceNumber: string;
    status: "ok" | "missing_xml" | "missing_html" | "missing_pdf" | "deleted";
    missing: string[];
  }[] = [];

  for (const invoice of invoices) {
    const xmlPath = path.join(xmlDir, invoice.xmlPath || "");
    const htmlPath = path.join(htmlDir, invoice.htmlPath || "");
    const pdfPath = path.join(pdfDir, invoice.pdfPath || "");

    // Verifica esistenza file
    const xmlExists = await fs
      .stat(xmlPath)
      .then(() => true)
      .catch(() => false);
    const htmlExists = await fs
      .stat(htmlPath)
      .then(() => true)
      .catch(() => false);
    const pdfExists = await fs
      .stat(pdfPath)
      .then(() => true)
      .catch(() => false);

    const missing = [];
    if (!xmlExists) missing.push("XML");
    if (!htmlExists) missing.push("HTML");
    if (!pdfExists) missing.push("PDF");

    if (missing.length > 0) {
      console.log(
        `⚠️ Invoice ${invoice.invoiceNumber} - Missing: ${missing.join(", ")}`
      );

      // Se mancano file critici (XML), rimuovi dal DB
      if (missing.includes("XML")) {
        console.log(`   → Removing from DB (critical file missing)`);
        await storage.deleteInvoice(invoice.id);
        report.push({
          invoiceNumber: invoice.invoiceNumber,
          status: "deleted",
          missing,
        });
        fixed++;
      } else {
        report.push({
          invoiceNumber: invoice.invoiceNumber,
          status: "ok",
          missing,
        });
        orphaned++;
      }
    } else {
      report.push({
        invoiceNumber: invoice.invoiceNumber,
        status: "ok",
        missing: [],
      });
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📋 REPORT");
  console.log("=".repeat(50));

  const okCount = report.filter((r) => r.missing.length === 0).length;
  const missingCount = report.filter((r) => r.missing.length > 0).length;

  console.log(`✅ Invoices with all files: ${okCount}`);
  console.log(`⚠️ Invoices with missing files: ${missingCount}`);
  console.log(`🗑️ Invoices deleted from DB: ${fixed}`);

  if (missingCount > 0) {
    console.log("\n📄 Invoices with missing files:");
    report
      .filter((r) => r.missing.length > 0)
      .forEach((r) => {
        console.log(`   - ${r.invoiceNumber}: missing ${r.missing.join(", ")}`);
      });
  }

  // Verifica finale
  const finalInvoices = await storage.getAllInvoices();
  console.log(
    `\n📊 Final count in DB: ${finalInvoices.length} (was ${invoices.length})`
  );

  if (okCount === finalInvoices.length) {
    console.log("\n✅ All invoices now have complete files!");
  }
}

// Run the fix
fixMissingFiles().catch(console.error);
