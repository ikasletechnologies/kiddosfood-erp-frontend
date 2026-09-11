import { formatDate } from "@/lib/utils";

export interface RecipeExportData {
  id?: string;
  name: string;
  recipeCode?: string;
  product?: { name?: string; sku?: string };
  yieldQty?: number;
  yieldUnit?: string;
  batchSize?: number;
  instructions?: string;
  recipeItems?: Array<{
    id?: string;
    inventoryItem?: { name?: string; sku?: string; unit?: string };
    name?: string;
    materialName?: string;
    quantityRequired?: number | string;
    quantity?: number | string;
    unit?: string;
  }>;
}

export async function exportRecipeToPdf(recipe: RecipeExportData): Promise<void> {
  if (!recipe || !recipe.name) {
    throw new Error("Invalid recipe data provided for PDF export.");
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const brandOrange: [number, number, number] = [245, 130, 32];
  const darkSlate: [number, number, number] = [15, 23, 42];
  const mutedText: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [248, 250, 252];
  const borderGray: [number, number, number] = [226, 232, 240];

  let currentY = margin;

  // 1. Top Brand Accent Line
  doc.setFillColor(...brandOrange);
  doc.rect(0, 0, pageWidth, 4, "F");

  currentY += 4;

  // 2. Header Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...darkSlate);
  doc.text(recipe.name.toUpperCase(), margin, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...mutedText);
  const genDateStr = `Generated: ${formatDate(new Date())}`;
  doc.text(genDateStr, pageWidth - margin, currentY + 6, { align: "right" });

  currentY += 10;

  // Horizontal Divider
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // 3. Stats / Summary Cards (3 Columns)
  const cardWidth = (contentWidth - 8) / 3;
  const cardHeight = 18;

  const drawStatCard = (x: number, label: string, value: string) => {
    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderGray);
    doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedText);
    doc.text(label.toUpperCase(), x + 4, currentY + 6);

    doc.setFontSize(11);
    doc.setTextColor(...darkSlate);
    doc.text(value, x + 4, currentY + 13);
  };

  const yieldText = `${recipe.yieldQty ?? 1} ${recipe.yieldUnit || "Units"}`;
  const batchText = `${recipe.batchSize || 1} ${recipe.yieldUnit || recipe.recipeItems?.[0]?.unit || "KG"}`;
  const compText = `${recipe.recipeItems?.length || 0} Materials`;

  drawStatCard(margin, "Yield Output", yieldText);
  drawStatCard(margin + cardWidth + 4, "Batch Configuration", batchText);
  drawStatCard(margin + (cardWidth + 4) * 2, "Total Components", compText);

  currentY += cardHeight + 10;

  // 4. Bill of Materials Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...brandOrange);
  doc.text("BILL OF MATERIALS (FORMULA)", margin, currentY);

  currentY += 4;

  const cols = [
    { header: "#", width: 12, align: "center" as const },
    { header: "Ingredient / Raw Material", width: 96, align: "left" as const },
    { header: "Required Qty", width: 38, align: "right" as const },
    { header: "Unit", width: 36, align: "right" as const },
  ];

  // Table Header
  const headerHeight = 7;
  doc.setFillColor(...brandOrange);
  doc.rect(margin, currentY, contentWidth, headerHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);

  let headerX = margin;
  cols.forEach(col => {
    const textX = col.align === "right" ? headerX + col.width - 3 : (col.align === "center" ? headerX + col.width / 2 : headerX + 3);
    doc.text(col.header, textX, currentY + 4.8, { align: col.align });
    headerX += col.width;
  });

  currentY += headerHeight;

  // Table Rows
  const items = recipe.recipeItems || [];

  if (items.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...borderGray);
    doc.rect(margin, currentY, contentWidth, 8, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...mutedText);
    doc.text("No ingredients specified for this recipe.", margin + contentWidth / 2, currentY + 5.5, { align: "center" });
    currentY += 8;
  } else {
    items.forEach((item, idx) => {
      // Check for page overflow
      if (currentY + 10 > pageHeight - 25) {
        doc.addPage();
        currentY = margin + 4;
      }

      const rowHeight = 7.5;
      const isEven = idx % 2 === 0;

      if (isEven) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(...lightBg);
      }

      doc.setDrawColor(...borderGray);
      doc.rect(margin, currentY, contentWidth, rowHeight, "FD");

      const matName = item.inventoryItem?.name || item.name || item.materialName || "Unknown Material";
      const rawQty = item.quantityRequired ?? item.quantity ?? 0;
      const qtyStr = typeof rawQty === "number" ? rawQty.toString() : String(rawQty);
      const unitStr = item.unit || item.inventoryItem?.unit || "KG";

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...darkSlate);

      let rowX = margin;
      // Col 0: Index
      doc.text(String(idx + 1), rowX + cols[0].width / 2, currentY + 5, { align: "center" });
      rowX += cols[0].width;

      // Col 1: Material Name
      doc.setFont("helvetica", "bold");
      doc.text(matName, rowX + 3, currentY + 5);
      rowX += cols[1].width;

      // Col 2: Quantity
      doc.setFont("helvetica", "normal");
      doc.text(qtyStr, rowX + cols[2].width - 3, currentY + 5, { align: "right" });
      rowX += cols[2].width;

      // Col 3: Unit
      doc.setTextColor(...mutedText);
      doc.text(unitStr, rowX + cols[3].width - 3, currentY + 5, { align: "right" });

      currentY += rowHeight;
    });
  }

  currentY += 10;

  // 5. Production Methodology / Instructions
  const cleanInstructions = (recipe.instructions || "")
    .replace(/\[unitWeight:[\d.]+\]/g, "")
    .replace(/\[weightUnit:\w+\]/g, "")
    .trim();

  if (cleanInstructions) {
    if (currentY + 30 > pageHeight - 25) {
      doc.addPage();
      currentY = margin + 4;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...brandOrange);
    doc.text("PRODUCTION METHODOLOGY & INSTRUCTIONS", margin, currentY);

    currentY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...darkSlate);

    const splitLines = doc.splitTextToSize(cleanInstructions, contentWidth - 8);
    const boxHeight = Math.max(16, splitLines.length * 4.5 + 8);

    doc.setFillColor(...lightBg);
    doc.setDrawColor(...borderGray);
    doc.roundedRect(margin, currentY, contentWidth, boxHeight, 2, 2, "FD");

    doc.text(splitLines, margin + 4, currentY + 6);
    currentY += boxHeight + 8;
  }

  // 6. Page Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedText);
    doc.text(`Kiddos Food ERP — Recipe Formulation Sheet`, margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  // 7. Save / Trigger Download directly
  const safeFileName = recipe.name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  doc.save(`${safeFileName}_Recipe.pdf`);
}
