import { describe, it, expect } from "vitest";
import { newVariantProblem, parseSizeText, productSize, variantChoices } from "../packaging-variants";

// Finished-goods catalogue. The batch being packed is "Thenai Dosa".
const products = [
  { id: "idli500", name: "Idli Batter 500g", sku: "FG-IDLI-500G", basePrice: 45 },
  { id: "then1kg", name: "Thenai Dosa 1kg", sku: "FG-THEN-1KG", basePrice: 90 },
  { id: "thenOld", name: "Thenai Dosa 250g", sku: "FG-THENO-250G", isActive: false },
  { id: "thenName", name: "Thenai Dosa Mix 2kg", sku: "FG-THENM-2KG" },
];
const linked = new Set(["then1kg"]); // verified recipe → product link

describe("packaging variant matching", () => {
  it("reads pack sizes from SKUs and size text", () => {
    expect(parseSizeText("500g")).toEqual({ amount: 500, dim: "W" });
    expect(parseSizeText("1kg")).toEqual({ amount: 1000, dim: "W" });
    expect(productSize(products[0])).toEqual({ amount: 500, dim: "W" });
  });

  it("never offers an unrelated product of the same size (Thenai Dosa 500g ≠ Idli Batter 500g)", () => {
    expect(variantChoices(products, "Thenai Dosa", "500g", linked)).toEqual({ linked: [], nameMatches: [] });
  });

  it("reuses only a variant linked to the recipe", () => {
    expect(variantChoices(products, "Thenai Dosa", "1kg", linked).linked.map((p) => p.id)).toEqual(["then1kg"]);
    // Inactive variants are never used.
    expect(variantChoices(products, "Thenai Dosa", "250g", new Set(["thenOld"])).linked).toEqual([]);
  });

  it("an unlinked same-name product is a name match needing confirmation, not an automatic link", () => {
    const { linked: l, nameMatches } = variantChoices(products, "Thenai Dosa", "2kg", linked);
    expect(l).toEqual([]);
    expect(nameMatches.map((p) => p.id)).toEqual(["thenName"]);
  });
});

describe("Create New Variant validation", () => {
  const ok = { name: "Thenai Dosa 500g", sku: "FG-THEN-500G", packetSize: "500g" };

  it("accepts the suggested name and SKU — no selling price needed in Packaging", () => {
    expect(newVariantProblem(ok, products)).toBeNull();
    expect(newVariantProblem({ ...ok, name: "Thenai Dosa Batter 500g", sku: "FG-THENB-500G" }, products)).toBeNull();
  });

  it("prevents duplicates: an existing name or SKU is rejected", () => {
    expect(newVariantProblem({ ...ok, name: "thenai dosa 1kg" }, products)).toMatch(/already exists/);
    expect(newVariantProblem({ ...ok, sku: "FG-IDLI-500G" }, products)).toMatch(/already belongs to "Idli Batter 500g"/);
  });

  it("records the pack size in the SKU and checks it matches", () => {
    expect(newVariantProblem({ ...ok, sku: "FG-THEN" }, products)).toMatch(/must end with the pack size/);
    expect(newVariantProblem({ ...ok, sku: "FG-THEN-1KG" }, products)).toMatch(/pack size is 500g/);
    expect(newVariantProblem({ ...ok, sku: "fg then 500g" }, products)).toMatch(/letters, numbers and hyphens/);
  });

  it("requires a product name", () => {
    expect(newVariantProblem({ ...ok, name: " " }, products)).toMatch(/product name/);
  });
});
