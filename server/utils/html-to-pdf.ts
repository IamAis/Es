import puppeteer, { Browser } from 'puppeteer';

let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance
 * Reuses the same browser instance for better performance
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
    ],
  });

  // Handle browser disconnection
  browserInstance.on('disconnected', () => {
    browserInstance = null;
  });

  return browserInstance;
}

/**
 * Convert HTML content to PDF
 * Uses Puppeteer to render HTML and generate a PDF buffer
 *
 * @param htmlContent - The HTML content to convert to PDF
 * @returns Buffer containing the PDF data
 */
export async function generatePDFFromHTML(htmlContent: string): Promise<Buffer> {
  let browser: Browser | null = null;

  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    // Set content and wait for all resources to load
    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load'],
      timeout: 30000,
    });

    // Generate PDF with Italian paper format
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
    });

    await page.close();

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF from HTML:', error);
    const e = new Error('Failed to generate PDF from HTML');
    (e as any).status = 500;
    (e as any).details = error instanceof Error ? error.message : String(error);
    throw e;
  }
}

/**
 * Gracefully close the browser instance
 * Should be called on application shutdown
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}
