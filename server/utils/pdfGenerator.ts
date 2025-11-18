import { readFile, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import puppeteer from "puppeteer";
import { transformXMLToHTML } from "./xslt-transformer.js";

/**
 * Genera un PDF da contenuto HTML usando Puppeteer
 *
 * @param htmlContent - Contenuto HTML da convertire in PDF
 * @returns Buffer contenente il PDF generato
 */
async function generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Imposta il contenuto HTML
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Genera il PDF con impostazioni ottimizzate per fatture
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: "10mm",
        right: "10mm",
        bottom: "10mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } catch (error: any) {
    console.error(
      "Errore durante la generazione del PDF con Puppeteer:",
      error,
    );
    const err = new Error(`Errore generazione PDF: ${error.message}`);
    (err as any).status = 500;
    (err as any).details = error.message;
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Genera un PDF da un file XML di fattura elettronica usando il foglio di stile XSL
 *
 * @param xmlFilePath - Percorso completo del file XML della fattura
 * @returns Buffer contenente il PDF generato
 */
export async function generatePdfFromXmlFile(
  xmlFilePath: string,
): Promise<Buffer> {
  try {
    // Leggi il contenuto del file XML
    const xmlContent = await readFile(xmlFilePath, "utf-8");

    // Trasforma XML in HTML usando il sistema XSLT esistente
    const htmlContent = await transformXMLToHTML(xmlContent);

    // Genera PDF dall'HTML
    const pdfBuffer = await generatePdfFromHtml(htmlContent);

    return pdfBuffer;
  } catch (error: any) {
    console.error("Errore nella generazione del PDF da file XML:", error);
    const err = new Error("Impossibile generare PDF dal file XML");
    (err as any).status = error.status || 500;
    (err as any).details = error.message;
    throw err;
  }
}

/**
 * Genera un PDF da contenuto XML (string) usando il foglio di stile XSL
 *
 * @param xmlContent - Contenuto XML della fattura come stringa
 * @returns Buffer contenente il PDF generato
 */
export async function generatePdfFromXmlString(
  xmlContent: string,
): Promise<Buffer> {
  try {
    // Trasforma XML in HTML usando il sistema XSLT esistente
    const htmlContent = await transformXMLToHTML(xmlContent);

    // Genera PDF dall'HTML
    const pdfBuffer = await generatePdfFromHtml(htmlContent);

    return pdfBuffer;
  } catch (error: any) {
    console.error("Errore nella generazione del PDF da stringa XML:", error);
    const err = new Error("Impossibile generare PDF dal contenuto XML");
    (err as any).status = error.status || 500;
    (err as any).details = error.message;
    throw err;
  }
}

/**
 * Genera un PDF da HTML usando il foglio di stile applicato
 * Utile quando l'HTML è già stato generato precedentemente
 *
 * @param htmlContent - Contenuto HTML già trasformato
 * @returns Buffer contenente il PDF generato
 */
export async function generatePdfFromHtmlContent(
  htmlContent: string,
): Promise<Buffer> {
  try {
    const pdfBuffer = await generatePdfFromHtml(htmlContent);
    return pdfBuffer;
  } catch (error: any) {
    console.error("Errore nella generazione del PDF da HTML:", error);
    const err = new Error("Impossibile generare PDF dal contenuto HTML");
    (err as any).status = error.status || 500;
    (err as any).details = error.message;
    throw err;
  }
}

/**
 * Rigenera il PDF di una fattura esistente dal suo file XML
 * Utile per aggiornare il PDF se il foglio di stile XSL è stato modificato
 *
 * @param xmlPath - Percorso del file XML
 * @param pdfPath - Percorso dove salvare il PDF generato
 * @returns true se la rigenerazione è riuscita
 */
export async function regeneratePdfFromXml(
  xmlPath: string,
  pdfPath: string,
): Promise<boolean> {
  try {
    // Genera il PDF dal file XML
    const pdfBuffer = await generatePdfFromXmlFile(xmlPath);

    // Salva il PDF nel percorso specificato
    await writeFile(pdfPath, pdfBuffer);

    console.log(`PDF rigenerato con successo: ${pdfPath}`);
    return true;
  } catch (error: any) {
    console.error("Errore durante la rigenerazione del PDF:", error);
    throw error;
  }
}

/**
 * Converte un XML in PDF usando un file temporaneo
 * Alternativa che usa file temporanei per gestire grandi XML
 *
 * @param xmlContent - Contenuto XML da convertire
 * @returns Buffer contenente il PDF generato
 */
export async function generatePdfFromXmlWithTempFile(
  xmlContent: string,
): Promise<Buffer> {
  const tmpFilePath = join(
    tmpdir(),
    `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.xml`,
  );

  try {
    // Scrivi il contenuto XML in un file temporaneo
    await writeFile(tmpFilePath, xmlContent, "utf-8");

    // Genera il PDF dal file temporaneo
    const pdfBuffer = await generatePdfFromXmlFile(tmpFilePath);

    return pdfBuffer;
  } catch (error: any) {
    console.error(
      "Errore nella generazione del PDF con file temporaneo:",
      error,
    );
    throw error;
  } finally {
    // Elimina il file temporaneo
    try {
      await unlink(tmpFilePath);
    } catch (unlinkError) {
      console.warn("Impossibile eliminare il file temporaneo:", tmpFilePath);
    }
  }
}
