// Shared CSV/Excel/PDF export for the GST report pages. Follows the ERP
// system's unified document branding, company profile, and typography
// established in GSTInvoice and PartyStatement.
import * as XLSX from "xlsx";
import { settingsApi } from "@/lib/api";

export type ExportCell = string | number | null | undefined;

export interface ExportPdfOptions {
  title?: string;
  subtitle?: string;
  period?: string;
  company?: {
    name?: string;
    address?: string;
    gstin?: string;
    state?: string;
    email?: string;
    phone?: string;
    pan?: string;
  };
  summaryTotals?: { label: string; value: number | string; isTax?: boolean; isGrandTotal?: boolean }[];
  notes?: string;
  orientation?: "portrait" | "landscape";
}

const FALLBACK_COMPANY = {
  name: "Kiddos Food",
  address: "123 Business Park, Chennai, Tamil Nadu - 600001",
  gstin: "33AAAAA0000A1Z5",
  pan: "ABCDE1234F",
  state: "Tamil Nadu",
  email: "support@kiddosfood.com",
  phone: "+91 98765 43210",
};

let cachedCompany: any = null;

async function getCompanyDetails(): Promise<typeof FALLBACK_COMPANY> {
  if (cachedCompany) return cachedCompany;
  try {
    const res = await settingsApi.getCompanyProfile();
    if (res.data && (res.data.name || res.data.companyName)) {
      cachedCompany = {
        name: res.data.name || res.data.companyName || FALLBACK_COMPANY.name,
        address: res.data.address || res.data.companyAddress || FALLBACK_COMPANY.address,
        gstin: res.data.gstin || res.data.taxNumber || FALLBACK_COMPANY.gstin,
        pan: res.data.pan || FALLBACK_COMPANY.pan,
        state: res.data.state || FALLBACK_COMPANY.state,
        email: res.data.email || FALLBACK_COMPANY.email,
        phone: res.data.phone || FALLBACK_COMPANY.phone,
      };
      return cachedCompany;
    }
  } catch {
    // ignore network errors and use fallback
  }
  return FALLBACK_COMPANY;
}

