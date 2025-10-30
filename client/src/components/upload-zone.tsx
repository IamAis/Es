import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
}

export function UploadZone({ onFilesSelected, isUploading }: UploadZoneProps) {
  const { toast } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter((file) => {
        const isXML = file.name.toLowerCase().endsWith(".xml");
        const isP7M = file.name.toLowerCase().endsWith(".p7m");
        const isXMLP7M = file.name.toLowerCase().endsWith(".xml.p7m");
        
        if (!isXML && !isP7M && !isXMLP7M) {
          toast({
            title: "Formato non valido",
            description: `${file.name} non è un file XML o P7M`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [onFilesSelected, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/xml": [".xml"],
      "application/pkcs7-mime": [".p7m"],
    },
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      data-testid="upload-zone"
      className={`
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
        transition-all duration-200
        ${
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50 hover-elevate"
        }
        ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input {...getInputProps()} data-testid="upload-input" />
      <div className="flex flex-col items-center gap-3">
        {isDragActive ? (
          <>
            <Upload className="w-12 h-12 text-primary animate-pulse" />
            <p className="text-base font-semibold text-primary">
              Rilascia i file qui...
            </p>
          </>
        ) : (
          <>
            <FileText className="w-12 h-12 text-primary" />
            <div>
              <p className="text-base font-semibold text-foreground mb-1">
                Trascina file XML o P7M
              </p>
              <p className="text-sm text-muted-foreground">
                oppure clicca per selezionare
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Supporta .xml, .xml.p7m, .p7m
            </p>
          </>
        )}
      </div>
    </div>
  );
}
