"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Landmark, Loader2, MapPin, Package, RefreshCw, Wallet, X } from "lucide-react";
import toast from "react-hot-toast";
import RequireSuperAdmin from "@/components/auth/RequireSuperAdmin";
import { accountsApi, inventoryApi } from "@/lib/api";
import { WarehouseApi, WarehouseStockItem } from "@/lib/api/warehouse.api";

type FranchiseWarehouse = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  location: string | null;
  franchiseId: string;
  franchiseName: string;
  binsCount?: number;
  batchCount?: number;
  movementsCount?: number;
  accounts: FranchiseAccount[];
};

type FranchiseAccount = {
  id: string;
  name: string;
  accountCode?: string | null;
  type: "CASH" | "BANK" | "UPI";
  balance: number;
  status?: string;
};

const errorMessage = (error: any) => error?.response?.data?.error || error?.message || "Request failed";

export default function FranchiseWarehousesPage() {
  return <RequireSuperAdmin><FranchiseWarehouseMonitor /></RequireSuperAdmin>;
}

function FranchiseWarehouseMonitor() {
  const [warehouses, setWarehouses] = useState<FranchiseWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FranchiseWarehouse | null>(null);
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await inventoryApi.getWarehouses({ includeInactive: true, scope: "FRANCHISE" });
      const warehouseRows = (response.data || []) as Omit<FranchiseWarehouse, "accounts">[];
      const accountsByFranchise = new Map<string, FranchiseAccount[]>();
      await Promise.all(Array.from(new Set(warehouseRows.map((warehouse) => warehouse.franchiseId))).map(async (franchiseId) => {
        try {
          const accountResponse = await accountsApi.getAll({ franchiseId });
          accountsByFranchise.set(franchiseId, accountResponse.data || []);
        } catch {
          accountsByFranchise.set(franchiseId, []);
        }
      }));
      setWarehouses(warehouseRows.map((warehouse) => ({ ...warehouse, accounts: accountsByFranchise.get(warehouse.franchiseId) || [] })));
    } catch (error) { toast.error(errorMessage(error)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const viewStock = async (warehouse: FranchiseWarehouse) => {
    setSelected(warehouse);
    setStockLoading(true);
    try { setStock(await WarehouseApi.getWarehouseStock(warehouse.id)); }
    catch (error) { toast.error(errorMessage(error)); setStock([]); }
    finally { setStockLoading(false); }
  };

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 dark:bg-background sm:p-6 lg:p-8">
      <div className="flex items-center justify-between rounded-2xl border bg-white p-6 dark:border-white/5 dark:bg-card">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-100 p-3 text-indigo-600"><Building2 /></div><div><h1 className="text-2xl font-black">Franchise Warehouses</h1><p className="text-sm text-slate-500">Read-only monitoring of existing franchise warehouse records</p></div></div>
        <button onClick={load} className="rounded-xl border p-2.5" title="Refresh"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></button>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white dark:border-white/5 dark:bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-white/[.03]"><tr><th className="p-4">Franchise</th><th className="p-4">Warehouse</th><th className="p-4">Location</th><th className="p-4">Accounts</th><th className="p-4 text-center">Batches</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead><tbody>{warehouses.map((warehouse) => { const accountBalance = warehouse.accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0); return <tr key={warehouse.id} className="border-t dark:border-white/5"><td className="p-4 font-bold">{warehouse.franchiseName}</td><td className="p-4"><span className="font-bold">{warehouse.name}</span><span className="block font-mono text-xs text-slate-500">{warehouse.code || "No code"}</span></td><td className="p-4 text-slate-500"><MapPin className="mr-1 inline h-3.5 w-3.5" />{warehouse.location || "—"}</td><td className="p-4"><span className="font-bold">{warehouse.accounts.length}</span><span className="block text-xs text-slate-500">₹{accountBalance.toLocaleString("en-IN")}</span></td><td className="p-4 text-center">{warehouse.batchCount || 0}</td><td className="p-4">{warehouse.status}</td><td className="p-4 text-right"><button onClick={() => viewStock(warehouse)} className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">View details</button></td></tr>})}{!loading && warehouses.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-500">No franchise warehouses are configured.</td></tr>}</tbody></table></div>{loading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-500" /></div>}</div>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-card"><div className="flex items-center justify-between border-b p-5 dark:border-white/10"><div><h2 className="font-black">{selected.franchiseName} — {selected.name}</h2><p className="text-xs text-slate-500">Read-only warehouse and financial account monitoring</p></div><button onClick={() => setSelected(null)}><X /></button></div><div className="max-h-[72vh] space-y-5 overflow-auto p-5"><section><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><Wallet className="h-4 w-4 text-indigo-500" />Franchise Accounts</h3>{selected.accounts.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selected.accounts.map((account) => <div key={account.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><div className="flex items-start justify-between"><div><p className="font-bold">{account.name}</p><p className="font-mono text-xs text-slate-500">{account.accountCode || "No account code"}</p></div><Landmark className="h-4 w-4 text-indigo-500" /></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase text-slate-400">{account.type}</p><p className="text-lg font-black">₹{Number(account.balance || 0).toLocaleString("en-IN")}</p></div><span className="text-[10px] font-bold text-emerald-600">{account.status || "ACTIVE"}</span></div></div>)}</div> : <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">No financial accounts created for this franchise.</div>}</section><section><h3 className="mb-3 flex items-center gap-2 text-sm font-black"><Package className="h-4 w-4 text-indigo-500" />Warehouse Inventory</h3><div className="overflow-x-auto rounded-xl border dark:border-white/10"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="p-4">Item / SKU</th><th className="p-4">Batch</th><th className="p-4">Bin</th><th className="p-4 text-right">Quantity</th><th className="p-4">Status</th></tr></thead><tbody>{stock.map((row) => <tr key={`${row.itemId}-${row.batchId}-${row.binId}`} className="border-t dark:border-white/5"><td className="p-4 font-bold">{row.itemName}<span className="block text-xs font-normal text-slate-500">{row.itemSku}</span></td><td className="p-4">{row.batchCode}</td><td className="p-4">{row.binCode}</td><td className="p-4 text-right font-mono">{row.balance} {row.unit}</td><td className="p-4">{row.status}</td></tr>)}{!stockLoading && stock.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-slate-500">No recorded stock.</td></tr>}</tbody></table>{stockLoading && <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>}</div></section></div></div></div>}
    </div>
  );
}
