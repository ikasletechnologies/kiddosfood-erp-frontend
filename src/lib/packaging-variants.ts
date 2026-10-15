// Finished-goods variant matching for Packaging & Confirmation: which
// existing product a pack-size row is packed into. Read-only over the
// product list; nothing here creates or changes a product.
import { convertUnit } from "@/lib/unitConversion";

// Pack size as a comparable amount in a base unit (g / ml / pcs).
export function canonicalSize(qty: number, unit: string): { amount: number; dim: string } | null {
  const u = unit.toUpperCase();
  if (u === "G" || u === "KG") return { amount: convertUnit(qty, u, "G"), dim: "W" };
  if (u === "ML" || u === "L") return { amount: convertUnit(qty, u, "ML"), dim: "V" };
  if (u === "PCS" || u === "PC" || u === "UNIT") return { amount: qty, dim: "C" };
  return null;
}

export function parseSizeText(text: string): { amount: number; dim: string } | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pcs|pc|unit)$/i);
  return m ? canonicalSize(Number(m[1]), m[2]) : null;
}

// Pack size a product represents: the SKU's size segment (the ERP SKU format
// always ends in one, e.g. FG-VEGD-500G), else a size at the end of its name.
export function productSize(p: any): { amount: number; dim: string } | null {
  const fromSku = (p.sku || "").match(/-(\d+(?:\.\d+)?)(KG|G|ML|L|PCS|PC)$/i);
  if (fromSku) return canonicalSize(Number(fromSku[1]), fromSku[2]);
  const fromName = (p.name || "").match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pcs)\.?\s*\)?\s*$/i);
  return fromName ? canonicalSize(Number(fromName[1]), fromName[2]) : null;
}

export const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
export const sameSize = (a: { amount: number; dim: string } | null, b: { amount: number; dim: string } | null) =>
  !!a && !!b && a.dim === b.dim && Math.abs(a.amount - b.amount) < 0.000001;

export const isSameBase = (p: any, base: string) => norm(p.name).includes(norm(base));

/**
 * Finished-goods variants for a pack size.
 * - `linked`: active, SKU'd variants linked to this batch's recipe (a
 *   verified relationship). Exactly one is reused automatically; several
 *   need the operator to choose.
 * - `nameMatches`: same-size products whose name contains the batch's base
 *   name but which aren't linked to the recipe. Never used without the
 *   operator confirming.
 * Unrelated products of the same size are never offered.
 */
export function variantChoices(products: any[], base: string, packetSize: string, linked: Set<string> = new Set()): { linked: any[]; nameMatches: any[] } {
  const want = parseSizeText(packetSize);
  if (!want) return { linked: [], nameMatches: [] };
  const sameSizeList = products.filter((p) => p.isActive !== false && p.sku && sameSize(productSize(p), want));
  return {
    linked: sameSizeList.filter((p) => linked.has(p.id)),
    nameMatches: sameSizeList.filter((p) => !linked.has(p.id) && isSameBase(p, base)),
  };
}

export const SKU_RE = /^[A-Z0-9][A-Z0-9-]{1,63}$/;

/**
 * First problem with a Create New Variant entry, or null. Checks against the
 * loaded product list; the server re-checks SKU uniqueness on confirm.
 */
export function newVariantProblem(
  input: { name: string; sku: string; packetSize: string },
  products: any[],
): string | null {
  const name = input.name.trim();
  const sku = input.sku.trim().toUpperCase();
  if (name.length < 2) return "Enter the product name";
  const sameName = products.find((p) => norm(p.name) === norm(name));
  if (sameName) return `"${sameName.name}" already exists — use it or enter a different name`;
  if (!SKU_RE.test(sku)) return "Enter a SKU (letters, numbers and hyphens)";
  const skuSize = productSize({ sku });
  const fromSku = sku.match(/-(\d+(?:\.\d+)?)(KG|G|ML|L|PCS|PC)$/i);
  if (!fromSku) return `SKU must end with the pack size, e.g. -${input.packetSize.toUpperCase()}`;
  if (!sameSize(skuSize, parseSizeText(input.packetSize))) return `SKU ends in ${fromSku[1]}${fromSku[2].toUpperCase()} but the pack size is ${input.packetSize}`;
  const owner = products.find((p) => (p.sku || "").toUpperCase() === sku);
  if (owner) return `SKU ${sku} already belongs to "${owner.name}"`;
  return null;
}
