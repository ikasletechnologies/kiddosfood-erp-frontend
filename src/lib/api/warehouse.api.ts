import api from './base';

export interface WarehouseBin {
  id: string;
  warehouseId: string;
  code: string;
  description: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  bins: WarehouseBin[];
}

export interface WarehouseStockItem {
  itemId: string;
  itemName: string;
  itemSku: string;
  unit: string;
  batchId: string;
  batchCode: string;
  status: string;
  binId: string | null;
  binCode: string;
  balance: number;
}

export const WarehouseApi = {
  getPrimaryWarehouse: async (franchiseId: string) => {
    return api.get<Warehouse>(`/warehouse/primary?franchiseId=${franchiseId}`).then(res => res.data);
  },

  getWarehouseStock: async (warehouseId: string) => {
    return api.get<WarehouseStockItem[]>(`/warehouse/${warehouseId}/stock`).then(res => res.data);
  },

  createBin: async (warehouseId: string, data: { code: string; description?: string }) => {
    return api.post<WarehouseBin>(`/warehouse/${warehouseId}/bins`, data).then(res => res.data);
  },

  updateBin: async (binId: string, data: { code: string; description?: string }) => {
    return api.put<WarehouseBin>(`/warehouse/bins/${binId}`, data).then(res => res.data);
  },

  deleteBin: async (binId: string) => {
    return api.delete(`/warehouse/bins/${binId}`).then(res => res.data);
  },

  assignBin: async (warehouseId: string, data: { itemId: string; batchId?: string; quantity: number; newBinId: string }) => {
    return api.post(`/warehouse/${warehouseId}/assign-bin`, data).then(res => res.data);
  }
};
