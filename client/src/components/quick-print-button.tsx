import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Printer } from "lucide-react";

interface QuickPrintButtonProps {
  onClick: () => void;
  disabled?: boolean;
  invoiceNumber?: string;
}

export function QuickPrintButton({
  onClick,
  disabled = false,
  invoiceNumber = "",
}: QuickPrintButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            disabled={disabled}
            className="h-8 w-8 hover:bg-primary/10"
          >
            <Printer className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Stampa {invoiceNumber ? `${invoiceNumber}` : "Fattura"}</p>
          <p className="text-xs text-muted-foreground">Shortcut: Ctrl + P</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
