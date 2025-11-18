import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Printer,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  htmlContent: string | null;
  invoiceNumber: string;
  onPrint: (options: PrintOptions) => void;
  onDownload?: () => void;
  isLoading?: boolean;
}

export interface PrintOptions {
  paperSize: "a4" | "letter";
  orientation: "portrait" | "landscape";
  margins: "minimal" | "normal" | "generous";
  colorMode: "color" | "grayscale";
  paperSource: "auto" | "manual";
  copies: number;
  pages: "all" | "current" | "range";
  pageRange?: string;
}

const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  paperSize: "a4",
  orientation: "portrait",
  margins: "normal",
  colorMode: "color",
  paperSource: "auto",
  copies: 1,
  pages: "all",
};

export function PrintDialog({
  open,
  onOpenChange,
  htmlContent,
  invoiceNumber,
  onPrint,
  onDownload,
  isLoading = false,
}: PrintDialogProps) {
  const [scale, setScale] = useState<number>(1.0);
  const [printOptions, setPrintOptions] = useState<PrintOptions>(
    DEFAULT_PRINT_OPTIONS
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handlePrintOptionsChange = (
    key: keyof PrintOptions,
    value: any
  ) => {
    setPrintOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePrint = () => {
    onPrint(printOptions);
    onOpenChange(false);
  };

  // Inject HTML content into iframe for preview
  useEffect(() => {
    if (htmlContent && iframeRef.current && open) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: white;
      padding: 20px;
      line-height: 1.5;
    }
    @page {
      size: A4;
      margin: 10mm;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`);
        doc.close();
      }
    }
  }, [htmlContent, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Stampa Fattura: {invoiceNumber}</DialogTitle>
          <DialogDescription>
            Anteprima e configurazione della stampa
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Preview area */}
          <div
            ref={previewContainerRef}
            className="flex-1 flex flex-col border rounded-lg bg-muted/30 overflow-hidden"
          >
            {/* Preview Controls */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/50">
              <div className="text-sm font-semibold text-muted-foreground">
                Anteprima (scala: {Math.round(scale * 100)}%)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
                  className="h-8 w-8"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm min-w-[50px] text-center font-semibold">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setScale((s) => Math.min(2.0, s + 0.2))}
                  className="h-8 w-8"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Info Message */}
            <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950 border-b text-xs text-blue-900 dark:text-blue-100">
              📄 Anteprima del documento trasformato da XSLT. Mantiene i page-break CSS per stampa corretta.
            </div>

            {/* HTML Preview */}
            <ScrollArea className="flex-1">
              <div className="flex justify-center items-start p-4 min-h-full bg-gradient-to-br from-muted/20 to-muted/40">
                {htmlContent && !isLoading ? (
                  <div 
                    className="bg-white rounded-lg shadow-xl overflow-auto"
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: 'top center',
                      width: '210mm',
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      style={{
                        width: '210mm',
                        height: 'auto',
                        border: 'none',
                        display: 'block',
                      }}
                      title="Print preview"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-96 w-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-sm text-muted-foreground">
                        Caricamento anteprima...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Settings panel */}
          <div className="w-80 flex flex-col gap-6 pr-2 overflow-y-auto">
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wide mb-4">
                Impostazioni Stampa
              </h3>

              {/* Paper Size */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="paperSize" className="text-xs font-semibold">
                  Formato Carta
                </Label>
                <Select
                  value={printOptions.paperSize}
                  onValueChange={(value) =>
                    handlePrintOptionsChange(
                      "paperSize",
                      value as "a4" | "letter"
                    )
                  }
                >
                  <SelectTrigger id="paperSize" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="letter">
                      Lettera (8.5 × 11 in)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Orientation */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="orientation" className="text-xs font-semibold">
                  Orientamento
                </Label>
                <Select
                  value={printOptions.orientation}
                  onValueChange={(value) =>
                    handlePrintOptionsChange(
                      "orientation",
                      value as "portrait" | "landscape"
                    )
                  }
                >
                  <SelectTrigger id="orientation" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Verticale</SelectItem>
                    <SelectItem value="landscape">Orizzontale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Margins */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="margins" className="text-xs font-semibold">
                  Margini
                </Label>
                <Select
                  value={printOptions.margins}
                  onValueChange={(value) =>
                    handlePrintOptionsChange(
                      "margins",
                      value as "minimal" | "normal" | "generous"
                    )
                  }
                >
                  <SelectTrigger id="margins" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimi</SelectItem>
                    <SelectItem value="normal">Normali</SelectItem>
                    <SelectItem value="generous">Generosi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Color Mode */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="colorMode" className="text-xs font-semibold">
                  Colore
                </Label>
                <Select
                  value={printOptions.colorMode}
                  onValueChange={(value) =>
                    handlePrintOptionsChange(
                      "colorMode",
                      value as "color" | "grayscale"
                    )
                  }
                >
                  <SelectTrigger id="colorMode" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="color">A Colori</SelectItem>
                    <SelectItem value="grayscale">In Bianco e Nero</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Paper Source */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="paperSource" className="text-xs font-semibold">
                  Alimentazione Carta
                </Label>
                <Select
                  value={printOptions.paperSource}
                  onValueChange={(value) =>
                    handlePrintOptionsChange(
                      "paperSource",
                      value as "auto" | "manual"
                    )
                  }
                >
                  <SelectTrigger id="paperSource" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatica</SelectItem>
                    <SelectItem value="manual">Manuale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Copies */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="copies" className="text-xs font-semibold">
                  Copie
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handlePrintOptionsChange(
                        "copies",
                        Math.max(1, printOptions.copies - 1)
                      )
                    }
                    className="h-8 w-8 p-0 text-base font-bold"
                  >
                    −
                  </Button>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={printOptions.copies}
                    onChange={(e) =>
                      handlePrintOptionsChange(
                        "copies",
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="flex-1 h-8 text-center border-2 border-primary rounded px-2 text-base font-bold text-foreground bg-background"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handlePrintOptionsChange(
                        "copies",
                        Math.min(99, printOptions.copies + 1)
                      )
                    }
                    className="h-8 w-8 p-0 text-base font-bold"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Pages */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="pages" className="text-xs font-semibold">
                  Pagine da Stampare
                </Label>
                <Select
                  value={printOptions.pages}
                  onValueChange={(value) =>
                    handlePrintOptionsChange(
                      "pages",
                      value as "all" | "current" | "range"
                    )
                  }
                >
                  <SelectTrigger id="pages" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le pagine</SelectItem>
                    <SelectItem value="range">Intervallo personalizzato</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page Range */}
              {printOptions.pages === "range" && (
                <div className="space-y-2 mb-4">
                  <Label
                    htmlFor="pageRange"
                    className="text-xs font-semibold"
                  >
                    Intervallo Pagine
                  </Label>
                  <input
                    id="pageRange"
                    type="text"
                    value={printOptions.pageRange || ""}
                    onChange={(e) =>
                      handlePrintOptionsChange("pageRange", e.target.value)
                    }
                    placeholder="es: 1-3 o 1,3,5"
                    className="w-full h-8 border rounded px-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usa: "1-3" per intervallo, "1,3,5" per pagine singole
                  </p>
                </div>
              )}
            </div>

            {/* Additional Options */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide mb-3">
                Opzioni
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="backgroundGraphics" />
                  <label
                    htmlFor="backgroundGraphics"
                    className="text-sm cursor-pointer"
                  >
                    Includi sfondo e grafiche
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="headers" />
                  <label
                    htmlFor="headers"
                    className="text-sm cursor-pointer"
                  >
                    Stampa intestazioni
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Annulla
          </Button>
          <Button
            onClick={handlePrint}
            disabled={!htmlContent || isLoading}
            className="flex-1 gap-2"
          >
            <Printer className="w-4 h-4" />
            Stampa Ora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
