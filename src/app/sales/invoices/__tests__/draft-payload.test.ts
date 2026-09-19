import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression guard for the "Invalid prisma.draft.create() invocation —
// Argument `data` is missing" bug: SalesInvoicesClient's draft-save call was
// sending `state: {...}` while the backend (DraftsService.saveDraft /
// prisma/schema.prisma's Draft.data, a required Json field) expects `data:
// {...}` — exactly matching the OTHER working caller, payment-in/page.tsx.
// A full component render isn't needed to guard against this regressing;
// a source-level check on the exact call site is enough and stays fast/safe.
describe("SalesInvoicesClient draft-save payload", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../SalesInvoicesClient.tsx"),
    "utf8"
  );

  it("sends the draft payload under `data`, matching DraftsService.saveDraft's contract", () => {
    const callMatch = source.match(/draftsApi\.saveDraft\(\{[\s\S]*?\n\s*\}\);/);
    expect(callMatch, "draftsApi.saveDraft(...) call site not found").toBeTruthy();
    const call = callMatch![0];
    expect(call).toMatch(/\bdata:\s*\{/);
    expect(call).not.toMatch(/\bstate:\s*\{/);
  });
});
