import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

const setSelectedVendor = vi.fn();
const getAll = vi.fn();

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { fullName: "Admin", role: "SUPER_ADMIN" } }) }));
vi.mock("@/context/PurchaseOrderContext", () => ({ usePurchaseOrder: () => ({ selectedVendor: null, setSelectedVendor }) }));
vi.mock("@/lib/api", () => ({ vendorsApi: { getAll: () => getAll() } }));

import BillingSection from "../BillingSection";

const VENDORS = [
  { id: "v1", name: "Annapurna Traders", vendorCode: "V-0001", status: "ACTIVE", gstNumber: "29AAA", balance: 500 },
  { id: "v2", name: "Blocked Foods", vendorCode: "V-0002", status: "BLOCKED" },
  { id: "v3", name: "Annapurna Mills", vendorCode: "V-0003", status: "ACTIVE" },
  { id: "v1", name: "Annapurna Traders (dup)", vendorCode: "V-0001", status: "ACTIVE" },
];

describe("PO vendor search (BillingSection)", () => {
  beforeEach(() => { setSelectedVendor.mockReset(); getAll.mockReset(); });

  it("loads vendors once, shows Searching…, filters trimmed/case-insensitive and selects the vendor record by keyboard", async () => {
    let resolve!: (v: any) => void;
    getAll.mockReturnValue(new Promise(r => { resolve = r; }));
    render(<BillingSection fromLabel="Billed To" toLabel="Billed By" targetType="vendor" />);
    const input = screen.getByRole("combobox", { name: "Search vendor" });

    fireEvent.focus(input);
    expect(screen.getByText("Searching…")).toBeInTheDocument();
    fireEvent.blur(input);
    fireEvent.focus(input);
    expect(getAll).toHaveBeenCalledTimes(1); // no duplicate request on re-focus

    await act(async () => { resolve({ data: VENDORS }); });
    fireEvent.change(input, { target: { value: "  ANNAPURNA  " } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2); // duplicate v1 removed, blocked vendor filtered by text
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(setSelectedVendor).toHaveBeenCalledTimes(1);
    expect(setSelectedVendor.mock.calls[0][0]).toMatchObject({ id: "v3", name: "Annapurna Mills" });
  });

  it("lists a blocked vendor but does not allow selecting it", async () => {
    getAll.mockResolvedValue({ data: VENDORS });
    render(<BillingSection fromLabel="Billed To" toLabel="Billed By" targetType="vendor" />);
    const input = screen.getByRole("combobox", { name: "Search vendor" });
    await act(async () => { fireEvent.focus(input); });
    fireEvent.change(input, { target: { value: "blocked" } });
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(option);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(setSelectedVendor).not.toHaveBeenCalled();
  });

  it("shows the no-match text", async () => {
    getAll.mockResolvedValue({ data: VENDORS });
    render(<BillingSection fromLabel="Billed To" toLabel="Billed By" targetType="vendor" />);
    const input = screen.getByRole("combobox", { name: "Search vendor" });
    await act(async () => { fireEvent.focus(input); });
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText("No matching records found")).toBeInTheDocument();
  });
});
