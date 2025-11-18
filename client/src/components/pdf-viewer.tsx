import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Invoice } from "@shared/schema";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  invoice: Invoice;
  onClose: () => void;
  onDownloadPDF: (invoice: Invoice) => void;
  onDownloadXML: (invoice: Invoice) => void;
  onPrint: (invoice: Invoice) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}

export function PDFViewer({
  invoice,
  onClose,
  onDownloadPDF,
  onDownloadXML,
  onPrint,
  onUpdateStatus,
  onUpdateNotes,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [notes, setNotes] = useState(invoice.notes || "");
  const [xmlContent, setXmlContent] = useState<string>("");

  useEffect(() => {
    // Load XML content
    fetch(`/api/invoices/${invoice.id}/xml`)
      .then((res) => res.text())
      .then(setXmlContent)
      .catch((err) => console.error("Error loading XML:", err));
  }, [invoice.id]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "€0,00";
    const num = parseFloat(amount);
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(num);
  };

  return (
    <div
      className="h-full flex flex-col bg-card border-l"
      data-testid="pdf-viewer"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-viewer"
          >
            <X className="w-5 h-5" />
          </Button>
          <div>
            <h3 className="font-semibold text-base">{invoice.invoiceNumber}</h3>
            <p className="text-xs text-muted-foreground">
              {invoice.supplierName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownloadPDF(invoice)}
            data-testid="button-download-pdf"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPrint(invoice)}
            data-testid="button-print"
          >
            <Printer className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pdf" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-3 gap-2">
          <TabsTrigger value="pdf" data-testid="tab-pdf">
            Anteprima PDF
          </TabsTrigger>
          <TabsTrigger value="xml" data-testid="tab-xml">
            XML Originale
          </TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">
            Dettagli
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf" className="flex-1 m-0 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* PDF Controls */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                  data-testid="button-prev-page"
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span
                  className="text-sm min-w-[100px] text-center"
                  data-testid="text-page-number"
                >
                  Pagina {pageNumber} di {numPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setPageNumber((p) => Math.min(numPages, p + 1))
                  }
                  disabled={pageNumber >= numPages}
                  data-testid="button-next-page"
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                  data-testid="button-zoom-out"
                  className="h-8 w-8"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span
                  className="text-sm min-w-[50px] text-center"
                  data-testid="text-zoom-level"
                >
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setScale((s) => Math.min(2.0, s + 0.2))}
                  data-testid="button-zoom-in"
                  className="h-8 w-8"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* PDF Display */}
            <ScrollArea className="flex-1">
              <div className="flex justify-center p-6 bg-muted/20">
                <Document
                  file={`/api/invoices/${invoice.id}/pdf`}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex flex-col items-center justify-center h-96 gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-muted-foreground">
                          Caricamento PDF...
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Ottimizzato per prestazioni elevate
                        </p>
                      </div>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-lg"
                  />
                </Document>
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="xml" className="flex-1 m-0 p-4 overflow-hidden">
          <ScrollArea className="h-full">
            <pre className="text-xs font-mono p-4 bg-muted/50 rounded-lg overflow-x-auto">
              {xmlContent || "Caricamento XML..."}
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="details" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Supplier Info */}
              <div>
                <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  Emittente
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold">{invoice.supplierName}</p>
                    {invoice.supplierVat && (
                      <p className="text-sm text-muted-foreground">
                        P.IVA: {invoice.supplierVat}
                      </p>
                    )}
                    {invoice.supplierFiscalCode && (
                      <p className="text-sm text-muted-foreground">
                        C.F.: {invoice.supplierFiscalCode}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              {invoice.customerName && (
                <div>
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                    Destinatario
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold">{invoice.customerName}</p>
                      {invoice.customerVat && (
                        <p className="text-sm text-muted-foreground">
                          P.IVA: {invoice.customerVat}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Invoice Details */}
              <div>
                <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  Documento
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Numero</p>
                    <p className="font-semibold font-mono">
                      {invoice.invoiceNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-semibold">{invoice.invoiceDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Imponibile</p>
                    <p className="font-semibold">
                      {formatCurrency(invoice.taxableAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">IVA</p>
                    <p className="font-semibold">
                      {formatCurrency(invoice.taxAmount)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Totale</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(invoice.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              {invoice.paymentDueDate && (
                <div>
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                    Pagamento
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {invoice.paymentMethod && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Modalità
                        </p>
                        <p className="font-semibold">{invoice.paymentMethod}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Scadenza</p>
                      <p className="font-semibold">{invoice.paymentDueDate}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <Label
                  htmlFor="status"
                  className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Stato
                </Label>
                <Select
                  value={(() => {
                    // Normalize legacy status values
                    if (
                      (invoice.status as any) === "received" ||
                      (invoice.status as any) === "overdue"
                    )
                      return "not_printed";
                    if ((invoice.status as any) === "paid") return "printed";
                    return invoice.status;
                  })()}
                  onValueChange={(value) => onUpdateStatus(invoice.id, value)}
                >
                  <SelectTrigger
                    id="status"
                    className="mt-2"
                    data-testid="select-status"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_printed">Non Stampata</SelectItem>
                    <SelectItem value="printed">Stampata</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <Label
                  htmlFor="notes"
                  className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Note
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => onUpdateNotes(invoice.id, notes)}
                  placeholder="Aggiungi note..."
                  className="mt-2 min-h-[100px]"
                  data-testid="textarea-notes"
                />
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
