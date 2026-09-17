import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

// next/link needs an App Router context we don't set up in these isolated
// component tests — swap it for a plain anchor so rendering doesn't depend
// on Next's router internals.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const getAlertsMock = vi.fn();
const getFranchiseOrdersMock = vi.fn();

vi.mock("@/lib/api", () => ({
  inventoryApi: { getAlerts: (...args: any[]) => getAlertsMock(...args) },
  franchiseOrdersApi: { getAll: (...args: any[]) => getFranchiseOrdersMock(...args) },
  alertsApi: {
    getAlerts: () => Promise.resolve({ data: [] }),
    getSummary: () => Promise.resolve({ data: null }),
    markAsRead: () => Promise.resolve({ success: true }),
    markAllAsRead: () => Promise.resolve({ success: true }),
    reconcile: () => Promise.resolve({ success: true }),
  },
}));

let mockUser: any = { id: "super-1", role: "SUPER_ADMIN" };
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser }),
}));

import AlertsPage from "../page";

function makeInventoryItems(count: number, overrides: (i: number) => any = () => ({})) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Product ${i}`,
    currentStock: 0,
    minimumStock: 10,
    unit: "KG",
    ...overrides(i),
  }));
}

function setAuthUser(user: any) {
  mockUser = user;
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(user));
  }
}

// Reads a KPI summary card's big number by its label, sidestepping
// ambiguous getByText("0")/getByText("310") matches when several cards (or
// the alert list itself) legitimately render the same digits.
function getSummaryCardValue(label: string): string {
  const heading = screen.getByText("ALERT SUMMARY");
  const grid = heading.parentElement!.querySelector(".grid") as HTMLElement;
  const cards = Array.from(grid.querySelectorAll(":scope > div"));
  const card = cards.find((c) => c.textContent?.includes(label));
  if (!card) throw new Error(`No summary card found for label "${label}"`);
  const h3 = card.querySelector("h3");
  return h3?.textContent ?? "";
}

beforeEach(() => {
  localStorage.clear();
  getAlertsMock.mockReset();
  getFranchiseOrdersMock.mockReset();
  getFranchiseOrdersMock.mockResolvedValue({ data: [] });
  setAuthUser({ id: "super-1", role: "SUPER_ADMIN" });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

async function renderAndLoad() {
  const utils = render(<AlertsPage />);
  await waitFor(() => expect(screen.getByText("ALERT SUMMARY")).toBeInTheDocument());
  await waitFor(() => expect(getAlertsMock).toHaveBeenCalled());
  return utils;
}

describe("Inventory Alerts page", () => {
  it("1. 310 active inventory alerts produce correct global summary counts", async () => {
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(310) });
    await renderAndLoad();

    await waitFor(() => {
      expect(getSummaryCardValue("UNREAD ALERTS")).toBe("310");
      expect(getSummaryCardValue("CRITICAL ISSUES")).toBe("310");
      expect(getSummaryCardValue("INVENTORY ALERTS")).toBe("310");
      expect(getSummaryCardValue("ORDER ALERTS")).toBe("0");
    });
  });

  it("2. Category filter returns only matching category", async () => {
    getAlertsMock.mockResolvedValue({
      data: [
        { id: "rm-1", name: "Raw Material Item", currentStock: 0, minimumStock: 10, category: "RAW_MATERIAL" },
        { id: "fg-1", name: "Finished Good Item", currentStock: 0, minimumStock: 10, category: "FINISHED_GOOD" },
      ],
    });

    await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "Raw Material" }));

    await waitFor(() => {
      expect(screen.getAllByText("Mark Read").length).toBe(1);
      expect(screen.getAllByText(/Raw Material Item/).length).toBeGreaterThan(0);
    });
  });

  it("3. Read status filter returns only matching read status", async () => {
    getAlertsMock.mockResolvedValue({
      data: [
        { id: "item-1", name: "ZeroStockItem", currentStock: 0, minimumStock: 10 },
        { id: "item-2", name: "LowStockItem", currentStock: 5, minimumStock: 10 },
      ],
    });
    await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(2));

    fireEvent.click(screen.getAllByText("Mark Read")[0]); // mark item-1 read

    fireEvent.click(screen.getByRole("button", { name: "Unread" }));

    await waitFor(() => {
      expect(screen.getAllByText("Mark Read").length).toBe(1);
    });
  });

  it("4. Status=Read with zero read alerts shows 'No Alerts Match Your Filters', not the all-clear state", async () => {
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(310) });
    await renderAndLoad();
    await waitFor(() => expect(getSummaryCardValue("UNREAD ALERTS")).toBe("310"));

    fireEvent.click(screen.getByRole("button", { name: "Read" }));

    await waitFor(() => {
      expect(screen.getByText("No Alerts Match Your Filters")).toBeInTheDocument();
      expect(screen.queryByText("All Clear — No Active Alerts")).not.toBeInTheDocument();
      // Global summary must remain unaffected by the filters.
      expect(getSummaryCardValue("UNREAD ALERTS")).toBe("310");
      expect(getSummaryCardValue("CRITICAL ISSUES")).toBe("310");
      expect(getSummaryCardValue("INVENTORY ALERTS")).toBe("310");
    });
  });

  it("5. Genuinely zero active alerts shows 'All Clear — No Active Alerts'", async () => {
    getAlertsMock.mockResolvedValue({ data: [] });
    await renderAndLoad();

    await waitFor(() => {
      expect(screen.getByText("All Clear — No Active Alerts")).toBeInTheDocument();
      expect(screen.queryByText("No Alerts Match Your Filters")).not.toBeInTheDocument();
    });
  });

  it("6. Marking one alert read persists after a simulated refresh (remount)", async () => {
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(3) });
    const user = userEvent.setup();
    const { unmount } = await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(3));

    await user.click(screen.getAllByText("Mark Read")[0]);
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(2));

    unmount();
    getAlertsMock.mockClear();
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(3) });

    await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(2));
  });

  it("7. Mark All Read persists after a simulated refresh (remount)", async () => {
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(5) });
    const user = userEvent.setup();
    const { unmount } = await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(5));

    await user.click(screen.getByRole("button", { name: /Mark All Read/i }));
    await waitFor(() => expect(screen.queryByText("Mark Read")).not.toBeInTheDocument());

    unmount();
    getAlertsMock.mockClear();
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(5) });

    await renderAndLoad();
    await waitFor(() => {
      expect(screen.queryByText("Mark Read")).not.toBeInTheDocument();
      expect(getSummaryCardValue("UNREAD ALERTS")).toBe("0");
    });
  });

  it("8. Unread count decreases correctly when marking alerts read", async () => {
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(5) });
    const user = userEvent.setup();
    await renderAndLoad();
    await waitFor(() => expect(getSummaryCardValue("UNREAD ALERTS")).toBe("5"));

    await user.click(screen.getAllByText("Mark Read")[0]);

    await waitFor(() => {
      expect(getSummaryCardValue("UNREAD ALERTS")).toBe("4");
    });
  });

  it("9. Reading an alert does not change the active inventory condition (Critical/Inventory counts unaffected)", async () => {
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(5) });
    const user = userEvent.setup();
    await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(5));

    await user.click(screen.getByRole("button", { name: /Mark All Read/i }));

    await waitFor(() => {
      expect(getSummaryCardValue("UNREAD ALERTS")).toBe("0");
      // Critical Issues and Inventory Alerts must both still read 5 — the
      // underlying stock condition hasn't changed just because it was read.
      expect(getSummaryCardValue("CRITICAL ISSUES")).toBe("5");
      expect(getSummaryCardValue("INVENTORY ALERTS")).toBe("5");
    });
  });

  it("10. Refresh does not create duplicate alert rows", async () => {
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(4) });
    const user = userEvent.setup();
    await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(4));

    await user.click(screen.getByTitle("Refresh alerts"));
    await waitFor(() => expect(getAlertsMock).toHaveBeenCalledTimes(2));

    expect(screen.getAllByText("Mark Read").length).toBe(4);
  });

  it("11. Live monitoring polls fetchAlerts once per 60 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(2) });
    const user = userEvent.setup({ delay: null });
    render(<AlertsPage />);
    await vi.waitFor(() => expect(getAlertsMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Live Monitoring/i }));

    await vi.advanceTimersByTimeAsync(60000);
    await vi.waitFor(() => expect(getAlertsMock).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(60000);
    await vi.waitFor(() => expect(getAlertsMock).toHaveBeenCalledTimes(3));
  });

  it("12. Live monitoring does not create duplicate intervals on re-render", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(2) });
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<AlertsPage />);
    await vi.waitFor(() => expect(getAlertsMock).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /Live Monitoring/i }));
    rerender(<AlertsPage />);
    rerender(<AlertsPage />);

    await vi.advanceTimersByTimeAsync(60000);
    // Exactly one extra fetch from the single interval, not one per re-render.
    await vi.waitFor(() => expect(getAlertsMock).toHaveBeenCalledTimes(2));
  });

  it("13. Turning Live Monitoring off stops polling", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getAlertsMock.mockResolvedValue({ data: makeInventoryItems(2) });
    const user = userEvent.setup({ delay: null });
    render(<AlertsPage />);
    await vi.waitFor(() => expect(getAlertsMock).toHaveBeenCalledTimes(1));

    const liveBtn = screen.getByRole("button", { name: /Live Monitoring/i });
    await user.click(liveBtn); // on
    await user.click(liveBtn); // off

    await vi.advanceTimersByTimeAsync(120000);
    expect(getAlertsMock).toHaveBeenCalledTimes(1);
  });

  it("14. Franchise scope is passed to the API; HQ/global scope omits it", async () => {
    getAlertsMock.mockResolvedValue({ data: [] });

    setAuthUser({ id: "f-admin", role: "FRANCHISE_ADMIN", franchiseId: "fr-42" });
    const { unmount } = await renderAndLoad();
    expect(getAlertsMock).toHaveBeenCalledWith({ franchiseId: "fr-42" });
    unmount();

    getAlertsMock.mockClear();
    setAuthUser({ id: "super-1", role: "SUPER_ADMIN" });
    await renderAndLoad();
    expect(getAlertsMock).toHaveBeenCalledWith(undefined);
  });

  it("15. Stable IDs preserve read state even when the fetch order/shape changes", async () => {
    const first = makeInventoryItems(3);
    getAlertsMock.mockResolvedValue({ data: first });
    const user = userEvent.setup();
    const { unmount } = await renderAndLoad();
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(3));

    await user.click(screen.getAllByText("Mark Read")[0]); // marks item-0 read
    await waitFor(() => expect(screen.getAllByText("Mark Read").length).toBe(2));

    unmount();

    // Re-fetch returns the same stable IDs but in reversed order plus one
    // brand-new alert — read state must follow item-0 by ID, not by index.
    const reordered = [...first].reverse().concat(makeInventoryItems(1, () => ({ id: "item-new" })));
    getAlertsMock.mockClear();
    getAlertsMock.mockResolvedValue({ data: reordered });

    await renderAndLoad();
    await waitFor(() => {
      // 4 total alerts, item-0 still read -> 3 "Mark Read" buttons remain.
      expect(screen.getAllByText("Mark Read").length).toBe(3);
    });
  });
});
