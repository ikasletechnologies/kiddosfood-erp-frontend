export type FinishedGoodsStockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
export function finishedGoodsStockStatus(available: number, threshold: number): FinishedGoodsStockStatus {
  if (available <= 0) return 'OUT_OF_STOCK';
  return available <= threshold ? 'LOW_STOCK' : 'IN_STOCK';
}
