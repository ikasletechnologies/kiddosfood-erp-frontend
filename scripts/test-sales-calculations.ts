import { calculateSalesDocumentTotals, roundMoney } from "../src/lib/utils";

function assertEqual(actual: any, expected: any, label: string) {
  if (actual !== expected) {
    throw new Error(`FAIL [${label}]: Expected ${expected}, got ${actual}`);
  }
  console.log(`  ✓ [${label}] = ${actual}`);
}

console.log("==================================================================");
console.log("  RUNNING AUTOMATED SALES CALCULATION TEST SUITE (15 TEST CASES) ");
console.log("==================================================================\n");

// Test Case 1: Primary Acceptance Test (QT-2026-00003)
console.log("Test Case 1: Primary Acceptance Test (QT-2026-00003: 1 x ₹60, 25% Disc, 5% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 60, discountPct: 25, taxPct: 5 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 60.00, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 15.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 45.00, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 2.25, "GST Amount");
  assertEqual(res.computedItems[0].lineTotal, 47.25, "Line Total");
  assertEqual(res.subTotal, 45.00, "Subtotal (Taxable)");
  assertEqual(res.totalDiscount, 15.00, "Total Discount");
  assertEqual(res.totalTax, 2.25, "Total Tax");
  assertEqual(res.roundOff, -0.25, "Round Off");
  assertEqual(res.finalTotal, 47.00, "Grand Total");
}

// Test Case 2: No Discount
console.log("\nTest Case 2: No Discount (2 x ₹50, 0% Disc, 18% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 2, rate: 50, discountPct: 0, taxPct: 18 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 100.00, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 0.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 100.00, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 18.00, "GST Amount");
  assertEqual(res.finalTotal, 118.00, "Grand Total");
}

// Test Case 3: 1% Discount
console.log("\nTest Case 3: 1% Discount (10 x ₹100, 1% Disc, 12% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 10, rate: 100, discountPct: 1, taxPct: 12 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 1000.00, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 10.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 990.00, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 118.80, "GST Amount");
  assertEqual(res.finalTotal, 1109.00, "Grand Total");
}

// Test Case 4: 25% Discount
console.log("\nTest Case 4: 25% Discount (4 x ₹250, 25% Disc, 5% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 4, rate: 250, discountPct: 25, taxPct: 5 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 1000.00, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 250.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 750.00, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 37.50, "GST Amount");
  assertEqual(res.finalTotal, 788.00, "Grand Total");
}

// Test Case 5: 100% Discount
console.log("\nTest Case 5: 100% Discount (1 x ₹150, 100% Disc, 18% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 150, discountPct: 100, taxPct: 18 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 150.00, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 150.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 0.00, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 0.00, "GST Amount");
  assertEqual(res.finalTotal, 0.00, "Grand Total");
}

// Test Case 6: Decimal Unit Price
console.log("\nTest Case 6: Decimal Unit Price (3 x ₹33.33, 10% Disc, 5% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 3, rate: 33.33, discountPct: 10, taxPct: 5 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 99.99, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 10.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 89.99, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 4.50, "GST Amount");
  assertEqual(res.finalTotal, 94.00, "Grand Total");
}

// Test Case 7: Decimal Quantity
console.log("\nTest Case 7: Decimal Quantity (2.5 x ₹80, 5% Disc, 12% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 2.5, rate: 80, discountPct: 5, taxPct: 12 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 200.00, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 10.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 190.00, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 22.80, "GST Amount");
  assertEqual(res.finalTotal, 213.00, "Grand Total");
}

// Test Case 8: Decimal Discount
console.log("\nTest Case 8: Decimal Discount (1 x ₹200, 12.5% Disc, 18% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 200, discountPct: 12.5, taxPct: 18 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 200.00, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 25.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 175.00, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 31.50, "GST Amount");
  assertEqual(res.finalTotal, 207.00, "Grand Total");
}

