import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceCardData, InvoiceCards, InvoiceViewSwitcher, useInvoiceListView } from "../InvoiceListViews";

const invoice: InvoiceCardData = { id: "i1", number: "INV-2026-0009", date: "28/10/2026", partyName: "P S GOVINDASWAMY NAIDU & SONS CHARITIES", partyType: "CUSTOMER", paymentType: "Credit", total: 410, balance: 205, status: "Partially Paid", statusClassName: "text-amber-600" };

describe("invoice list views", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("defaults to cards, persists an explicit choice, and restores it after remount", () => {
    const first = renderHook(() => useInvoiceListView("alice"));
    expect(first.result.current[0]).toBe("card");
    act(() => first.result.current[1]("table"));
    expect(localStorage.getItem("erp_sales_invoice_view_alice")).toBe("table");
    first.unmount();
    const second = renderHook(() => useInvoiceListView("alice"));
    expect(second.result.current[0]).toBe("table");
    act(() => second.result.current[1]("card"));
    expect(localStorage.getItem("erp_sales_invoice_view_alice")).toBe("card");
  });

  it("isolates user preferences and ignores invalid saved values", () => {
    localStorage.setItem("erp_sales_invoice_view_alice", "table");
    localStorage.setItem("erp_sales_invoice_view_bob", "invalid");
    const hook = renderHook(({ id }) => useInvoiceListView(id), { initialProps: { id: "alice" } });
    expect(hook.result.current[0]).toBe("table");
    hook.rerender({ id: "bob" });
    expect(hook.result.current[0]).toBe("card");
    expect(localStorage.getItem("erp_sales_invoice_view_alice")).toBe("table");
  });

  it("still switches views when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    const hook = renderHook(() => useInvoiceListView("alice"));
    expect(hook.result.current[0]).toBe("card");
    act(() => hook.result.current[1]("table"));
    expect(hook.result.current[0]).toBe("table");
  });

  it("exposes accessible view buttons and leaves surrounding filters intact", () => {
    const Harness = () => {
      const [view, setView] = useInvoiceListView("alice");
      return <><input aria-label="Search invoices" defaultValue="Charities" /><select aria-label="Payment status" defaultValue="partial"><option value="partial">Partially Paid</option></select><InvoiceViewSwitcher view={view} onChange={setView} /></>;
    };
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Card View" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Table View" }));
    expect(screen.getByRole("button", { name: "Table View" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Search invoices")).toHaveValue("Charities");
    expect(screen.getByLabelText("Payment status")).toHaveValue("partial");
  });

  it("displays full party names, financial details, and accessible View/Print actions", () => {
    const open = vi.fn(), print = vi.fn();
    render(<InvoiceCards items={[invoice]} onOpen={open} renderActions={id => <><button onClick={() => open(id)}>View</button><button onClick={() => print(id)}>Print</button></>} />);
    const card = screen.getByRole("article", { name: "Invoice INV-2026-0009" });
    expect(within(card).getByRole("heading")).toHaveTextContent(invoice.partyName);
    for (const text of ["28/10/2026", "CUSTOMER", "Credit", "Sale", "Partially Paid", "₹410.00", "₹205.00"]) expect(within(card).getByText(text)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "INV-2026-0009" }));
    fireEvent.click(within(card).getByRole("button", { name: "View" }));
    fireEvent.click(within(card).getByRole("button", { name: "Print" }));
    expect(open).toHaveBeenCalledWith("i1"); expect(print).toHaveBeenCalledWith("i1");
    expect(screen.queryByText(/Fulfilment/)).toBeNull();
  });

  it("keeps draft and cancelled invoices and their action controls visible", () => {
    render(<InvoiceCards items={[{ ...invoice, id: "draft", number: "Not yet numbered", status: "Draft", balance: 0 }, { ...invoice, id: "cancelled", status: "Cancelled", balance: 0 }]} onOpen={vi.fn()} renderActions={id => <button>{id === "draft" ? "Delete Draft" : "View"}</button>} />);
    expect(screen.getByText("Draft")).toBeInTheDocument(); expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Draft" })).toBeInTheDocument();
    expect(screen.getAllByText("₹0.00")).toHaveLength(2);
  });
});
