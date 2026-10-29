export type ProductionProduct = {
  id: string;
  name: string;
  sku?: string | null;
  isActive?: boolean;
  productType?: string;
  packSize?: { quantity?: number; unit?: string } | null;
};

export type ProductionRecipe = {
  id: string;
  name: string;
  productId?: string | null;
  product?: { id: string; name: string } | null;
  productLinks?: Array<{ productId: string; product?: { id: string; name: string; sku?: string | null } }>;
  activeFormulation?: any;
  ingredients?: Array<{ inventoryItemId: string }>;
  recipeItems?: Array<{ inventoryItemId: string }>;
};

export type BulkProductGroup = {
  id: string;
  name: string;
  recipe: ProductionRecipe | null;
  products: ProductionProduct[];
  anchorProduct: ProductionProduct;
  aliases: string[];
  conflict: boolean;
  suggested: boolean;
};

const exactCatalogName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleUpperCase("en-IN");

/**
 * Groups only through persisted recipe/product relations. Names and pack-size
 * text are deliberately never used as identity: an unlinked SKU remains its
 * own reviewable entry until an administrator creates a real association.
 */
export function buildBulkProductGroups(products: ProductionProduct[], recipes: ProductionRecipe[]): BulkProductGroup[] {
  const eligible = products.filter((p) => p.isActive !== false && p.productType === "FINISHED_GOOD");
  const productById = new Map(eligible.map((p) => [p.id, p]));
  const recipesByProduct = new Map<string, ProductionRecipe[]>();

  for (const recipe of recipes) {
    const ids = new Set<string>([
      ...(recipe.productId ? [recipe.productId] : []),
      ...(recipe.product?.id ? [recipe.product.id] : []),
      ...(recipe.productLinks || []).map((link) => link.productId),
    ]);
    for (const id of Array.from(ids)) {
      if (!productById.has(id)) continue;
      recipesByProduct.set(id, [...(recipesByProduct.get(id) || []), recipe]);
    }
  }

  const groups: BulkProductGroup[] = [];
  const assigned = new Set<string>();
  for (const recipe of recipes) {
    const ids = new Set<string>([
      ...(recipe.productId ? [recipe.productId] : []),
      ...(recipe.product?.id ? [recipe.product.id] : []),
      ...(recipe.productLinks || []).map((link) => link.productId),
    ]);
    const members = Array.from(ids).map((id) => productById.get(id)).filter(Boolean) as ProductionProduct[];
    const confirmed = members.filter((p) => !assigned.has(p.id));
    const confirmedNames = new Set(confirmed.map((p) => exactCatalogName(p.name)));
    // Exact catalog-name equality is a suggestion, not fuzzy identity. It
    // catches APPAM products whose pack size lives in SKU while avoiding any
    // stripping of numbers/units from genuinely different product names.
    const suggested = eligible.filter((p) => !assigned.has(p.id) && !(recipesByProduct.get(p.id)?.length) && confirmedNames.has(exactCatalogName(p.name)));
    const unassigned = Array.from(new Map([...confirmed, ...suggested].map((p) => [p.id, p])).values());
    if (!unassigned.length) continue;
    unassigned.forEach((p) => assigned.add(p.id));
    groups.push({
      id: `recipe:${recipe.id}`,
      name: recipe.name,
      recipe,
      products: unassigned,
      anchorProduct: unassigned.find((p) => p.id === recipe.productId) || unassigned[0],
      aliases: Array.from(new Set(unassigned.flatMap((p) => [p.name, p.sku || ""]).filter(Boolean))),
      conflict: unassigned.some((p) => (recipesByProduct.get(p.id) || []).length > 1),
      suggested: suggested.length > 0,
    });
  }

  const unlinkedByName = new Map<string, ProductionProduct[]>();
  for (const product of eligible) {
    if (assigned.has(product.id)) continue;
    const key = exactCatalogName(product.name);
    unlinkedByName.set(key, [...(unlinkedByName.get(key) || []), product]);
  }
  for (const sameNameProducts of Array.from(unlinkedByName.values())) {
    const product = sameNameProducts[0];
    groups.push({
      id: `product:${product.id}`,
      name: product.name,
      recipe: null,
      products: sameNameProducts,
      anchorProduct: product,
      aliases: Array.from(new Set(sameNameProducts.flatMap((p) => [p.name, p.sku || ""]).filter(Boolean))),
      conflict: false,
      suggested: sameNameProducts.length > 1,
    });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}
