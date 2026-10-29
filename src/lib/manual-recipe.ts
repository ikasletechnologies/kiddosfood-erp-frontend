import { convertMeasurement, ValidUnit } from '@businessgroupikasle/erp-units';
export const MANUAL_YIELD_UNITS = ['KG','G','L','ML','PCS','BOX'];
export const MANUAL_INGREDIENT_UNITS = ['KG','G','L','ML','PCS'];
export interface ManualIngredient { inventoryItemId: string; quantity: string; unit: string }
export function referenceOf(recipe: any) {
  const active = recipe.activeFormulation;
  const rows = active?.items ?? recipe.recipeItems ?? [];
  const ids: string[] = recipe.ingredients?.length ? recipe.ingredients.map((i: any) => i.inventoryItemId) : Array.from(new Set<string>(rows.map((i: any) => i.inventoryItemId)));
  return {
    yieldQty: active || rows.length ? String(active?.yieldQty ?? recipe.yieldQty ?? '') : '',
    yieldUnit: String(active?.yieldUnit ?? recipe.yieldUnit ?? 'KG').toUpperCase(),
    items: ids.map(inventoryItemId => {
      const row = rows.find((i: any) => i.inventoryItemId === inventoryItemId);
      return { inventoryItemId, quantity: row ? String(row.quantity ?? row.quantityRequired ?? '') : '', unit: String(row?.unit ?? 'KG').toUpperCase() };
    }),
  };
}
export function validateReference(form: {yieldQty: string; yieldUnit: string; items: ManualIngredient[]}, materials: any[]) {
  if (!Number.isFinite(Number(form.yieldQty)) || Number(form.yieldQty) <= 0) return 'Expected output quantity must be greater than zero.';
  if (!MANUAL_YIELD_UNITS.includes(form.yieldUnit)) return 'Select a supported reference output unit.';
  if (!form.items.length) return 'Add at least one ingredient.';
  if (new Set(form.items.map(i=>i.inventoryItemId)).size !== form.items.length) return 'Each ingredient can only be added once.';
  for (let index=0; index<form.items.length; index++) {
    const item=form.items[index];
    const material=materials.find(m=>m.id===item.inventoryItemId);
    if (!material) return 'Select a raw material for ingredient '+(index+1)+'.';
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity)<=0) return 'Enter a positive reference quantity for '+material.name+'.';
    if (!MANUAL_INGREDIENT_UNITS.includes(item.unit)) return 'Select a supported ingredient measurement unit.';
    try { convertMeasurement('1',item.unit as ValidUnit,String(material.unit).toUpperCase() as ValidUnit); }
    catch { return material.name+' is stocked in '+material.unit+'; choose a compatible measurement unit.'; }
  }
  return null;
}
