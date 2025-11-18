import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Download,
  Upload,
  Check,
  AlertTriangle,
  Database,
  Loader2,
} from "lucide-react";

interface BackupStatus {
  status: string;
  invoices: {
    total: number;
    byStatus: {
      printed: number;
      not_printed: number;
    };
  };
  storage: {
    xml: { count: number; size: number; sizeHuman: string };
    html: { count: number; size: number; sizeHuman: string };
    pdf: { count: number; size: number; sizeHuman: string };
    total: { size: number; sizeHuman: string };
  };
  lastBackup: string | null;
  timestamp: string;
}

interface ImportResponse {
  success: boolean;
  message: string;
  imported: number;
  errors?: string[];
  manifest?: {
    version: string;
    timestamp: string;
    appName: string;
    totalInvoices: number;
    exportedAt: string;
  };
}

export function BackupRestore() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Query per ottenere lo stato del backup
  const { data: backupStatus, isLoading: statusLoading, refetch } = useQuery<
    BackupStatus
  >({
    queryKey: ["backup-status"],
    queryFn: async () => {
      const response = await fetch("/api/backup/status");
      if (!response.ok) throw new Error("Failed to fetch backup status");
      return response.json();
    },
    enabled: open,
  });

  // Mutation per esportare backup
  const exportBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/backup/export");
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();

      // Crea un link di download e lo clicca automaticamente
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      a.download = `app-fatture-backup-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (error) => {
      console.error("Export failed:", error);
    },
  });

  // Mutation per importare backup
  const importBackupMutation = useMutation({
    mutationFn: async (file: File): Promise<ImportResponse> => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/backup/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUploading(false);
      setUploadProgress(0);

      // Mostra il risultato
      const message =
        data.errors && data.errors.length > 0
          ? `Importati ${data.imported} file con ${data.errors.length} errori`
          : `Importati ${data.imported} file con successo`;

      alert(message + "\n\nRiavvia l'applicazione per completare il ripristino.");
      setOpen(false);
      refetch();
    },
    onError: (error: any) => {
      setUploading(false);
      setUploadProgress(0);
      alert(`Errore durante l'importazione: ${error.message}`);
    },
  });

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(10);

    // Simula il progresso dell'upload
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 20;
      });
    }, 200);

    try {
      await importBackupMutation.mutateAsync(file);
      clearInterval(interval);
      setUploadProgress(100);
    } catch (error) {
      clearInterval(interval);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="w-4 h-4" />
          Backup
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Backup e Ripristino Dati</DialogTitle>
          <DialogDescription>
            Esporta i tuoi dati per il backup o per trasferire su un altro PC
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Esporta</TabsTrigger>
            <TabsTrigger value="import">Importa</TabsTrigger>
          </TabsList>

          {/* TAB EXPORT */}
          <TabsContent value="export" className="space-y-4">
            {statusLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : backupStatus ? (
              <>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600 mb-1">
                        Fatture totali
                      </p>
                      <p className="text-2xl font-bold">
                        {backupStatus.invoices.total}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        📄 Stampate:{" "}
                        {backupStatus.invoices.byStatus.printed}
                        <br />
                        📋 Non stampate:{" "}
                        {backupStatus.invoices.byStatus.not_printed}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600 mb-1">
                        Spazio totale
                      </p>
                      <p className="text-2xl font-bold">
                        {backupStatus.storage.total.sizeHuman}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        XML: {backupStatus.storage.xml.sizeHuman}
                        <br />
                        HTML: {backupStatus.storage.html.sizeHuman}
                        <br />
                        PDF: {backupStatus.storage.pdf.sizeHuman}
                      </p>
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      L'esportazione creerà un file ZIP contenente:
                      <ul className="mt-2 ml-4 list-disc text-sm">
                        <li>Metadati di tutte le fatture</li>
                        <li>
                          {backupStatus.storage.xml.count} file XML originali
                        </li>
                        <li>
                          {backupStatus.storage.html.count} file HTML
                          (renderizzati)
                        </li>
                        <li>
                          {backupStatus.storage.pdf.count} file PDF (generati)
                        </li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={() => exportBackupMutation.mutate()}
                    disabled={exportBackupMutation.isPending}
                    className="w-full gap-2"
                  >
                    {exportBackupMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Esportazione in corso...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Scarica Backup
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : null}
          </TabsContent>

          {/* TAB IMPORT */}
          <TabsContent value="import" className="space-y-4">
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                L'importazione sovrascriverà i dati attuali. Un backup dei dati
                correnti verrà creato automaticamente.
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              {uploading ? (
                <div className="space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-600" />
                  <p className="text-sm text-slate-600">
                    Importazione in corso...
                  </p>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-xs text-slate-500">
                    {Math.round(uploadProgress)}%
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600 mb-4">
                    Seleziona un file di backup (.zip) da importare
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    onClick={handleImportClick}
                    disabled={uploading}
                    variant="outline"
                  >
                    Seleziona file
                  </Button>
                </>
              )}
            </div>

            <Alert>
              <Check className="w-4 h-4" />
              <AlertDescription>
                <strong>Dopo l'importazione:</strong>
                <ul className="mt-2 ml-4 list-disc text-sm space-y-1">
                  <li>Riavvia l'applicazione</li>
                  <li>
                    I dati precedenti saranno salvati in backup automaticamente
                  </li>
                  <li>
                    Se qualcosa va storto, puoi ripristinare il backup precedente
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
