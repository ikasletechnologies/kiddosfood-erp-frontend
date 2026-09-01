// Shared CSV/Excel/PDF export for the GST report pages. Every export here
// operates on the full filtered dataset already held in the page's state —
// never a paginated slice, since these reports don't paginate.
import * as XLSX from "xlsx";

export type ExportCell = string | number;

function downloadBlob(filename: string, blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCsv(filename: string, headers: string[], rows: ExportCell[][]) {
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}

export function exportExcel(filename: string, sheetName: string, title: string, headers: string[], rows: ExportCell[][]) {
  const aoa: ExportCell[][] = [[title], [], headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportPdf(filename: string, title: string, subtitle: string, headers: string[], rows: ExportCell[][]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const colWidth = contentWidth / headers.length;
  const rowHeight = 6;

  let y = margin;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 6;
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, margin, y);
    y += 6;
  }
  y += 2;

  const drawHeader = () => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => {
      doc.text(String(h), margin + i * colWidth + 1, y);
    });
    y += rowHeight;
    doc.setDrawColor(200);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);
    doc.setFont("helvetica", "normal");
  };

  drawHeader();

  rows.forEach((row) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    row.forEach((cell, i) => {
      const text = typeof cell === "number" ? cell.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(cell ?? "");
      doc.text(text, margin + i * colWidth + 1, y, { maxWidth: colWidth - 2 });
    });
    y += rowHeight;
  });

  doc.save(filename);
}
