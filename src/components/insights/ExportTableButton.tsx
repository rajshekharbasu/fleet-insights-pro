import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToXlsx, type ExportColumn } from "@/lib/export-xlsx";

export function ExportTableButton<T extends Record<string, unknown>>({
  filename,
  columns,
  rows,
  label = "Export XLS",
  size = "sm",
}: {
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  label?: string;
  size?: "sm" | "default";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className="h-8 gap-1.5 rounded-lg border-border/60 bg-card/50 text-[11px]"
      onClick={() => exportToXlsx(filename, columns, rows)}
      disabled={!rows.length}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
