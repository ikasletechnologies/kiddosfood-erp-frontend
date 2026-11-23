// Back must discard unsaved edits: it used to auto-save a draft (a server
// Draft row for invoices, a real DRAFT quotation for estimations) whenever
// anything was typed. Drafts are now created only by the explicit
// "Save Draft" button, which must still exist.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

function handleBackBody(source: string): string {
  const start = source.indexOf("const handleBack = () => {");
  expect(start, "handleBack not found").toBeGreaterThan(-1);
  const end = source.indexOf("\n  };", start);
  return source.slice(start, end);
}

describe.each([
  ["sales invoice", "invoices/SalesInvoicesClient.tsx"],
  ["estimation", "estimation/EstimationsPageClient.tsx"],
])("%s form", (_label, file) => {
  const source = read(file);

  it("Back never saves (no auto-draft)", () => {
    const body = handleBackBody(source);
    expect(body).not.toMatch(/handleSave\s*\(/);
    expect(body).not.toMatch(/saveDraft|draftsApi|api\.(post|put|patch)/);
  });

  it("the explicit Save Draft button is kept", () => {
    expect(source).toMatch(/onClick=\{\(\) => handleSave\(true\)\}/);
  });
});
