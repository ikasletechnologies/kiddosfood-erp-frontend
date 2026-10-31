import { describe, it, expect } from 'vitest';
import { referenceOf, validateReference } from '../manual-recipe';
const materials = [{ id: 'rice', name: 'Rice', unit: 'KG' }, { id: 'water', name: 'Water', unit: 'L' }, { id: 'egg', name: 'Egg', unit: 'PCS' }, { id: 'carton', name: 'Carton', unit: 'BOX' }];
const form = { yieldQty: '1', yieldUnit: 'KG', items: [{ inventoryItemId: 'rice', quantity: '600', unit: 'G' }] };
describe('manual recipe reference form', () => {
  it('hydrates active quantities and units instead of guessing from material defaults', () => {
    expect(referenceOf({ ingredients: [{ inventoryItemId: 'rice' }], activeFormulation: { yieldQty: 2, yieldUnit: 'KG', items: [{ inventoryItemId: 'rice', quantity: 600, unit: 'G' }] } })).toEqual({ ...form, yieldQty: '2' });
  });
  it('loads legacy BOM values and leaves selection-only quantities blank', () => {
    expect(referenceOf({ yieldQty: 3, yieldUnit: 'L', recipeItems: [{ inventoryItemId: 'water', quantityRequired: 500, unit: 'ML' }] }).items[0].quantity).toBe('500');
    expect(referenceOf({ ingredients: [{ inventoryItemId: 'rice' }], yieldQty: 1, yieldUnit: 'KG' })).toEqual({ ...form, yieldQty: '', items: [{ inventoryItemId: 'rice', quantity: '', unit: 'KG' }] });
  });
  it.each(['KG', 'G', 'L', 'ML', 'PCS', 'BOX'])('accepts reference yield in %s', unit => expect(validateReference({ ...form, yieldUnit: unit }, materials)).toBeNull());
  it.each([['rice', 'KG'], ['rice', 'G'], ['water', 'L'], ['water', 'ML'], ['egg', 'PCS'], ['carton', 'BOX']])('accepts compatible fractional %s quantities in %s', (id, unit) => expect(validateReference({ ...form, items: [{ inventoryItemId: id, quantity: '0.25', unit }] }, materials)).toBeNull());
  it.each(['0', '-1', '', 'NaN', 'Infinity'])('rejects invalid reference and ingredient quantity %s', quantity => {
    expect(validateReference({ ...form, yieldQty: quantity }, materials)).toBeTruthy();
    expect(validateReference({ ...form, items: [{ ...form.items[0], quantity }] }, materials)).toBeTruthy();
  });
  it('rejects duplicate, missing, incompatible and unsupported ingredients', () => {
    expect(validateReference({ ...form, items: [...form.items, ...form.items] }, materials)).toMatch(/once/);
    expect(validateReference({ ...form, items: [] }, materials)).toMatch(/at least/);
    expect(validateReference({ ...form, items: [{ ...form.items[0], unit: 'L' }] }, materials)).toMatch(/compatible/);
    expect(validateReference({ ...form, items: [{ ...form.items[0], unit: 'BOX' }] }, materials)).toMatch(/compatible/);
    expect(validateReference({ ...form, items: [{ ...form.items[0], unit: 'TON' }] }, materials)).toMatch(/supported/);
  });
});
