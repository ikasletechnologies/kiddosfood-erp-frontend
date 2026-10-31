import { describe, expect, it } from 'vitest';
import { canReceivePO, poStatusLabel } from '../po-receipt';

describe('Purchase order direct receiving', () => {
  it('shows receiving for saved and legacy pending POs without an approval action', () => {
    for (const status of ['APPROVED', 'PENDING_APPROVAL', 'ORDERED', 'SENT', 'PARTIALLY_RECEIVED']) expect(canReceivePO({ status })).toBe(true);
    expect(poStatusLabel('PENDING_APPROVAL')).toBe('Ready for Receipt');
    expect(poStatusLabel('APPROVED')).toBe('Ready for Receipt');
  });
  it('blocks drafts and terminal POs even when an outdated eligibility flag is true', () => {
    for (const status of ['DRAFT', 'CANCELLED', 'CLOSED', 'RECEIVED', 'INVOICED', 'PAID']) expect(canReceivePO({ status, canReceive: true })).toBe(false);
  });
  it('counts awaiting POs once each, excluding fulfilled orders and preserving partial receipts', () => {
    const orders = [{ status: 'APPROVED', canReceive: true }, { status: 'PENDING_APPROVAL', canReceive: true }, { status: 'PARTIALLY_RECEIVED', totalItemsCount: 10, receivedItemsCount: 4 }, { status: 'APPROVED', canReceive: false }, { status: 'CANCELLED' }, { status: 'RECEIVED' }, { status: 'APPROVED', totalItemsCount: 10, receivedItemsCount: 10 }];
    expect(orders.filter(canReceivePO)).toHaveLength(3);
    expect(poStatusLabel('RECEIVED')).toBe('Fully Received');
  });
});
