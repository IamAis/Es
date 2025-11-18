import { Router } from "express";
import {
  generatePdfFromXmlString,
  generatePdfFromXmlFile,
} from "../utils/pdfGenerator.js";
import { transformXMLToHTML } from "../utils/xslt-transformer.js";
import { generatePDFFromHTML } from "../utils/html-to-pdf.js";
import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { storage } from "../storage.js";
import path from "path";
import { getStorageDir, getXmlDir, getHtmlDir } from "../paths.js";

const router = Router();

// Storage directories - dynamically resolved based on environment
const STORAGE_DIR = getStorageDir();
const XML_DIR = getXmlDir();
const HTML_DIR = getHtmlDir();

/**
 * POST /api/pdf/generate
 * Genera un PDF da contenuto XML inviato nel body
 *
 * Body: { xmlContent: string }
 * Response: PDF file
 */
router.post("/generate", async (req, res) => {
  try {
    const { xmlContent } = req.body;

    if (!xmlContent) {
      return res.status(400).json({
        error: "xmlContent è richiesto nel body della richiesta",
      });
    }

    // Genera il PDF dal contenuto XML
    const pdfBuffer = await generatePdfFromXmlString(xmlContent);

    // Imposta gli headers per il download del PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="fattura.pdf"');
    res.setHeader("Content-Length", pdfBuffer.length);

    // Invia il PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("Errore nella generazione del PDF:", error);
    res.status(error.status || 500).json({
      error: "Errore durante la generazione del PDF",
      details: error.details || error.message,
    });
  }
});

/**
 * POST /api/pdf/preview
 * Genera un'anteprima HTML da contenuto XML usando il foglio di stile XSL
 *
 * Body: { xmlContent: string }
 * Response: HTML string
 */
router.post("/preview", async (req, res) => {
  try {
    const { xmlContent } = req.body;

    if (!xmlContent) {
      return res.status(400).json({
        error: "xmlContent è richiesto nel body della richiesta",
      });
    }

    // Trasforma XML in HTML usando il foglio di stile XSL
    const htmlContent = await transformXMLToHTML(xmlContent);

    // Imposta gli headers per HTML
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    // Invia l'HTML
    res.send(htmlContent);
  } catch (error: any) {
    console.error("Errore nella generazione dell'anteprima HTML:", error);
    res.status(error.status || 500).json({
      error: "Errore durante la generazione dell'anteprima",
      details: error.details || error.message,
    });
  }
});

/**
 * POST /api/pdf/regenerate/:id
 * Rigenera il PDF di una fattura esistente dal suo XML
 * Utile se il foglio di stile XSL è stato aggiornato
 *
 * Response: PDF file
 */
router.post("/regenerate/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Recupera la fattura dal database
    const invoice = await storage.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ error: "Fattura non trovata" });
    }

    // Verifica che il file HTML esista
    if (!invoice.htmlPath) {
      return res
        .status(404)
        .json({ error: "File HTML non trovato per questa fattura" });
    }

    // Percorsi dei file
    const xmlPath = path.join(XML_DIR, invoice.xmlPath);
    const htmlPath = path.join(HTML_DIR, invoice.htmlPath);

    // Rigenera l'HTML dal XML
    const xmlContent = await readFile(xmlPath, "utf-8");
    const htmlContent = await transformXMLToHTML(xmlContent);

    // Salva il nuovo HTML
    await writeFile(htmlPath, htmlContent, "utf-8");

    // Genera PDF dall'HTML
    const pdfBuffer = await generatePDFFromHTML(htmlContent);

    // Imposta gli headers per il download del PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    // Invia il PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("Errore nella rigenerazione del PDF:", error);
    res.status(error.status || 500).json({
      error: "Errore durante la rigenerazione del PDF",
      details: error.details || error.message,
    });
  }
});

/**
 * POST /api/pdf/regenerate-all
 * Rigenera tutti gli HTML delle fatture nel database dal XML
 * Utile dopo aggiornamenti al foglio di stile XSL
 *
 * Response: { success: number, failed: number, errors: Array }
 */
