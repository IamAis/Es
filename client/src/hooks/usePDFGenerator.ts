import { useState, useCallback } from 'react';
import { transformXMLToHTML } from '../utils/xslt-transformer';
import { generatePDFFromHTML, downloadPDFFromHTML, PDFGenerationOptions } from '../utils/html-to-pdf';
import { extractXMLFromP7M, processUploadedFile } from '../utils/p7m-extractor';

export interface UsePDFGeneratorOptions {
  autoDownload?: boolean;
  filename?: string;
  pdfOptions?: PDFGenerationOptions;
}

export interface PDFGeneratorState {
  isGenerating: boolean;
  error: string | null;
  progress: number;
}

export interface PDFGeneratorActions {
  generatePDFFromXML: (xmlContent: string, filename?: string) => Promise<Blob | null>;
  generatePDFFromFile: (file: File, filename?: string) => Promise<Blob | null>;
  generatePDFFromInvoiceId: (invoiceId: string, invoiceNumber: string) => Promise<Blob | null>;
  downloadPDF: (pdfBlob: Blob, filename: string) => void;
  clearError: () => void;
  resetState: () => void;
}

export interface UsePDFGeneratorReturn extends PDFGeneratorState, PDFGeneratorActions {}

/**
 * Hook personalizzato per la generazione di PDF lato client
 * Gestisce la trasformazione XML->HTML->PDF completamente nel browser
 */
export function usePDFGenerator(options: UsePDFGeneratorOptions = {}): UsePDFGeneratorReturn {
  const {
    autoDownload = false,
    filename: defaultFilename = 'fattura.pdf',
    pdfOptions = {},
  } = options;

  const [state, setState] = useState<PDFGeneratorState>({
    isGenerating: false,
    error: null,
    progress: 0,
  });

  /**
   * Aggiorna lo stato
   */
  const updateState = useCallback((updates: Partial<PDFGeneratorState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Resetta lo stato
   */
  const resetState = useCallback(() => {
    setState({
      isGenerating: false,
      error: null,
      progress: 0,
    });
  }, []);

  /**
   * Pulisce l'errore
   */
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  /**
   * Genera PDF da contenuto XML
   */
  const generatePDFFromXML = useCallback(
    async (xmlContent: string, filename?: string): Promise<Blob | null> => {
      try {
        updateState({ isGenerating: true, error: null, progress: 0 });

        // Step 1: Trasforma XML in HTML (33%)
        updateState({ progress: 33 });
        const htmlContent = await transformXMLToHTML(xmlContent);

        // Step 2: Genera PDF da HTML (66%)
        updateState({ progress: 66 });
        const pdfBlob = await generatePDFFromHTML(htmlContent, pdfOptions);

        // Step 3: Completato (100%)
        updateState({ progress: 100, isGenerating: false });

        // Auto-download se richiesto
        if (autoDownload) {
          const downloadFilename = filename || defaultFilename;
          downloadPDF(pdfBlob, downloadFilename);
        }

        return pdfBlob;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
        updateState({
          error: `Errore nella generazione del PDF: ${errorMessage}`,
          isGenerating: false,
          progress: 0,
        });
        console.error('Error generating PDF from XML:', error);
        return null;
      }
    },
    [autoDownload, defaultFilename, pdfOptions, updateState]
  );

  /**
   * Genera PDF da file (XML o P7M)
   */
  const generatePDFFromFile = useCallback(
    async (file: File, filename?: string): Promise<Blob | null> => {
      try {
        updateState({ isGenerating: true, error: null, progress: 0 });

        // Step 1: Processa il file (estrai XML se P7M) (25%)
        updateState({ progress: 25 });
        const { xmlContent, wasP7M } = await processUploadedFile(file);

        if (wasP7M) {
          console.log('File P7M rilevato, XML estratto con successo');
        }

        // Step 2: Trasforma XML in HTML (50%)
        updateState({ progress: 50 });
        const htmlContent = await transformXMLToHTML(xmlContent);

        // Step 3: Genera PDF da HTML (75%)
        updateState({ progress: 75 });
        const pdfBlob = await generatePDFFromHTML(htmlContent, pdfOptions);

        // Step 4: Completato (100%)
        updateState({ progress: 100, isGenerating: false });

        // Auto-download se richiesto
        if (autoDownload) {
          const downloadFilename =
            filename ||
            file.name.replace(/\.(xml|p7m)$/i, '.pdf') ||
            defaultFilename;
          downloadPDF(pdfBlob, downloadFilename);
        }

        return pdfBlob;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
        updateState({
          error: `Errore nella generazione del PDF dal file: ${errorMessage}`,
          isGenerating: false,
          progress: 0,
        });
        console.error('Error generating PDF from file:', error);
        return null;
      }
    },
    [autoDownload, defaultFilename, pdfOptions, updateState]
  );

  /**
   * Genera PDF da ID fattura (recupera XML dal backend)
   */
  const generatePDFFromInvoiceId = useCallback(
    async (invoiceId: string, invoiceNumber: string): Promise<Blob | null> => {
      try {
        updateState({ isGenerating: true, error: null, progress: 0 });

        // Step 1: Recupera XML dal backend (25%)
        updateState({ progress: 25 });
        const response = await fetch(`/api/invoices/${invoiceId}/xml`);

        if (!response.ok) {
          throw new Error(`Errore nel recupero dell'XML: ${response.statusText}`);
        }

        const xmlContent = await response.text();

        // Step 2: Trasforma XML in HTML (50%)
        updateState({ progress: 50 });
        const htmlContent = await transformXMLToHTML(xmlContent);

        // Step 3: Genera PDF da HTML (75%)
        updateState({ progress: 75 });
        const pdfBlob = await generatePDFFromHTML(htmlContent, pdfOptions);

        // Step 4: Completato (100%)
        updateState({ progress: 100, isGenerating: false });

        // Auto-download se richiesto
        if (autoDownload) {
          const downloadFilename = `${invoiceNumber}.pdf`;
          downloadPDF(pdfBlob, downloadFilename);
        }

        return pdfBlob;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
        updateState({
          error: `Errore nella generazione del PDF: ${errorMessage}`,
          isGenerating: false,
          progress: 0,
        });
        console.error('Error generating PDF from invoice:', error);
        return null;
      }
    },
    [autoDownload, pdfOptions, updateState]
  );

  /**
   * Scarica un PDF Blob
   */
  const downloadPDF = useCallback((pdfBlob: Blob, filename: string) => {
    try {
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      updateState({
        error: 'Errore nel download del PDF',
      });
    }
  }, [updateState]);

  return {
    // State
    isGenerating: state.isGenerating,
    error: state.error,
    progress: state.progress,

    // Actions
    generatePDFFromXML,
    generatePDFFromFile,
    generatePDFFromInvoiceId,
    downloadPDF,
    clearError,
    resetState,
  };
}

/**
 * Hook semplificato per generazione veloce di PDF
 */
export function useQuickPDFGenerator() {
  return usePDFGenerator({
    autoDownload: true,
    pdfOptions: {
      format: 'a4',
      orientation: 'portrait',
      margin: {
        top: 20,
        right: 15,
        bottom: 20,
        left: 15,
      },
    },
  });
}

/**
 * Hook per anteprima PDF (senza auto-download)
 */
export function usePDFPreview() {
  return usePDFGenerator({
    autoDownload: false,
  });
}
