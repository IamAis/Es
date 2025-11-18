import { useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PDFGenerationProgressProps {
  isGenerating: boolean;
  progress: number;
  error: string | null;
  filename?: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
  showCard?: boolean;
}

export function PDFGenerationProgress({
  isGenerating,
  progress,
  error,
  filename = "documento.pdf",
  onComplete,
  onError,
  className,
  showCard = true,
}: PDFGenerationProgressProps) {
  // Chiama callback quando completato o in errore
  useEffect(() => {
    if (!isGenerating && progress === 100 && !error && onComplete) {
      onComplete();
    }
  }, [isGenerating, progress, error, onComplete]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  if (!isGenerating && !error && progress === 0) {
    return null;
  }

  const getStatusMessage = () => {
    if (error) {
      return "Errore nella generazione";
    }
    if (!isGenerating && progress === 100) {
      return "PDF generato con successo!";
    }
    if (progress < 33) {
      return "Trasformazione XML in HTML...";
    }
    if (progress < 66) {
      return "Generazione PDF da HTML...";
    }
    if (progress < 100) {
      return "Finalizzazione...";
    }
    return "Completato!";
  };

  const getStatusIcon = () => {
    if (error) {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (!isGenerating && progress === 100) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  };

  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {getStatusIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium leading-none">
            {getStatusMessage()}
          </p>
          {filename && !error && (
            <p className="text-xs text-muted-foreground mt-1">
              {filename}
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
        </div>
      </div>

      {!error && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {progress}%
          </p>
        </div>
      )}
    </div>
  );

  if (showCard) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="pt-6">{content}</CardContent>
      </Card>
    );
  }

  return <div className={cn("w-full", className)}>{content}</div>;
}

// Componente inline più compatto
export function PDFGenerationProgressInline({
  isGenerating,
  progress,
  error,
  className,
}: Pick<
  PDFGenerationProgressProps,
  "isGenerating" | "progress" | "error" | "className"
>) {
  if (!isGenerating && !error && progress === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            Generazione PDF... {progress}%
          </span>
        </>
      ) : error ? (
        <>
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive">Errore</span>
        </>
      ) : progress === 100 ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-600 dark:text-green-400">
            Completato
          </span>
        </>
      ) : null}
    </div>
  );
}

// Badge con stato
export function PDFGenerationBadge({
  isGenerating,
  progress,
  error,
}: Pick<PDFGenerationProgressProps, "isGenerating" | "progress" | "error">) {
  if (!isGenerating && !error && progress === 0) {
    return null;
  }

  const getVariant = () => {
    if (error) return "destructive";
    if (!isGenerating && progress === 100) return "default";
    return "secondary";
  };

  const getText = () => {
    if (error) return "Errore";
    if (!isGenerating && progress === 100) return "Completato";
    return `Generazione... ${progress}%`;
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        error
          ? "bg-destructive/10 text-destructive"
          : !isGenerating && progress === 100
            ? "bg-green-500/10 text-green-600 dark:text-green-400"
            : "bg-primary/10 text-primary"
      )}
    >
      {isGenerating ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : error ? (
        <XCircle className="h-3 w-3" />
      ) : (
        <CheckCircle className="h-3 w-3" />
      )}
      {getText()}
    </div>
  );
}

// Toast-like floating notification
export function PDFGenerationToast({
  isGenerating,
  progress,
  error,
  filename,
  onClose,
}: PDFGenerationProgressProps & { onClose?: () => void }) {
  if (!isGenerating && !error && progress === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 animate-in slide-in-from-bottom-5">
      <Card className="shadow-lg border-2">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : error ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm font-semibold">
                  {error
                    ? "Errore generazione PDF"
                    : !isGenerating && progress === 100
                      ? "PDF generato!"
                      : "Generazione PDF"}
                </span>
              </div>

              {filename && !error && (
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <FileDown className="h-3 w-3" />
                  {filename}
                </p>
              )}

              {error && (
                <p className="text-xs text-destructive mb-2">{error}</p>
              )}

              {!error && <Progress value={progress} className="h-1.5" />}
            </div>

            {onClose && !isGenerating && (
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Chiudi"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
