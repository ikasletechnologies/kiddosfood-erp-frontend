"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Plus,
  Receipt,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { formatERPNumber } from "@/lib/utils";
import { reportsApi, accountingApi } from "@/lib/api/accounting.api";
import {
  inventoryApi,
  productsFullApi,
  productionApi,
  wasteApi,
  recipesApi,
  cartonApi,
} from "@/lib/api/inventory.api";

// ─── Child Report Components ──────────────────────────────────────────────────
import CentralProfitLossReport from "./components/ProfitLossReport";
import CentralBillWiseProfitReport from "./components/BillWiseProfitReport";
import CentralCashFlowReport from "./components/CashFlowReport";
import CentralTrialBalanceReport from "./components/TrialBalanceReport";
import CentralBalanceSheetReport from "./components/BalanceSheetReport";
import CentralPartyStatementReport from "./components/PartyStatementReport";
import CentralPartyProfitLossReport from "./components/PartyProfitLossReport";
import CentralAllPartiesReport from "./components/AllPartiesReport";
import CentralPartyReportByItem from "./components/PartyReportByItem";
import CentralSalePurchaseByParty from "./components/SalePurchaseByParty";
import CentralSalePurchaseByPartyGroup from "./components/SalePurchaseByPartyGroup";
import CentralLoanStatementReport from "./components/LoanStatementReport";
import CentralSaleOrdersReport from "./components/SaleOrdersReport";
import CentralSaleOrderItemReport from "./components/SaleOrderItemReport";
import CentralExpenseReport from "./components/ExpenseReport";
import CentralExpenseCategoryReport from "./components/ExpenseCategoryReport";
import CentralExpenseItemReport from "./components/ExpenseItemReport";
import CentralGSTReport from "./components/GSTReport";
import CentralGSTRateReport from "./components/GSTRateReport";
import CentralTCSReceivableReport from "./components/TCSReceivableReport";
import CentralTDSReceivableReport from "./components/TDSReceivableReport";
import CentralTDSPayableReport from "./components/TDSPayableReport";
import CentralForm27eqReport from "./components/Form27eqReport";
import CentralStockSummaryReport from "./components/StockSummaryReport";
import CentralItemReportByParty from "./components/ItemReportByParty";
import CentralItemWiseProfitLossReport from "./components/ItemWiseProfitLossReport";
import CentralItemCategoryWiseProfitLossReport from "./components/ItemCategoryWiseProfitLossReport";
import CentralBankStatementReport from "./components/BankStatementReport";
import CentralDiscountReport from "./components/DiscountReport";
import CentralLowStockSummaryReport from "./components/LowStockSummaryReport";
import CentralStockDetailReport from "./components/StockDetailReport";
import CentralItemDetailReport from "./components/ItemDetailReport";
import CentralSalePurchaseByCategoryReport from "./components/SalePurchaseByCategoryReport";
import CentralStockSummaryByCategoryReport from "./components/StockSummaryByCategoryReport";
import CentralItemWiseDiscountReport from "./components/ItemWiseDiscountReport";
import CentralGSTR1Report from "./components/GSTR1Report";
import CentralGSTR2Report from "./components/GSTR2Report";
import CentralGSTR3BReport from "./components/GSTR3BReport";
import CentralGSTR9Report from "./components/GSTR9Report";
import CentralSaleSummaryByHSNReport from "./components/SaleSummaryByHSNReport";
import CentralSACReport from "./components/SACReport";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ChildReportDef {
  id: string;
  label: string;
  category?: string;
  description?: string;
}

interface ParentReportDef {
  id: string;
  label: string;
  description: string;
  subcategories?: string[];
  children: ChildReportDef[];
}

interface ReportMeta {
  title: string;
  kpiLabel: string;
  tableTitle: string;
  columns: { key: string; label: string }[];
}

interface ReportData {
  kpiValue: string;
  kpiSubText: string;
  kpiTrend?: string;
  rows: Record<string, any>[];
  revenue?: number;
  cogs?: number;
  purchase?: number;
  tax?: number;
  taxPayable?: number;
  taxReceivable?: number;
  grossProfit?: number;
  expenses?: number;
  netProfit?: number;
  totalSales?: number;
  totalProfit?: number;
  cashIn?: number;
  cashOut?: number;
  totalDebit?: number;
  totalCredit?: number;
  openingBalance?: number;
  closingBalance?: number;
}

// ─── 5 Parent Definitions ─────────────────────────────────────────────────────

