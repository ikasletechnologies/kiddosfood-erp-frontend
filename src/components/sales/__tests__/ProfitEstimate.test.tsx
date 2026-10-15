import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LineProfit, LossWarning, ProfitSummaryPanel } from "../ProfitEstimate";
import { canViewCost, EstimatedLine } from "@/lib/profit-estimate";

const line = (p: Partial<EstimatedLine>): EstimatedLine => ({
  productId: "p", productName: "Kambu Dosa 1kg", quantity: 10, unitPrice: 100, netUnitPrice: 100, netRevenue: 1000,
  unitCost: 80, costOfGoods: 800, unitProfit: 20, profit: 200, marginPct: 20, status: "PROFIT", warning: null, ...p,
});

describe("profit estimate display", () => {
  afterEach(cleanup);

  it("shows cost, net price and profit per unit and per line", () => {
    render(<LineProfit line={line({})} />);
    expect(screen.getByText(/Cost ₹80 · Net ₹100/)).toBeInTheDocument();
    expect(screen.getByText("+₹20/unit (+₹200)")).toBeInTheDocument();
  });

  it("shows the server's loss warning in red", () => {
    const loss = line({ netUnitPrice: 65, netRevenue: 650, unitProfit: -15, profit: -150, marginPct: -23.08, status: "LOSS",
      warning: "Warning: Your selling price is ₹15 below production cost per unit. Estimated loss for 10 units is ₹150." });
    render(<><LineProfit line={loss} /><LossWarning line={loss} /></>);
    expect(screen.getByText("−₹15/unit (−₹150)")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Estimated loss for 10 units is ₹150.");
  });

  it("never shows ₹0 cost when cost is unknown", () => {
    render(<LineProfit line={line({ unitCost: null, costOfGoods: null, unitProfit: null, profit: null, marginPct: null, status: "COST_UNAVAILABLE" })} />);
    expect(screen.getByText(/Cost unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/₹0/)).toBeNull();
  });

  it("summarizes revenue excl. GST, cost of goods, profit and margin", () => {
    render(<ProfitSummaryPanel summary={{ netRevenue: 1000, costOfGoods: 800, profit: 200, marginPct: 20, costUnavailableLines: 0, costedRevenue: 1000, status: "PROFIT" }} />);
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
    expect(screen.getByText("₹800")).toBeInTheDocument();
    expect(screen.getByText("+₹200")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("says when part of the order has no cost", () => {
    render(<ProfitSummaryPanel summary={{ netRevenue: 1300, costOfGoods: 800, profit: 200, marginPct: 20, costUnavailableLines: 1, costedRevenue: 1000, status: "PROFIT" }} />);
    expect(screen.getByText(/Cost unavailable for 1 item/)).toBeInTheDocument();
  });

  it("cost is visible only to allowed roles", () => {
    expect(canViewCost({ role: "SUPER_ADMIN" })).toBe(true);
    expect(canViewCost({ role: { name: "FRANCHISE_ADMIN" } })).toBe(true);
    expect(canViewCost({ role: "CASHIER" })).toBe(false);
    expect(canViewCost(null)).toBe(false);
  });
});
