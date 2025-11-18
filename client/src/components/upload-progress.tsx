import { useEffect, useState, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, FileText, X } from "lucide-react";

interface UploadProgressData {
  jobId: string;
  total: number;
  completed: number;
  failed: number;
  status: "preparing" | "processing" | "completed" | "failed";
  currentFile: string;
  results?: any[];
  errors?: any[];
}

interface UploadProgressProps {
  jobId: string | null;
  onComplete?: (data: UploadProgressData) => void;
  onClose?: () => void;
}

export function UploadProgress({
  jobId,
  onComplete,
  onClose,
}: UploadProgressProps) {
  const [progress, setProgress] = useState<UploadProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(
    null,
  );

  const progressRef = useRef(progress);
  progressRef.current = progress;

  const hasCompletedRef = useRef(hasCompleted);
  hasCompletedRef.current = hasCompleted;

  useEffect(() => {
    if (!jobId) {
      setProgress(null);
      setIsConnected(false);
      setHasCompleted(false);
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      return;
    }

    // Show preparing state immediately
    if (!progressRef.current) {
      setProgress({
        jobId,
        total: 0,
        completed: 0,
        failed: 0,
        status: "preparing",
        currentFile: "Preparazione upload...",
      });
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    let isConnecting = false;

    const connect = () => {
      // Prevent multiple simultaneous connection attempts
      if (isConnecting) {
        return;
      }

      // Stop reconnecting if completed or failed
      if (
        progressRef.current?.status === "completed" ||
        progressRef.current?.status === "failed"
      ) {
        return;
      }

      // Limit reconnection attempts
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error("Max reconnection attempts reached for job:", jobId);
        return;
      }

      isConnecting = true;

      try {
        eventSource = new EventSource(`/api/invoices/upload/progress/${jobId}`);

        eventSource.onopen = () => {
          setIsConnected(true);
          isConnecting = false;
          reconnectAttempts = 0; // Reset on successful connection
          console.log("SSE connection opened for job:", jobId);
        };

        eventSource.onmessage = (event) => {
          try {
            const data: any = JSON.parse(event.data);

            if (data.error) {
              console.error("Progress error:", data.error);
              if (onClose) {
                onClose();
              }
              return;
            }

            setProgress(data as UploadProgressData);

            // Call onComplete when upload finishes
            if (
              (data.status === "completed" || data.status === "failed") &&
              !hasCompletedRef.current
            ) {
              setHasCompleted(true);
              if (onComplete) {
                onComplete(data);
              }
              
              // Auto-close after 5 seconds only for successful uploads
              if (data.status === "completed" && onClose) {
                const timer = setTimeout(() => {
                  onClose();
                }, 5000);
                setAutoCloseTimer(timer);
              }
            }
          } catch (error) {
            console.error("Error parsing SSE data:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE connection error:", error);
          setIsConnected(false);
          isConnecting = false;
          eventSource?.close();

          // Only retry if still processing and haven't exceeded max attempts
          if (
            progressRef.current?.status === "processing" &&
            reconnectAttempts < MAX_RECONNECT_ATTEMPTS
          ) {
            reconnectAttempts++;
            const delay = Math.min(2000 * reconnectAttempts, 10000); // Exponential backoff, max 10s
            console.log(
              `Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
            );
            reconnectTimeout = setTimeout(() => {
              connect();
            }, delay);
          }
        };
      } catch (error) {
        console.error("Error creating EventSource:", error);
        isConnecting = false;
      }
    };

    connect();

    // Cleanup
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
      }
    };
  }, [jobId, onComplete, onClose]);

  if (!jobId) {
    return null;
  }

  // Show preparing state if no progress yet
  if (!progress) {
    return (
      <Card className="fixed bottom-4 right-4 w-96 p-4 shadow-lg border-2 z-50 animate-in slide-in-from-bottom-5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <div>
            <h3 className="font-semibold text-sm">Preparazione Upload</h3>
            <p className="text-xs text-muted-foreground">
              Caricamento file in corso...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const percentage =
    progress.total > 0
      ? Math.round(
          ((progress.completed + progress.failed) / progress.total) * 100,
        )
      : 0;

  const getStatusColor = () => {
    switch (progress.status) {
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "preparing":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "preparing":
        return <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusLabel = () => {
    switch (progress.status) {
      case "completed":
        return "Completato";
      case "failed":
        return "Fallito";
      case "preparing":
        return "Preparazione";
      default:
        return "In elaborazione";
    }
  };

  // Calcolo tempo stimato rimanente
  const getEstimatedTimeRemaining = () => {
    if (progress.status !== "processing" || progress.completed === 0) {
      return null;
    }
    const processedCount = progress.completed + progress.failed;
    const avgTimePerFile = 1000; // ms per file (rough estimate)
    const remainingFiles = progress.total - processedCount;
    const estimatedMs = remainingFiles * avgTimePerFile;
    
    if (estimatedMs < 1000) return "meno di 1s";
    if (estimatedMs < 60000) return `~${Math.ceil(estimatedMs / 1000)}s`;
    return `~${Math.ceil(estimatedMs / 60000)}m`;
  };

  return (
    <Card className="fixed bottom-4 right-4 w-96 p-4 shadow-lg border-2 z-50 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <h3 className="font-semibold text-sm">Importazione Fatture</h3>
            <Badge
              variant={
                progress.status === "completed" ? "default" : "secondary"
              }
              className="text-xs"
            >
              {getStatusLabel()}
            </Badge>
          </div>
        </div>
        {(progress.status === "completed" || progress.status === "failed") &&
          onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
      </div>

      <div className="space-y-3">
        {/* Progress Bar */}
        {progress.status !== "preparing" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        )}

        {/* Preparing Message */}
        {progress.status === "preparing" && (
          <div className="text-xs p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
            <p className="text-yellow-700 dark:text-yellow-300 font-medium">
              ⏳ Preparazione upload in corso...
            </p>
            <p className="text-muted-foreground mt-1">
              Caricamento file sul server
            </p>
          </div>
        )}

        {/* Statistics */}
        {progress.status !== "preparing" && progress.total > 0 && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-muted rounded">
              <div className="font-semibold text-lg">{progress.total}</div>
              <div className="text-muted-foreground">Totale</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="font-semibold text-lg text-green-600 dark:text-green-400">
                {progress.completed}
              </div>
              <div className="text-muted-foreground">Completati</div>
            </div>
            {progress.failed > 0 && (
              <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded">
                <div className="font-semibold text-lg text-red-600 dark:text-red-400">
                  {progress.failed}
                </div>
                <div className="text-muted-foreground">Falliti</div>
              </div>
            )}
          </div>
        )}

        {/* Current File */}
        {(progress.status === "processing" ||
          progress.status === "preparing") &&
          progress.currentFile && (
            <div className="flex items-center gap-2 text-xs p-2 bg-blue-50 dark:bg-blue-950 rounded">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="truncate text-muted-foreground">
                <span className="font-medium text-foreground">Elaborando:</span>{" "}
                {progress.currentFile}
              </span>
            </div>
          )}

        {/* Connection Status */}
        {!isConnected && progress.status === "processing" && (
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Riconnessione in corso...</span>
          </div>
        )}

        {/* Estimated Time Remaining */}
        {progress.status === "processing" && 
          progress.total > 0 && 
          getEstimatedTimeRemaining() && (
          <div className="text-xs text-muted-foreground text-center">
            ⏱️ Tempo stimato: {getEstimatedTimeRemaining()}
          </div>
        )}

        {/* Completion Messages */}
        {progress.status === "completed" && (
          <div className="text-xs p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
            <p className="text-green-700 dark:text-green-300 font-medium">
              ✓ {progress.completed}{" "}
              {progress.completed === 1
                ? "fattura importata"
                : "fatture importate"}{" "}
              con successo!
            </p>
            {progress.failed > 0 && (
              <p className="text-amber-600 dark:text-amber-400 mt-1">
                {progress.failed}{" "}
                {progress.failed === 1 ? "fallita" : "fallite"}
              </p>
            )}
          </div>
        )}

        {progress.status === "failed" && (
          <div className="text-xs p-2 bg-red-50 dark:bg-red-950 rounded border border-red-200 dark:border-red-800">
            <p className="text-red-700 dark:text-red-300 font-medium">
              ✗ Errore durante l'importazione
            </p>
            {progress.errors && progress.errors.length > 0 && (
              <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                {progress.errors
                  .slice(0, 3)
                  .map((error: any, index: number) => (
                    <p key={index} className="text-red-600 dark:text-red-400">
                      • {error.filename}: {error.error}
                    </p>
                  ))}
                {progress.errors.length > 3 && (
                  <p className="text-red-500 dark:text-red-400">
                    ... e altri {progress.errors.length - 3} errori
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Processing Status - remaining files */}
        {progress.status === "processing" && progress.completed > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {progress.total - progress.completed - progress.failed} fatture
            rimanenti
          </div>
        )}
      </div>
    </Card>
  );
}

// Hook per gestire facilmente l'upload progress
export function useUploadProgress() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const startTracking = (newJobId: string) => {
    setJobId(newJobId);
    setIsUploading(true);
  };

  const stopTracking = () => {
    setJobId(null);
    setIsUploading(false);
  };

  const handleComplete = (data: any) => {
    // Keep isUploading true until explicitly stopped
    // This prevents refetch spam during the completion phase
  };

  return {
    jobId,
    isUploading,
    startTracking,
    stopTracking,
    handleComplete,
  };
}
