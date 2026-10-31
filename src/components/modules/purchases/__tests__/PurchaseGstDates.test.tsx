import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewPurchaseContent } from '../PurchaseFormContent';
import LineItemsTable from '@/components/documents/LineItemsTable';
const mocks=vi.hoisted(()=>({form:{} as any,create:vi.fn(),error:vi.fn(),push:vi.fn()}));
vi.mock('@/context/PurchaseOrderContext',()=>({usePurchaseOrder:()=>mocks.form,PurchaseOrderProvider:({children}:any)=>children}));
vi.mock('@/lib/api',()=>({inventoryApi:{getWarehouses:async()=>({data:[]})},purchaseOrdersApi:{create:mocks.create},rawMaterialsApi:{getAll:async()=>({data:[{id:'m',name:'TEST',unit:'PC',gstRate:5}]})},productsApi:{}}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:mocks.push}),useSearchParams:()=>({get:()=>null})}));
vi.mock('next/link',()=>({default:({children,...p}:any)=><a {...p}>{children}</a>}));
vi.mock('react-hot-toast',()=>({toast:{error:mocks.error,success:vi.fn()}}));
vi.mock('@/components/documents/DocumentHeader',()=>({default:()=>null}));
vi.mock('@/components/documents/BillingSection',()=>({default:()=>null}));
vi.mock('@/components/documents/DocumentSummary',()=>({default:()=>null}));
vi.mock('@/components/modals/WarehouseFormSidebar',()=>({default:()=>null}));
vi.mock('@/components/modules/inventory/AddMaterialDrawer',()=>({default:()=>null}));
beforeEach(()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-31T10:00:00Z'));
 mocks.form={purchaseDate:'2026-10-31',expectedDeliveryDate:'2026-10-31',originalExpectedDeliveryDate:'',poStatus:'DRAFT',purchaseType:'RAW_MATERIAL',selectedVendor:{id:'v',status:'ACTIVE',suppliedMaterials:[]},items:[{id:'line',materialId:'m',name:'Material',unit:'PC',quantity:10,price:10,gstRate:0}],totals:{subtotal:100,appliedAdvance:0},discountAmount:0,freightCost:0,isValid:true,isSubmitting:false,errors:[],autoFilledIds:new Set(),getVendorPrice:()=>0};
 for(const method of ['setPurchaseDate','setExpectedDeliveryDate','setWarehouseId','setPurchaseType','setIsBulkPurchase','setPaymentTerms','setDiscountAmount','setFreightCost','setInternalNotes','setVendorNotes','setSelectedVendor','setIsSubmitting','setPoNumber','setContextMessage','updateItem','addItem','removeItem','setAutoFilledIds'])mocks.form[method]=vi.fn();
 mocks.create.mockResolvedValue({data:{poNumber:'PO-TEST'}});
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
describe('Purchase GST and date controls',()=>{
 it('locks Purchase Date and sets delivery minimum to the business date',async()=>{await act(async()=>{render(<NewPurchaseContent/>);});const date=screen.getByLabelText('Purchase Date');expect(date).toHaveAttribute('readonly');expect(date).toHaveValue('2026-10-31');expect(screen.getByLabelText('Expected Delivery')).toHaveAttribute('min','2026-10-31');expect(screen.getByLabelText('Expected Delivery')).toBeRequired();});
 it('blocks a manually submitted past delivery with a clear error',async()=>{mocks.form.expectedDeliveryDate='2026-10-30';await act(async()=>{render(<NewPurchaseContent/>);});fireEvent.click(screen.getByRole('button',{name:'Create PO'}));expect(mocks.create).not.toHaveBeenCalled();expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('today or a future'));});
 it('submits date-only fields and explicit zero GST without UTC conversion',async()=>{await act(async()=>{render(<NewPurchaseContent/>);});fireEvent.click(screen.getByRole('button',{name:'Create PO'}));await waitFor(()=>expect(mocks.create).toHaveBeenCalledOnce());expect(mocks.create.mock.calls[0][0]).toMatchObject({purchaseDate:'2026-10-31',expectedDeliveryDate:'2026-10-31',status:'APPROVED',items:[expect.objectContaining({gstRate:0})]});});
 it('keeps selected zero GST when material-name auto-fill sees a 5% master',async()=>{await act(async()=>{render(<LineItemsTable/>);});await waitFor(()=>expect(mocks.form.updateItem).toHaveBeenCalledWith('line',expect.objectContaining({name:'TEST',gstRate:0})));});
 it('keeps a configured custom GST rate visible in the selectors',async()=>{mocks.form.items[0].gstRate=2.5;await act(async()=>{render(<LineItemsTable/>);});await waitFor(()=>expect(screen.getAllByRole('option',{name:'2.5%'})).toHaveLength(2));});
});
