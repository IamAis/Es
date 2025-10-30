import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Eye, Download, Printer, Trash2 } from "lucide-react";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import type { Invoice } from "@shared/schema";

interface InvoiceTableProps {
  invoices: Invoice[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onDownloadXML: (invoice: Invoice) => void;
  onDownloadPDF: (invoice: Invoice) => void;
  onPrint: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

export function InvoiceTable({
  invoices,
  selectedIds,
  onSelectionChange,
  onViewInvoice,
  onDownloadXML,
  onDownloadPDF,
  onPrint,
  onDelete,
}: InvoiceTableProps) {
  const [sortBy, setSortBy] = useState<keyof Invoice | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(invoices.map((inv) => inv.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "€0,00";
    const num = parseFloat(amount);
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd MMM yyyy", { locale: it });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.length === invoices.length && invoices.length > 0}
                onCheckedChange={toggleSelectAll}
                data-testid="checkbox-select-all"
              />
            </TableHead>
            <TableHead className="w-32 font-semibold text-xs uppercase tracking-wide">
              Numero
            </TableHead>
            <TableHead className="font-semibold text-xs uppercase tracking-wide">
              Fornitore
            </TableHead>
            <TableHead className="w-32 font-semibold text-xs uppercase tracking-wide">
              Data
            </TableHead>
            <TableHead className="w-32 font-semibold text-xs uppercase tracking-wide text-right">
              Importo
            </TableHead>
            <TableHead className="w-32 font-semibold text-xs uppercase tracking-wide">
              Stato
            </TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow
              key={invoice.id}
              className="hover-elevate cursor-pointer group"
              onClick={() => onViewInvoice(invoice)}
              data-testid={`row-invoice-${invoice.id}`}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.includes(invoice.id)}
                  onCheckedChange={() => toggleSelect(invoice.id)}
                  data-testid={`checkbox-invoice-${invoice.id}`}
                />
              </TableCell>
              <TableCell className="font-medium font-mono text-sm" data-testid={`text-invoice-number-${invoice.id}`}>
                {invoice.invoiceNumber}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-sm" data-testid={`text-supplier-${invoice.id}`}>
                    {invoice.supplierName}
                  </span>
                  {invoice.supplierVat && (
                    <span className="text-xs text-muted-foreground" data-testid={`text-vat-${invoice.id}`}>
                      P.IVA {invoice.supplierVat}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm" data-testid={`text-date-${invoice.id}`}>
                {formatDate(invoice.invoiceDate)}
              </TableCell>
              <TableCell className="text-right font-semibold text-sm" data-testid={`text-amount-${invoice.id}`}>
                {formatCurrency(invoice.totalAmount)}
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={invoice.status as any} />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-actions-${invoice.id}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                      <span className="sr-only">Azioni</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewInvoice(invoice)} data-testid={`action-view-${invoice.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      Visualizza PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDownloadXML(invoice)} data-testid={`action-download-xml-${invoice.id}`}>
                      <Download className="w-4 h-4 mr-2" />
                      Scarica XML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDownloadPDF(invoice)} data-testid={`action-download-pdf-${invoice.id}`}>
                      <Download className="w-4 h-4 mr-2" />
                      Scarica PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPrint(invoice)} data-testid={`action-print-${invoice.id}`}>
                      <Printer className="w-4 h-4 mr-2" />
                      Stampa
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(invoice)}
                      className="text-destructive"
                      data-testid={`action-delete-${invoice.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