router.post("/regenerate-all", async (req, res) => {
  try {
    // Recupera tutte le fatture
    const invoices = await storage.getAllInvoices();

    if (invoices.length === 0) {
      return res.json({
        success: 0,
        failed: 0,
        message: "Nessuna fattura da rigenerare",
      });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: Array<{ id: string; invoiceNumber: string; error: string }> =
      [];

    // Rigenera ogni HTML dal XML
    for (const invoice of invoices) {
      try {
        if (!invoice.htmlPath) {
          throw new Error("File HTML non trovato per questa fattura");
        }

        const xmlPath = path.join(XML_DIR, invoice.xmlPath);
        const htmlPath = path.join(HTML_DIR, invoice.htmlPath);

        // Leggi XML e rigenera HTML
        const xmlContent = await readFile(xmlPath, "utf-8");
        const htmlContent = await transformXMLToHTML(xmlContent);

        // Salva il nuovo HTML
        await writeFile(htmlPath, htmlContent, "utf-8");

        successCount++;
      } catch (error: any) {
        console.error(
          `Errore rigenerazione HTML per fattura ${invoice.id}:`,
          error,
        );
        failedCount++;
        errors.push({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          error: error.message || "Errore sconosciuto",
        });
      }
    }

    res.json({
      success: successCount,
      failed: failedCount,
      total: invoices.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Rigenerati ${successCount} HTML su ${invoices.length} totali`,
    });
  } catch (error: any) {
    console.error("Errore nella rigenerazione di massa degli HTML:", error);
    res.status(500).json({
      error: "Errore durante la rigenerazione degli HTML",
      details: error.message,
    });
  }
});

/**
 * POST /api/pdf/generate-from-file
 * Genera un PDF da un file XML caricato
 *
 * Body: FormData con file XML
 * Response: PDF file
 */
router.post("/generate-from-file", async (req, res) => {
  let tmpFilePath: string | null = null;

  try {
    // Verifica se è stato caricato un file
    if (!req.file && !req.body.xmlContent) {
      return res.status(400).json({
        error: "Nessun file caricato o xmlContent fornito",
      });
    }

    let xmlContent: string;

    if (req.file) {
      // Se è stato caricato un file, usa il suo contenuto
      xmlContent = req.file.buffer.toString("utf-8");
    } else {
      // Altrimenti usa il contenuto dal body
      xmlContent = req.body.xmlContent;
    }

    // Crea un file temporaneo
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    tmpFilePath = join(tmpdir(), `invoice_${timestamp}_${randomId}.xml`);

    // Scrivi il contenuto nel file temporaneo
    await writeFile(tmpFilePath, xmlContent, "utf-8");

    // Genera il PDF
    const pdfBuffer = await generatePdfFromXmlFile(tmpFilePath);

    // Determina il nome del file
    const fileName =
      req.file?.originalname?.replace(/\.xml$/i, ".pdf") || "fattura.pdf";

    // Imposta gli headers per il download del PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    // Invia il PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("Errore nella generazione del PDF da file:", error);
    res.status(error.status || 500).json({
      error: "Errore durante la generazione del PDF da file",
      details: error.details || error.message,
    });
  } finally {
    // Elimina il file temporaneo se esiste
    if (tmpFilePath) {
      try {
        await unlink(tmpFilePath);
      } catch (unlinkError) {
        console.warn("Impossibile eliminare il file temporaneo:", tmpFilePath);
      }
    }
  }
});

/**
 * GET /api/pdf/test
 * Endpoint di test per verificare che il sistema di generazione PDF funzioni
 */
router.get("/test", async (req, res) => {
  try {
    res.json({
      status: "ok",
      message: "Sistema di generazione PDF operativo",
      endpoints: {
        generate: "POST /api/pdf/generate - Genera PDF da xmlContent",
        preview: "POST /api/pdf/preview - Genera anteprima HTML",
        regenerate:
          "POST /api/pdf/regenerate/:id - Rigenera PDF di una fattura",
        regenerateAll: "POST /api/pdf/regenerate-all - Rigenera tutti i PDF",
        generateFromFile:
          "POST /api/pdf/generate-from-file - Genera PDF da file caricato",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
