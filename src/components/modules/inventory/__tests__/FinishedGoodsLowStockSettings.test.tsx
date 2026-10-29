import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FinishedGoodsLowStockProvider,LowStockSettingsButton} from '../FinishedGoodsLowStockSettings';
import FinishedGoodsStockClient from '../FinishedGoodsStockClient';
import {finishedGoodsStockStatus} from '@/lib/finished-goods-stock';
const mocks=vi.hoisted(()=>({get:vi.fn(),put:vi.fn(),role:'SUPER_ADMIN',value:5}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{role:mocks.role}})}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/lib/api/base',()=>({default:{get:mocks.get,put:mocks.put}}));
vi.mock('../ProductDemandDrawer',()=>({default:()=>null}));
vi.mock('../BranchStockDrawer',()=>({default:()=>null}));
vi.mock('../FinishedGoodsLotsPanel',()=>({default:()=>null}));
vi.mock('../MinimizedImportWidget',()=>({default:()=>null}));
const products=[{id:'p1',name:'APPAM 250g',sku:'FG-APPA-250G',category:'FINISHED_GOOD',unit:'PC'}, {id:'p2',name:'APPAM 500g',sku:'FG-APPA-500G',category:'FINISHED_GOOD',unit:'PC'}, {id:'p3',name:'APPAM 900g',sku:'FG-APPA-900G',category:'FINISHED_GOOD',unit:'PC'}, {id:'p4',name:'KAMBU DOSA 1kg',sku:'FG-KAMB-1KG',category:'FINISHED_GOOD',unit:'PC'}];
vi.mock('@/lib/api',()=>({
  default:{get:mocks.get},productsFullApi:{getAll:async()=>({data:products})},
  franchiseProductRequestsApi:{getAll:async()=>({data:[]})},franchiseOrdersApi:{getAll:async()=>({data:[]})},
  franchiseApi:{getAll:async()=>({data:[]})},
  rawMaterialsApi:{getAll:async()=>({data:products.map((p,i)=>({...p,id:'item-'+i,currentStock:[10,5,3,0][i],minimumStock:999,franchiseId:null}))})},
  recallApi:{quarantineSummary:async()=>({data:[]})},lotPricingApi:{listProducts:async()=>({data:{products:[]}})},
}));
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();mocks.role='SUPER_ADMIN';mocks.value=5;mocks.get.mockImplementation(async()=>({data:{finishedGoodsLowStockThreshold:mocks.value,unit:'PC'}}));mocks.put.mockImplementation(async(_url,data)=>{mocks.value=data.finishedGoodsLowStockThreshold;return {data:{finishedGoodsLowStockThreshold:mocks.value,unit:'PC'}};});});
afterEach(cleanup);
const Page=()=> <FinishedGoodsLowStockProvider><LowStockSettingsButton/><FinishedGoodsStockClient/></FinishedGoodsLowStockProvider>;
async function openSettings(){const button=await screen.findByRole('button',{name:'Low Stock Settings'});await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);return screen.getByRole('spinbutton',{name:'Low Stock Alert Quantity'});}

it('uses one global setting for all SKU counts, filters and badges, ignoring per-item minimums',async()=>{
  render(<Page/>);await screen.findByText('Low Stock Alert: ≤ 5 PC');await screen.findByText('APPAM 900g');
  expect(screen.getAllByRole('button',{name:'Low Stock Settings'})).toHaveLength(1);
  fireEvent.click(screen.getByRole('button',{name:'Low Stock'}));
  expect(screen.getByText('APPAM 500g')).toBeVisible();expect(screen.getByText('APPAM 900g')).toBeVisible();
  expect(screen.queryByText('APPAM 250g')).toBeNull();expect(screen.queryByText('KAMBU DOSA 1kg')).toBeNull();
  const input=await openSettings();expect(input).toHaveValue(5);
  fireEvent.change(input,{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Save Settings'}));
  await screen.findByText('Low Stock Alert: ≤ 2 PC');
  expect(mocks.put).toHaveBeenCalledWith('/api/settings/finished-goods-low-stock',{finishedGoodsLowStockThreshold:2});
  expect(screen.queryByText('APPAM 900g')).toBeNull();expect(screen.queryByText('APPAM 500g')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'In Stock'}));
  expect(screen.getByText('APPAM 900g')).toBeVisible();expect(screen.getByText('APPAM 500g')).toBeVisible();expect(screen.queryByText('KAMBU DOSA 1kg')).toBeNull();
});
it('persists zero after remount and always keeps zero quantities Out of Stock',async()=>{
  const first=render(<Page/>);const input=await openSettings();fireEvent.change(input,{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'Save Settings'}));await screen.findByText('Low Stock Alert: ≤ 0 PC');
  fireEvent.click(screen.getByRole('button',{name:'Out of Stock'}));expect(screen.getByText('KAMBU DOSA 1kg')).toBeVisible();
  first.unmount();render(<Page/>);await screen.findByText('Low Stock Alert: ≤ 0 PC');
  fireEvent.click(screen.getByRole('button',{name:'Low Stock'}));expect(screen.queryByText('KAMBU DOSA 1kg')).toBeNull();expect(screen.queryByText('APPAM 900g')).toBeNull();
});
it.each(['-1','1.5',''])('rejects invalid value %s without writing settings',async value=>{
  render(<Page/>);const input=await openSettings();fireEvent.change(input,{target:{value}});fireEvent.click(screen.getByRole('button',{name:'Save Settings'}));
  expect(screen.getByRole('alert')).toHaveTextContent('non-negative whole number');expect(mocks.put).not.toHaveBeenCalled();
});
it('Cancel does not change the global threshold',async()=>{
  render(<Page/>);const input=await openSettings();fireEvent.change(input,{target:{value:'100'}});fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(mocks.put).not.toHaveBeenCalled();expect(screen.getByText('Low Stock Alert: ≤ 5 PC')).toBeVisible();
});
it('hides the settings action for franchise users',async()=>{
  mocks.role='FRANCHISE_ADMIN';render(<Page/>);await screen.findByText('Low Stock Alert: ≤ 5 PC');expect(screen.queryByRole('button',{name:'Low Stock Settings'})).toBeNull();
});
it('does not substitute a default threshold when configuration cannot be loaded',async()=>{
  mocks.get.mockRejectedValue(new Error('offline'));render(<Page/>);
  await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Low Stock Settings'})).toBeDisabled();
  expect(screen.queryByText('Low Stock Alert: ≤ 5 PC')).toBeNull();expect(mocks.put).not.toHaveBeenCalled();
});
it.each([[0,5,'OUT_OF_STOCK'],[3,5,'LOW_STOCK'],[5,5,'LOW_STOCK'],[10,5,'IN_STOCK'],[3,2,'IN_STOCK'],[1,0,'IN_STOCK']] as const)('classifies %s against %s as %s',(stock,threshold,status)=>{
  expect(finishedGoodsStockStatus(stock,threshold)).toBe(status);
});
