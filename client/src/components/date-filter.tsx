import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DateFilterProps {
  selectedYear: string;
  selectedMonth: string;
  onYearChange: (year: string) => void;
  onMonthChange: (month: string) => void;
  onInvoiceDateFromChange: (date: string) => void;
  onInvoiceDateToChange: (date: string) => void;
  onDueDateFromChange: (date: string) => void;
  onDueDateToChange: (date: string) => void;
  invoiceDateFrom: string;
  invoiceDateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
  availableYears: number[];
}

const MONTHS = [
  { value: "all", label: "Tutti i mesi" },
  { value: "01", label: "Gennaio" },
  { value: "02", label: "Febbraio" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Aprile" },
  { value: "05", label: "Maggio" },
  { value: "06", label: "Giugno" },
  { value: "07", label: "Luglio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Settembre" },
  { value: "10", label: "Ottobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Dicembre" },
];

export function DateFilter({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  onInvoiceDateFromChange,
  onInvoiceDateToChange,
  onDueDateFromChange,
  onDueDateToChange,
  invoiceDateFrom,
  invoiceDateTo,
  dueDateFrom,
  dueDateTo,
  availableYears,
}: DateFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    selectedYear !== "all" ||
    selectedMonth !== "all" ||
    invoiceDateFrom ||
    invoiceDateTo ||
    dueDateFrom ||
    dueDateTo;

  const handleResetFilters = () => {
    onYearChange("all");
    onMonthChange("all");
    onInvoiceDateFromChange("");
    onInvoiceDateToChange("");
    onDueDateFromChange("");
    onDueDateToChange("");
    setIsExpanded(false);
  };
  return (
    <Card className="p-4 mb-4">
      <div className="space-y-4">
        {/* Primary filters - always visible */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Filtra per periodo:</span>
          </div>

          <Select value={selectedYear} onValueChange={onYearChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Anno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli anni</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedMonth}
            onValueChange={onMonthChange}
            disabled={selectedYear === "all"}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Mese" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Nascondi filtri avanzati
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Filtri avanzati
              </>
            )}
          </Button>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Azzera filtri
            </button>
          )}
        </div>

        {/* Advanced filters - collapsible */}
        {isExpanded && (
          <div className="border-t pt-4 space-y-4">
            {/* Invoice Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium block">
                Data Fattura (dal - al):
              </label>
              <div className="flex gap-3 items-center">
                <Input
                  type="date"
                  value={invoiceDateFrom}
                  onChange={(e) => onInvoiceDateFromChange(e.target.value)}
                  className="flex-1"
                  placeholder="Da"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={invoiceDateTo}
                  onChange={(e) => onInvoiceDateToChange(e.target.value)}
                  className="flex-1"
                  placeholder="A"
                  min={invoiceDateFrom}
                />
              </div>
            </div>

            {/* Due Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium block">
                Data Scadenza (dal - al):
              </label>
              <div className="flex gap-3 items-center">
                <Input
                  type="date"
                  value={dueDateFrom}
                  onChange={(e) => onDueDateFromChange(e.target.value)}
                  className="flex-1"
                  placeholder="Da"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={dueDateTo}
                  onChange={(e) => onDueDateToChange(e.target.value)}
                  className="flex-1"
                  placeholder="A"
                  min={dueDateFrom}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
