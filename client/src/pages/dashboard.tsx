import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  FileText,
  Filter,
  Download,
  Trash2,
  Printer,
  AlertTriangle,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadZone } from "@/components/upload-zone";
import { InvoiceTable } from "@/components/invoice-table";
import { EmptyState } from "@/components/empty-state";
import { PDFViewer } from "@/components/pdf-viewer";
import { DeleteInvoiceDialog } from "@/components/delete-invoice-dialog";
import { DeleteBatchDialog } from "@/components/delete-batch-dialog";
import { DateFilter } from "@/components/date-filter";
import { PrintDialog, PrintOptions } from "@/components/print-dialog";
import { BackupRestore } from "@/components/backup-restore";
import { useToast } from "@/hooks/use-toast";
import { usePDFGenerator } from "@/hooks/usePDFGenerator";
import { usePrintService } from "@/utils/print-service";
import {
  UploadProgress,
  useUploadProgress,
} from "@/components/upload-progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Invoice } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const pdfGenerator = usePDFGenerator({ autoDownload: false });
  const printService = usePrintService();
  const { jobId, startTracking, stopTracking } = useUploadProgress();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("not_printed");
  const [printConfirmInvoice, setPrintConfirmInvoice] =
    useState<Invoice | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printDialogInvoice, setPrintDialogInvoice] = useState<Invoice | null>(
    null
  );
  const [printDialogPDF, setPrintDialogPDF] = useState<Blob | null>(null);
  const [printDialogHTML, setPrintDialogHTML] = useState<string | null>(null);
  const [printDialogLoading, setPrintDialogLoading] = useState(false);
  const [showBatchPrintDialog, setShowBatchPrintDialog] = useState(false);
  const [batchPrintDialogLoading, setBatchPrintDialogLoading] = useState(false);
  const [batchPrintConfirmInvoiceIds, setBatchPrintConfirmInvoiceIds] = useState<string[]>([]);
  const [batchPrintMarkAsPrinted, setBatchPrintMarkAsPrinted] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [duplicateMessage, setDuplicateMessage] = useState<string>("");
  
  // Period filter - default to "all", no localStorage persistence
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState<string>("");
  const [invoiceDateTo, setInvoiceDateTo] = useState<string>("");
  const [dueDateFrom, setDueDateFrom] = useState<string>("");
  const [dueDateTo, setDueDateTo] = useState<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch invoices (supports paginated response from server)
  const { data, isLoading } = useQuery<
    Invoice[] | { invoices: Invoice[]; pagination: any }
  >({
    queryKey: ["/api/invoices"],
  });

  // Support both old format (Invoice[]) and new format ({ invoices: Invoice[], pagination: {...} })
  const invoices: Invoice[] = Array.isArray(data) ? data : data?.invoices || [];

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const res = await apiRequest("POST", "/api/invoices/upload", formData);
      return res.json();
    },
    onSuccess: (data: any) => {
      // Invalidate queries immediately after successful upload
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });

      // Update tracking with real jobId from server
      if (data.jobId) {
        startTracking(data.jobId);
      }

      const duplicateEntries = Array.isArray(data?.errors)
        ? data.errors.filter(
            (entry: any) => entry?.code === "DUPLICATE_INVOICE",
          )
        : [];

      if (duplicateEntries.length > 0) {
        openDuplicateDialog(
          duplicateEntries.map((entry: any) => entry.filename),
          "Alcune fatture sono già presenti e non sono state importate.",
        );
      }
    },
    onError: (error: any) => {
      const duplicateEntries = Array.isArray(error?.data?.errors)
        ? error.data.errors.filter(
            (entry: any) => entry?.code === "DUPLICATE_INVOICE",
          )
        : [];

      if (duplicateEntries.length > 0) {
        openDuplicateDialog(
          duplicateEntries.map((entry: any) => entry.filename),
          "Le fatture selezionate risultano già presenti e non sono state importate.",
        );
        return;
      }

      toast({
        title: "Errore importazione",
        description: error?.message || "Si è verificato un errore",
        variant: "destructive",
      });
    },
  });

  const openDuplicateDialog = (filenames: string[], message: string) => {
    const uniqueFiles = Array.from(new Set(filenames)).sort((a, b) =>
      a.localeCompare(b),
    );
    setDuplicateFiles(uniqueFiles);
    setDuplicateMessage(message);
    setShowDuplicateDialog(true);
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/invoices/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedIds((prev) => prev.filter((id) => id !== invoiceToDelete?.id));
      if (selectedInvoice?.id === invoiceToDelete?.id) {
        setSelectedInvoice(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore eliminazione",
        description: error.message || "Si è verificato un errore",
        variant: "destructive",
      });
    },
  });

  // Batch delete mutation
  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Use the batch delete endpoint to avoid race conditions
      const res = await apiRequest("POST", "/api/invoices/batch-delete", {
        ids,
      });
      return res.json();
    },
    onSuccess: (data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedIds([]);
      if (selectedInvoice && ids.includes(selectedInvoice.id)) {
        setSelectedInvoice(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore eliminazione",
        description:
          error.message || "Si è verificato un errore durante l'eliminazione",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/invoices/${id}`, {
        status,
      });
      return response.json();
    },
    onSuccess: (updatedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (selectedInvoice?.id === updatedInvoice.id) {
        setSelectedInvoice(updatedInvoice);
      }
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest("PATCH", `/api/invoices/${id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  // Toggle mark mutation
  const toggleMarkMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/invoices/${id}/mark`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile contrassegnare la fattura",
        variant: "destructive",
      });
    },
  });

  // Calculate available years from invoices
  const availableYears = Array.from(
    new Set(
      invoices
        .map((invoice) => new Date(invoice.invoiceDate).getFullYear())
        .filter((year) => !isNaN(year)),
    ),
  ).sort((a, b) => b - a);

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      !searchQuery ||
      invoice.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (() => {
        // Handle legacy status values for backward compatibility
        if (statusFilter === "not_printed") {
          return (
            invoice.status === "not_printed" ||
            (invoice.status as any) === "received" ||
            (invoice.status as any) === "overdue"
          );
        }
        if (statusFilter === "printed") {
          return (
            invoice.status === "printed" || (invoice.status as any) === "paid"
          );
        }
        return invoice.status === statusFilter;
      })();

    // Date filtering
    const invoiceDate = new Date(invoice.invoiceDate);
    const invoiceYear = invoiceDate.getFullYear().toString();
    const invoiceMonth = (invoiceDate.getMonth() + 1)
      .toString()
      .padStart(2, "0");

    const matchesYear = selectedYear === "all" || invoiceYear === selectedYear;
    const matchesMonth =
      selectedMonth === "all" || invoiceMonth === selectedMonth;

    // Advanced date filters
    let matchesInvoiceDateRange = true;
    if (invoiceDateFrom || invoiceDateTo) {
      const fromDate = invoiceDateFrom ? new Date(invoiceDateFrom) : null;
      const toDate = invoiceDateTo ? new Date(invoiceDateTo) : null;
      
      if (fromDate && invoiceDate < fromDate) {
        matchesInvoiceDateRange = false;
      }
      if (toDate) {
        // Set time to end of day for "to" comparison
        const endOfDay = new Date(toDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (invoiceDate > endOfDay) {
          matchesInvoiceDateRange = false;
        }
      }
    }

    let matchesDueDateRange = true;
    if (dueDateFrom || dueDateTo) {
      const dueDate = invoice.paymentDueDate
        ? new Date(invoice.paymentDueDate)
        : null;
      
      if (!dueDate) {
        matchesDueDateRange = false;
      } else {
        const fromDate = dueDateFrom ? new Date(dueDateFrom) : null;
        const toDate = dueDateTo ? new Date(dueDateTo) : null;
        
        if (fromDate && dueDate < fromDate) {
          matchesDueDateRange = false;
        }
        if (toDate) {
          // Set time to end of day for "to" comparison
          const endOfDay = new Date(toDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (dueDate > endOfDay) {
            matchesDueDateRange = false;
          }
        }
      }
    }

    return (
      matchesSearch &&
      matchesStatus &&
      matchesYear &&
      matchesMonth &&
      matchesInvoiceDateRange &&
      matchesDueDateRange
    );
  });

  const stats = {
    total: invoices.length,
    not_printed: invoices.filter(
      (i) =>
        i.status === "not_printed" ||
        (i.status as any) === "received" ||
        (i.status as any) === "overdue",
    ).length,
    printed: invoices.filter(
      (i) => i.status === "printed" || (i.status as any) === "paid",
    ).length,
  };

  const handleFilesSelected = (files: File[]) => {
    uploadMutation.mutate(files);
  };

  const handleUploadComplete = (data: any) => {
    if (data.status === "completed") {
      // Invalidate queries only after upload is complete to avoid spam
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    }
  };

  const handleDownloadXML = (invoice: Invoice) => {
    window.open(`/api/invoices/${invoice.id}/xml/download`, "_blank");
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      await pdfGenerator.generatePDFFromInvoiceId(
        invoice.id,
        invoice.invoiceNumber,
      );

      if (pdfGenerator.error) {
        toast({
          title: "Errore nella generazione del PDF",
          description: pdfGenerator.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Errore",
        description: "Impossibile generare il PDF. Riprova.",
        variant: "destructive",
      });
    }
  };

  const handlePrint = (invoice: Invoice) => {
    if (invoice.status === "not_printed") {
      setPrintConfirmInvoice(invoice);
    } else {
      executePrint(invoice);
    }
  };

  const executePrint = async (invoice: Invoice) => {
    try {
      setPrintDialogLoading(true);

      // Recupera HTML direttamente dal backend (già trasformato da xslt-transformer.ts del server)
      const htmlResponse = await fetch(`/api/invoices/${invoice.id}/html`);
      if (!htmlResponse.ok) {
        throw new Error("Impossibile recuperare l'HTML");
      }
      const htmlContent = await htmlResponse.text();

      // Mostra il dialog di stampa con HTML trasformato dal server
      setPrintDialogInvoice(invoice);
      setPrintDialogHTML(htmlContent);
      setShowPrintDialog(true);
      setPrintDialogLoading(false);
    } catch (error) {
      console.error("Error preparing print:", error);
      toast({
        title: "Errore nella preparazione della stampa",
        description: "Impossibile preparare il documento. Riprova.",
        variant: "destructive",
      });
      setPrintDialogLoading(false);
    }
  };

  const handlePrintConfirm = async (printOptions: PrintOptions) => {
    try {
      if (!printDialogHTML || !printDialogInvoice) return;

      // Stampa l'HTML trasformato direttamente (rispetta i page-break CSS)
      await printService.printHTMLContent(
        printDialogHTML,
        printOptions,
        printDialogInvoice.invoiceNumber
      );

      // Aggiorna lo stato a "stampato" se era "non stampato"
      if (printConfirmInvoice) {
        updateStatusMutation.mutate(
          { id: printConfirmInvoice.id, status: "printed" }
        );
        setPrintConfirmInvoice(null);
      }
    } catch (error) {
      console.error("Error during print:", error);
      toast({
        title: "Errore nella stampa",
        description:
          error instanceof Error
            ? error.message
            : "Impossibile stampare il documento. Riprova.",
        variant: "destructive",
      });
    }
  };

  const handlePrintDownload = () => {
    if (!printDialogPDF || !printDialogInvoice) return;

    const url = URL.createObjectURL(printDialogPDF);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${printDialogInvoice.invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleToggleMark = (invoice: Invoice) => {
    toggleMarkMutation.mutate(invoice.id);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setShowBatchDeleteDialog(true);
  };

  const handleConfirmBatchDelete = () => {
    batchDeleteMutation.mutate(selectedIds);
    setShowBatchDeleteDialog(false);
  };

  const handleBatchDownloadXML = async () => {
    if (selectedIds.length === 0) return;

    try {
      toast({
        title: "Preparazione download",
        description: `Creazione ZIP con ${selectedIds.length} file XML...`,
      });

      const response = await apiRequest("POST", "/api/invoices/batch-download/xml", {
        ids: selectedIds,
      });

      if (!response.ok) {
        throw new Error("Errore nel download dei file");
      }

      // Create blob from response and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fatture_xml_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading XMLs:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile scaricare i file",
        variant: "destructive",
      });
    }
  };

  const handleBatchDownloadPDF = async () => {
    if (selectedIds.length === 0) return;

    try {
      toast({
        title: "Preparazione download",
        description: `Creazione ZIP con ${selectedIds.length} file PDF...`,
      });

      const response = await apiRequest("POST", "/api/invoices/batch-download/pdf", {
        ids: selectedIds,
      });

      if (!response.ok) {
        throw new Error("Errore nel download dei file");
      }

      // Create blob from response and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fatture_pdf_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDFs:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Impossibile scaricare i file",
        variant: "destructive",
      });
    }
  };

  const handleBatchPrint = () => {
    if (selectedIds.length === 0) return;
    
    // Mostra il dialog di conferma per il batch print
    setBatchPrintConfirmInvoiceIds(selectedIds);
    setShowBatchPrintDialog(true);
  };

  const executeBatchPrint = async () => {
    if (batchPrintConfirmInvoiceIds.length === 0) return;

    try {
      setBatchPrintDialogLoading(true);
      // Chiudi il dialog batch senza resettare il flag (il PrintDialog lo userà)
      setShowBatchPrintDialog(false);

      // Raccogliere tutti gli HTML delle fatture selezionate dal backend
      const htmlParts: string[] = [];

      for (const id of batchPrintConfirmInvoiceIds) {
        const invoice = invoices.find((i) => i.id === id);
        if (invoice) {
          // Recupera HTML direttamente dal backend (già trasformato da xslt-transformer.ts)
          const htmlResponse = await fetch(`/api/invoices/${invoice.id}/html`);
          if (!htmlResponse.ok) {
            throw new Error(`Impossibile recuperare l'HTML per ${invoice.invoiceNumber}`);
          }
          const htmlContent = await htmlResponse.text();
          htmlParts.push(htmlContent);
        }
      }

      // Combina tutti gli HTML in un unico documento con page-break tra le fatture
      const compositeHTML = htmlParts.join('<div style="page-break-after: always;"></div>');

      // Mostra il dialog di stampa con HTML composito
      setPrintDialogHTML(compositeHTML);
      setPrintDialogInvoice({ invoiceNumber: `${batchPrintConfirmInvoiceIds.length} fatture` } as any);
      setShowPrintDialog(true);
      setBatchPrintDialogLoading(false);
    } catch (error) {
      console.error("Error preparing batch print:", error);
      toast({
        title: "Errore nella preparazione della stampa",
        description: error instanceof Error ? error.message : "Impossibile preparare le fatture per la stampa. Riprova.",
        variant: "destructive",
      });
      setBatchPrintDialogLoading(false);
    }
  };

  const handleBatchPrintConfirm = async (printOptions: PrintOptions) => {
    try {
      if (!printDialogHTML) return;

      // Stampa l'HTML composito
      await printService.printHTMLContent(
        printDialogHTML,
        printOptions,
        `Fatture_${batchPrintConfirmInvoiceIds.length}`
      );

      // Aggiorna lo stato delle fatture se richiesto
      if (batchPrintMarkAsPrinted && batchPrintConfirmInvoiceIds.length > 0) {
        try {
          const response = await apiRequest("POST", "/api/invoices/batch-update-status", {
            ids: batchPrintConfirmInvoiceIds,
            status: "printed",
          });

          if (response.ok) {
            const result = await response.json();
            // Invalida le query per aggiornare l'UI
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
          } else {
            throw new Error("Errore durante l'aggiornamento dello stato");
          }
        } catch (error) {
          console.error("Error updating invoice statuses:", error);
          toast({
            title: "Errore nell'aggiornamento",
            description:
              error instanceof Error
                ? error.message
                : "Impossibile aggiornare lo stato delle fatture",
            variant: "destructive",
          });
        }
      }

      // Chiudi il dialog di stampa
      setShowPrintDialog(false);
      setPrintDialogHTML(null);
      setBatchPrintConfirmInvoiceIds([]);
      setBatchPrintMarkAsPrinted(false);
    } catch (error) {
      console.error("Error during batch print:", error);
      toast({
        title: "Errore nella stampa",
        description:
          error instanceof Error
            ? error.message
            : "Impossibile stampare il documento. Riprova.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <AlertDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fatture duplicate</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateMessage ||
                "Le fatture selezionate risultano già presenti e non sono state importate."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 overflow-auto space-y-2">
            {duplicateFiles.map((filename) => (
              <div key={filename} className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{filename}</span>
              </div>
            ))}
            {duplicateFiles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nessun dettaglio disponibile.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDuplicateDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">FatturaPA Manager</h1>
              <p className="text-xs text-muted-foreground">
                Gestione Fatture Elettroniche
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cerca fatture..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-80"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <BackupRestore />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Date Filter - Top Bar */}
        <div className="px-6 py-4 border-b">
          <DateFilter
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
            onInvoiceDateFromChange={setInvoiceDateFrom}
            onInvoiceDateToChange={setInvoiceDateTo}
            onDueDateFromChange={setDueDateFrom}
            onDueDateToChange={setDueDateTo}
            invoiceDateFrom={invoiceDateFrom}
            invoiceDateTo={invoiceDateTo}
            dueDateFrom={dueDateFrom}
            dueDateTo={dueDateTo}
            availableYears={availableYears}
          />
        </div>

        {/* Main Content - Three Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-72 border-r bg-sidebar p-6 flex flex-col gap-6 overflow-y-auto">
            {/* Upload Zone */}
            <div>
              <UploadZone
                onFilesSelected={handleFilesSelected}
                isUploading={uploadMutation.isPending}
              />
            </div>

            {/* Quick Filters */}
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wide text-sidebar-foreground mb-3">
                Filtri Rapidi
              </h3>
              <div className="space-y-2">
                <Button
                  variant={statusFilter === "not_printed" ? "default" : "ghost"}
                  className="w-full justify-between"
                  onClick={() => setStatusFilter("not_printed")}
                  data-testid="filter-not-printed"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Non Stampate
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-2"
                    data-testid="badge-count-not-printed"
                  >
                    {stats.not_printed}
                  </Badge>
                </Button>
                <Button
                  variant={statusFilter === "printed" ? "default" : "ghost"}
                  className="w-full justify-between"
                  onClick={() => setStatusFilter("printed")}
                  data-testid="filter-printed"
                >
                  <span className="flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    Stampate
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-2"
                    data-testid="badge-count-printed"
                  >
                    {stats.printed}
                  </Badge>
                </Button>
                <Button
                  variant={statusFilter === "all" ? "default" : "ghost"}
                  className="w-full justify-between"
                  onClick={() => setStatusFilter("all")}
                  data-testid="filter-all"
                >
                  <span>Tutte le fatture</span>
                  <Badge
                    variant="secondary"
                    className="ml-2"
                    data-testid="badge-count-all"
                  >
                    {stats.total}
                  </Badge>
                </Button>
              </div>
            </div>

            {/* Storage Stats */}
            <div className="mt-auto pt-6 border-t border-sidebar-border">
              <div className="space-y-1">
                <p
                  className="text-sm font-semibold"
                  data-testid="text-total-invoices"
                >
                  {stats.total} fatture
                </p>
                <p className="text-xs text-muted-foreground">
                  Archiviate localmente
                </p>
              </div>
            </div>
          </aside>

          {/* Center Panel - Invoice List */}
          <main className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <EmptyState
                    onUploadClick={() => fileInputRef.current?.click()}
                  />
                ) : (
                  <InvoiceTable
                    invoices={filteredInvoices}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onViewInvoice={setSelectedInvoice}
                    onDownloadXML={handleDownloadXML}
                    onDownloadPDF={handleDownloadPDF}
                    onPrint={handlePrint}
                    onToggleMark={handleToggleMark}
                    onDelete={setInvoiceToDelete}
                  />
                )}
              </div>
            </ScrollArea>

            {/* Batch Actions Toolbar */}
            {selectedIds.length > 0 && (
              <div className="border-t bg-card p-4">
                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  <span
                    className="text-sm font-medium"
                    data-testid="text-selected-count"
                  >
                    {selectedIds.length} fatture selezionate
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBatchPrint}
                      data-testid="button-batch-print"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Stampa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBatchDownloadXML}
                      data-testid="button-batch-download-xml"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Scarica XML
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBatchDownloadPDF}
                      data-testid="button-batch-download-pdf"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Scarica PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBatchDelete}
                      className="text-destructive"
                      data-testid="button-batch-delete"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Elimina
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIds([])}
                      data-testid="button-deselect-all"
                    >
                      Deseleziona
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Right Panel - PDF Viewer */}
          {selectedInvoice && (
            <div className="w-[45vw] min-w-[520px] max-w-[1000px] flex-shrink-0">
              <PDFViewer
                invoice={selectedInvoice}
                onClose={() => setSelectedInvoice(null)}
                onDownloadPDF={handleDownloadPDF}
                onDownloadXML={handleDownloadXML}
                onPrint={handlePrint}
                onUpdateStatus={(id, status) =>
                  updateStatusMutation.mutate({ id, status })
                }
                onUpdateNotes={(id, notes) =>
                  updateNotesMutation.mutate({ id, notes })
                }
              />
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <DeleteInvoiceDialog
          invoice={invoiceToDelete}
          open={!!invoiceToDelete}
          onOpenChange={(open) => !open && setInvoiceToDelete(null)}
          onConfirm={() => {
            if (invoiceToDelete) {
              deleteMutation.mutate(invoiceToDelete.id);
              setInvoiceToDelete(null);
            }
          }}
        />

        {/* Batch Delete Confirmation Dialog */}
        <DeleteBatchDialog
          count={selectedIds.length}
          open={showBatchDeleteDialog}
          onOpenChange={setShowBatchDeleteDialog}
          onConfirm={handleConfirmBatchDelete}
        />

        {/* Print Confirmation Dialog */}
        <AlertDialog
          open={!!printConfirmInvoice}
          onOpenChange={(open) => !open && setPrintConfirmInvoice(null)}
        >
          <AlertDialogContent className="max-w-[700px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma stampa</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Questa fattura è attualmente contrassegnata come "Non Stampata".
                Vuoi contrassegnarla come "Stampata" dopo la stampa?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:flex-row gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  executePrint(printConfirmInvoice!);
                  setPrintConfirmInvoice(null);
                }}
              >
                Stampa senza cambiare stato
              </Button>
              <Button
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  executePrint(printConfirmInvoice!);
                  setPrintConfirmInvoice(null);
                  updateStatusMutation.mutate({
                    id: printConfirmInvoice!.id,
                    status: "printed",
                  });
                }}
              >
                Stampa e contrassegna come "Stampata"
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Print Dialog */}
        <PrintDialog
          open={showPrintDialog}
          onOpenChange={(open) => {
            setShowPrintDialog(open);
            // Quando il PrintDialog si chiude, resetta i dati batch
            if (!open && batchPrintConfirmInvoiceIds.length > 0) {
              setBatchPrintConfirmInvoiceIds([]);
              setBatchPrintMarkAsPrinted(false);
            }
          }}
          htmlContent={printDialogHTML}
          invoiceNumber={printDialogInvoice?.invoiceNumber || ""}
          onPrint={batchPrintConfirmInvoiceIds.length > 0 ? handleBatchPrintConfirm : handlePrintConfirm}
          onDownload={handlePrintDownload}
          isLoading={printDialogLoading}
        />

        {/* Batch Print Confirmation Dialog */}
        <AlertDialog
          open={showBatchPrintDialog && batchPrintConfirmInvoiceIds.length > 0}
          onOpenChange={(open) => {
            if (!open) {
              // Chiudi il dialog ma NON resettare i dati - verranno resettati da handleBatchPrintConfirm o manualmente
              setShowBatchPrintDialog(false);
            } else {
              setShowBatchPrintDialog(open);
            }
          }}
        >
          <AlertDialogContent className="max-w-[700px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma stampa multipla</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Desideri contrassegnare le {batchPrintConfirmInvoiceIds.length} fatture come "Stampate" dopo la stampa?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:flex-row gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  setBatchPrintMarkAsPrinted(false);
                  executeBatchPrint();
                }}
                disabled={batchPrintDialogLoading}
              >
                Stampa senza contrassegnare
              </Button>
              <Button
                variant="default"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  setBatchPrintMarkAsPrinted(true);
                  executeBatchPrint();
                }}
                disabled={batchPrintDialogLoading}
              >
                Stampa e contrassegna come "Stampate"
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Hidden file input for upload button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xml,.p7m"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFilesSelected(Array.from(e.target.files));
            }
          }}
        />

        {/* Upload Progress Tracker */}
        <UploadProgress
          jobId={jobId}
          onComplete={handleUploadComplete}
          onClose={stopTracking}
        />
      </div>
    </>
  );
}
