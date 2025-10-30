import { useState, useRef } from "react";
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
  CheckCircle,
  Clock,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadZone } from "@/components/upload-zone";
import { InvoiceTable } from "@/components/invoice-table";
import { EmptyState } from "@/components/empty-state";
import { PDFViewer } from "@/components/pdf-viewer";
import { DeleteInvoiceDialog } from "@/components/delete-invoice-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Invoice } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      return apiRequest("POST", "/api/invoices/upload", formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Importazione completata",
        description: "Le fatture sono state importate e convertite in PDF",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore importazione",
        description: error.message || "Si è verificato un errore",
        variant: "destructive",
      });
    },
  });

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
      toast({
        title: "Fattura eliminata",
        description: "La fattura è stata eliminata correttamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore eliminazione",
        description: error.message || "Si è verificato un errore",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/invoices/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Stato aggiornato",
        description: "Lo stato della fattura è stato aggiornato",
      });
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

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      !searchQuery ||
      invoice.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: invoices.length,
    received: invoices.filter((i) => i.status === "received").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
  };

  const handleFilesSelected = (files: File[]) => {
    uploadMutation.mutate(files);
  };

  const handleDownloadXML = (invoice: Invoice) => {
    window.open(`/api/invoices/${invoice.id}/xml/download`, "_blank");
  };

  const handleDownloadPDF = (invoice: Invoice) => {
    window.open(`/api/invoices/${invoice.id}/pdf/download`, "_blank");
  };

  const handlePrint = (invoice: Invoice) => {
    const printWindow = window.open(`/api/invoices/${invoice.id}/pdf`, "_blank");
    printWindow?.addEventListener("load", () => {
      printWindow.print();
    });
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    // For simplicity, delete first selected invoice
    const invoice = invoices.find((i) => i.id === selectedIds[0]);
    if (invoice) {
      setInvoiceToDelete(invoice);
    }
  };

  const handleBatchDownloadXML = () => {
    selectedIds.forEach((id) => {
      const invoice = invoices.find((i) => i.id === id);
      if (invoice) handleDownloadXML(invoice);
    });
  };

  const handleBatchDownloadPDF = () => {
    selectedIds.forEach((id) => {
      const invoice = invoices.find((i) => i.id === id);
      if (invoice) handleDownloadPDF(invoice);
    });
  };

  return (
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
          <ThemeToggle />
        </div>
      </header>

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
                variant={statusFilter === "all" ? "default" : "ghost"}
                className="w-full justify-between"
                onClick={() => setStatusFilter("all")}
                data-testid="filter-all"
              >
                <span>Tutte le fatture</span>
                <Badge variant="secondary" className="ml-2" data-testid="badge-count-all">
                  {stats.total}
                </Badge>
              </Button>
              <Button
                variant={statusFilter === "received" ? "default" : "ghost"}
                className="w-full justify-between"
                onClick={() => setStatusFilter("received")}
                data-testid="filter-received"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Da pagare
                </span>
                <Badge variant="secondary" className="ml-2" data-testid="badge-count-received">
                  {stats.received}
                </Badge>
              </Button>
              <Button
                variant={statusFilter === "paid" ? "default" : "ghost"}
                className="w-full justify-between"
                onClick={() => setStatusFilter("paid")}
                data-testid="filter-paid"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Pagate
                </span>
                <Badge variant="secondary" className="ml-2" data-testid="badge-count-paid">
                  {stats.paid}
                </Badge>
              </Button>
            </div>
          </div>

          {/* Storage Stats */}
          <div className="mt-auto pt-6 border-t border-sidebar-border">
            <div className="space-y-1">
              <p className="text-sm font-semibold" data-testid="text-total-invoices">{stats.total} fatture</p>
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
                  onDelete={setInvoiceToDelete}
                />
              )}
            </div>
          </ScrollArea>

          {/* Batch Actions Toolbar */}
          {selectedIds.length > 0 && (
            <div className="border-t bg-card p-4">
              <div className="flex items-center justify-between max-w-4xl mx-auto">
                <span className="text-sm font-medium" data-testid="text-selected-count">
                  {selectedIds.length} fatture selezionate
                </span>
                <div className="flex items-center gap-2">
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
          <div className="w-[480px] flex-shrink-0">
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
    </div>
  );
}