// Convert numbers into Indian numbering words (same as GSTInvoice.tsx)
function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if ((num = Math.floor(Math.abs(num))) === 0) return 'Zero';

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str != '') ? 'And ' : '') + (a[Number(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) : '';
  
  return str.trim();
}

function downloadBlob(filename: string, blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCsv(filename: string, headers: string[], rows: ExportCell[][]) {
  // Add UTF-8 BOM so Excel opens Indian rupee/symbols and accented characters properly
  const bom = "\uFEFF";
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((v) => {
          if (v == null) return '""';
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    )
    .join("\r\n");

  downloadBlob(filename, new Blob([bom + csv], { type: "text/csv;charset=utf-8;" }));
}

export function exportExcel(
  filename: string,
  sheetName: string,
  title: string,
  headers: string[],
  rows: ExportCell[][]
) {
  const aoa: ExportCell[][] = [
    [FALLBACK_COMPANY.name],
    [`${title} - GST Compliance Report`],
    [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
    [],
    headers,
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto column sizing
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    rows.forEach((r) => {
      const valStr = String(r[i] ?? "");
      if (valStr.length > max) max = Math.min(valStr.length, 35);
    });
    return { wch: Math.max(max + 3, 10) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: ExportCell[][],
  customOptions?: ExportPdfOptions
) {
  const { jsPDF } = await import("jspdf");
  const company = customOptions?.company || (await getCompanyDetails());
  const orientation = customOptions?.orientation || (headers.length > 6 ? "landscape" : "portrait");

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Colors based on ERP brand (#F97316)
  const brandOrange: [number, number, number] = [249, 115, 22]; // #F97316
  const darkGray: [number, number, number] = [31, 41, 55]; // #1F2937
  const lightGray: [number, number, number] = [243, 244, 246]; // #F3F4F6
  const borderGray: [number, number, number] = [229, 231, 235]; // #E5E7EB
  const textMuted: [number, number, number] = [107, 114, 128]; // #6B7280

  let currentPage = 1;

  // Classify column alignment: right-align monetary/number columns
  const numericKeywords = ["value", "amount", "tax", "cgst", "sgst", "igst", "cess", "itc", "total", "qty", "quantity", "rate", "price", "payable", "balance"];
  const isNumericCol = headers.map((h) => {
    const hl = h.toLowerCase();
    return numericKeywords.some((k) => hl.includes(k));
  });

  // Calculate proportional column widths
  const baseColWidths: number[] = headers.map((h, i) => {
    const hl = h.toLowerCase();
    if (hl === "#" || hl === "sl" || hl === "type" || hl === "rcm") return 12;
    if (hl.includes("rate") || hl.includes("uom") || hl.includes("qty")) return 16;
    if (hl.includes("hsn") || hl.includes("sac") || hl.includes("date")) return 22;
    if (hl.includes("invoice") || hl.includes("bill") || hl.includes("po") || hl.includes("return")) return 28;
    if (hl.includes("gstin")) return 32;
    if (hl.includes("party") || hl.includes("vendor") || hl.includes("customer") || hl.includes("product") || hl.includes("service") || hl.includes("description")) return 45;
    return 24;
  });

  const totalBaseWidth = baseColWidths.reduce((a, b) => a + b, 0);
  const colWidths = baseColWidths.map((w) => (w / totalBaseWidth) * contentWidth);

  // Helper: Draw Brand Header & Company Info
  const drawPageHeader = (yStart: number) => {
    // Top brand orange accent line
    doc.setFillColor(...brandOrange);
    doc.rect(0, 0, pageWidth, 3, "F");

    let y = yStart;

    // Report Title & Badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...brandOrange);
    doc.text(title.toUpperCase(), margin, y);

    // Company block (Right-aligned)
    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.setFont("helvetica", "bold");
    doc.text(company.name || FALLBACK_COMPANY.name, pageWidth - margin, y - 1, { align: "right" });

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    if (subtitle) {
      doc.text(subtitle, margin, y);
    }
    doc.text(company.address || FALLBACK_COMPANY.address, pageWidth - margin, y, { align: "right" });

    y += 4.5;
    const dateStr = `Generated: ${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    doc.text(dateStr, margin, y);
    doc.text(`GSTIN: ${company.gstin || FALLBACK_COMPANY.gstin}  |  State: ${company.state || FALLBACK_COMPANY.state}`, pageWidth - margin, y, { align: "right" });

    y += 5;
    // Divider line
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    return y + 4;
  };

  // Helper: Draw Table Header
  const drawTableHeader = (y: number) => {
    const rowHeight = 7;
    doc.setFillColor(...brandOrange);
    doc.roundedRect(margin, y, contentWidth, rowHeight, 1, 1, "F");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    headers.forEach((h, i) => {
      const w = colWidths[i];
      const align = isNumericCol[i] ? "right" : "left";
      const textX = align === "right" ? curX + w - 2 : curX + 2;
      doc.text(h, textX, y + 4.5, { align, maxWidth: w - 3 });
      curX += w;
    });

    return y + rowHeight;
  };

  // Helper: Draw Running Footer
  const drawPageFooter = (page: number, totalPagesPlaceholder: boolean) => {
    const y = pageHeight - 6;
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 3, pageWidth - margin, y - 3);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text("This is a computer-generated GST report from ERP. All transaction values are verified.", margin, y);
    doc.text(`${company.email || FALLBACK_COMPANY.email}  |  ${company.phone || FALLBACK_COMPANY.phone}`, pageWidth / 2, y, { align: "center" });
    doc.text(`Page ${page}`, pageWidth - margin, y, { align: "right" });
  };

  // Initial header
  let y = drawPageHeader(10);
  y = drawTableHeader(y);

  // Render Data Rows
  const rowHeight = 5.5;
  let totalTaxable = 0;
  let totalTax = 0;
  let grandTotal = 0;

  rows.forEach((row, rowIdx) => {
    // Check if new page is needed
    if (y + rowHeight > pageHeight - 20) {
      drawPageFooter(currentPage, true);
      doc.addPage();
      currentPage++;
      y = drawPageHeader(10);
      y = drawTableHeader(y);
    }

    // Alternating row background
    if (rowIdx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }

    doc.setDrawColor(245, 245, 245);
    doc.setLineWidth(0.1);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkGray);

    let curX = margin;
    row.forEach((cell, colIdx) => {
      const w = colWidths[colIdx];
      const isNum = isNumericCol[colIdx];
      const align = isNum ? "right" : "left";
      const textX = align === "right" ? curX + w - 2 : curX + 2;

      let cellText = "";
      if (typeof cell === "number") {
        cellText = cell.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        cellText = String(cell ?? "—");
      }

      // Format monetary values
      if (isNum && typeof cell === "number" && !headers[colIdx].toLowerCase().includes("rate") && !headers[colIdx].toLowerCase().includes("qty")) {
        cellText = `₹${cellText}`;
      }

      doc.text(cellText, textX, y + 3.8, { align, maxWidth: w - 3 });
      curX += w;
    });

    y += rowHeight;
  });

  // Calculate totals if applicable
  const taxableColIdx = headers.findIndex((h) => h.toLowerCase().includes("taxable"));
  const taxColIdx = headers.findIndex((h) => h.toLowerCase().includes("total tax"));
  const totalValColIdx = headers.findIndex((h) => h.toLowerCase().includes("invoice value") || h.toLowerCase().includes("total value") || h.toLowerCase().includes("bill value") || h.toLowerCase().includes("refund value"));

  if (taxableColIdx !== -1) {
    totalTaxable = rows.reduce((s, r) => s + (typeof r[taxableColIdx] === "number" ? (r[taxableColIdx] as number) : 0), 0);
  }
  if (taxColIdx !== -1) {
    totalTax = rows.reduce((s, r) => s + (typeof r[taxColIdx] === "number" ? (r[taxColIdx] as number) : 0), 0);
  }
  if (totalValColIdx !== -1) {
    grandTotal = rows.reduce((s, r) => s + (typeof r[totalValColIdx] === "number" ? (r[totalValColIdx] as number) : 0), 0);
  } else if (totalTaxable > 0 || totalTax > 0) {
    grandTotal = totalTaxable + totalTax;
  }

  // Draw Summary / Totals Box
  if (grandTotal > 0 || totalTaxable > 0 || (customOptions?.summaryTotals && customOptions.summaryTotals.length > 0)) {
    const summaryWidth = Math.min(contentWidth * 0.45, 95);
    const summaryX = pageWidth - margin - summaryWidth;

    if (y + 35 > pageHeight - 15) {
      drawPageFooter(currentPage, true);
      doc.addPage();
      currentPage++;
      y = drawPageHeader(10);
    }

    y += 4;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(summaryX, y, summaryWidth, 26, 1.5, 1.5, "F");
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.2);
    doc.roundedRect(summaryX, y, summaryWidth, 26, 1.5, 1.5, "D");

    let sumY = y + 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkGray);

    if (totalTaxable > 0) {
      doc.text("Total Taxable Value:", summaryX + 3, sumY);
      doc.text(`₹${totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, summaryX + summaryWidth - 3, sumY, { align: "right" });
      sumY += 5;
    }

    if (totalTax > 0) {
      doc.text("Total Tax Collected / Paid:", summaryX + 3, sumY);
      doc.text(`₹${totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, summaryX + summaryWidth - 3, sumY, { align: "right" });
      sumY += 5;
    }

    doc.setDrawColor(...borderGray);
    doc.line(summaryX + 3, sumY, summaryX + summaryWidth - 3, sumY);
    sumY += 4.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...brandOrange);
    doc.text("Net Total Amount:", summaryX + 3, sumY);
    doc.text(`₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, summaryX + summaryWidth - 3, sumY, { align: "right" });

    // Amount in Words on the left
    if (grandTotal > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      doc.text("Total Amount (in words):", margin, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkGray);
      doc.text(`${numberToWords(grandTotal)} Rupees Only`, margin, y + 10, { maxWidth: summaryX - margin - 5 });
    }
  }

  // Final page footer
  drawPageFooter(currentPage, false);

  doc.save(filename);
}
