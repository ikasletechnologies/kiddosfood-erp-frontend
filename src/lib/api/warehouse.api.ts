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

// The role-aware, franchise-enriched warehouse list lives on the existing
// inventoryApi.getWarehouses() (GET /api/warehouses) — see its JSDoc for the
// response shape. Not duplicated here to avoid two clients for one endpoint.
export interface WarehouseListItem {
  id: string;
  name: string;
  code: string | null;
  franchiseId: string | null;
  franchiseName: string | null;
}

export interface WarehouseBinDetail {
  id: string;
  warehouseId: string;
  code: string;
  description: string | null;
  itemCount: number;
  totalQuantity: number;
  hasStock: boolean;
  status: string;
  warehouse: {
    id: string;
    name: string;
    code: string | null;
    location: string | null;
    status: string;
    type: string | null;
  } | null;
}

export const WarehouseApi = {
  getPrimaryWarehouse: async (franchiseId: string) => {
    return api.get<Warehouse>(`/api/warehouse/primary?franchiseId=${franchiseId}`).then(res => res.data);
  },

  // For SUPER_ADMIN picking an arbitrary warehouse from the global list —
  // getPrimaryWarehouse only resolves via a franchise's primaryWarehouseId.
  getWarehouseById: async (warehouseId: string) => {
    return api.get<Warehouse>(`/api/warehouse/${warehouseId}`).then(res => res.data);
  },

  getWarehouseStock: async (warehouseId: string) => {
    return api.get<WarehouseStockItem[]>(`/api/warehouse/${warehouseId}/stock`).then(res => res.data);
  },

  getAllBins: async (params?: { warehouseId?: string }) => {
    return api.get<WarehouseBinDetail[]>('/api/warehouse/bins', { params }).then(res => res.data);
  },

  createBinDirect: async (data: { warehouseId: string; code: string; description?: string }) => {
    return api.post<WarehouseBinDetail>('/api/warehouse/bins', data).then(res => res.data);
  },

  createBin: async (warehouseId: string, data: { code: string; description?: string }) => {
    return api.post<WarehouseBin>(`/api/warehouse/${warehouseId}/bins`, data).then(res => res.data);
  },

  updateBin: async (binId: string, data: { code: string; description?: string }) => {
    return api.put<WarehouseBinDetail>(`/api/warehouse/bins/${binId}`, data).then(res => res.data);
  },

  deleteBin: async (binId: string) => {
    return api.delete(`/api/warehouse/bins/${binId}`).then(res => res.data);
  },

  assignBin: async (warehouseId: string, data: { itemId: string; batchId?: string; quantity: number; newBinId: string }) => {
    return api.post(`/api/warehouse/${warehouseId}/assign-bin`, data).then(res => res.data);
  }
};

