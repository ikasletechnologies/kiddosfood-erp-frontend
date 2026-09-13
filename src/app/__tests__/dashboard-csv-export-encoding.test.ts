import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression guard for "₹ shows up as â‚¹ in the downloaded Excel report".
// Root cause: the Executive Dashboard's "Export Excel" button actually
// downloads a plain .csv (text/csv, not a real .xlsx workbook). Opened in
// Excel, a .csv with no UTF-8 BOM is decoded using the system's ANSI
// codepage, not UTF-8 — so the 3-byte UTF-8 encoding of ₹ (E2 82 B9) is
// misread as three separate Latin-1 characters. Prepending the UTF-8 BOM
// (﻿) to the Blob tells Excel to decode it as UTF-8.
describe("Executive Dashboard CSV export — ₹ encoding", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../page.tsx"), "utf8");

  it("prepends a UTF-8 BOM to the exported CSV Blob", () => {
    const blobCall = source.match(/const blob = new Blob\(\[[^\]]*\], \{ type: "text\/csv[^"]*" \}\);/);
    expect(blobCall, "CSV export Blob() call not found in page.tsx").toBeTruthy();
    expect(blobCall![0]).toContain("\\uFEFF");
  });
});
