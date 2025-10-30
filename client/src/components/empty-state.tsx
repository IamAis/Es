import { FileX2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onUploadClick?: () => void;
}

export function EmptyState({ onUploadClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="empty-state">
      <div className="relative mb-6">
        <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
          <FileX2 className="w-16 h-16 text-primary" />
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-2">Nessuna fattura importata</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Inizia caricando i tuoi file XML o P7M delle fatture elettroniche.
        Verranno automaticamente convertiti in PDF per una visualizzazione ottimale.
      </p>
      {onUploadClick && (
        <Button onClick={onUploadClick} size="lg" data-testid="button-upload-first">
          <Upload className="w-4 h-4 mr-2" />
          Carica Fatture
        </Button>
      )}
    </div>
  );
}
