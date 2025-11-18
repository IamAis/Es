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

interface DeleteBatchDialogProps {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteBatchDialog({
  count,
  open,
  onOpenChange,
  onConfirm,
}: DeleteBatchDialogProps) {
  if (count === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="dialog-delete-batch">
        <AlertDialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            </div>
            <AlertDialogTitle className="text-xl">
              Elimina {count} fatture?
            </AlertDialogTitle>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-semibold text-foreground">
                Stai per eliminare {count} fatture selezionate
              </p>
            </div>
            <p className="text-amber-600 dark:text-amber-500 font-medium">
              Verranno eliminati tutti i file XML originali e i PDF generati. 
              Questa azione non può essere annullata.
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-batch-delete">
            Annulla
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="button-confirm-batch-delete"
          >
            Elimina {count} fatture
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
