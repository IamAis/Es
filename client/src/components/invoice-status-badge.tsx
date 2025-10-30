import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

interface InvoiceStatusBadgeProps {
  status: "received" | "paid" | "overdue";
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const statusConfig = {
    received: {
      label: "RICEVUTA",
      className: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700",
      icon: Clock,
    },
    paid: {
      label: "PAGATA",
      className: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700",
      icon: CheckCircle,
    },
    overdue: {
      label: "SCADUTA",
      className: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700",
      icon: AlertCircle,
    },
  };

  const config = statusConfig[status];
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
