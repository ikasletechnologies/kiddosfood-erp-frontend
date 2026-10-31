import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import PurchaseOrdersClient from '../PurchaseOrdersClient';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: {}, purchaseOrdersApi: { getAll: mocks.list }, vendorsApi: { getAll: async () => ({ data: [] }) }, rawMaterialsApi: { getAll: async () => ({ data: [] }) }, settingsApi: { getCompanyProfile: async () => ({ data: null }) }, accountsApi: { getAll: async () => ({ data: [] }) } }));
vi.mock('@/components/documents/GSTInvoice', () => ({ default: () => null }));
vi.mock('../RecordPaymentModal', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...p }: any) => <a {...p}>{children}</a> }));
vi.mock('@/lib/utils', () => ({ formatDate: (v:any) => String(v || ''), formatCurrency: (v:any) => String(v || 0), formatQuantity: (v:any) => String(v || 0), formatERPNumber: (_t:any, v:any) => String(v) }));
const make = (status:string, canReceive:boolean) => ({ id: status, poNumber: status, status, canReceive, vendor: { name: `${status} vendor` }, createdAt: '2026-10-31', totalAmount: 100, totalItemsCount: 10, receivedItemsCount: status === 'PARTIALLY_RECEIVED' ? 4 : status === 'RECEIVED' ? 10 : 0, paid: 0 });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('Purchase Order list without manual approval', () => {
  it('renders immediate and remaining receipt actions, draft completion and accurate pending count', async () => {
    mocks.list.mockResolvedValue({ data: [make('APPROVED', true), make('PENDING_APPROVAL', true), make('PARTIALLY_RECEIVED', true), make('DRAFT', false), make('CANCELLED', false), make('RECEIVED', false)] });
    render(<PurchaseOrdersClient />);
    await screen.findByText('APPROVED vendor');
    expect(screen.getAllByRole('button', { name: 'Receive Goods' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Receive Remaining Goods' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit / Complete PO' })).toHaveAttribute('href', '/purchases/edit/DRAFT');
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pending Approval' })).toBeNull();
    expect(within(screen.getByText('Pending GRNs').parentElement!).getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ready for Receipt' }));
    expect(screen.getByText('PENDING_APPROVAL vendor')).toBeInTheDocument();
    expect(screen.queryByText('DRAFT vendor')).toBeNull();
  });
});
