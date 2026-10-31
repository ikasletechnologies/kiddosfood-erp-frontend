import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PurchaseReturnDetailsModal from '../PurchaseReturnDetailsModal';

it('shows saved zero tax and the original return credit in return details', () => {
  render(<PurchaseReturnDetailsModal data={{ returnNumber:'PR-TEST', createdAt:'2026-10-31T10:00:00Z', status:'COMPLETED', vendor:{name:'Supplier'}, items:[], taxableValue:100, refundAmount:100, taxAmount:0, cgst:2.5, sgst:2.5 }} onClose={vi.fn()} onUpdateStatus={vi.fn()} />);
  expect(screen.getByText('Return GST').parentElement?.textContent).toContain('₹0');
  expect(screen.getByText('Return Goods Value').parentElement?.textContent).toContain('₹100');
  expect(screen.getByText('Total Return Credit').parentElement?.textContent).toContain('₹100');
});
