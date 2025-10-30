import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import type { Invoice } from "@shared/schema";

interface DeleteInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteInvoiceDialog({
  invoice,
  open,
  onOpenChange,
  onConfirm,
}: DeleteInvoiceDialogProps) {
  if (!invoice) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-delete-invoice">
        <AlertDialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            </div>
            <AlertDialogTitle className="text-xl">
              Elimina fattura?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-semibold text-foreground">
                {invoice.invoiceNumber}
              </p>
              <p className="text-sm">{invoice.supplierName}</p>
              <p className="text-sm text-muted-foreground">
                Data: {invoice.invoiceDate}
              </p>
            </div>
            <p className="text-amber-600 dark:text-amber-500 font-medium">
              Verranno eliminati sia il file XML originale che il PDF
              generato. Questa azione non può essere annullata.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">
            Annulla
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            variant="destructive"
            data-testid="button-confirm-delete"
          >
            Elimina
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
