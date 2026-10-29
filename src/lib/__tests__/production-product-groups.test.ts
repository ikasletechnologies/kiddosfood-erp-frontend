import { describe, expect, it } from "vitest";
import { buildBulkProductGroups } from "../production-product-groups";

const product = (id: string, name: string, sku: string) => ({ id, name, sku, isActive: true, productType: "FINISHED_GOOD" });

describe("bulk production product grouping", () => {
  it("shows all variants linked to one recipe as one bulk product", () => {
    const products = [product("450", "APPAM 450g", "APP-450G"), product("900", "APPAM 900g", "APP-900G")];
    const recipes = [{ id: "r1", name: "APPAM", productId: "450", productLinks: [{ productId: "900" }] }];
    const groups = buildBulkProductGroups(products, recipes);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: "recipe:r1", name: "APPAM", conflict: false });
    expect(groups[0].products.map((p) => p.id)).toEqual(["450", "900"]);
  });

  it("does not guess that similarly named unlinked SKUs belong together", () => {
    const groups = buildBulkProductGroups([
      product("450", "BATTER 450g", "BAT-450G"),
      product("900", "BATTER 900g", "BAT-900G"),
    ], []);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.recipe === null)).toBe(true);
  });

  it("suggests one family for exact catalog names while retaining every SKU", () => {
    const groups = buildBulkProductGroups([
      product("450", "APPAM", "FG-APPAM-450G"),
      product("900", "APPAM", "FG-APPAM-900G"),
    ], []);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "APPAM", suggested: true });
    expect(groups[0].products.map((p) => p.sku)).toEqual(["FG-APPAM-450G", "FG-APPAM-900G"]);
  });

  it("adds an exact-name unlinked SKU to its configured bulk recipe", () => {
    const products = [product("450", "APPAM", "FG-APPAM-450G"), product("900", "APPAM", "FG-APPAM-900G")];
    const groups = buildBulkProductGroups(products, [{ id: "r1", name: "APPAM", productId: "450" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].products.map((p) => p.id)).toEqual(["450", "900"]);
    expect(groups[0].recipe?.id).toBe("r1");
  });

  it("excludes inactive and non-finished products regardless of stock", () => {
    const groups = buildBulkProductGroups([
      { ...product("ok", "APPAM", "APP"), currentStock: 0 } as any,
      { ...product("inactive", "OLD", "OLD"), isActive: false },
      { ...product("raw", "RICE", "RM"), productType: "RAW_MATERIAL" },
    ], []);
    expect(groups.map((g) => g.anchorProduct.id)).toEqual(["ok"]);
  });
});
