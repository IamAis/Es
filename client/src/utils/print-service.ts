import { PrintOptions } from "@/components/print-dialog";

/**
 * Utility per gestire la stampa diretta nel browser
 * Permette la stampa senza necessità di salvare il file
 */

interface PrinterSettings {
  paperSize: string;
  orientation: string;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  colorMode: string;
  copies: number;
}

/**
 * Converte le opzioni di stampa in configurazione CSS per l'anteprima
 */
export function getPrintPageStyles(options: PrintOptions): string {
  const marginMap = {
    minimal: { top: 5, right: 5, bottom: 5, left: 5 },
    normal: { top: 20, right: 15, bottom: 20, left: 15 },
    generous: { top: 30, right: 25, bottom: 30, left: 25 },
  };

  const margins = marginMap[options.margins];

  const paperSizeMap = {
    a4: "210mm 297mm",
    letter: "8.5in 11in",
  };

  const pageSize = paperSizeMap[options.paperSize];

  return `
    @page {
      size: ${pageSize} ${options.orientation};
      margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
    }

    @media print {
      * {
        -webkit-print-color-adjust: preserve;
        print-color-adjust: preserve;
        color-adjust: preserve;
      }

      ${options.colorMode === "grayscale" ? "* { filter: grayscale(100%); }" : ""}

      body {
        margin: 0;
        padding: 0;
      }

      .print-container {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
      }
    }
  `;
}

/**
 * Stampa un Blob PDF direttamente nel browser
 * Utilizza l'API di stampa nativa del browser
 */
export async function printPDFBlob(
  pdfBlob: Blob,
  options: PrintOptions,
  invoiceNumber: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Crea un iframe nascosto per la stampa
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          // Attendi un momento per assicurarti che il PDF sia completamente caricato
          setTimeout(() => {
            // Imposta il titolo della stampa
            if (iframe.contentWindow) {
              iframe.contentWindow.document.title = `${invoiceNumber}.pdf`;
              
              // Configura le proprietà di stampa per evitare scaling
              const style = iframe.contentWindow.document.createElement("style");
              style.textContent = `
                @page {
                  margin: 0;
                  padding: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                }
                #viewer {
                  width: 100% !important;
                  height: 100% !important;
                }
              `;
              iframe.contentWindow.document.head.appendChild(style);
            }

            // Attiva la finestra di dialogo di stampa
            iframe.contentWindow!.print();

            // Pulizia
            setTimeout(() => {
              document.body.removeChild(iframe);
              URL.revokeObjectURL(pdfUrl);
              resolve();
            }, 250);
          }, 500);
        } catch (error) {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(pdfUrl);
          reject(error);
        }
      };

      iframe.onerror = () => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(pdfUrl);
        reject(new Error("Errore nel caricamento del PDF per la stampa"));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stampa un PDF dalla URL
 * Utile per URL remote
 */
export async function printPDFFromURL(
  url: string,
  invoiceNumber: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          setTimeout(() => {
            iframe.contentWindow!.document.title = `${invoiceNumber}.pdf`;
            iframe.contentWindow!.print();

            setTimeout(() => {
              document.body.removeChild(iframe);
              resolve();
            }, 250);
          }, 500);
        } catch (error) {
          document.body.removeChild(iframe);
          reject(error);
        }
      };

      iframe.onerror = () => {
        document.body.removeChild(iframe);
        reject(new Error("Errore nel caricamento del PDF per la stampa"));
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stampa HTML direttamente
 * Utile per stampe personalizzate
 */
export async function printHTML(
  htmlContent: string,
  options: PrintOptions,
  title: string = "Documento"
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        reject(
          new Error(
            "Impossibile aprire la finestra di stampa. Controlla il blocco popup."
          )
        );
        return;
      }

      // Aggiungi gli stili per la stampa
      const pageStyles = getPrintPageStyles(options);

      const fullHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            ${pageStyles}
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${htmlContent}
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(fullHTML);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
            resolve();
          }, 250);
        }, 500);
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Hook helper per la stampa diretta di PDF
 * Senza necessità di salvare il file
 */
export function usePrintService() {
  const printPDF = async (
    pdfBlob: Blob,
    options: PrintOptions,
    invoiceNumber: string
  ): Promise<void> => {
    await printPDFBlob(pdfBlob, options, invoiceNumber);
  };

  const printFromURL = async (
    url: string,
    invoiceNumber: string
  ): Promise<void> => {
    await printPDFFromURL(url, invoiceNumber);
  };

  const printHTMLContent = async (
    htmlContent: string,
    options: PrintOptions,
    title?: string
  ): Promise<void> => {
    await printHTML(htmlContent, options, title);
  };

  return {
    printPDF,
    printFromURL,
    printHTMLContent,
  };
}
