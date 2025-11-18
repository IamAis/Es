import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Options for PDF generation
 */
export interface PDFGenerationOptions {
  filename?: string;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  scale?: number;
  quality?: number;
}

/**
 * Generate PDF from HTML content in the browser
 * Uses html2canvas to render HTML and jsPDF to create the PDF
 *
 * @param htmlContent - The HTML content to convert to PDF
 * @param options - Options for PDF generation
 * @returns Promise<Blob> - PDF as Blob
 */
export async function generatePDFFromHTML(
  htmlContent: string,
  options: PDFGenerationOptions = {}
): Promise<Blob> {
  const {
    format = 'a4',
    orientation = 'portrait',
    margin = { top: 20, right: 15, bottom: 20, left: 15 },
    scale = 2,
    quality = 0.95,
  } = options;

  try {
    // Create a temporary container for the HTML
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // A4 width
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.backgroundColor = 'white';
    document.body.appendChild(container);

    // Wait for fonts and images to load
    await document.fonts.ready;
    await waitForImages(container);

    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
    });

    // Remove the temporary container
    document.body.removeChild(container);

    // Calculate PDF dimensions
    const imgWidth = orientation === 'portrait' ? 210 : 297; // A4 dimensions in mm
    const imgHeight = orientation === 'portrait' ? 297 : 210;

    const marginTop = margin.top || 20;
    const marginRight = margin.right || 15;
    const marginBottom = margin.bottom || 20;
    const marginLeft = margin.left || 15;

    const pageWidth = imgWidth - marginLeft - marginRight;
    const pageHeight = imgHeight - marginTop - marginBottom;

    // Create PDF
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format,
      compress: true,
    });

    // Calculate image dimensions to fit the page
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / canvasHeight;

    let pdfWidth = pageWidth;
    let pdfHeight = pageWidth / ratio;

    // If the image is taller than the page, split it into multiple pages
    if (pdfHeight > pageHeight) {
      pdfHeight = pageHeight;
      pdfWidth = pageHeight * ratio;
    }

    const imgData = canvas.toDataURL('image/jpeg', quality);

    // Calculate how many pages we need
    const totalPages = Math.ceil(canvasHeight / (canvasWidth * (pageHeight / pageWidth)));

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const position = -(pageHeight * i);
      pdf.addImage(
        imgData,
        'JPEG',
        marginLeft,
        position + marginTop,
        pdfWidth,
        (canvasHeight * pdfWidth) / canvasWidth,
        undefined,
        'FAST'
      );
    }

    // Return PDF as Blob
    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF from HTML:', error);
    throw new Error('Failed to generate PDF from HTML: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * Generate and download PDF from HTML content
 *
 * @param htmlContent - The HTML content to convert to PDF
 * @param filename - The filename for the downloaded PDF
 * @param options - Options for PDF generation
 */
export async function downloadPDFFromHTML(
  htmlContent: string,
  filename: string = 'document.pdf',
  options: PDFGenerationOptions = {}
): Promise<void> {
  try {
    const pdfBlob = await generatePDFFromHTML(htmlContent, options);

    // Create download link
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}

/**
 * Wait for all images in a container to load
 */
function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.getElementsByTagName('img'));

  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Resolve even on error to not block
          }
        })
    )
  ).then(() => {});
}

/**
 * Generate PDF from HTML element in the DOM
 *
 * @param element - The HTML element to convert to PDF
 * @param options - Options for PDF generation
 * @returns Promise<Blob> - PDF as Blob
 */
export async function generatePDFFromElement(
  element: HTMLElement,
  options: PDFGenerationOptions = {}
): Promise<Blob> {
  const {
    format = 'a4',
    orientation = 'portrait',
    margin = { top: 20, right: 15, bottom: 20, left: 15 },
    scale = 2,
    quality = 0.95,
  } = options;

  try {
    // Wait for fonts and images to load
    await document.fonts.ready;
    await waitForImages(element);

    // Convert HTML to canvas
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
    });

    // Calculate PDF dimensions
    const imgWidth = orientation === 'portrait' ? 210 : 297;
    const imgHeight = orientation === 'portrait' ? 297 : 210;

    const marginTop = margin.top || 20;
    const marginRight = margin.right || 15;
    const marginBottom = margin.bottom || 20;
    const marginLeft = margin.left || 15;

    const pageWidth = imgWidth - marginLeft - marginRight;
    const pageHeight = imgHeight - marginTop - marginBottom;

    // Create PDF
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format,
      compress: true,
    });

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / canvasHeight;

    let pdfWidth = pageWidth;
    let pdfHeight = pageWidth / ratio;

    if (pdfHeight > pageHeight) {
      pdfHeight = pageHeight;
      pdfWidth = pageHeight * ratio;
    }

    const imgData = canvas.toDataURL('image/jpeg', quality);
    const totalPages = Math.ceil(canvasHeight / (canvasWidth * (pageHeight / pageWidth)));

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const position = -(pageHeight * i);
      pdf.addImage(
        imgData,
        'JPEG',
        marginLeft,
        position + marginTop,
        pdfWidth,
        (canvasHeight * pdfWidth) / canvasWidth,
        undefined,
        'FAST'
      );
    }

    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF from element:', error);
    throw new Error('Failed to generate PDF from element: ' + (error instanceof Error ? error.message : String(error)));
  }
}
