import api from './base';

// --- Accounts & Money Workflow ---
export const accountingApi = {
  getPayments: (params?: any) => api.get('/api/accounting/payments', { params }),
  recordPayment: (data: any) => api.post('/api/accounting/payments', data),
  getExpenses: (params?: any) => api.get('/api/accounting/expenses', { params }),
  getExpenseById: (id: string) => api.get(`/api/accounting/expenses/${id}`),
  recordExpense: (data: any) => api.post('/api/accounting/expenses', data),
  recordExpensePayment: (id: string, data: { amount: number, accountId: string, paymentMode: string, note?: string }) => 
    api.post(`/api/accounting/expenses/${id}/payment`, data),
  deleteExpense: (id: string) => api.delete(`/api/accounting/expenses/${id}`),
  getCashFlow: () => api.get('/api/finance/cash-flow'),
  getAccounts: () => api.get('/api/accounts'),
  transferFunds: (data: any) => api.post('/api/accounting/transfers', data),
  cancelPayment: (id: string) => api.post(`/api/accounting/payments/${id}/cancel`),
  getLedgerSummary: (params?: any) => api.get('/api/accounting/ledger-summary', { params }),
};

export const accountsApi = {
  getAll: () => api.get('/api/accounts'),
  getById: (id: string) => api.get(`/api/accounts/${id}`),
  create: (data: { name: string, type: 'CASH' | 'BANK' | 'UPI', balance?: number, franchiseId?: string, isActive?: boolean }) => api.post('/api/accounts', data),
  delete: (id: string) => api.delete(`/api/accounts/${id}`),
};

// --- Reports & Analytics (Financial & Operational) ---
export const reportsApi = {
  // Core metrics
  getInventoryValue: (franchiseId?: string) => api.get('/api/reports/inventory-value', { params: { franchiseId } }),

  // Transaction Reports
  getSales: (params?: any) => api.get('/api/reports/sales', { params }),
  getPurchases: (params?: any) => api.get('/api/reports/purchases', { params }),
  getDayBook: (params?: any) => api.get('/api/reports/daybook', { params }),
  getAllTransactions: (params?: any) => api.get('/api/reports/transactions', { params }),
  getProfit: (params?: any) => api.get('/api/reports/profit', { params }),
  getDetailedProfit: (params?: any) => api.get('/api/reports/profit', { params: { ...params, detailed: 'true' } }),
  getBillWiseProfit: (params?: any) => api.get('/api/reports/bill-wise-profit', { params }),
  getCashFlow: (params?: any) => api.get('/api/finance/cash-flow', { params }),
  getTrialBalance: (params?: any) => api.get('/api/reports/trial-balance', { params }),
  getBalanceSheet: (params?: any) => api.get('/api/reports/balance-sheet', { params }),
  getAccountSummary: (params?: any) => api.get('/api/reports/account-summary', { params }),

  // Party Reports
  getPartyStatement: (params?: any) => api.get('/api/reports/party-statement', { params }),
  getPartyProfitLoss: (params?: any) => api.get('/api/reports/party-profit-loss', { params }),
  getAllParties: (params?: any) => api.get('/api/reports/all-parties', { params }),
  getPartyInvoices: (params?: any) => api.get('/api/reports/party-invoices', { params }),
  getPartyByItem: (params?: any) => api.get('/api/reports/party-by-item', { params }),
  getSalePurchaseByParty: (params?: any) => api.get('/api/reports/sale-purchase-by-party', { params }),
  getSalePurchaseByPartyGroup: (params?: any) => api.get('/api/reports/sale-purchase-by-party-group', { params }),
  getFranchiseReport: (params?: any) => api.get('/api/reports/franchise', { params }),

  // GST Reports
  getGstr: (type: string, params?: any) => api.get(`/api/reports/gstr/${type}`, { params }),
  getHsnSummary: (params?: any) => api.get('/api/reports/hsn-summary', { params }),
  getSacReport: (params?: any) => api.get('/api/reports/sac', { params }),

  // Item / Stock Reports
  getItemByParty: (params?: any) => api.get('/api/reports/item-by-party', { params }),
  getItemProfitLoss: (params?: any) => api.get('/api/reports/item-profit-loss', { params }),
  getItemCategoryProfitLoss: (params?: any) => api.get('/api/reports/item-category-profit-loss', { params }),
  getSalePurchaseByCategory: (params?: any) => api.get('/api/reports/sale-purchase-by-category', { params }),
  getStockByCategory: (params?: any) => api.get('/api/reports/stock-by-category', { params }),
  getItemDiscount: (params?: any) => api.get('/api/reports/item-discount', { params }),
  getStockSummary: (params?: any) => api.get('/api/reports/stock-summary', { params }),
  getStockDetail: (params?: any) => api.get('/api/reports/stock-detail', { params }),
  getItemDetail: (params?: any) => api.get('/api/reports/item-detail', { params }),

  // Business Status
  getBankStatement: (params?: any) => api.get('/api/reports/bank-statement', { params }),
  getDiscountReport: (params?: any) => api.get('/api/reports/discount-report', { params }),

  // Tax Reports
  getGstReport: (params?: any) => api.get('/api/reports/gst', { params }),
  getGSTR1: (params?: any) => api.get('/api/reports/gstr1', { params }),
  getGSTR2: (params?: any) => api.get('/api/reports/gstr2', { params }),
  getGSTR3B: (params?: any) => api.get('/api/reports/gstr3b', { params }),
  getGSTR9: (params?: any) => api.get('/api/reports/gstr9', { params }),
  getGstRateReport: (params?: any) => api.get('/api/reports/gst-rate', { params }),
  getForm27eq: (params?: any) => api.get('/api/reports/form-27eq', { params }),
  getTcsReceivable: (params?: any) => api.get('/api/reports/tcs-receivable', { params }),
  getTdsPayable: (params?: any) => api.get('/api/reports/tds-payable', { params }),
  getTdsReceivable: (params?: any) => api.get('/api/reports/tds-receivable', { params }),

  // Expense Reports
  getExpenses: (params?: any) => api.get('/api/reports/expenses', { params }),
  getExpenseCategory: (params?: any) => api.get('/api/reports/expense-category', { params }),
  getExpenseItem: (params?: any) => api.get('/api/reports/expense-item', { params }),

  // Sale Orders
  getSaleOrders: (params?: any) => api.get('/api/sales/orders', { params }),
  // Franchise-isolated report endpoints — use these for the Reports page.
  // getSaleOrders above hits the raw CRUD listing (SalesOrder model, no
  // franchiseId filter) and must not be used for reporting.
  getSaleOrdersReport: (params?: any) => api.get('/api/reports/sale-orders', { params }),
  getSaleOrderItemsReport: (params?: any) => api.get('/api/reports/sale-order-items', { params }),

  // Loan
  getLoans: (params?: any) => api.get('/api/reports/loans', { params }),
  addLoanAccount: (data: any) => api.post('/api/reports/loans', data),
  getLoanStatement: (params?: any) => api.get('/api/reports/loan-statement', { params }),
  addLoanTransaction: (id: string, data: any) => api.post(`/api/reports/loans/${id}/transaction`, data),
};

export const chequesApi = {
  getAll: (params?: any) => api.get('/api/cheques', { params }),
  getStats: (params?: any) => api.get('/api/cheques/stats', { params }),
  create: (data: any) => api.post('/api/cheques', data),
  updateStatus: (id: string, status: string, accountId?: string) => api.patch(`/api/cheques/${id}/status`, { status, accountId }),
};
