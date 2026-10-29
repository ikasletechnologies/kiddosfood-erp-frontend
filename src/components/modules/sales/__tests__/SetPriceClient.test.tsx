import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SetPricesModal } from "../SetPriceClient";
import { productPricingStatus, PRODUCT_FULLY_PRICED, mrpWarning } from "@/lib/lot-pricing";

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/api", () => ({ lotPricingApi: { setProductPrices: mocks.save }, franchiseApi: {} }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("@/components/ui/Modal", () => ({ Modal: ({ title, children, footer }: any) => <div><h1>{title}</h1>{children}{footer}</div> }));
vi.mock("@/components/modules/inventory/FinishedGoodsLotsPanel", () => ({ default: () => null }));

const product = {
  id: "sku-500", productId: "product-500", name: "APPAM 500g", sku: "FG-APPA-500G", category: "FINISHED_GOOD", unit: "PC", packSize: "500g",
  location: "HQ", taxPercent: 5, customerPrice: 100, dealerPrice: 80, franchisePrice: 70,
  upcountryFranchisePrice: 75, mrp: 120, whiteLabelCost: 55, tiers: [], pricingStatus: PRODUCT_FULLY_PRICED,
  missingTiers: [], lotCount: 2, availableQty: 50, totalQty: 50, warehouses: [], latestLotNumber: "LOT-B", latestProductionAt: null,
  legacyLotPrice: null, latestCost: 20,
};
const input = (label: RegExp) => screen.getByLabelText(label, { selector: 'input[type="number"]' }) as HTMLInputElement;
const show = (p = product) => render(<SetPricesModal product={p} showCost onClose={vi.fn()} onSaved={vi.fn()} />);

describe("six SKU pricing fields", () => {
  afterEach(cleanup);
  beforeEach(() => { mocks.save.mockReset().mockResolvedValue({ data: {} }); });

  it("shows all six saved values and preserves the other fields when editing one", async () => {
    show();
    expect(input(/^Customer price$/i).value).toBe("100");
    expect(input(/^Dealer price$/i).value).toBe("80");
    expect(input(/^Franchise price$/i).value).toBe("70");
    expect(input(/Upcountry Franchise price/i).value).toBe("75");
    expect(input(/MRP \(including GST\)/i).value).toBe("120");
    expect(input(/^White Label Cost$/i).value).toBe("55");
    fireEvent.change(input(/^White Label Cost$/i), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: /Save prices/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("sku-500", expect.objectContaining({
      customerPrice: 100, dealerPrice: 80, franchisePrice: 70, upcountryFranchisePrice: 75, mrp: 120, whiteLabelCost: 60,
    })));
  });

  it("shows the same six inputs for first-time pricing and keeps optional fields optional", () => {
    show({ ...product, customerPrice: null, dealerPrice: null, franchisePrice: null, upcountryFranchisePrice: null, mrp: null, whiteLabelCost: null } as any);
    expect(screen.getByRole("heading", { name: "Set prices" })).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")).toHaveLength(6);
    expect(productPricingStatus({ ...product, upcountryFranchisePrice: null, mrp: null, whiteLabelCost: null } as any)).toBe(PRODUCT_FULLY_PRICED);
  });

  it("converts commercial inputs with GST while keeping MRP inclusive", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Including GST" }));
    expect(input(/^Customer price$/i).value).toBe("105");
    expect(input(/Upcountry Franchise price/i).value).toBe("78.75");
    expect(input(/^White Label Cost$/i).value).toBe("57.75");
    expect(input(/MRP \(including GST\)/i).value).toBe("120");
    fireEvent.change(input(/^White Label Cost$/i), { target: { value: "63" } });
    fireEvent.click(screen.getByRole("button", { name: /Save prices/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("sku-500", expect.objectContaining({ taxInclusive: true, mrp: 120, customerPrice: 105, whiteLabelCost: 63 })));
  });

  it("warns about MRP without changing the customer price", () => {
    show();
    fireEvent.change(input(/MRP \(including GST\)/i), { target: { value: "104" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/Customer price including GST exceeds MRP/);
    expect(input(/^Customer price$/i).value).toBe("100");
    expect(mrpWarning(100, 105, 5)).toBeNull();
    expect(mrpWarning(100, null, 5)).toBeNull();
  });

  it("allows clearing an optional field, rejects zero, and retains below-cost warnings", async () => {
    show({ ...product, latestCost: 90 });
    fireEvent.change(input(/^White Label Cost$/i), { target: { value: "" } });
    expect(screen.getByText(/prices are below the latest production cost/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Save prices/i }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("sku-500", expect.objectContaining({ whiteLabelCost: null, acknowledgeBelowCost: true })));
    fireEvent.change(input(/Upcountry Franchise price/i), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: /Save prices/i })).toBeDisabled();
  });
});
