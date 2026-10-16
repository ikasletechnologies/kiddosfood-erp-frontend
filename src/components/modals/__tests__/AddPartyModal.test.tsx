import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddPartyModal from "../AddPartyModal";

const { toastError, getVendors } = vi.hoisted(() => ({ toastError: vi.fn(), getVendors: vi.fn() }));

vi.mock("react-hot-toast", () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock("@/lib/api", () => ({
  vendorsApi: { getAll: getVendors },
  customersApi: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
  gstApi: { verify: vi.fn() },
}));
vi.mock("@/lib/party-form", async () => {
  const actual = await vi.importActual<any>("@/lib/party-form");
  return { ...actual, lookupPincode: vi.fn().mockResolvedValue(null) };
});

describe("AddPartyModal vendor step validation", () => {
  beforeEach(() => {
    toastError.mockReset();
    getVendors.mockResolvedValue({ data: [] });
  });
  afterEach(cleanup);

  it("does not move to Credit & Balance when required details are empty", async () => {
    render(<AddPartyModal isOpen onClose={vi.fn()} onSave={vi.fn()} partyType="vendor" />);
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.queryByText("Credit & Balance")).not.toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Vendor Name is required.");
  });

  it("moves to the next step only after all step-one required fields are valid", async () => {
    render(<AddPartyModal isOpen onClose={vi.fn()} onSave={vi.fn()} partyType="vendor" />);
    fireEvent.change(screen.getByPlaceholderText("Enter name..."), { target: { value: "Valid Vendor" } });
    fireEvent.change(screen.getByPlaceholderText("10 digits..."), { target: { value: "9876543210" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "ALL" } });
    fireEvent.change(screen.getByPlaceholderText("Address..."), { target: { value: "Billing address" } });
    fireEvent.change(screen.getByPlaceholderText("Shipping Address..."), { target: { value: "Shipping address" } });
    fireEvent.change(screen.getByPlaceholderText("6-digit Pincode"), { target: { value: "642203" } });
    await waitFor(() => {
      expect(getVendors).toHaveBeenCalled();
      expect(screen.getByPlaceholderText("6-digit Pincode")).toHaveValue("642203");
    });
    toastError.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(toastError).not.toHaveBeenCalled();
    expect(await screen.findByText("Credit & Balance")).toBeInTheDocument();
  });
});