const PARENT_REPORTS: ParentReportDef[] = [
  {
    id: "production",
    label: "Production",
    description: "Batches, recipes, QC inspections and scrap logs.",
    children: [
      { id: "Batch Manufacturing History", label: "Batch Manufacturing History", description: "Batch runs, actual yield, status and duration." },
      { id: "Production Planning", label: "Production Planning", description: "Scheduled manufacturing plans and output targets." },
      { id: "QC & Inspection Report", label: "QC & Inspection Report", description: "Quality control inspection outcomes and notes." },
      { id: "Material Consumption Report", label: "Material Consumption", description: "Raw materials consumed across batches." },
      { id: "Wastage & Scrap Report", label: "Wastage & Scrap", description: "Scrap quantities and damage reasons." },
      { id: "Formulation & Recipe Costing", label: "Recipe Costing", description: "Recipe ingredients and estimated unit cost." },
      { id: "Packaging", label: "Packaging", description: "Packaged goods log and batch records." },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Stock valuation, item P&L, stock movements and low stock alerts.",
    children: [
      { id: "Stock summary", label: "Stock Summary", description: "Current stock quantities, unit rates and warehouse valuation." },
      { id: "Item Report By Party", label: "Item Report By Party", description: "Item-wise transactions by party." },
      { id: "Item Wise Profit And Loss", label: "Item Wise Profit & Loss", description: "Gross margin and profit per catalog item." },
      { id: "Item Category Wise Profit And Loss", label: "Item Category Wise Profit", description: "Profitability by product category." },
      { id: "Low Stock Summary", label: "Low Stock Summary", description: "Items below minimum reorder point." },
      { id: "Stock Detail", label: "Stock Detail", description: "Chronological inward and outward stock movements." },
      { id: "Item Detail", label: "Item Detail", description: "Product catalog with SKUs, HSN codes and rates." },
      { id: "Sale/ Purchase Report By Item Category", label: "Sale / Purchase Report By Item", description: "Category-wise sales and purchase volume." },
      { id: "Stock Summary Report By Item Category", label: "Stock Summary Report By Item", description: "Category-level stock quantity and valuation." },
      { id: "Item Wise Discount", label: "Item Wise Discount", description: "Discounts applied across catalog products." },
    ],
  },
  {
    id: "inventory-ledger",
    label: "Inventory Ledger",
    description: "Raw material logs, stock movement audits and adjustments.",
    children: [
      { id: "Raw Material Ledger", label: "Raw Material Ledger", description: "Item-wise ledger with Inward, Outward and Balance." },
      { id: "Stock Movement History", label: "Stock Movement History", description: "Movement audit records across all items." },
      { id: "Inward & GRN Movements", label: "Inward & GRN Movements", description: "Stock received from suppliers and purchase orders." },
      { id: "Outward & Dispatch Movements", label: "Outward & Dispatch Movements", description: "Stock issued and dispatched." },
      { id: "Stock Adjustments & Reconciliation", label: "Stock Adjustments", description: "Physical count adjustments and audit variances." },
      { id: "Finished Goods Stock", label: "Finished Goods Stock", description: "Stock balance for finished catalog goods." },
    ],
  },
  {
    id: "financial",
    label: "Financial",
    description: "Profit & Loss, Balance Sheet, GST returns, taxes and expenses.",
    subcategories: [
      "Statements & P&L",
      "GST Reports",
      "Taxes & Compliance",
      "Expenses & Orders",
      "Banking & Loans",
    ],
    children: [
      // Statements & P&L
      { id: "Profit And Loss", label: "Profit And Loss", category: "Statements & P&L", description: "Net Profit / Loss financial statement." },
      { id: "Balance Sheet", label: "Balance Sheet", category: "Statements & P&L", description: "Assets, Liabilities and Equity balance." },
      { id: "Cash flow", label: "Cash Flow", category: "Statements & P&L", description: "Operating cash inflows and outflows." },
      { id: "Trial Balance Report", label: "Trial Balance Report", category: "Statements & P&L", description: "Debit and Credit account balances." },
      { id: "Bill Wise Profit", label: "Bill Wise Profit", category: "Statements & P&L", description: "Profit margin achieved per invoice." },
      { id: "Day book", label: "Day Book", category: "Statements & P&L", description: "Daily financial transaction entries." },
      { id: "Sale", label: "Sale Invoices", category: "Statements & P&L", description: "Sales invoice records and dues." },
      { id: "Purchase", label: "Purchase Orders", category: "Statements & P&L", description: "Vendor purchase orders and billed values." },
      { id: "All Transactions", label: "All Transactions", category: "Statements & P&L", description: "Master transaction log." },

      // GST Reports
      { id: "GSTR 1", label: "GSTR 1", category: "GST Reports", description: "Outward supply return statement." },
      { id: "GSTR 2", label: "GSTR 2", category: "GST Reports", description: "Inward supply and purchase input credits." },
      { id: "GSTR 3 B", label: "GSTR 3B", category: "GST Reports", description: "Monthly GST self-declaration return." },
      { id: "GSTR 9", label: "GSTR 9", category: "GST Reports", description: "Annual GST return summary." },
      { id: "Sale Summary By HSN", label: "Sale Summary By HSN", category: "GST Reports", description: "HSN code sales and tax breakdown." },
      { id: "SAC Report", label: "SAC Report", category: "GST Reports", description: "Service Accounting Code breakdown." },

      // Taxes & Compliance
      { id: "GST Report", label: "GST Report", category: "Taxes & Compliance", description: "GST collected and paid summary." },
      { id: "GST Rate Report", label: "GST Rate Report", category: "Taxes & Compliance", description: "Rate-wise GST tax collection." },
      { id: "Form No. 27EQ", label: "Form No. 27EQ", category: "Taxes & Compliance", description: "Quarterly TCS collected return." },
      { id: "TCS Receivable", label: "TCS Receivable", category: "Taxes & Compliance", description: "TCS receivable statement." },
      { id: "TDS Payable", label: "TDS Payable", category: "Taxes & Compliance", description: "TDS payable to authorities." },
      { id: "TDS Receivable", label: "TDS Receivable", category: "Taxes & Compliance", description: "TDS withheld by clients." },

      // Expenses & Orders
      { id: "Expense", label: "Expense Report", category: "Expenses & Orders", description: "Operational expenditures." },
      { id: "Expense Category Report", label: "Expense Category Report", category: "Expenses & Orders", description: "Category-wise expense breakdown." },
      { id: "Expense Item Report", label: "Expense Item Report", category: "Expenses & Orders", description: "Itemized expense details." },
      { id: "Sale Orders", label: "Sale Orders", category: "Expenses & Orders", description: "Booked sales order fulfillment." },
      { id: "Sale Order Item", label: "Sale Order Item", category: "Expenses & Orders", description: "Item-wise ordered quantities." },

      // Banking & Loans
      { id: "Bank Statement", label: "Bank Statement", category: "Banking & Loans", description: "Bank transactions and balance." },
      { id: "Discount Report", label: "Discount Report", category: "Banking & Loans", description: "Discounts allowed on invoices." },
      { id: "Loan Statement", label: "Loan Statement", category: "Banking & Loans", description: "Loan accounts, EMI and interest." },
    ],
  },
  {
    id: "franchise",
    label: "Franchise",
    description: "Party statements, branch performance and party-wise P&L.",
    children: [
      { id: "Party Statement", label: "Party Statement", description: "Party ledger statement." },
      { id: "Party wise Profit & Loss", label: "Party wise Profit & Loss", description: "Profitability per party relationship." },
      { id: "All parties", label: "All Parties", description: "Party directory with live balances." },
      { id: "Party Report By Item", label: "Party Report By Item", description: "Item-wise sales per party." },
      { id: "Sale Purchase By Party", label: "Sale Purchase By Party", description: "Sales vs. purchases comparison." },
      { id: "Sale Purchase By Party Group", label: "Sale Purchase By Party Group", description: "Transactions grouped by customer tier." },
      { id: "Franchise Dues & Balances", label: "Franchise Dues & Balances", description: "Branch dues and outstanding limits." },
      { id: "Franchise Performance Summary", label: "Franchise Performance", description: "Branch revenue and operating metrics." },
    ],
  },
];

// ─── Static Report Metadata ───────────────────────────────────────────────────

const REPORT_METADATA: Record<string, ReportMeta> = {
  "Batch Manufacturing History": {
    title: "Batch Manufacturing History",
    kpiLabel: "Total Batches",
    tableTitle: "Production Batches",
    columns: [
      { key: "batchNumber", label: "Batch No" },
      { key: "productName", label: "Product / Recipe" },
      { key: "targetYield", label: "Target Yield" },
      { key: "actualYield", label: "Actual Yield" },
      { key: "status", label: "Status" },
      { key: "stage", label: "Stage" },
      { key: "date", label: "Date" },
    ],
  },
  "Production Planning": {
    title: "Production Planning Summary",
    kpiLabel: "Planned Batches",
    tableTitle: "Production Plan Queue",
    columns: [
      { key: "planNo", label: "Plan No" },
      { key: "product", label: "Product" },
      { key: "quantity", label: "Target Quantity" },
      { key: "startDate", label: "Scheduled Start" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
    ],
  },
  "QC & Inspection Report": {
    title: "QC & Inspection Report",
    kpiLabel: "Inspections",
    tableTitle: "Inspection Records",
    columns: [
      { key: "batchNo", label: "Batch No" },
      { key: "product", label: "Product" },
      { key: "inspector", label: "Inspector" },
      { key: "result", label: "QC Result" },
      { key: "score", label: "Score" },
      { key: "date", label: "Inspection Date" },
    ],
  },
  "Material Consumption Report": {
    title: "Material Consumption Report",
    kpiLabel: "Total Materials",
    tableTitle: "Raw Material Consumption",
    columns: [
      { key: "materialName", label: "Raw Material" },
      { key: "sku", label: "SKU" },
      { key: "consumedQty", label: "Quantity Consumed" },
      { key: "unit", label: "Unit" },
      { key: "totalCost", label: "Estimated Cost" },
    ],
  },
  "Wastage & Scrap Report": {
    title: "Wastage & Scrap Report",
    kpiLabel: "Scrap Total",
    tableTitle: "Scrap & Wastage Entries",
    columns: [
      { key: "date", label: "Date" },
      { key: "item", label: "Item / Material" },
      { key: "quantity", label: "Scrap Qty" },
      { key: "reason", label: "Reason" },
      { key: "note", label: "Notes" },
    ],
  },
  "Formulation & Recipe Costing": {
    title: "Formulation & Recipe Costing",
    kpiLabel: "Active Recipes",
    tableTitle: "Recipe Master & Unit Costs",
    columns: [
      { key: "recipeName", label: "Recipe Name" },
      { key: "productName", label: "Product" },
      { key: "batchSize", label: "Batch Size" },
      { key: "ingredientsCount", label: "Ingredients" },
      { key: "costPerUnit", label: "Cost / Unit" },
    ],
  },
  "Packaging & Cartons": {
    title: "Packaging & Cartons Report",
    kpiLabel: "Cartons Packaged",
    tableTitle: "Packaged Cartons Log",
    columns: [
      { key: "cartonNo", label: "Carton No" },
      { key: "batchNo", label: "Batch No" },
      { key: "size", label: "Carton Size" },
      { key: "units", label: "Units / Carton" },
      { key: "date", label: "Packaged Date" },
    ],
  },
  "Raw Material Ledger": {
    title: "Raw Material Stock Ledger",
    kpiLabel: "Ledger Entries",
    tableTitle: "Raw Material Ledger Entries",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item Name" },
      { key: "sku", label: "SKU" },
      { key: "transactionType", label: "Transaction Type" },
      { key: "inwardQty", label: "Inward (+)" },
      { key: "outwardQty", label: "Outward (-)" },
      { key: "runningBalance", label: "Balance" },
      { key: "unit", label: "Unit" },
      { key: "actor", label: "Actor" },
    ],
  },
  "Stock Movement History": {
    title: "Stock Movement History",
    kpiLabel: "Total Movements",
    tableTitle: "Movement Audit Records",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item Name" },
      { key: "type", label: "Type" },
      { key: "reference", label: "Reference" },
      { key: "quantityIn", label: "Qty In" },
      { key: "quantityOut", label: "Qty Out" },
      { key: "balance", label: "Balance" },
    ],
  },
  "Inward & GRN Movements": {
    title: "Inward & GRN Movements",
    kpiLabel: "Total Receipts",
    tableTitle: "Inward Receipts (PO & GRN)",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item Name" },
      { key: "reference", label: "PO / GRN No" },
      { key: "quantityIn", label: "Quantity In" },
      { key: "balance", label: "Stock After" },
    ],
  },
  "Outward & Dispatch Movements": {
    title: "Outward & Dispatch Movements",
    kpiLabel: "Total Dispatches",
    tableTitle: "Stock Issued & Dispatched",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item Name" },
      { key: "reference", label: "Order / Issue No" },
      { key: "quantityOut", label: "Quantity Out" },
      { key: "balance", label: "Stock After" },
    ],
  },
  "Stock Adjustments & Reconciliation": {
    title: "Stock Adjustments & Reconciliation",
    kpiLabel: "Adjustments",
    tableTitle: "Stock Adjustments Log",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item Name" },
      { key: "type", label: "Reason" },
      { key: "quantityIn", label: "Adjustment" },
      { key: "balance", label: "Reconciled Balance" },
    ],
  },
  "Finished Goods Stock": {
    title: "Finished Goods Stock",
    kpiLabel: "Finished Goods Value",
    tableTitle: "Finished Goods Inventory",
    columns: [
      { key: "itemName", label: "Item Name" },
      { key: "category", label: "Category" },
      { key: "inStock", label: "In Stock" },
      { key: "minStock", label: "Reorder Point" },
      { key: "rate", label: "Unit Rate" },
      { key: "value", label: "Valuation" },
    ],
  },
  "Franchise Dues & Balances": {
    title: "Franchise Dues & Balances",
    kpiLabel: "Total Outstanding",
    tableTitle: "Outstanding Accounts",
    columns: [
      { key: "name", label: "Franchise / Party" },
      { key: "phone", label: "Phone" },
      { key: "gst", label: "GST No" },
      { key: "state", label: "Location" },
      { key: "balance", label: "Outstanding Dues" },
      { key: "creditLimit", label: "Credit Limit" },
    ],
  },
  "Franchise Performance Summary": {
    title: "Franchise Performance Summary",
    kpiLabel: "Branch Sales",
    tableTitle: "Branch Performance Ledger",
    columns: [
      { key: "partyName", label: "Franchise Name" },
      { key: "totalSale", label: "Total Sales" },
      { key: "totalPurchase", label: "Total Purchases" },
      { key: "net", label: "Net Volume" },
    ],
  },
  Sale: {
    title: "Sale Invoices",
    kpiLabel: "Total Sales",
    tableTitle: "Sales Invoices",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Invoice No" },
      { key: "partyName", label: "Party Name" },
      { key: "transaction", label: "Transaction" },
      { key: "paymentType", label: "Payment Type" },
      { key: "amount", label: "Amount" },
      { key: "balance", label: "Balance" },
    ],
  },
  Purchase: {
    title: "Purchase Orders",
    kpiLabel: "Total Purchases",
    tableTitle: "Purchase Orders",
    columns: [
      { key: "date", label: "Date" },
      { key: "poNo", label: "PO No" },
      { key: "supplier", label: "Supplier" },
      { key: "status", label: "Status" },
      { key: "paymentType", label: "Payment Type" },
      { key: "amount", label: "Amount" },
      { key: "balance", label: "Balance" },
    ],
  },
  "Day book": {
    title: "Day Book Ledger",
    kpiLabel: "Daily Net Flow",
    tableTitle: "Daily Ledger Entries",
    columns: [
      { key: "time", label: "Date / Time" },
      { key: "particulars", label: "Particulars" },
      { key: "voucherType", label: "Voucher Type" },
      { key: "voucherNo", label: "Voucher No" },
      { key: "debit", label: "Debit (In)" },
      { key: "credit", label: "Credit (Out)" },
    ],
  },
  "All Transactions": {
    title: "All Account Transactions",
    kpiLabel: "Total Volume",
    tableTitle: "Account Transactions",
    columns: [
      { key: "date", label: "Date" },
      { key: "refNo", label: "Ref No" },
      { key: "particulars", label: "Particulars" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
    ],
  },
  "Profit And Loss": {
    title: "Profit & Loss Statement",
    kpiLabel: "Net Profit / Loss",
    tableTitle: "Revenue & Expense Accounts",
    columns: [
      { key: "category", label: "Category" },
      { key: "accountName", label: "Account Name" },
      { key: "mtd", label: "Month to Date" },
      { key: "ytd", label: "Year to Date" },
    ],
  },
  "Bill Wise Profit": {
    title: "Bill Wise Profit Report",
    kpiLabel: "Total Profit",
    tableTitle: "Invoice Profit Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Invoice No" },
      { key: "partyName", label: "Party Name" },
      { key: "saleAmount", label: "Sale Amount" },
      { key: "costAmount", label: "Cost Amount" },
      { key: "profit", label: "Profit" },
      { key: "margin", label: "Margin %" },
    ],
  },
  "Cash flow": {
    title: "Cash Flow Statement",
    kpiLabel: "Net Cash Flow",
    tableTitle: "Cash Flow Entries",
    columns: [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "category", label: "Category" },
      { key: "inflow", label: "Inflow" },
      { key: "outflow", label: "Outflow" },
      { key: "balance", label: "Balance" },
    ],
  },
  "Trial Balance Report": {
    title: "Trial Balance Report",
    kpiLabel: "Balance Status",
    tableTitle: "Account Balances",
    columns: [
      { key: "accountCode", label: "Account Code" },
      { key: "accountName", label: "Account Name" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
    ],
  },
  "Balance Sheet": {
    title: "Balance Sheet",
    kpiLabel: "Total Assets",
    tableTitle: "Assets & Liabilities",
    columns: [
      { key: "category", label: "Category" },
      { key: "accountName", label: "Account Name" },
      { key: "amount", label: "Amount" },
      { key: "notes", label: "Notes" },
    ],
  },
  "Party Statement": {
    title: "Party Statement",
    kpiLabel: "Closing Balance",
    tableTitle: "Party Ledger",
    columns: [
      { key: "date", label: "Date" },
      { key: "particular", label: "Particulars" },
      { key: "voucherNo", label: "Voucher No" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
      { key: "balance", label: "Balance" },
    ],
  },
  "Party wise Profit & Loss": {
    title: "Party Wise Profit & Loss",
    kpiLabel: "Total Party Profit",
    tableTitle: "Party Profitability",
    columns: [
      { key: "partyName", label: "Party Name" },
      { key: "totalSales", label: "Total Sales" },
      { key: "totalCost", label: "Total Cost" },
      { key: "profit", label: "Profit" },
      { key: "margin", label: "Margin %" },
    ],
  },
  "All parties": {
    title: "All Parties",
    kpiLabel: "Total Parties",
    tableTitle: "Party Master List",
    columns: [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "gst", label: "GST No." },
      { key: "state", label: "State" },
      { key: "balance", label: "Balance" },
      { key: "creditLimit", label: "Credit Limit" },
    ],
  },
  "Party Report By Item": {
    title: "Party Report By Item",
    kpiLabel: "Items Sold",
    tableTitle: "Item-wise Party Transactions",
    columns: [
      { key: "partyName", label: "Party Name" },
      { key: "itemName", label: "Item Name" },
      { key: "quantity", label: "Quantity" },
      { key: "amount", label: "Amount" },
      { key: "date", label: "Date" },
    ],
  },
  "Sale Purchase By Party": {
    title: "Sale & Purchase By Party",
    kpiLabel: "Transactions",
    tableTitle: "Party Transactions Summary",
    columns: [
      { key: "partyName", label: "Party Name" },
      { key: "totalSale", label: "Total Sale" },
      { key: "totalPurchase", label: "Total Purchase" },
      { key: "net", label: "Net" },
    ],
  },
  "Sale Purchase By Party Group": {
    title: "Sale & Purchase By Party Group",
    kpiLabel: "Total Groups",
    tableTitle: "Party Group Summary",
    columns: [
      { key: "groupName", label: "Group Name" },
      { key: "totalSale", label: "Total Sale" },
      { key: "totalPurchase", label: "Total Purchase" },
      { key: "net", label: "Net" },
    ],
  },
  "GSTR 1": {
    title: "GSTR 1 – Outward Supplies",
    kpiLabel: "Output GST",
    tableTitle: "Outward Supply Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Invoice No" },
      { key: "partyName", label: "Party Name" },
      { key: "gstin", label: "GSTIN" },
      { key: "taxableAmount", label: "Taxable Amt" },
      { key: "cgst", label: "CGST" },
      { key: "sgst", label: "SGST" },
      { key: "igst", label: "IGST" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  "GSTR 2": {
    title: "GSTR 2 – Inward Supplies",
    kpiLabel: "Input GST",
    tableTitle: "Inward Supply Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Invoice No" },
      { key: "partyName", label: "Supplier" },
      { key: "gstin", label: "Supplier GSTIN" },
      { key: "taxableAmount", label: "Taxable Amt" },
      { key: "cgst", label: "CGST" },
      { key: "sgst", label: "SGST" },
      { key: "igst", label: "IGST" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  "GSTR 3 B": {
    title: "GSTR 3B – Monthly Return",
    kpiLabel: "Net GST Payable",
    tableTitle: "GST Summary",
    columns: [
      { key: "category", label: "Category" },
      { key: "taxableAmount", label: "Taxable Amount" },
      { key: "cgst", label: "CGST" },
      { key: "sgst", label: "SGST" },
      { key: "igst", label: "IGST" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  "GSTR 9": {
    title: "GSTR 9 – Annual Return",
    kpiLabel: "Annual GST",
    tableTitle: "Annual GST Summary",
    columns: [
      { key: "quarter", label: "Quarter" },
      { key: "taxableAmount", label: "Taxable Amount" },
      { key: "cgst", label: "CGST" },
      { key: "sgst", label: "SGST" },
      { key: "igst", label: "IGST" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  "Sale Summary By HSN": {
    title: "Sale Summary By HSN",
    kpiLabel: "Taxable Value",
    tableTitle: "HSN-wise Sale Summary",
    columns: [
      { key: "hsn", label: "HSN Code" },
      { key: "description", label: "Description" },
      { key: "unit", label: "Unit" },
      { key: "quantity", label: "Quantity" },
      { key: "taxableAmount", label: "Taxable Value" },
      { key: "gstRate", label: "GST Rate" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  "SAC Report": {
    title: "SAC Report",
    kpiLabel: "Service Value",
    tableTitle: "SAC-wise Summary",
    columns: [
      { key: "sac", label: "SAC Code" },
      { key: "description", label: "Service" },
      { key: "taxableAmount", label: "Taxable Value" },
      { key: "gstRate", label: "GST Rate" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  "Stock summary": {
    title: "Stock Summary",
    kpiLabel: "Total Stock Value",
    tableTitle: "Current Stock",
    columns: [
      { key: "itemName", label: "Item Name" },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
      { key: "inStock", label: "In Stock" },
      { key: "minStock", label: "Min Stock" },
      { key: "rate", label: "Rate" },
      { key: "value", label: "Stock Value" },
    ],
  },
  "Item Report By Party": {
    title: "Item Report By Party",
    kpiLabel: "Total Transactions",
    tableTitle: "Item-Party Transactions",
    columns: [
      { key: "partyName", label: "Party Name" },
      { key: "itemName", label: "Item Name" },
      { key: "quantity", label: "Qty Sold" },
      { key: "amount", label: "Amount" },
      { key: "date", label: "Last Date" },
    ],
  },
  "Item Wise Profit And Loss": {
    title: "Item Wise Profit & Loss",
    kpiLabel: "Item Profit",
    tableTitle: "Item Profitability",
    columns: [
      { key: "itemName", label: "Item Name" },
      { key: "quantitySold", label: "Qty Sold" },
      { key: "revenue", label: "Revenue" },
      { key: "cost", label: "Cost" },
      { key: "profit", label: "Profit" },
      { key: "margin", label: "Margin %" },
    ],
  },
  "Item Category Wise Profit And Loss": {
    title: "Item Category Wise Profit & Loss",
    kpiLabel: "Category Profit",
    tableTitle: "Category Profitability",
    columns: [
      { key: "category", label: "Category" },
      { key: "items", label: "Items" },
      { key: "revenue", label: "Revenue" },
      { key: "cost", label: "Cost" },
      { key: "profit", label: "Profit" },
      { key: "margin", label: "Margin %" },
    ],
  },
  "Low Stock Summary": {
    title: "Low Stock Summary",
    kpiLabel: "Low Stock Items",
    tableTitle: "Low Stock Items",
    columns: [
      { key: "itemName", label: "Item Name" },
      { key: "category", label: "Category" },
      { key: "unit", label: "Unit" },
      { key: "currentStock", label: "Current Stock" },
      { key: "minStock", label: "Min Stock" },
      { key: "shortfall", label: "Shortfall" },
      { key: "status", label: "Status" },
    ],
  },
  "Stock Detail": {
    title: "Stock Detail",
    kpiLabel: "Movements",
    tableTitle: "Stock Movement History",
    columns: [
      { key: "date", label: "Date" },
      { key: "itemName", label: "Item Name" },
      { key: "type", label: "Type" },
      { key: "reference", label: "Reference" },
      { key: "quantityIn", label: "Qty In" },
      { key: "quantityOut", label: "Qty Out" },
      { key: "balance", label: "Balance" },
    ],
  },
  "Item Detail": {
    title: "Item Detail",
    kpiLabel: "Total Items",
    tableTitle: "Item Master List",
    columns: [
      { key: "name", label: "Item Name" },
      { key: "sku", label: "SKU" },
      { key: "hsn", label: "HSN Code" },
      { key: "unit", label: "Unit" },
      { key: "saleRate", label: "Sale Rate" },
      { key: "purchaseRate", label: "Purchase Rate" },
      { key: "tax", label: "Tax %" },
    ],
  },
  "Sale/ Purchase Report By Item Category": {
    title: "Sale/Purchase by Item Category",
    kpiLabel: "Total Volume",
    tableTitle: "Category-wise Sale/Purchase",
    columns: [
      { key: "category", label: "Category" },
      { key: "saleQty", label: "Sale Qty" },
      { key: "saleAmount", label: "Sale Amount" },
      { key: "purchaseQty", label: "Purchase Qty" },
      { key: "purchaseAmount", label: "Purchase Amount" },
    ],
  },
  "Stock Summary Report By Item Category": {
    title: "Stock Summary By Category",
    kpiLabel: "Category Valuation",
    tableTitle: "Category Stock",
    columns: [
      { key: "category", label: "Category" },
      { key: "totalItems", label: "Total Items" },
      { key: "totalQuantity", label: "Total Quantity" },
      { key: "totalValue", label: "Total Value" },
    ],
  },
  "Item Wise Discount": {
    title: "Item Wise Discount",
    kpiLabel: "Total Discount",
    tableTitle: "Item Discount Details",
    columns: [
      { key: "itemName", label: "Item Name" },
      { key: "totalSales", label: "Total Sales" },
      { key: "discountAmount", label: "Discount Amount" },
      { key: "discountPct", label: "Discount %" },
      { key: "netAmount", label: "Net Amount" },
    ],
  },
  "Bank Statement": {
    title: "Bank Statement",
    kpiLabel: "Closing Balance",
    tableTitle: "Bank Transactions",
    columns: [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "reference", label: "Reference" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
      { key: "balance", label: "Balance" },
    ],
  },
  "Discount Report": {
    title: "Discount Report",
    kpiLabel: "Total Discounts",
    tableTitle: "Discount Transactions",
    columns: [
      { key: "date", label: "Date" },
      { key: "invoiceNo", label: "Invoice No" },
      { key: "partyName", label: "Party" },
      { key: "grossAmount", label: "Gross Amount" },
      { key: "discountAmount", label: "Discount" },
      { key: "netAmount", label: "Net Amount" },
    ],
  },
  "GST Report": {
    title: "GST Report",
    kpiLabel: "Net GST",
    tableTitle: "GST Summary",
    columns: [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "taxableAmount", label: "Taxable Amount" },
      { key: "gstRate", label: "GST Rate" },
      { key: "gstAmount", label: "GST Amount" },
      { key: "type", label: "Type" },
    ],
  },
  "GST Rate Report": {
    title: "GST Rate Report",
    kpiLabel: "Tax Collected",
    tableTitle: "Rate-wise GST Summary",
    columns: [
      { key: "gstRate", label: "GST Rate" },
      { key: "taxableAmount", label: "Taxable Amount" },
      { key: "cgst", label: "CGST" },
      { key: "sgst", label: "SGST" },
      { key: "igst", label: "IGST" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  "Form No. 27EQ": {
    title: "Form No. 27EQ (TCS)",
    kpiLabel: "Total TCS",
    tableTitle: "TCS Collected Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "partyName", label: "Party Name" },
      { key: "pan", label: "PAN" },
      { key: "amount", label: "Amount" },
      { key: "tcsRate", label: "TCS Rate" },
      { key: "tcsAmount", label: "TCS Amount" },
    ],
  },
  "TCS Receivable": {
    title: "TCS Receivable",
    kpiLabel: "TCS Receivable",
    tableTitle: "TCS Receivable Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "partyName", label: "Party Name" },
      { key: "amount", label: "Transaction Amount" },
      { key: "tcsRate", label: "TCS Rate" },
      { key: "tcsAmount", label: "TCS Amount" },
      { key: "status", label: "Status" },
    ],
  },
  "TDS Payable": {
    title: "TDS Payable",
    kpiLabel: "TDS Payable",
    tableTitle: "TDS Payable Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "partyName", label: "Deductee" },
      { key: "section", label: "Section" },
      { key: "amount", label: "Payment Amount" },
      { key: "tdsRate", label: "TDS Rate" },
      { key: "tdsAmount", label: "TDS Amount" },
    ],
  },
  "TDS Receivable": {
    title: "TDS Receivable",
    kpiLabel: "TDS Receivable",
    tableTitle: "TDS Receivable Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "partyName", label: "Deductor" },
      { key: "section", label: "Section" },
      { key: "amount", label: "Payment Amount" },
      { key: "tdsRate", label: "TDS Rate" },
      { key: "tdsAmount", label: "TDS Amount" },
    ],
  },
  Expense: {
    title: "Expense Report",
    kpiLabel: "Total Expenses",
    tableTitle: "Expense Transactions",
    columns: [
      { key: "date", label: "Date" },
      { key: "category", label: "Category" },
      { key: "description", label: "Description" },
      { key: "paymentMode", label: "Payment Mode" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
    ],
  },
  "Expense Category Report": {
    title: "Expense Category Report",
    kpiLabel: "Total Expenses",
    tableTitle: "Category-wise Expenses",
    columns: [
      { key: "category", label: "Category" },
      { key: "transactions", label: "Transactions" },
      { key: "amount", label: "Amount" },
      { key: "percentage", label: "% of Total" },
    ],
  },
  "Expense Item Report": {
    title: "Expense Item Report",
    kpiLabel: "Expense Items",
    tableTitle: "Expense Item Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "category", label: "Category" },
      { key: "item", label: "Item" },
      { key: "quantity", label: "Quantity" },
      { key: "rate", label: "Rate" },
      { key: "amount", label: "Amount" },
    ],
  },
  "Sale Orders": {
    title: "Sale Orders Report",
    kpiLabel: "Sale Orders",
    tableTitle: "Sale Orders",
    columns: [
      { key: "date", label: "Date" },
      { key: "orderNo", label: "Order No" },
      { key: "customer", label: "Customer" },
      { key: "deliveryDate", label: "Delivery Date" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
    ],
  },
  "Sale Order Item": {
    title: "Sale Order Items",
    kpiLabel: "Items Ordered",
    tableTitle: "Sale Order Item Details",
    columns: [
      { key: "date", label: "Date" },
      { key: "orderNo", label: "Order No" },
      { key: "customer", label: "Customer" },
      { key: "item", label: "Item Name" },
      { key: "quantity", label: "Ordered Qty" },
      { key: "amount", label: "Total Amount" },
    ],
  },
  "Loan Statement": {
    title: "Loan Statement",
    kpiLabel: "Outstanding Loan",
    tableTitle: "Loan Transactions",
    columns: [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "emi", label: "EMI Amount" },
      { key: "principal", label: "Principal" },
      { key: "interest", label: "Interest" },
      { key: "balance", label: "Outstanding" },
    ],
  },
};

const DEFAULT_META: ReportMeta = {
  title: "Report",
  kpiLabel: "Total",
  tableTitle: "Details",
  columns: [
    { key: "date", label: "Date" },
    { key: "description", label: "Description" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
  ],
};

// ─── Date Utilities ───────────────────────────────────────────────────────────

function getDateRange(
  filter: string,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = iso(now);

  if (filter === "Custom" && customFrom && customTo)
    return { from: customFrom, to: customTo };
  if (filter === "Today") return { from: today, to: today };
  if (filter === "Yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  if (filter === "Last 7 Days") {
    const w = new Date(now);
    w.setDate(w.getDate() - 7);
    return { from: iso(w), to: today };
  }
  if (filter === "This Year") {
    return { from: `${now.getFullYear()}-01-01`, to: today };
  }
  // Default: This Month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: iso(start), to: iso(end) };
}

function formatCategory(cat: any): string {
  if (!cat) return "—";
  const name = typeof cat === "object" ? (cat.name || cat.label || "") : String(cat);
  if (!name || name === "null" || name === "undefined") return "—";
  return name.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function fmtDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtCurrency(val: any): string {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: any): string {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

function toArr(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const key of [
    "data",
    "items",
    "invoices",
    "orders",
    "entries",
    "transactions",
    "expenses",
    "accounts",
    "results",
    "batches",
    "cartons",
  ]) {
    if (data?.[key] && Array.isArray(data[key])) return data[key];
  }
  return [];
}

// ─── Data Transforms ──────────────────────────────────────────────────────────

function transformSales(data: any): ReportData {
  const rows = toArr(data);
  const total = rows.reduce((s: number, r: any) => s + (Number(r.total) || Number(r.amount) || Number(r.grandTotal) || 0), 0);
  const received = rows.reduce((s: number, r: any) => s + (Number(r.paidAmount) || Number(r.paid) || 0), 0);
  return {
    kpiValue: fmtCurrency(total),
    kpiSubText: `Received: ${fmtCurrency(received)} • Balance: ${fmtCurrency(total - received)}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.date || r.createdAt),
      invoiceNo: r.invoiceNumber || r.orderNumber || r.referenceNumber || r._id?.slice(-6) || "—",
      partyName: r.customer?.name || r.customerName || r.partyName || "—",
      transaction: r.type || r.orderType || "Sale",
      paymentType: r.paymentMode || r.paymentType || "—",
      amount: fmtCurrency(r.total || r.amount || r.grandTotal),
      balance: fmtCurrency(r.balance || r.due || r.pendingAmount || Math.max(0, (r.total || 0) - (r.paidAmount || 0))),
    })),
  };
}

function transformPurchases(data: any): ReportData {
  const rows = toArr(data);
  const total = rows.reduce((s: number, r: any) => s + (Number(r.totalAmount) || Number(r.total) || 0), 0);
  const paid = rows.reduce((s: number, r: any) => s + (Number(r.advancePaid) || Number(r.paidAmount) || 0), 0);
  return {
    kpiValue: fmtCurrency(total),
    kpiSubText: `Paid: ${fmtCurrency(paid)} • Balance: ${fmtCurrency(total - paid)}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.createdAt || r.date),
      poNo: r.poNumber || r.referenceNumber || r._id?.slice(-6) || "—",
      supplier: r.vendor?.name || r.vendorName || r.supplier?.name || "—",
      status: r.status || "—",
      paymentType: r.paymentMode || "—",
      amount: fmtCurrency(r.totalAmount || r.total),
      balance: fmtCurrency(Math.max(0, (Number(r.totalAmount || r.total) || 0) - (Number(r.advancePaid || r.paidAmount) || 0))),
    })),
  };
}

function transformDayBook(data: any): ReportData {
  const entries = toArr(data);
  // Prefer the backend's full-range aggregates over summing just the
  // (possibly paginated) `entries` page, so Net Cash Flow stays correct
  // once a period has more rows than one page.
  const hasBackendTotals = data && (data.openingBalance !== undefined || data.closingBalance !== undefined);
  const cashIn = hasBackendTotals
    ? Number(data.totalDebit) || 0
    : entries.filter((e: any) => e.type === "DEBIT" || e.side === "IN" || e.direction === "IN").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const cashOut = hasBackendTotals
    ? Number(data.totalCredit) || 0
    : entries.filter((e: any) => e.type === "CREDIT" || e.side === "OUT" || e.direction === "OUT").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const openingBalance = Number(data?.openingBalance) || 0;
  const closingBalance = hasBackendTotals ? Number(data.closingBalance) || 0 : openingBalance + cashIn - cashOut;
  return {
    kpiValue: fmtCurrency(cashIn - cashOut),
    kpiSubText: `Cash In: ${fmtCurrency(cashIn)} • Cash Out: ${fmtCurrency(cashOut)}`,
    rows: entries.map((e: any) => {
      const isIn = e.type === "DEBIT" || e.side === "IN" || e.direction === "IN";
      return {
        time: e.time ? `${fmtDate(e.createdAt)} ${e.time}` : fmtDate(e.createdAt),
        particulars: e.particulars || e.description || e.narration || "—",
        voucherType: e.voucherType || e.type || "—",
        voucherNo: e.voucherNo || e.referenceNumber || e._id?.slice(-6) || "—",
        debit: isIn ? fmtCurrency(e.amount) : "—",
        credit: !isIn ? fmtCurrency(e.amount) : "—",
      };
    }),
    totalDebit: cashIn,
    totalCredit: cashOut,
    openingBalance,
    closingBalance,
  };
}

function transformTransactions(data: any): ReportData {
  const rows = toArr(data);
  // Prefer the backend's full-range aggregates over summing just the
  // (possibly paginated) `rows` page.
  const hasBackendTotals = data && (data.totalDebit !== undefined || data.totalCredit !== undefined);
  const totalDebit = hasBackendTotals
    ? Number(data.totalDebit) || 0
    : rows.filter((r: any) => r.type === "DEBIT" || r.side === "IN").reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  const totalCredit = hasBackendTotals
    ? Number(data.totalCredit) || 0
    : rows.filter((r: any) => r.type === "CREDIT" || r.side === "OUT").reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  return {
    kpiValue: `${rows.length} Transactions`,
    kpiSubText: `Debit: ${fmtCurrency(totalDebit)} • Credit: ${fmtCurrency(totalCredit)}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.date || r.createdAt),
      refNo: r.referenceNumber || r.refNo || r._id?.slice(-6) || "—",
      particulars: r.particulars || r.description || r.narration || "—",
      type: r.type || r.transactionType || "—",
      amount: fmtCurrency(r.amount),
      status: r.status || "—",
    })),
    totalDebit,
    totalCredit,
  };
}

function transformProfitLoss(data: any): ReportData {
  const netProfit = Number(data?.netProfit || data?.profit || 0);
  const revenue = Number(data?.totalRevenue || data?.revenue || 0);
  const expenses = Number(data?.totalExpenses || data?.expenses || 0);
  const cogs = Number(data?.cogs || 0);
  const grossProfit = Number(data?.grossProfit || revenue - cogs);
  const purchase = Number(data?.purchase || 0);
  const taxPayable = Number(data?.taxPayable ?? data?.tax ?? 0);
  const taxReceivable = Number(data?.taxReceivable || 0);
  return {
    kpiValue: fmtCurrency(netProfit),
    kpiSubText: `Revenue: ${fmtCurrency(revenue)} • Expenses: ${fmtCurrency(expenses)}`,
    rows: [],
    revenue,
    cogs,
    purchase,
    tax: taxPayable,
    taxPayable,
    taxReceivable,
    grossProfit,
    expenses,
    netProfit,
  };
}

function transformBillWiseProfit(data: any): ReportData {
  const rows = toArr(data);
  const totalProfit = rows.reduce((s: number, r: any) => s + (Number(r.profit) || 0), 0);
  const totalSales = rows.reduce((s: number, r: any) => s + (Number(r.total) || Number(r.saleAmount) || 0), 0);
  return {
    kpiValue: fmtCurrency(totalProfit),
    kpiSubText: `Bills: ${rows.length} • Margin: ${totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) + "%" : "—"}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.date || r.createdAt),
      invoiceNo: r.invoiceNumber || r.billNo || r._id?.slice(-6) || "—",
      partyName: r.customer?.name || r.partyName || "—",
      saleAmount: fmtCurrency(r.total || r.saleAmount),
      costAmount: fmtCurrency(r.cost || r.costAmount),
      profit: fmtCurrency(r.profit),
      margin: r.margin ? `${Number(r.margin).toFixed(1)}%` : "—",
    })),
    totalSales,
    totalProfit,
  };
}

function transformCashFlow(data: any): ReportData {
  const entries = toArr(data?.entries || data?.transactions || data);
  const cashIn = Number(data?.totalInflow || data?.cashIn || entries.filter((e: any) => e.type === "IN" || e.direction === "IN").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0));
  const cashOut = Number(data?.totalOutflow || data?.cashOut || entries.filter((e: any) => e.type === "OUT" || e.direction === "OUT").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0));
  return {
    kpiValue: fmtCurrency(cashIn - cashOut),
    kpiSubText: `Inflow: ${fmtCurrency(cashIn)} • Outflow: ${fmtCurrency(cashOut)}`,
    rows: entries.map((e: any) => ({
      date: fmtDate(e.date || e.createdAt),
      refNo: e.refNo || e.invoiceNumber || e.billNo || e._id?.slice(-6) || "—",
      partyName: e.customer?.name || e.partyName || e.name || "—",
      category: e.category || "—",
      type: e.type || e.direction || "—",
      cashIn: e.type === "IN" || e.direction === "IN" ? Number(e.amount || 0) : 0,
      cashOut: e.type === "OUT" || e.direction === "OUT" ? Number(e.amount || 0) : 0,
      runningCash: Number(e.runningBalance || e.balance || 0),
    })),
    cashIn,
    cashOut,
  };
}

function transformTrialBalance(data: any): ReportData {
  const rows = toArr(data?.accounts || data);
  const totalDebit = rows.reduce((s: number, r: any) => s + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((s: number, r: any) => s + (Number(r.credit) || 0), 0);
  return {
    kpiValue: `Debit: ${fmtCurrency(totalDebit)} | Credit: ${fmtCurrency(totalCredit)}`,
    kpiSubText: `Difference: ${fmtCurrency(Math.abs(totalDebit - totalCredit))}`,
    rows: rows.map((r: any) => ({
      accountName: r.name || r.accountName || "—",
      debit: Number(r.debit || 0),
      credit: Number(r.credit || 0),
    })),
    totalDebit,
    totalCredit,
  };
}

function transformBalanceSheet(data: any): ReportData {
  const assets = toArr(data?.assets || data?.assetItems);
  const liabilities = toArr(data?.liabilities || data?.liabilityItems);
  const allRows = [
    ...assets.map((r: any) => ({ ...r, _side: "Assets" })),
    ...liabilities.map((r: any) => ({ ...r, _side: "Liabilities & Equity" })),
  ];
  const totalAssets = assets.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  const totalLiabilities = liabilities.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  return {
    kpiValue: fmtCurrency(totalAssets),
    kpiSubText: `Assets: ${fmtCurrency(totalAssets)} • Liabilities: ${fmtCurrency(totalLiabilities)}`,
    rows: allRows.map((r: any) => ({
      category: r._side,
      accountName: r.name || r.accountName || "—",
      amount: fmtCurrency(r.amount || r.value),
      notes: r.notes || "—",
    })),
  };
}

function transformPartyStatement(data: any): ReportData {
  const entries = toArr(data?.entries || data?.transactions || data);
  const closing = Number(data?.closingBalance || data?.balance || 0);
  const opening = Number(data?.openingBalance || 0);
  return {
    kpiValue: fmtCurrency(closing),
    kpiSubText: `Opening: ${fmtCurrency(opening)} • Closing: ${fmtCurrency(closing)}`,
    rows: entries.map((e: any) => ({
      date: fmtDate(e.date || e.createdAt),
      particular: e.particular || e.description || "—",
      voucherNo: e.voucherNo || e.referenceNo || "—",
      debit: fmtCurrency(e.debit || 0),
      credit: fmtCurrency(e.credit || 0),
      balance: fmtCurrency(e.runningBalance || e.balance),
    })),
  };
}

function transformAllParties(data: any): ReportData {
  const rows = toArr(data);
  const customers = rows.filter((r: any) => r.type === "CUSTOMER" || !r.type).length;
  const vendors = rows.filter((r: any) => r.type === "VENDOR").length;
  return {
    kpiValue: `${rows.length} Parties`,
    kpiSubText: `Customers: ${customers} • Vendors: ${vendors}`,
    rows: rows.map((r: any) => ({
      name: r.name || "—",
      phone: r.phone || r.mobile || "—",
      gst: r.gstNumber || r.gstin || "—",
      state: r.state || r.city || "—",
      balance: fmtCurrency(r.balance || r.outstanding || 0),
      creditLimit: fmtCurrency(r.creditLimit || 0),
    })),
  };
}

function transformGstr(data: any): ReportData {
  const rows = toArr(data?.invoices || data?.entries || data);
  const totalTax = rows.reduce((s: number, r: any) => s + (Number(r.tax) || Number(r.totalGst) || Number(r.gstAmount) || 0), 0);
  const totalTaxable = rows.reduce((s: number, r: any) => s + (Number(r.taxableAmount) || Number(r.amount) || 0), 0);
  return {
    kpiValue: fmtCurrency(totalTax),
    kpiSubText: `Taxable: ${fmtCurrency(totalTaxable)} • Tax: ${fmtCurrency(totalTax)}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.date || r.invoiceDate || r.createdAt),
      invoiceNo: r.invoiceNo || r.billNo || r._id?.slice(-6) || "—",
      partyName: r.partyName || r.customer?.name || r.supplier?.name || "—",
      gstin: r.gstin || r.partyGstin || "—",
      taxableAmount: fmtCurrency(r.taxableAmount || r.amount),
      cgst: fmtCurrency(r.cgst || 0),
      sgst: fmtCurrency(r.sgst || 0),
      igst: fmtCurrency(r.igst || 0),
      totalTax: fmtCurrency(r.tax || r.totalGst || r.gstAmount || 0),
    })),
  };
}

function transformStockSummary(data: any): ReportData {
  const rows = toArr(data);
  const totalValue = rows.reduce(
    (s: number, r: any) =>
      s + (Number(r.quantity || r.currentStock) || 0) * (Number(r.price || r.unitPrice || r.costPrice) || 0),
    0
  );
  return {
    kpiValue: fmtCurrency(totalValue),
    kpiSubText: `Items: ${rows.length} • Total Units: ${rows.reduce((s: number, r: any) => s + (Number(r.quantity || r.currentStock) || 0), 0)}`,
    rows: rows.map((r: any) => ({
      itemName: r.name || r.itemName || "—",
      category: formatCategory(r.category || r.categoryName || r.group),
      unit: r.unit || r.unitOfMeasure || "—",
      inStock: String(Number(r.quantity || r.currentStock || 0)),
      minStock: String(Number(r.minQuantity || r.reorderPoint || 0)),
      rate: fmtCurrency(r.price || r.unitPrice || r.costPrice),
      value: fmtCurrency((Number(r.quantity || r.currentStock) || 0) * (Number(r.price || r.unitPrice || r.costPrice) || 0)),
    })),
  };
}

function transformLowStock(data: any): ReportData {
  const rows = toArr(data?.alerts || data);
  return {
    kpiValue: `${rows.length} Items`,
    kpiSubText: rows.length > 0 ? "Requires reorder" : "Stock healthy",
    rows: rows.map((r: any) => ({
      itemName: r.item?.name || r.name || r.itemName || "—",
      category: formatCategory(r.item?.category || r.category),
      unit: r.unit || r.item?.unit || "—",
      currentStock: String(Number(r.currentStock || r.quantity || r.stock || 0)),
      minStock: String(Number(r.minQuantity || r.reorderPoint || r.threshold || 0)),
      shortfall: String(Math.max(0, Number(r.minQuantity || r.reorderPoint || 0) - Number(r.currentStock || r.quantity || 0))),
      status: r.status || "Low",
    })),
  };
}

function transformStockDetail(data: any): ReportData {
  const rows = toArr(data);
  const totalIn = rows.filter((r: any) => r.type === "IN" || r.direction === "IN").reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
  const totalOut = rows.filter((r: any) => r.type === "OUT" || r.direction === "OUT").reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
  return {
    kpiValue: `${rows.length} Movements`,
    kpiSubText: `In: ${totalIn} • Out: ${totalOut}`,
    rows: rows.map((r: any) => {
      const isIn = r.type === "IN" || r.direction === "IN";
      return {
        date: fmtDate(r.date || r.createdAt),
        itemName: r.item?.name || r.itemName || "—",
        type: r.type || r.movementType || "—",
        reference: r.reference || r.referenceNo || "—",
        quantityIn: isIn ? String(Number(r.quantity || 0)) : "—",
        quantityOut: !isIn ? String(Number(r.quantity || 0)) : "—",
        balance: String(Number(r.runningBalance || r.stockAfter || 0)),
      };
    }),
  };
}

function transformItemDetail(data: any): ReportData {
  const rows = toArr(data);
  return {
    kpiValue: `${rows.length} Items`,
    kpiSubText: "Active catalog items",
    rows: rows.map((r: any) => ({
      name: r.name || "—",
      sku: r.sku || r.code || "—",
      hsn: r.hsnCode || r.hsn || "—",
      unit: r.unit || "—",
      saleRate: fmtCurrency(r.price || r.sellingPrice),
      purchaseRate: fmtCurrency(r.costPrice || r.purchasePrice),
      tax: r.gstRate ? `${r.gstRate}%` : "—",
    })),
  };
}

function transformExpenses(data: any): ReportData {
  const rows = toArr(data);
  const total = rows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  const paid = rows.filter((r: any) => r.status === "PAID").reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  return {
    kpiValue: fmtCurrency(total),
    kpiSubText: `Paid: ${fmtCurrency(paid)} • Pending: ${fmtCurrency(total - paid)}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.date || r.createdAt),
      category: r.category?.name || r.categoryName || r.category || "—",
      description: r.description || r.narration || "—",
      paymentMode: r.paymentMode || r.paymentType || "—",
      amount: fmtCurrency(r.amount),
      status: r.status || "—",
    })),
  };
}

