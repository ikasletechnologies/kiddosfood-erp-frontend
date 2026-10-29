import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Page from '../page';

const mocks = vi.hoisted(() => ({ user: { role: 'SUPER_ADMIN', franchiseId: undefined as string | undefined }, get: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ default: { get: mocks.get }, franchiseOrdersApi: {}, franchiseProductRequestsApi: {}, accountsApi: {} }));
vi.mock('@/components/documents/GSTInvoice', () => ({ default: () => null }));
const orders = [
  { id: 'a', orderNumber: 'FO-001', franchiseId: 'f1', franchise: { id: 'f1', name: 'Coimbatore Main Branch', location: 'CBE' }, createdAt: '2026-10-28', status: 'APPROVED', paymentStatus: 'PAID', totalAmount: 378, items: [], hasInvoice: true, invoiceNum: 'INV-001' },
  { id: 'b', orderNumber: 'FO-002', franchiseId: 'f2', franchise: { id: 'f2', name: 'Chennai Branch', location: 'CHN' }, createdAt: '2026-10-28', status: 'PENDING', paymentStatus: 'UNPAID', totalAmount: 100, items: [] },
];
beforeEach(() => {
  mocks.user = { role: 'SUPER_ADMIN', franchiseId: undefined };
  mocks.get.mockImplementation(async (url: string) => ({ data: url === '/api/franchise-orders' ? orders : url === '/api/franchise' ? [] : url.includes('/api/products') ? [] : null }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('shows registered branch names, locations, invoice and unchanged order/payment statuses', async () => {
  render(<Page />);
  expect(await screen.findByText('Franchise: Coimbatore Main Branch')).toBeVisible();
  expect(screen.getByText(/Location: CBE/)).toBeVisible();
  expect(screen.getByText('FO-001')).toBeVisible();
  expect(screen.getByText('INV-001')).toBeVisible();
  expect(screen.getByText('Paid')).toBeVisible();
  expect(screen.getByText('Franchise: Chennai Branch')).toBeVisible();
});

it.each(['coimbatore', 'MAIN BRANCH', 'fo-001', 'cbe'])('searches by %s while preserving status filters', async query => {
  render(<Page />); await screen.findByText('FO-001');
  fireEvent.change(screen.getByRole('textbox', { name: 'Search franchise orders' }), { target: { value: query } });
  expect(screen.getByText('FO-001')).toBeVisible();
  expect(screen.queryByText('FO-002')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^PENDING$/ }));
  expect(screen.getByText('No orders found.')).toBeVisible();
});

it('shows only the authenticated franchise and retains delivered invoice/payment actions', async () => {
  mocks.user = { role: 'FRANCHISE_ADMIN', franchiseId: 'f1' };
  mocks.get.mockImplementation(async (url: string) => ({ data: url === '/api/franchise-orders' ? orders.map(order => ({ ...order, status: 'DELIVERED' })) : [] }));
  render(<Page />); await screen.findByText('Franchise: Coimbatore Main Branch');
  expect(screen.queryByText('FO-002')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View Invoice' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Payment Details' })).toBeVisible();
  expect(mocks.get).toHaveBeenCalledWith('/api/franchise-orders', { params: { franchiseId: 'f1' } });
});

it('retains Pay HQ for unpaid franchise orders', async () => {
  mocks.user = { role: 'FRANCHISE_ADMIN', franchiseId: 'f2' };
  mocks.get.mockImplementation(async (url: string) => ({ data: url === '/api/franchise-orders' ? orders.map(order => ({ ...order, status: 'DELIVERED' })) : [] }));
  render(<Page />); await screen.findByText('Franchise: Chennai Branch');
  expect(screen.getByRole('button', { name: 'Pay HQ' })).toBeVisible();
});

it('does not display any orders for an unassigned franchise admin', async () => {
  mocks.user = { role: 'FRANCHISE_ADMIN', franchiseId: undefined };
  render(<Page />); await screen.findByText('No orders found.');
  expect(screen.queryByText('FO-001')).not.toBeInTheDocument();
});

it('uses a safe fallback without substituting a login or location as the name', async () => {
  mocks.get.mockImplementation(async (url: string) => ({ data: url === '/api/franchise-orders' ? [{ ...orders[0], franchise: null }] : [] }));
  render(<Page />);
  expect(await screen.findByText('Franchise: Franchise unavailable')).toBeVisible();
  expect(screen.getByText(/Location: Not provided/)).toBeVisible();
});
