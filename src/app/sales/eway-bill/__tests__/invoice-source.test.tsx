import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import EWayBillForm from '../EWayBillForm';
import InvoiceEWayBills from '@/components/sales/InvoiceEWayBills';
import {Masters} from '../ewaybill-ui';

const mocks=vi.hoisted(()=>({sources:vi.fn(),prefill:vi.fn(),create:vi.fn(),update:vi.fn(),validate:vi.fn(),submit:vi.fn(),list:vi.fn(),toast:vi.fn()}));
vi.mock('@/lib/api',()=>({ewayBillApi:{getSources:mocks.sources,prefill:mocks.prefill,create:mocks.create,update:mocks.update,validate:mocks.validate,submit:mocks.submit,getAll:mocks.list}}));
vi.mock('@/context/ToastContext',()=>({useToast:()=>({showToast:mocks.toast})}));
const masters:Masters={subSupplyTypes:{'1':'Supply','8':'Others'},supplyDocMatrix:{O:{'1':['INV'],'8':['CHL','OTH']}},docTypes:{INV:'Tax Invoice',CHL:'Delivery Challan',OTH:'Others'},transModes:{'1':'Road','2':'Rail'},cancelReasons:{},vehicleUpdateReasons:{},extensionReasons:{},threshold:50000,consignor:{},generationAvailable:false};
const document={id:'invoice-id',docNo:'INV-2026-0009',partyName:'Customer Charity',partyType:'CUSTOMER',date:'2026-10-28',amount:105};
const payload={sourceType:'SALE_INVOICE',sourceId:'invoice-id',supplyType:'O',subSupplyType:'1',docType:'INV',docNo:document.docNo,docDate:'2026-10-28',transactionType:2,fromGstin:'33AAAAA0000A1Z5',fromTradeName:'Test Foods',fromAddr1:'HQ address',fromPlace:'Chennai',fromPincode:'600001',fromStateCode:33,actFromStateCode:33,toGstin:'URP',toTradeName:'Customer Charity',toAddr1:'Shipping address',toPincode:'641004',toStateCode:33,actToStateCode:33,transMode:'1',transDistance:20,vehicleNo:'',items:[{productName:'APPAM 500g',productDesc:'FG-APPA-500G',hsnCode:'1905',quantity:1,qtyUnit:'PCS',taxableAmount:100,cgstRate:2.5,sgstRate:2.5}],warnings:['Invoice is not fully fulfilled. Confirm actual dispatch.'],sourceSummary:{invoiceId:'invoice-id',invoiceAmount:105,billingAddress:'Billing address',shippingAddress:'Shipping address',phone:'9888800000'}};
describe('Sale Invoice E-Way Bill wizard',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.spyOn(window,'scrollTo').mockImplementation(()=>{});mocks.sources.mockResolvedValue({data:[document]});mocks.prefill.mockResolvedValue({data:payload});mocks.create.mockResolvedValue({data:{id:'draft',refNumber:'EWB-DFT-00001',status:'DRAFT'}});mocks.update.mockResolvedValue({data:{id:'draft',status:'DRAFT'}});mocks.validate.mockResolvedValue({data:{valid:true,generationAvailable:false,errors:[],message:'No authorised NIC/GSP API integration is configured. No official E-Way Bill has been generated.'}});});
  afterEach(()=>{cleanup();vi.restoreAllMocks();});
  const mount=(extra:any={})=>render(<EWayBillForm masters={masters} onCancel={vi.fn()} onSaved={vi.fn()} {...extra}/>);
  it('adds Sale Invoice before Delivery Challan and Manual, with debounced party/phone search',async()=>{
    mount();const sale=screen.getByRole('button',{name:'Sale Invoice'}),dc=screen.getByRole('button',{name:'Delivery Challan'});
    expect(sale.compareDocumentPosition(dc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Search sale invoice/),{target:{value:'9888800000'}});
    await waitFor(()=>expect(mocks.sources).toHaveBeenLastCalledWith('SALE_INVOICE','9888800000'));
  });
  it('fills source details and saves canonical invoice ID with editable shipment fields',async()=>{
    const saved=vi.fn();mount({onSaved:saved});fireEvent.click(await screen.findByRole('button',{name:/INV-2026-0009/}));
    expect(await screen.findByDisplayValue('Test Foods')).toBeInTheDocument();expect(screen.getByDisplayValue('1905')).toBeInTheDocument();expect(screen.getByText('Billing: Billing address')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Vehicle No\./),{target:{value:'TN01AB1234'}});
    fireEvent.click(screen.getAllByRole('button',{name:'Save Draft'})[0]);
    await waitFor(()=>expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({sourceType:'SALE_INVOICE',sourceId:'invoice-id',vehicleNo:'TN01AB1234',items:[expect.objectContaining({hsnCode:'1905',quantity:1,taxableAmount:100,cgstRate:2.5,sgstRate:2.5})]})));
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({status:'DRAFT'}));
  });
  it('requires confirmation before discarding edits and preserves manual/DC sources',async()=>{
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);mount();fireEvent.click(await screen.findByRole('button',{name:/INV-2026-0009/}));await screen.findByDisplayValue('Test Foods');
    fireEvent.change(screen.getByLabelText(/Vehicle No\./),{target:{value:'TN01AB1234'}});fireEvent.click(screen.getByRole('button',{name:'Manual'}));
    expect(confirm).toHaveBeenCalled();expect(screen.getByDisplayValue('TN01AB1234')).toBeInTheDocument();
    confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Manual'}));expect(screen.getByText(/Enter all details below/)).toBeInTheDocument();
    mocks.sources.mockResolvedValue({data:[{...document,id:'dc-id',docNo:'DC-001'}]});mocks.prefill.mockResolvedValue({data:{...payload,sourceType:'DELIVERY_CHALLAN',sourceId:'dc-id',docType:'CHL',subSupplyType:'8',docNo:'DC-001'}});
    fireEvent.click(screen.getByRole('button',{name:'Delivery Challan'}));fireEvent.click(await screen.findByRole('button',{name:/DC-001/}));
    await waitFor(()=>expect(mocks.prefill).toHaveBeenLastCalledWith('DELIVERY_CHALLAN','dc-id'));expect(await screen.findByDisplayValue('DC-001')).toBeInTheDocument();
  });
  it('validates without faking generation and updates the same draft on retries',async()=>{
    mount({initialInvoiceId:'invoice-id'});await screen.findByDisplayValue('Test Foods');fireEvent.click(screen.getByRole('button',{name:'Validate & Generate'}));
    expect(await screen.findByRole('status')).toHaveTextContent('No official E-Way Bill has been generated');expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Validate & Generate'}));await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith('draft',expect.any(Object)));expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it('opens existing records and displays actual validation errors',async()=>{
    mocks.sources.mockResolvedValue({data:[{...document,existingEwb:{id:'existing',status:'DRAFT',refNumber:'EWB-DFT-00001'}}]});const open=vi.fn();mount({onExisting:open});
    fireEvent.click(await screen.findByRole('button',{name:/EWB-DFT-00001/}));expect(open).toHaveBeenCalledWith('existing');expect(mocks.prefill).not.toHaveBeenCalled();
  });
  it('keeps server validation errors visible and never claims generation success',async()=>{
    mocks.create.mockRejectedValue({response:{status:422,data:{message:'Item 1: HSN code is required\nConsignee pincode is invalid'}}});mount({initialInvoiceId:'invoice-id'});await screen.findByDisplayValue('Test Foods');
    fireEvent.click(screen.getAllByRole('button',{name:'Save Draft'})[0]);expect(await screen.findByText('Item 1: HSN code is required')).toBeInTheDocument();expect(screen.getByText('Consignee pincode is invalid')).toBeInTheDocument();expect(mocks.submit).not.toHaveBeenCalled();
  });
  it('links the invoice detail to creation and existing response metadata',async()=>{
    mocks.list.mockResolvedValue({data:[]});const first=render(<InvoiceEWayBills invoiceId="invoice-id"/>);expect(await screen.findByRole('link',{name:'Generate E-Way Bill'})).toHaveAttribute('href','/sales/eway-bill?invoiceId=invoice-id');first.unmount();
    mocks.list.mockResolvedValue({data:[{id:'official',ewbNumber:'123456789012',status:'GENERATED',ewbDate:'2026-10-28T10:00:00Z',validUntil:'2026-10-29T18:29:59Z'}]});render(<InvoiceEWayBills invoiceId="invoice-id"/>);
    expect(await screen.findByText(/123456789012/)).toBeInTheDocument();expect(screen.getByRole('link',{name:'View / Download'})).toHaveAttribute('href','/sales/eway-bill?ewbId=official');expect(screen.queryByRole('link',{name:'Generate E-Way Bill'})).toBeNull();
  });
});
