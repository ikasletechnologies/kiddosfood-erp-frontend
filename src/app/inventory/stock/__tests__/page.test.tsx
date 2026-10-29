import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import StockInventoryPage from "../page";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/components/modules/inventory/FinishedGoodsStockClient", () => ({ default: () => <div>Existing finished goods module</div> }));
vi.mock("@/components/modules/inventory/RawMaterialStockClient", () => ({ default: () => <div>Existing raw materials module</div> }));
vi.mock("@/components/modules/inventory/SemiFinishedStockClient", () => ({ default: () => <div>Semi-finished goods module</div> }));
vi.mock("@/components/modules/inventory/FinishedGoodsLowStockSettings", () => ({ FinishedGoodsLowStockProvider: ({ children }: any) => children, LowStockSettingsButton: () => <button>Low Stock Settings</button> }));
describe("Stock Hub category tabs", () => {
  afterEach(cleanup);
  it("adds Semi-Finished Goods between the two existing modules without changing their selection", () => {
    render(<StockInventoryPage />);
    expect(screen.getAllByRole("button").slice(0,3).map(button => button.textContent)).toEqual(["Finished Goods", "Semi-Finished Goods", "Raw Materials"]);
    expect(screen.getByRole('button',{name:'Low Stock Settings'})).toBeVisible();
    expect(screen.getByText("Existing finished goods module")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Semi-Finished Goods" }));
    expect(screen.getByText("Semi-finished goods module")).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Low Stock Settings'})).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Raw Materials" }));
    expect(screen.getByText("Existing raw materials module")).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Low Stock Settings'})).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Finished Goods" }));
    expect(screen.getByText("Existing finished goods module")).toBeInTheDocument();
  });
});
