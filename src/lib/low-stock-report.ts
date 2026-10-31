export type LowStockRow = {
  id: string; itemName: string; category: string; unit: string;
  minimumStock: number; stockQty: number; stockValue: number; shortfall: number;
  stockStatus: 'LOW_STOCK' | 'OUT_OF_STOCK'; status: string;
};
const categories: Record<string,string> = { FINISHED_GOOD:'Finished Goods', RAW_MATERIAL:'Raw Materials', SEMI_FINISHED:'Semi-Finished Goods' };
/** Consume the inventory API's classification, never SKU minima or a second global setting. */
export function lowStockReportRows(data:any): LowStockRow[] {
  const rows = Array.isArray(data) ? data : data?.alerts ?? data?.rows ?? data?.data ?? [];
  return rows.filter((r:any)=>['LOW_STOCK','OUT_OF_STOCK'].includes(r.stockStatus ?? r.status)).map((r:any)=>{
    const stockQty=Number(r.currentStock ?? r.stockQty ?? 0);
    const minimumStock=Number(r.lowStockThreshold ?? r.minStock ?? r.minimumStock ?? 0);
    const stockStatus=r.stockStatus ?? r.status;
    return {id:r.id,itemName:r.name ?? r.itemName ?? '—',category:categories[r.category] ?? r.category ?? '—',unit:r.unit ?? '—',
      minimumStock,stockQty,shortfall:Math.max(0,minimumStock-stockQty),
      stockValue:Number(r.stockValue ?? Math.max(0,stockQty)*Number(r.costPrice ?? 0)),stockStatus,
      status:stockStatus==='OUT_OF_STOCK'?'Out of Stock':'Low Stock'};
  });
}
export function lowStockReportCounts(rows: { status: string }[]) {
  return {total:rows.length,lowStock:rows.filter(r=>r.status==='Low Stock').length,outOfStock:rows.filter(r=>r.status==='Out of Stock').length};
}
export const lowStockExportHeaders=['Item Name','Category','Unit','Current Stock','Minimum Stock','Shortfall','Status','Stock Value'];
export function lowStockReportCsv(rows:LowStockRow[]) {
  const quote=(v:unknown)=>'"'+String(v).replace(/"/g,'""')+'"';
  return [lowStockExportHeaders,...rows.map(r=>[r.itemName,r.category,r.unit,r.stockQty,r.minimumStock,r.shortfall,r.status,r.stockValue.toFixed(2)])].map(row=>row.map(quote).join(',')).join('\n');
}
