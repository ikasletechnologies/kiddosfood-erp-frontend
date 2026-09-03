import * as XLSX from "xlsx";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  format?: "currency" | "number" | "date" | "string";
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  subtitle?: string;
  columns: ExcelColumn[];
  data: Record<string, any>[];
  totals?: Record<string, any>;
  companyName?: string;
}

/**
 * Universal ERP Excel (.xlsx) Report Exporter
 * Creates cleanly formatted spreadsheet with metadata, headers, numeric formatting, totals, and auto column widths.
 */
export function exportReportToExcel({
  filename,
  sheetName = "Report",
  title,
  subtitle,
  columns,
  data,
  totals,
  companyName = "Kiddos Food ERP",
}: ExcelExportOptions) {
  const aoa: any[][] = [];

  // Metadata Header Block
  if (title) {
    aoa.push([companyName]);
    aoa.push([title]);
    if (subtitle) {
      aoa.push([`Period: ${subtitle}`]);
    }
    aoa.push([`Generated on: ${new Date().toLocaleString("en-IN")}`]);
    aoa.push([]); // blank row before table
  }

  // Column Headers
  aoa.push(columns.map((c) => c.header));

  // Data Rows
  data.forEach((row) => {
    const rowValues = columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined || val === "—") {
        return "";
      }
      if (col.format === "currency" || col.format === "number") {
        if (typeof val === "string") {
          const cleanNum = Number(val.replace(/[₹,]/g, "").trim());
          return isNaN(cleanNum) ? val : cleanNum;
        }
        return typeof val === "number" ? val : Number(val) || 0;
      }
      return val;
    });
    aoa.push(rowValues);
  });

  // Optional Totals Row
  if (totals) {
    const totalRow = columns.map((col, idx) => {
      if (idx === 0) return "Total";
      const totalVal = totals[col.key];
      if (totalVal !== undefined && totalVal !== null && totalVal !== "") {
        if (typeof totalVal === "string") {
          const cleanNum = Number(totalVal.replace(/[₹,]/g, "").trim());
          return isNaN(cleanNum) ? totalVal : cleanNum;
        }
        return typeof totalVal === "number" ? totalVal : Number(totalVal) || 0;
      }
      return "";
    });
    aoa.push(totalRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Dynamic Column Widths
  const colWidths = columns.map((col) => {
    let max = col.header.length;
    data.forEach((row) => {
      const val = row[col.key];
      const str = val !== null && val !== undefined ? String(val) : "";
      if (str.length > max) max = Math.min(str.length, 45);
    });
    if (col.width) return { wch: col.width };
    return { wch: Math.max(max + 3, 12) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  const cleanSheetName = (sheetName || "Report").replace(/[*?:/\\\[\]]/g, "").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);

  const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}
