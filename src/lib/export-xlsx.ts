import * as XLSX from "xlsx";

export type ExportColumn<T> = {
  key: keyof T | string;
  header: string;
  format?: (row: T) => string | number;
};

export function exportToXlsx<T extends Record<string, unknown>>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
  sheetName = "Data",
) {
  const data = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      const key = String(col.key);
      const raw = col.format ? col.format(row) : (row[key] as string | number | undefined);
      out[col.header] = raw ?? "";
    }
    return out;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