function transformSaleOrders(data: any): ReportData {
  const rows = toArr(data);
  const pending = rows.filter((r: any) => r.status === "PENDING").length;
  const total = rows.reduce((s: number, r: any) => s + (Number(r.total) || Number(r.totalAmount) || 0), 0);
  return {
    kpiValue: fmtCurrency(total),
    kpiSubText: `Orders: ${rows.length} • Pending: ${pending}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.createdAt || r.date),
      orderNo: r.orderNumber || r._id?.slice(-6) || "—",
      customer: r.customer?.name || r.customerName || "—",
      deliveryDate: fmtDate(r.expectedDelivery || r.deliveryDate),
      amount: fmtCurrency(r.total || r.totalAmount),
      status: r.status || "—",
    })),
  };
}

function transformGeneric(data: any, meta?: ReportMeta): ReportData {
  const rows = toArr(data);
  const totalAmount = rows.reduce((s: number, r: any) => {
    return s + (Number(r.amount || r.total || r.value || r.netAmount) || 0);
  }, 0);
  return {
    kpiValue: rows.length > 0 ? (totalAmount > 0 ? fmtCurrency(totalAmount) : `${rows.length} Records`) : "—",
    kpiSubText: rows.length > 0 ? `${rows.length} records found` : "No records found",
    rows: rows.map((r: any) => {
      if (meta?.columns) {
        const row: Record<string, any> = {};
        meta.columns.forEach((col) => {
          const val = r[col.key];
          if (val !== undefined) {
            row[col.key] = val;
          } else if (col.key === "date") {
            row[col.key] = fmtDate(r.date || r.createdAt);
          } else if (["amount", "total", "value", "cost"].some((k) => col.key.toLowerCase().includes(k))) {
            row[col.key] = fmtCurrency(r[col.key] || r.amount || 0);
          } else {
            row[col.key] = r[col.key] || "—";
          }
        });
        return row;
      }
      return {
        date: fmtDate(r.date || r.createdAt),
        description: r.description || r.name || r.particulars || "—",
        amount: fmtCurrency(r.amount || r.total || r.value),
        status: r.status || "—",
      };
    }),
  };
}

// ─── Fetch Dispatcher ─────────────────────────────────────────────────────────

async function fetchReport(
  label: string,
  params: { startDate: string; endDate: string; search?: string }
): Promise<ReportData> {
  const meta = REPORT_METADATA[label];
  try {
    switch (label) {
      // Production
      case "Batch Manufacturing History": {
        const res = await productionApi.getAllBatches();
        const batches = toArr(res.data);
        return {
          kpiValue: `${batches.length} Batches`,
          kpiSubText: `Completed: ${batches.filter((b: any) => b.status === "COMPLETED").length} • Active: ${batches.filter((b: any) => b.status === "IN_PROGRESS").length}`,
          rows: batches.map((b: any) => ({
            batchNumber: b.batchNumber || b._id?.slice(-6) || "—",
            productName: b.recipe?.name || b.product?.name || b.productName || "—",
            targetYield: `${b.targetYield || b.batchSize || 0} units`,
            actualYield: b.actualYield ? `${b.actualYield} units` : "Pending",
            status: b.status || "SCHEDULED",
            stage: b.stage || "PLANNED",
            date: fmtDate(b.startDate || b.createdAt),
          })),
        };
      }
      case "Production Planning": {
        const res = await productionApi.getHistory();
        return transformGeneric(res.data, meta);
      }
      case "QC & Inspection Report": {
        const res = await productionApi.getPendingQC();
        const items = toArr(res.data);
        return {
          kpiValue: `${items.length} Pending QC`,
          kpiSubText: "Quality inspection audits",
          rows: items.map((q: any) => ({
            batchNo: q.batchNumber || q._id?.slice(-6) || "—",
            product: q.product?.name || q.recipe?.name || "—",
            inspector: q.inspector?.name || "QA Staff",
            result: q.qcStatus || "PENDING",
            score: q.qcScore ? `${q.qcScore}%` : "—",
            date: fmtDate(q.createdAt),
          })),
        };
      }
      case "Material Consumption Report": {
        const res = await inventoryApi.getRawMaterialConsumption();
        return transformGeneric(res.data, meta);
      }
      case "Wastage & Scrap Report": {
        const res = await wasteApi.getAll();
        const wasteRows = toArr(res.data);
        const totalQty = wasteRows.reduce((s: number, w: any) => s + (Number(w.quantity) || 0), 0);
        return {
          kpiValue: `${totalQty} Units Waste`,
          kpiSubText: `${wasteRows.length} scrap entries recorded`,
          rows: wasteRows.map((w: any) => ({
            date: fmtDate(w.createdAt || w.date),
            item: w.item?.name || w.itemName || "—",
            quantity: String(w.quantity || 0),
            reason: w.reason || "Damaged / Spoiled",
            note: w.note || "—",
          })),
        };
      }
      case "Formulation & Recipe Costing": {
        const res = await recipesApi.getAll();
        const recipes = toArr(res.data);
        return {
          kpiValue: `${recipes.length} Recipes`,
          kpiSubText: "Standard recipe master formulations",
          rows: recipes.map((rec: any) => ({
            recipeName: rec.name || "—",
            productName: rec.product?.name || rec.category || "—",
            batchSize: `${rec.batchSize || 1} units`,
            ingredientsCount: `${rec.ingredients?.length || 0} items`,
            costPerUnit: fmtCurrency(rec.costPerUnit || rec.estimatedCost || 0),
          })),
        };
      }
      case "Packaging & Cartons": {
        const res = await cartonApi.getAll();
        const cartons = toArr(res.data);
        return {
          kpiValue: `${cartons.length} Cartons`,
          kpiSubText: `Packaged box records`,
          rows: cartons.map((c: any) => ({
            cartonNo: c.cartonNumber || c._id?.slice(-6) || "—",
            batchNo: c.batch?.batchNumber || c.batchId || "—",
            size: c.cartonSize || "Standard",
            units: String(c.unitsPerCarton || 0),
            date: fmtDate(c.createdAt),
          })),
        };
      }

      // Inventory Ledger
      case "Raw Material Ledger": {
        const res = await inventoryApi.getRawMaterialLedger(undefined);
        const entries = toArr(res.data);
        return {
          kpiValue: `${entries.length} Ledger Entries`,
          kpiSubText: "Raw material movements and balances",
          rows: entries.map((e: any) => ({
            date: fmtDate(e.date || e.createdAt),
            itemName: e.itemName || e.item?.name || "—",
            sku: e.sku || e.item?.sku || "—",
            transactionType: e.transactionType || e.type || "—",
            inwardQty: e.inwardQty ? String(Number(e.inwardQty).toFixed(2)) : "—",
            outwardQty: e.outwardQty ? String(Number(e.outwardQty).toFixed(2)) : "—",
            runningBalance: String(Number(e.runningBalance || 0).toFixed(2)),
            unit: e.unit || e.item?.unit || "—",
            actor: e.actor || e.actorName || "System",
          })),
        };
      }
      case "Stock Movement History":
        return transformStockDetail((await inventoryApi.getMovements(params)).data);
      case "Inward & GRN Movements": {
        const res = await inventoryApi.getMovements({ ...params, type: "IN" });
        const rows = toArr(res.data).filter((r: any) => r.type === "IN" || r.direction === "IN");
        return {
          kpiValue: `${rows.length} Receipts`,
          kpiSubText: "Inward stock receipts",
          rows: rows.map((r: any) => ({
            date: fmtDate(r.date || r.createdAt),
            itemName: r.item?.name || r.itemName || "—",
            reference: r.reference || r.referenceNo || "GRN",
            quantityIn: String(Number(r.quantity || 0)),
            balance: String(Number(r.runningBalance || r.stockAfter || 0)),
          })),
        };
      }
      case "Outward & Dispatch Movements": {
        const res = await inventoryApi.getMovements({ ...params, type: "OUT" });
        const rows = toArr(res.data).filter((r: any) => r.type === "OUT" || r.direction === "OUT");
        return {
          kpiValue: `${rows.length} Dispatches`,
          kpiSubText: "Stock issues and dispatches",
          rows: rows.map((r: any) => ({
            date: fmtDate(r.date || r.createdAt),
            itemName: r.item?.name || r.itemName || "—",
            reference: r.reference || r.referenceNo || "DISPATCH",
            quantityOut: String(Number(r.quantity || 0)),
            balance: String(Number(r.runningBalance || r.stockAfter || 0)),
          })),
        };
      }
      case "Stock Adjustments & Reconciliation": {
        const res = await inventoryApi.getMovements({ ...params, type: "ADJUSTMENT" });
        return transformStockDetail(res.data);
      }
      case "Finished Goods Stock":
        return transformStockSummary((await inventoryApi.getInventory()).data);

      // Inventory
      case "Stock summary":
        return transformStockSummary((await inventoryApi.getInventory()).data);
      case "Item Report By Party":
        return transformGeneric((await reportsApi.getItemByParty(params)).data, meta);
      case "Item Wise Profit And Loss":
        return transformGeneric((await reportsApi.getItemProfitLoss(params)).data, meta);
      case "Item Category Wise Profit And Loss":
        return transformGeneric((await reportsApi.getItemCategoryProfitLoss(params)).data, meta);
      case "Low Stock Summary":
        return transformLowStock((await inventoryApi.getAlerts()).data);
      case "Stock Detail":
        return transformStockDetail((await inventoryApi.getMovements(params)).data);
      case "Item Detail":
        return transformItemDetail((await productsFullApi.getAll()).data);
      case "Sale/ Purchase Report By Item Category":
        return transformGeneric((await reportsApi.getSalePurchaseByCategory(params)).data, meta);
      case "Stock Summary Report By Item Category":
        return transformGeneric((await reportsApi.getStockByCategory(params)).data, meta);
      case "Item Wise Discount":
        return transformGeneric((await reportsApi.getItemDiscount(params)).data, meta);

      // Financial - Statements & P&L
      case "Sale":
        return transformSales((await reportsApi.getSales(params)).data);
      case "Purchase":
        return transformPurchases((await reportsApi.getPurchases(params)).data);
      case "Day book":
        return transformDayBook((await reportsApi.getDayBook(params)).data);
      case "All Transactions":
        return transformTransactions((await reportsApi.getAllTransactions(params)).data);
      case "Profit And Loss":
        return transformProfitLoss((await reportsApi.getProfit(params)).data);
      case "Bill Wise Profit":
        return transformBillWiseProfit((await reportsApi.getBillWiseProfit(params)).data);
      case "Cash flow":
        return transformCashFlow((await reportsApi.getCashFlow(params)).data);
      case "Trial Balance Report":
        return transformTrialBalance((await reportsApi.getTrialBalance(params)).data);
      case "Balance Sheet":
        return transformBalanceSheet((await reportsApi.getBalanceSheet(params)).data);

      // Financial - GST & Taxes
      case "GSTR 1":
        return transformGstr((await reportsApi.getGstr("1", params)).data);
      case "GSTR 2":
        return transformGstr((await reportsApi.getGstr("2", params)).data);
      case "GSTR 3 B":
        return transformGstr((await reportsApi.getGstr("3b", params)).data);
      case "GSTR 9":
        return transformGstr((await reportsApi.getGstr("9", params)).data);
      case "Sale Summary By HSN":
        return transformGeneric((await reportsApi.getHsnSummary(params)).data, meta);
      case "SAC Report":
        return transformGeneric((await reportsApi.getSacReport(params)).data, meta);
      case "GST Report":
        return transformGeneric((await reportsApi.getGstReport(params)).data, meta);
      case "GST Rate Report":
        return transformGeneric((await reportsApi.getGstRateReport(params)).data, meta);
      case "Form No. 27EQ":
        return transformGeneric((await reportsApi.getForm27eq(params)).data, meta);
      case "TCS Receivable":
        return transformGeneric((await reportsApi.getTcsReceivable(params)).data, meta);
      case "TDS Payable":
        return transformGeneric((await reportsApi.getTdsPayable(params)).data, meta);
      case "TDS Receivable":
        return transformGeneric((await reportsApi.getTdsReceivable(params)).data, meta);

      // Financial - Expenses & Orders & Banking
      case "Expense":
        return transformExpenses((await accountingApi.getExpenses(params)).data);
      case "Expense Category Report":
        return transformGeneric((await reportsApi.getExpenseCategory(params)).data, meta);
      case "Expense Item Report":
        return transformGeneric((await reportsApi.getExpenseItem(params)).data, meta);
      case "Sale Orders":
        return transformSaleOrders((await reportsApi.getSaleOrders(params)).data);
      case "Sale Order Item":
        return transformGeneric((await reportsApi.getSaleOrders(params)).data, meta);
      case "Bank Statement":
        return transformGeneric((await reportsApi.getBankStatement(params)).data, meta);
      case "Discount Report":
        return transformGeneric((await reportsApi.getDiscountReport(params)).data, meta);
      case "Loan Statement":
        return transformGeneric((await reportsApi.getLoanStatement(params)).data, meta);

      // Franchise
      case "Party Statement":
        return transformPartyStatement((await reportsApi.getPartyStatement(params)).data);
      case "Party wise Profit & Loss":
        return transformGeneric((await reportsApi.getPartyProfitLoss(params)).data, meta);
      case "All parties":
        return transformAllParties((await reportsApi.getAllParties()).data);
      case "Party Report By Item":
        return transformGeneric((await reportsApi.getPartyByItem(params)).data, meta);
      case "Sale Purchase By Party":
        return transformGeneric((await reportsApi.getSalePurchaseByParty(params)).data, meta);
      case "Sale Purchase By Party Group":
        return transformGeneric((await reportsApi.getSalePurchaseByPartyGroup(params)).data, meta);
      case "Franchise Dues & Balances":
        return transformAllParties((await reportsApi.getAllParties()).data);
      case "Franchise Performance Summary":
        return transformGeneric((await reportsApi.getSalePurchaseByParty(params)).data, meta);

      default:
        return { kpiValue: "—", kpiSubText: "Report ready", rows: [] };
    }
  } catch {
    return { kpiValue: "—", kpiSubText: "No records found for selected period", rows: [] };
  }
}

// ─── Inner Reports Component (Uses useSearchParams) ───────────────────────────

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string>("production");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedFinancialCategory, setSelectedFinancialCategory] = useState<string>("All");
  const [tableSearchTerm, setTableSearchTerm] = useState("");

  const [dateFilter, setDateFilter] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  // Profit Loss special subview state
  const [plViewType, setPlViewType] = useState<"vyapar" | "accounting">("vyapar");
  const [plExpanded, setPlExpanded] = useState({
    directExpenses: true,
    taxPayable: true,
    taxReceivable: true,
    indirectExpenses: true,
  });

  // Sync state from URL search params
  useEffect(() => {
    setMounted(true);
    const parentParam = searchParams.get("parent");
    const reportParam = searchParams.get("report");

    let resolvedParent = "production";
    if (parentParam) {
      const foundParent = PARENT_REPORTS.find(
        (p) => p.id.toLowerCase() === parentParam.toLowerCase()
      );
      if (foundParent) {
        resolvedParent = foundParent.id;
      }
    }

    setSelectedParentId(resolvedParent);

    const parentDef = PARENT_REPORTS.find((p) => p.id === resolvedParent) || PARENT_REPORTS[0];

    if (reportParam) {
      const foundChild = parentDef.children.find(
        (c) =>
          c.id.toLowerCase() === reportParam.toLowerCase() ||
          c.label.toLowerCase() === reportParam.toLowerCase()
      );
      setSelectedChildId(foundChild ? foundChild.id : parentDef.children[0].id);
    } else {
      setSelectedChildId((prev) => {
        // If current child belongs to this parent, preserve it; otherwise default to first child
        const exists = parentDef.children.find((c) => c.id === prev);
        return exists ? prev : parentDef.children[0].id;
      });
    }
  }, [searchParams]);

  // Update browser URL query
  const updateUrl = useCallback(
    (parentId: string, childId: string | null) => {
      const params = new URLSearchParams();
      params.set("parent", parentId);
      if (childId) {
        params.set("report", childId);
      }
      const qs = params.toString();
      router.push(`/reports?${qs}`);
    },
    [router]
  );

  // Handle child selection
  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    setTableSearchTerm("");
    updateUrl(selectedParentId, childId);
  };

  // Active Parent & Child definitions
  const activeParent = useMemo(() => {
    return PARENT_REPORTS.find((p) => p.id === selectedParentId) || PARENT_REPORTS[0];
  }, [selectedParentId]);

  const activeChild = useMemo(() => {
    if (!activeParent) return null;
    return (
      activeParent.children.find((c) => c.id === selectedChildId) ||
      activeParent.children[0]
    );
  }, [activeParent, selectedChildId]);

  // Filtered children for active parent
  const filteredChildren = useMemo(() => {
    if (!activeParent) return [];
    return activeParent.children.filter((child) => {
      const matchesFinancialCat =
        activeParent.id !== "financial" ||
        selectedFinancialCategory === "All" ||
        child.category === selectedFinancialCategory;
      return matchesFinancialCat;
    });
  }, [activeParent, selectedFinancialCategory]);

  // Fetch report data when active child or date changes
  useEffect(() => {
    if (!mounted || !activeChild) {
      setReportData(null);
      return;
    }
    let cancelled = false;
    const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
    setLoading(true);
    setReportData(null);

    fetchReport(activeChild.id, { startDate: from, endDate: to })
      .then((d) => {
        if (!cancelled) setReportData(d);
      })
      .catch(() => {
        if (!cancelled) setReportData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mounted, activeChild, dateFilter, customStartDate, customEndDate]);

  const currentMeta = activeChild ? REPORT_METADATA[activeChild.id] ?? DEFAULT_META : DEFAULT_META;
  const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
  const displayRange = `${fmtDisplayDate(from)} to ${fmtDisplayDate(to)}`;

  // Filter table rows
  const filteredRows = (reportData?.rows ?? []).filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(tableSearchTerm.toLowerCase())
    )
  );

  // Print & CSV Export
  const handlePrint = () => {
    toast.success(`Preparing print layout for ${currentMeta.title}...`);
    window.print();
  };

  // Row-level print: isolates just the clicked record instead of reusing
  // handlePrint (which prints the whole current report view).
  const handlePrintRow = (row: Record<string, any>) => {
    const cols = currentMeta.columns;
    const rowsHtml = cols
      .map((c) => `<tr><td style="padding:6px 14px;font-weight:600;color:#475569;white-space:nowrap;">${c.label}</td><td style="padding:6px 14px;">${row[c.key] ?? "—"}</td></tr>`)
      .join("");
    const win = window.open("", "_blank", "width=480,height=640");
    if (!win) {
      toast.error("Please allow pop-ups to print");
      return;
    }
    win.document.write(`
      <html>
        <head>
          <title>${currentMeta.title} — ${row[cols[0]?.key] ?? ""}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #0f172a; }
            h2 { font-size: 16px; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; }
            td { border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          </style>
        </head>
        <body>
          <h2>${currentMeta.title}</h2>
          <table>${rowsHtml}</table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleShareRow = async (row: Record<string, any>) => {
    const cols = currentMeta.columns;
    const text = [currentMeta.title, ...cols.map((c) => `${c.label}: ${row[c.key] ?? "—"}`)].join("\n");
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: currentMeta.title, text });
      } catch {
        // user cancelled the share sheet — no-op
      }
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      toast.success("Details copied to clipboard");
      return;
    }
    toast.error("Sharing is not supported in this browser");
  };

  const handleExportCSV = () => {
    if (!reportData || reportData.rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const toastId = toast.loading("Generating CSV...");
    try {
      const cols = currentMeta.columns;
      const header = cols.map((c) => c.label).join(",");
      const rowLines = reportData.rows.map((row) =>
        cols.map((c) => `"${String(row[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
      );
      const csvContent = "data:text/csv;charset=utf-8," + [header, ...rowLines].join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute(
        "download",
        `${(activeChild?.label || "report").replace(/\s+/g, "_").toLowerCase()}_${from}_${to}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV Exported", { id: toastId });
    } catch {
      toast.error("Export failed", { id: toastId });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 -m-4 md:-m-6">
      {/* ── Top Header / Breadcrumb Bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-[#f58220] rounded-lg">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <span>Reports</span>
              <span>/</span>
              <span className="text-gray-900 font-semibold">{activeParent.label}</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              {activeParent.label} — {activeChild?.label || "Report"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/sales/invoices/new")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#f58220] hover:bg-[#e0751a] text-white text-xs font-semibold rounded-lg shadow-sm transition-all shadow-orange-500/10"
          >
            <Plus className="h-4 w-4" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* ── Horizontal Navigation Tabs (Pill style) ── */}
        <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {filteredChildren.map((child) => {
            const isActive = selectedChildId === child.id;
            return (
              <button
                key={child.id}
                onClick={() => handleSelectChild(child.id)}
                className={clsx(
                  "px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2",
                  isActive
                    ? "bg-[#f58220] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
                )}
              >
                <span>{child.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Top Summary / KPI Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-4 ring-orange-50" />
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {currentMeta.kpiLabel}
              </div>
              <div className="text-xl font-bold text-gray-900 mt-0.5">
                {loading ? "..." : reportData?.kpiValue || "0"}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Summary Details
              </div>
              <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                {loading ? "Calculating..." : reportData?.kpiSubText || "All records captured"}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-50" />
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Current Period
              </div>
              <div className="text-sm font-semibold text-gray-700 mt-0.5">
                {displayRange}
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters Row ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search in table..."
              value={tableSearchTerm}
              onChange={(e) => setTableSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#f58220]"
            />
          </div>

          {/* Date Preset Filter */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none cursor-pointer focus:border-[#f58220]"
            >
              <option>This Month</option>
              <option>Today</option>
              <option>Yesterday</option>
              <option>Last 7 Days</option>
              <option>This Year</option>
              <option>Custom</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Custom Date Pickers */}
          {dateFilter === "Custom" && (
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs text-gray-700 outline-none"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs text-gray-700 outline-none"
              />
            </div>
          )}

          <div className="flex-1" />

          {/* CSV Export & Print */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs"
            title="Export CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs"
            title="Print"
          >
            <Printer className="h-4 w-4 text-gray-500" />
            <span>Print</span>
          </button>

          <button
            onClick={() => {
              const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
              if (activeChild) {
                setLoading(true);
                fetchReport(activeChild.id, { startDate: from, endDate: to })
                  .then((d) => setReportData(d))
                  .finally(() => setLoading(false));
              }
            }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-orange-500")} />
          </button>
        </div>

        {/* ── Unified Clean Data Table ── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              {currentMeta.tableTitle}
            </span>
            <span className="text-xs font-medium text-gray-400">
              {filteredRows.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-16 flex justify-center items-center">
                <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500 text-[11px] font-bold border-b border-gray-200 uppercase tracking-wider">
                    {currentMeta.columns.map((col, idx) => (
                      <th
                        key={idx}
                        className="px-5 py-3.5 font-bold text-gray-500"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-5 py-3.5 text-right font-bold text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-medium">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="hover:bg-orange-50/20 transition-colors"
                      >
                        {currentMeta.columns.map((col, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-5 py-3.5 text-gray-700"
                          >
                            {col.key === "status" || col.key === "result" ? (
                              <span
                                className={clsx(
                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                  String(row[col.key]).toUpperCase().includes("APPROV") || String(row[col.key]).toUpperCase() === "COMPLETED"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : String(row[col.key]).toUpperCase().includes("PROGRESS")
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : String(row[col.key]).toUpperCase().includes("REJECT")
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                )}
                              >
                                {row[col.key]}
                              </span>
                            ) : (
                              row[col.key] ?? "—"
                            )}
                          </td>
                        ))}
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handlePrintRow(row)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors inline-flex items-center"
                            title="Print Single Record"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={currentMeta.columns.length + 1}
                        className="px-5 py-16 text-center text-gray-400 text-xs"
                      >
                        {tableSearchTerm
                          ? `No entries match "${tableSearchTerm}".`
                          : "No data records found for the selected period."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <RefreshCw className="h-6 w-6 animate-spin text-[#f58220]" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
