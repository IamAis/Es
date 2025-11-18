import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

/**
 * Generate a professional PDF from FatturaPA invoice data
 * Creates a formatted, print-ready PDF document in Italian
 */
export async function generateInvoicePDF(invoiceData: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Helper functions
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: invoiceData.currency || 'EUR',
        }).format(amount);
      };

      const formatDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          return new Intl.DateTimeFormat('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).format(date);
        } catch {
          return dateStr;
        }
      };

      // Colors
      const primaryColor = '#DC2754'; // Primary color from design
      const darkGray = '#333333';
      const mediumGray = '#666666';
      const lightGray = '#999999';

      // Header
      doc.fontSize(24)
         .fillColor(primaryColor)
         .text('FATTURA ELETTRONICA', 50, 50);

      doc.fontSize(10)
         .fillColor(mediumGray)
         .text(`Fattura N. ${invoiceData.invoiceNumber}`, 50, 80);

      // Document info box (top right)
      const rightX = 400;
      doc.fontSize(9)
         .fillColor(darkGray)
         .text('Data:', rightX, 50)
         .text('Valuta:', rightX, 65)
         .text('Tipo:', rightX, 80);

      doc.fontSize(9)
         .fillColor(mediumGray)
         .text(formatDate(invoiceData.invoiceDate), rightX + 60, 50)
         .text(invoiceData.currency || 'EUR', rightX + 60, 65)
         .text(invoiceData.documentType || 'TD01', rightX + 60, 80);

      // Separator line
      doc.moveTo(50, 110)
         .lineTo(545, 110)
         .strokeColor(lightGray)
         .lineWidth(0.5)
         .stroke();

      // Supplier section (left)
      let yPos = 130;
      doc.fontSize(11)
         .fillColor(primaryColor)
         .text('EMITTENTE', 50, yPos);

      yPos += 20;
      doc.fontSize(10)
         .fillColor(darkGray)
         .text(invoiceData.supplierName, 50, yPos, { width: 230 });

      yPos += 25;
      if (invoiceData.supplierVat) {
        doc.fontSize(9)
           .fillColor(mediumGray)
           .text(`P.IVA: ${invoiceData.supplierVat}`, 50, yPos);
        yPos += 15;
      }

      if (invoiceData.supplierFiscalCode) {
        doc.fontSize(9)
           .fillColor(mediumGray)
           .text(`C.F.: ${invoiceData.supplierFiscalCode}`, 50, yPos);
        yPos += 15;
      }

      if (invoiceData.supplierAddress) {
        const addr = invoiceData.supplierAddress;
        const addressText = [
          addr.Indirizzo,
          addr.NumeroCivico,
          addr.CAP,
          addr.Comune,
          addr.Provincia ? `(${addr.Provincia})` : null,
        ].filter(Boolean).join(' ');
        
        doc.fontSize(9)
           .fillColor(mediumGray)
           .text(addressText, 50, yPos, { width: 230 });
      }

      // Customer section (right)
      yPos = 130;
      doc.fontSize(11)
         .fillColor(primaryColor)
         .text('DESTINATARIO', 320, yPos);

      yPos += 20;
      doc.fontSize(10)
         .fillColor(darkGray)
         .text(invoiceData.customerName, 320, yPos, { width: 230 });

      yPos += 25;
      if (invoiceData.customerVat) {
        doc.fontSize(9)
           .fillColor(mediumGray)
           .text(`P.IVA: ${invoiceData.customerVat}`, 320, yPos);
        yPos += 15;
      }

      if (invoiceData.customerAddress) {
        const addr = invoiceData.customerAddress;
        const addressText = [
          addr.Indirizzo,
          addr.NumeroCivico,
          addr.CAP,
          addr.Comune,
          addr.Provincia ? `(${addr.Provincia})` : null,
        ].filter(Boolean).join(' ');
        
        doc.fontSize(9)
           .fillColor(mediumGray)
           .text(addressText, 320, yPos, { width: 230 });
      }

      // Line items table
      yPos = 280;
      doc.moveTo(50, yPos)
         .lineTo(545, yPos)
         .strokeColor(lightGray)
         .lineWidth(0.5)
         .stroke();

      yPos += 10;

      // Table header
      doc.fontSize(9)
         .fillColor(darkGray)
         .text('Descrizione', 50, yPos)
         .text('Q.tà', 350, yPos)
         .text('Prezzo', 400, yPos)
         .text('IVA', 460, yPos)
         .text('Totale', 500, yPos);

      yPos += 15;
      doc.moveTo(50, yPos)
         .lineTo(545, yPos)
         .strokeColor(lightGray)
         .lineWidth(0.5)
         .stroke();

      // Line items
      yPos += 10;
      if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
        for (const item of invoiceData.lineItems) {
          // Check if we need a new page
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }

          // Hide values if total is 0.00
          const shouldHideValues = item.total === 0;
          const vatDisplay = shouldHideValues ? '' : `${item.vat}%`;
          const discountDisplay = shouldHideValues ? '' : (item.discount ? `${item.discount}%` : '-');
          const totalDisplay = shouldHideValues ? '' : formatCurrency(item.total);

          doc.fontSize(9)
             .fillColor(darkGray)
             .text(item.description, 50, yPos, { width: 280 })
             .text(item.quantity.toFixed(2), 350, yPos)
             .text(formatCurrency(item.unitPrice), 400, yPos, { width: 50 })
             .text(vatDisplay, 460, yPos)
             .text(totalDisplay, 500, yPos);

          yPos += 30;
        }
      }

      // Totals section
      yPos += 20;
      doc.moveTo(50, yPos)
         .lineTo(545, yPos)
         .strokeColor(lightGray)
         .lineWidth(0.5)
         .stroke();

      yPos += 15;
      
      // Subtotal
      doc.fontSize(9)
         .fillColor(mediumGray)
         .text('Imponibile:', 400, yPos)
         .fillColor(darkGray)
         .text(formatCurrency(invoiceData.taxableAmount), 500, yPos);

      yPos += 20;
      doc.fontSize(9)
         .fillColor(mediumGray)
         .text('IVA:', 400, yPos)
         .fillColor(darkGray)
         .text(formatCurrency(invoiceData.taxAmount), 500, yPos);

      yPos += 25;
      doc.moveTo(400, yPos)
         .lineTo(545, yPos)
         .strokeColor(primaryColor)
         .lineWidth(1)
         .stroke();

      yPos += 10;
      doc.fontSize(12)
         .fillColor(primaryColor)
         .text('TOTALE:', 400, yPos)
         .fontSize(14)
         .text(formatCurrency(invoiceData.totalAmount), 500, yPos);

      // Payment info (if available)
      if (invoiceData.paymentDueDate || invoiceData.paymentMethod) {
        yPos += 40;
        doc.fontSize(10)
           .fillColor(primaryColor)
           .text('INFORMAZIONI PAGAMENTO', 50, yPos);

        yPos += 20;
        if (invoiceData.paymentMethod) {
          doc.fontSize(9)
             .fillColor(mediumGray)
             .text('Modalità:', 50, yPos)
             .fillColor(darkGray)
             .text(invoiceData.paymentMethod, 150, yPos);
          yPos += 15;
        }

        if (invoiceData.paymentDueDate) {
          doc.fontSize(9)
             .fillColor(mediumGray)
             .text('Scadenza:', 50, yPos)
             .fillColor(darkGray)
             .text(formatDate(invoiceData.paymentDueDate), 150, yPos);
        }
      }

      // Footer
      const footerY = 750;
      doc.fontSize(8)
         .fillColor(lightGray)
         .text(
           'Documento generato elettronicamente da FatturaPA Manager',
           50,
           footerY,
           { align: 'center', width: 495 }
         );

      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      reject(new Error('Failed to generate PDF'));
    }
  });
}
