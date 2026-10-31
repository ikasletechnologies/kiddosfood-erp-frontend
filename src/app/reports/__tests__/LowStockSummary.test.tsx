import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import Page from '../page';
import { FinishedGoodsLowStockProvider, LowStockSettingsButton } from '@/components/modules/inventory/FinishedGoodsLowStockSettings';
import { FINISHED_GOODS_SETTING_CHANGED, FINISHED_GOODS_SETTING_STORAGE_KEY } from '@/lib/stock-settings-events';
import { lowStockReportRows, lowStockReportCsv, lowStockReportCounts } from '@/lib/low-stock-report';
const mocks = vi.hoisted(() => ({ getAlerts: vi.fn(), exportExcel: vi.fn(), put: vi.fn(), threshold: 5 }));
const params = new URLSearchParams('parent=inventory&report=Low+Stock+Summary');
vi.mock('next/navigation', () => ({ useSearchParams: () => params, useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'SUPER_ADMIN' } }) }));
vi.mock('@/lib/api/base', () => ({
  default: {
    get: async () => ({ data: { finishedGoodsLowStockThreshold: mocks.threshold, unit: 'PC' } }),
    put: mocks.put,
  },
}));
vi.mock('@/lib/excelExport', () => ({ exportReportToExcel: mocks.exportExcel }));
vi.mock('@/lib/api/inventory.api', () => ({ inventoryApi: { getAlerts: mocks.getAlerts }, productsFullApi: {}, productionApi: {}, wasteApi: {}, recipesApi: {}, cartonApi: {} }));
const fixture = () => [
  ...[0, 1, 2, 3, 6].map(q => ({ id: 'fg' + q, name: 'APPAM ' + q, category: 'FINISHED_GOOD', unit: 'PC', currentStock: q, minimumStock: 99, lowStockThreshold: mocks.threshold, stockStatus: q === 0 ? 'OUT_OF_STOCK' : q <= mocks.threshold ? 'LOW_STOCK' : 'IN_STOCK' })),
  { id: 'raw', name: 'Aval', category: 'RAW_MATERIAL', unit: 'KG', currentStock: 8, minimumStock: 10, lowStockThreshold: 10, stockStatus: 'LOW_STOCK' },
  { id: 'semi', name: 'APPAM Bulk', category: 'SEMI_FINISHED', unit: 'KG', currentStock: 4, minimumStock: 5, lowStockThreshold: 5, stockStatus: 'LOW_STOCK' }
];
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.threshold = 5;
  mocks.put.mockImplementation(async (_url: string, data: any) => {
    mocks.threshold = data.finishedGoodsLowStockThreshold;
    return { data: { finishedGoodsLowStockThreshold: mocks.threshold, unit: 'PC' } };
  });
  mocks.getAlerts.mockImplementation(async () => ({ data: fixture() }));
  vi.spyOn(window, 'print').mockImplementation(() => {});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

it('uses global thresholds, preserves category units/minima, includes equality and zero, and exports those values',()=>{
  mocks.threshold=2;
  const rows=lowStockReportRows(fixture());
  expect(rows.filter(r=>r.category==='Finished Goods').map(r=>[r.stockQty,r.minimumStock,r.shortfall,r.status])).toEqual([[0,2,2,'Out of Stock'],[1,2,1,'Low Stock'],[2,2,0,'Low Stock']]);
  expect(rows.find(r=>r.id==='raw')).toMatchObject({minimumStock:10,unit:'KG',shortfall:2});
  expect(rows.find(r=>r.id==='semi')).toMatchObject({minimumStock:5,unit:'KG',shortfall:1});
  expect(lowStockReportCounts(rows)).toEqual({total:5,lowStock:4,outOfStock:1});
  const csv=lowStockReportCsv(rows);expect(csv).toContain('"APPAM 2","Finished Goods","PC","2","2","0","Low Stock"');
  expect(csv).toContain('"APPAM 0","Finished Goods","PC","0","2","2","Out of Stock"');
});

it('refreshes the actual reports route after setting saves and preserves print/Excel/search counters',async()=>{
  render(<Page/>);await screen.findByText('APPAM 3');expect(screen.getByText('6 Items')).toBeVisible();
  mocks.threshold=2;fireEvent(window,new CustomEvent(FINISHED_GOODS_SETTING_CHANGED,{detail:2}));
  await waitFor(()=>expect(screen.queryByText('APPAM 3')).toBeNull());
  await screen.findByText('APPAM 2');expect(screen.getByText('5 Items')).toBeVisible();
  const row=screen.getByText('APPAM 2').closest('tr')!;expect(within(row).getByText('Low Stock')).toBeVisible();
  expect(screen.getByText('Out of Stock')).toBeVisible();
  fireEvent.change(screen.getByPlaceholderText('Search in table...'),{target:{value:'APPAM 2'}});
  await waitFor(()=>expect(screen.getByText('1 Items')).toBeVisible());
  fireEvent.click(screen.getByTitle('Print'));expect(window.print).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTitle('Export to Excel'));
  await waitFor(()=>expect(mocks.exportExcel).toHaveBeenCalled());
  const exported=mocks.exportExcel.mock.calls[0][0];
  expect(JSON.stringify(exported)).toContain('Low Stock');expect(JSON.stringify(exported)).toContain('Minimum Stock');expect(JSON.stringify(exported)).toContain('"shortfall":"0"');expect(JSON.stringify(exported)).not.toContain('99');
});

it('refreshes on cross-tab storage, window focus and manual Refresh without using stale settings',async()=>{
  render(<Page/>);await screen.findByText('APPAM 3');
  mocks.threshold=2;fireEvent(window,new StorageEvent('storage',{key:FINISHED_GOODS_SETTING_STORAGE_KEY,newValue:'now'}));
  await waitFor(()=>expect(screen.queryByText('APPAM 3')).toBeNull());
  mocks.threshold=5;fireEvent.focus(window);await screen.findByText('APPAM 3');
  mocks.threshold=0;fireEvent.click(screen.getByTitle('Refresh'));
  await waitFor(()=>expect(screen.queryByText('APPAM 1')).toBeNull());expect(screen.getByText('APPAM 0')).toBeVisible();expect(screen.getByText('3 Items')).toBeVisible();
});

it('saving Stock Hub settings refreshes the report and survives a page remount', async () => {
  const first = render(
    <FinishedGoodsLowStockProvider>
      <LowStockSettingsButton />
      <Page />
    </FinishedGoodsLowStockProvider>
  );
  await screen.findByText('APPAM 3');
  const button = screen.getByRole('button', { name: 'Low Stock Settings' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Low Stock Alert Quantity' }), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
  await waitFor(() => expect(mocks.put).toHaveBeenCalledWith('/api/settings/finished-goods-low-stock', { finishedGoodsLowStockThreshold: 2 }));
  await waitFor(() => expect(screen.queryByText('APPAM 3')).toBeNull());
  expect(await screen.findByText('APPAM 2')).toBeVisible();
  first.unmount();
  render(<Page />);
  await screen.findByText('APPAM 2');
  expect(screen.queryByText('APPAM 3')).toBeNull();
  expect(screen.getByText('5 Items')).toBeVisible();
});
