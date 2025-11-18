import { Badge } from "@/components/ui/badge";
import { Printer, FileText, AlertCircle } from "lucide-react";

interface InvoiceStatusBadgeProps {
  status: string;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
    not_printed: {
      label: "NON STAMPATA",
      className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700",
      icon: FileText,
    },
    printed: {
      label: "STAMPATA",
      className: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700",
      icon: Printer,
    },
    // Legacy status mappings for backward compatibility
    received: {
      label: "NON STAMPATA",
      className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700",
      icon: FileText,
    },
    paid: {
      label: "STAMPATA",
      className: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700",
      icon: Printer,
    },
    overdue: {
      label: "NON STAMPATA",
      className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700",
      icon: FileText,
    },
  };

  // Fallback for unknown status values
  const config = statusConfig[status] || {
    label: "SCONOSCIUTO",
    className: "bg-gray-100 text-gray-900 dark:bg-gray-900/30 dark:text-gray-300 border-gray-300 dark:border-gray-700",
    icon: AlertCircle,
  };
  
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.className} text-xs font-semibold uppercase gap-1.5 no-default-hover-elevate no-default-active-elevate`}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}
