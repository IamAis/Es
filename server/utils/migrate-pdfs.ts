import path from "path";
import fs from "fs/promises";
import { storage } from "../storage";
import { generatePDFFromHTML } from "./html-to-pdf.js";

const STORAGE_DIR = path.join(process.cwd(), "invoice_storage");
const HTML_DIR = path.join(STORAGE_DIR, "html");
const PDF_DIR = path.join(STORAGE_DIR, "pdf");

/**
 * Migrates existing invoices by generating cached PDF files
 * This script should be run once to generate PDFs for all existing invoices
 */
async function migratePDFs() {
  console.log("Starting PDF migration...");

  // Ensure PDF directory exists
  try {
    await fs.mkdir(PDF_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating PDF directory:", error);
    process.exit(1);
  }

  // Get all invoices
  const invoices = await storage.getAllInvoices();
  console.log(`Found ${invoices.length} invoices`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const invoice of invoices) {
    try {
      // Skip if PDF already exists
      if (invoice.pdfPath) {
        const pdfPath = path.join(PDF_DIR, invoice.pdfPath);
        try {
          await fs.access(pdfPath);
          console.log(`✓ Skipped ${invoice.invoiceNumber} - PDF already exists`);
          skippedCount++;
          continue;
        } catch {
          // PDF file doesn't exist, regenerate it
          console.log(`⚠ PDF path exists but file missing for ${invoice.invoiceNumber}, regenerating...`);
        }
      }

      // Check if HTML file exists
      if (!invoice.htmlPath) {
        console.log(`✗ Skipped ${invoice.invoiceNumber} - No HTML file`);
        skippedCount++;
        continue;
      }

      const htmlPath = path.join(HTML_DIR, invoice.htmlPath);

      // Read HTML content
      let htmlContent: string;
      try {
        htmlContent = await fs.readFile(htmlPath, "utf-8");
      } catch (error) {
        console.log(`✗ Error reading HTML for ${invoice.invoiceNumber}:`, error);
        errorCount++;
        continue;
      }

      // Generate PDF filename
      const safeFilename = invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_");
      const timestamp = Date.now();
      const pdfFilename = `${safeFilename}_${timestamp}.pdf`;

      // Generate PDF from HTML
      console.log(`→ Generating PDF for ${invoice.invoiceNumber}...`);
      const pdfBuffer = await generatePDFFromHTML(htmlContent);

      // Save PDF file
      const pdfPath = path.join(PDF_DIR, pdfFilename);
      await fs.writeFile(pdfPath, pdfBuffer);

      // Update invoice record with pdfPath
      await storage.updateInvoice(invoice.id, {
        pdfPath: pdfFilename,
      });

      console.log(`✓ Generated PDF for ${invoice.invoiceNumber}`);
      migratedCount++;
    } catch (error: any) {
      console.error(`✗ Error processing ${invoice.invoiceNumber}:`, error?.message || error);
      errorCount++;
    }
  }

  console.log("\n=== PDF Migration Complete ===");
  console.log(`Total invoices: ${invoices.length}`);
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

// Run migration if called directly
if (require.main === module) {
  migratePDFs()
    .then(() => {
      console.log("\nMigration finished successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nMigration failed:", error);
      process.exit(1);
    });
}

export { migratePDFs };
