import { afterEach, describe, expect, it, vi } from "vitest";
import { packableQty, packagingBlocker } from "@/config/production-features";
describe("physical bulk packaging availability", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("caps logical batch quantity by physical source stock and pending reservations", () => {
    expect(packableQty({ approvedQty: 20, packagedQty: 9, qcStatus: "QC_NOT_REQUIRED", availableBulkQty: 11 })).toBe(11);
    expect(packableQty({ approvedQty: 20, packagedQty: 9, qcStatus: "QC_NOT_REQUIRED", availableBulkQty: 2 })).toBe(2);
    expect(packableQty({ approvedQty: 20, packagedQty: 9, qcStatus: "APPROVED", packagings: [{ status: "AWAITING_CONFIRMATION", totalWeight: 3 }], availableBulkQty: 8 })).toBe(8);
    expect(packableQty({ approvedQty: 20, qcStatus: "APPROVED", availableBulkQty: 0 })).toBe(0);
  });
  it("blocks approved lots on their expiry day in the business timezone", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-28T05:00:00Z"));
    expect(packagingBlocker({ qcStatus: "APPROVED", expiryDate: "2026-10-28T00:00:00Z" })).toBe("Expired");
    expect(packagingBlocker({ qcStatus: "QC_NOT_REQUIRED", expiryDate: "2026-10-29T00:00:00Z" })).toBeNull();
  });
});