// Test Case 9: 5% GST
console.log("\nTest Case 9: 5% GST (1 x ₹100, 10% Disc, 5% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 100, discountPct: 10, taxPct: 5 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].taxAmount, 4.50, "GST 5% Amount");
  assertEqual(res.finalTotal, 95.00, "Grand Total");
}

// Test Case 10: 12% GST
console.log("\nTest Case 10: 12% GST (1 x ₹100, 10% Disc, 12% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 100, discountPct: 10, taxPct: 12 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].taxAmount, 10.80, "GST 12% Amount");
  assertEqual(res.finalTotal, 101.00, "Grand Total");
}

// Test Case 11: 18% GST
console.log("\nTest Case 11: 18% GST (1 x ₹100, 10% Disc, 18% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 100, discountPct: 10, taxPct: 18 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].taxAmount, 16.20, "GST 18% Amount");
  assertEqual(res.finalTotal, 106.00, "Grand Total");
}

// Test Case 12: Multiple Items (APPAM + Banyard Millet)
console.log("\nTest Case 12: Multiple Items (APPAM ₹35 @ 27% + Banyard Millet ₹95 @ 27%, 5% GST)");
{
  const res = calculateSalesDocumentTotals(
    [
      { qty: 1, rate: 35, discountPct: 27, taxPct: 5 },
      { qty: 1, rate: 95, discountPct: 27, taxPct: 5 }
    ],
    "without_tax",
    true
  );
  assertEqual(res.subTotal, 94.90, "Taxable Subtotal");
  assertEqual(res.totalDiscount, 35.10, "Total Discount");
  assertEqual(res.totalTax, 4.75, "Total Tax");
  assertEqual(res.roundOff, 0.35, "Round Off");
  assertEqual(res.finalTotal, 100.00, "Grand Total");
}

// Test Case 13: Paise Values (1 x ₹99.99, 15% Disc, 5% GST)
console.log("\nTest Case 13: Paise Values (1 x ₹99.99, 15% Disc, 5% GST)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 99.99, discountPct: 15, taxPct: 5 }],
    "without_tax",
    true
  );
  assertEqual(res.computedItems[0].grossAmount, 99.99, "Gross Amount");
  assertEqual(res.computedItems[0].discountAmount, 15.00, "Discount Amount");
  assertEqual(res.computedItems[0].taxableAmount, 84.99, "Taxable Amount");
  assertEqual(res.computedItems[0].taxAmount, 4.25, "GST Amount");
  assertEqual(res.finalTotal, 89.00, "Grand Total");
}

// Test Case 14: Round-off Disabled
console.log("\nTest Case 14: Round-off Disabled (1 x ₹60, 25% Disc, 5% GST, roundOffEnabled = false)");
{
  const res = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 60, discountPct: 25, taxPct: 5 }],
    "without_tax",
    false
  );
  assertEqual(res.roundOff, 0.00, "Round Off");
  assertEqual(res.finalTotal, 47.25, "Grand Total");
}

// Test Case 15: Edit an existing estimate and save again
console.log("\nTest Case 15: Edit an existing estimate and save again");
{
  const initial = calculateSalesDocumentTotals(
    [{ qty: 1, rate: 60, discountPct: 25, taxPct: 5 }],
    "without_tax",
    true
  );
  const updatedItem = { qty: 2, rate: 60, discountPct: 25, taxPct: 5 };
  const edited = calculateSalesDocumentTotals(
    [updatedItem],
    "without_tax",
    true
  );
  assertEqual(initial.finalTotal, 47.00, "Initial Grand Total");
  assertEqual(edited.computedItems[0].grossAmount, 120.00, "Edited Gross Amount");
  assertEqual(edited.computedItems[0].taxableAmount, 90.00, "Edited Taxable Amount");
  assertEqual(edited.computedItems[0].taxAmount, 4.50, "Edited GST Amount");
  assertEqual(edited.finalTotal, 95.00, "Edited Grand Total");
}

console.log("\n==================================================================");
console.log("  ALL 15 TEST CASES PASSED SUCCESSFULLY WITH 100% ACCURACY!        ");
console.log("==================================================================\n");
