import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvoiceInventoryStatus from '../InvoiceInventoryStatus';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}));
vi.mock('@/lib/api/base',()=>({default:mocks}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{role:'SUPER_ADMIN'}})}));
vi.mock('next/link',()=>({default:({children,...p}:any)=><a {...p}>{children}</a>}));
const review={inventoryStatus:'PENDING',canPost:true,warnings:[],challans:[],lines:[{orderItemId:'a',lotNumber:'LOT-A',quantity:1,unit:'PC',beforeQty:10,afterQty:9},{orderItemId:'b',lotNumber:'LOT-B',quantity:1,unit:'PC',beforeQty:1,afterQty:0}]};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.resetAllMocks();});
describe('Invoice inventory status',()=>{
it('shows pending separately and never posts on load; explicit confirmation dispatches and refreshes',async()=>{
 mocks.get.mockResolvedValueOnce({data:review}).mockResolvedValueOnce({data:{...review,inventoryStatus:'FULFILLED',canPost:false,lines:[]}});mocks.post.mockResolvedValue({data:{}});
 const refreshed=vi.fn();vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<InvoiceInventoryStatus invoiceId="invoice" orderId="order" onPosted={refreshed}/>);
 await screen.findByText('Pending');expect(screen.getByText('LOT-B')).toBeInTheDocument();expect(mocks.post).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Dispatch Selected Lots'}));
 await screen.findByText('Posted / Dispatched');await waitFor(()=>expect(refreshed).toHaveBeenCalledOnce());
 expect(mocks.post).toHaveBeenCalledTimes(1);expect(mocks.post).toHaveBeenCalledWith('/api/sales/invoices/invoice/dispatch-selected',{confirm:true});
 expect(screen.queryByRole('button',{name:'Dispatch Selected Lots'})).toBeNull();
});
it('keeps posting pending when dispatch confirmation is declined',async()=>{
 mocks.get.mockResolvedValue({data:review});vi.spyOn(window,'confirm').mockReturnValue(false);
 render(<InvoiceInventoryStatus invoiceId="invoice" orderId="order" onPosted={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Dispatch Selected Lots'}));expect(mocks.post).not.toHaveBeenCalled();
});
it('blocks posting ineligible lots and points to the existing challan flow',async()=>{
 mocks.get.mockResolvedValue({data:{...review,canPost:false,warnings:['Selected lot has expired.']}});
 render(<InvoiceInventoryStatus invoiceId="invoice" orderId="order" onPosted={vi.fn()}/>);
 await screen.findByText('Selected lot has expired.');expect(screen.queryByRole('button',{name:'Dispatch Selected Lots'})).toBeNull();
 expect(screen.getByRole('link',{name:'Open Delivery Challan'})).toHaveAttribute('href','/sales/delivery-challan?sourceInvoiceId=order');
});
});
