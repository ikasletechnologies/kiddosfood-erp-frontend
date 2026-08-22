"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Download as DownloadIcon,
  Calendar as CalendarIcon,
  ExternalLink as ExternalLinkIcon,
  FileText as FileTextIcon,
  ShoppingCart as ShoppingCartIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Info as InfoIcon,
  Crown as CrownIcon,
  Users as UsersIcon,
  Layers as LayersIcon,
  Package as PackageIcon,
  TrendingUp as TrendingUpIcon,
  Calculator as CalculatorIcon,
  Wallet as WalletIcon,
  Landmark as LandmarkIcon,
  Printer as PrinterIcon,
  Share2 as ShareIcon,
  BarChart4 as ChartIcon,
  FileSpreadsheet as ExcelIcon,
  Loader2 as LoaderIcon,
  AlertCircle as AlertCircleIcon,
} from "lucide-react";
import { clsx } from "clsx";
import toast from "react-hot-toast";
import { reportsApi, accountingApi } from "@/lib/api/accounting.api";
import { inventoryApi, productsFullApi } from "@/lib/api/inventory.api";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportItem {
  label: string;
  isNew?: boolean;
  isVip?: boolean;
}

interface ReportCategory {
  title: string;
  icon: any;
  items: ReportItem[];
}

interface ReportMeta {
  title: string;
  addBtnLabel?: string;
  addBtnColor?: string;
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

// ─── Sidebar Categories ───────────────────────────────────────────────────────

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    title: "Transaction report",
    icon: FileTextIcon,
    items: [
      { label: "Sale" },
      { label: "Purchase" },
      { label: "Day book" },
      { label: "All Transactions" },
      { label: "Profit And Loss" },
      { label: "Bill Wise Profit", },
      { label: "Cash flow" },
      { label: "Trial Balance Report", },
      { label: "Balance Sheet", },
    ],
  },
  {
    title: "Party report",
    icon: UsersIcon,
    items: [
      { label: "Party Statement" },
      { label: "Party wise Profit & Loss",  },
      { label: "All parties" },
      { label: "Party Report By Item" },
      { label: "Sale Purchase By Party" },
      { label: "Sale Purchase By Party Group" },
    ],
  },
  {
    title: "GST reports",
    icon: LayersIcon,
    items: [
      { label: "GSTR 1" },
      { label: "GSTR 2" },
      { label: "GSTR 3 B" },
      { label: "GSTR 9" },
      { label: "Sale Summary By HSN" },
      { label: "SAC Report" },
    ],
  },
  {
    title: "Item/ Stock report",
    icon: PackageIcon,
    items: [
      { label: "Stock summary" },
      { label: "Item Report By Party" },
      { label: "Item Wise Profit And Loss" },
      { label: "Item Category Wise Profit And Loss" },
      { label: "Low Stock Summary" },
      { label: "Stock Detail" },
      { label: "Item Detail" },
      { label: "Sale/ Purchase Report By Item Category" },
      { label: "Stock Summary Report By Item Category" },
      { label: "Item Wise Discount" },
    ],
  },
  {
    title: "Business Status",
    icon: TrendingUpIcon,
    items: [{ label: "Bank Statement" }, { label: "Discount Report" }],
  },
  {
    title: "Taxes",
    icon: CalculatorIcon,
    items: [
      { label: "GST Report" },
      { label: "GST Rate Report" },
      { label: "Form No. 27EQ" },
      { label: "TCS Receivable" },
      { label: "TDS Payable" },
      { label: "TDS Receivable" },
    ],
  },
  {
    title: "Expense report",
    icon: WalletIcon,
    items: [
      { label: "Expense" },
      { label: "Expense Category Report" },
      { label: "Expense Item Report" },
    ],
  },
  {
    title: "Sale Order report",
    icon: ShoppingCartIcon,
    items: [{ label: "Sale Orders" }, { label: "Sale Order Item" }],
  },
  {
    title: "Loan Accounts",
    icon: LandmarkIcon,
    items: [{ label: "Loan Statement" }],
  },
];

// ─── Static Report Metadata (columns, titles — no data) ──────────────────────

const REPORT_METADATA: Record<string, ReportMeta> = {
  // Transaction Reports
  Sale: {
    title: "Sale Invoices",
    addBtnLabel: "+ Add Sale",
    addBtnColor: "bg-orange-500 hover:bg-orange-600 focus:ring-orange-500 shadow-sm shadow-orange-500/10",
    kpiLabel: "Total Sales Amount",
    tableTitle: "Transactions",
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
    addBtnLabel: "+ Add Purchase",
    addBtnColor: "bg-orange-500 hover:bg-orange-600 focus:ring-orange-500 shadow-sm shadow-orange-500/10",
    kpiLabel: "Total Purchases Value",
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
    kpiLabel: "Daily Net Cash Flow",
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
    kpiLabel: "Total Transaction Volume",
    tableTitle: "Account Transactions",
    columns: [
      { key: "date", label: "Date" },
      { key: "refNo", label: "Reference No" },
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
  // Party Reports
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
    kpiLabel: "Total Items Sold",
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
    kpiLabel: "Total Transactions",
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
  // GST Reports
  "GSTR 1": {
    title: "GSTR 1 – Outward Supplies",
    kpiLabel: "Total Output GST",
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
    kpiLabel: "Total Input GST",
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
    kpiLabel: "Total Taxable Value",
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
    kpiLabel: "Total Service Value",
    tableTitle: "SAC-wise Summary",
    columns: [
      { key: "sac", label: "SAC Code" },
      { key: "description", label: "Service" },
      { key: "taxableAmount", label: "Taxable Value" },
      { key: "gstRate", label: "GST Rate" },
      { key: "totalTax", label: "Total Tax" },
    ],
  },
  // Item / Stock Reports
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
    kpiLabel: "Total Item Profit",
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
    kpiLabel: "Total Category Profit",
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
    kpiLabel: "Items Below Minimum",
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
    kpiLabel: "Total Movements",
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
    kpiLabel: "Total Stock Value",
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
    kpiLabel: "Total Discount Given",
    tableTitle: "Item Discount Details",
    columns: [
      { key: "itemName", label: "Item Name" },
      { key: "totalSales", label: "Total Sales" },
      { key: "discountAmount", label: "Discount Amount" },
      { key: "discountPct", label: "Discount %" },
      { key: "netAmount", label: "Net Amount" },
    ],
  },
  // Business Status
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
  // Taxes
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
    kpiLabel: "Total Tax Collected",
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
    kpiLabel: "Total TCS Receivable",
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
    kpiLabel: "Total TDS Payable",
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
    kpiLabel: "Total TDS Receivable",
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
  // Expense Reports
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
    kpiLabel: "Total Expense Items",
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
  // Sale Order Report
  "Sale Orders": {
    title: "Sale Orders Report",
    kpiLabel: "Total Sale Orders Value",
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
  // Loan
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

function fmtDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Data Helpers ─────────────────────────────────────────────────────────────

function fmtCurrency(val: any): string {
  const num = Number(val) || 0;
  return `₹ ${num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: any): string {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("en-IN");
  } catch {
    return String(val);
  }
}

function toArr(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const key of ["data", "items", "invoices", "orders", "entries", "transactions", "expenses", "accounts", "results"]) {
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
    kpiSubText: `Received: ${fmtCurrency(received)}  Balance: ${fmtCurrency(total - received)}`,
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
    kpiSubText: `Paid: ${fmtCurrency(paid)}  Balance: ${fmtCurrency(total - paid)}`,
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
    kpiValue: fmtCurrency(closingBalance - openingBalance),
    kpiSubText: `Cash In: ${fmtCurrency(cashIn)}  Cash Out: ${fmtCurrency(cashOut)}  Closing: ${fmtCurrency(closingBalance)}`,
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
    kpiSubText: `Debit Total: ${fmtCurrency(totalDebit)}  Credit Total: ${fmtCurrency(totalCredit)}`,
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
  const purchase = Number(data?.purchase || 0);
  const taxPayable = Number(data?.taxPayable ?? data?.tax ?? 0);
  const taxReceivable = Number(data?.taxReceivable || 0);
  const grossProfit = Number(data?.grossProfit || (revenue - cogs));
  return {
    kpiValue: fmtCurrency(netProfit),
    kpiSubText: `Revenue: ${fmtCurrency(revenue)}  Expenses: ${fmtCurrency(expenses)}`,
    rows: [],
    revenue,
    cogs,
    purchase,
    tax: taxPayable,
    taxPayable,
    taxReceivable,
    grossProfit,
    expenses,
    netProfit
  };
}

function transformBillWiseProfit(data: any): ReportData {
  const rows = toArr(data);
  const totalProfit = rows.reduce((s: number, r: any) => s + (Number(r.profit) || 0), 0);
  const totalSales = rows.reduce((s: number, r: any) => s + (Number(r.total) || Number(r.saleAmount) || 0), 0);
  return {
    kpiValue: fmtCurrency(totalProfit),
    kpiSubText: `Bills: ${rows.length}  Avg Margin: ${totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) + "%" : "—"}`,
    rows: rows.map((r: any) => ({
      date: fmtDate(r.date || r.createdAt),
      invoiceNo: r.invoiceNumber || r.billNo || r._id?.slice(-6) || "—",
      partyName: r.customer?.name || r.partyName || "—",
      saleAmount: fmtCurrency(r.total || r.saleAmount),
      costAmount: fmtCurrency(r.cost || r.costAmount),
      profit: fmtCurrency(r.profit),
      margin: r.margin ? `${Number(r.margin).toFixed(1)}%` : "—",
      rawSale: Number(r.total || r.saleAmount || 0),
      rawProfit: Number(r.profit || 0),
    })),
    totalSales,
    totalProfit
  };
}

function transformCashFlow(data: any): ReportData {
  const entries = toArr(data?.entries || data?.transactions || data);
  const cashIn = Number(data?.totalInflow || data?.cashIn || entries.filter((e: any) => e.type === "IN" || e.direction === "IN").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0));
  const cashOut = Number(data?.totalOutflow || data?.cashOut || entries.filter((e: any) => e.type === "OUT" || e.direction === "OUT").reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0));
  return {
    kpiValue: fmtCurrency(cashIn - cashOut),
    kpiSubText: `Inflow: ${fmtCurrency(cashIn)}  Outflow: ${fmtCurrency(cashOut)}`,
    rows: entries.map((e: any) => ({
      date: fmtDate(e.date || e.createdAt),
      refNo: e.refNo || e.invoiceNumber || e.billNo || e._id?.slice(-6) || "—",
      partyName: e.customer?.name || e.partyName || e.name || "—",
      category: e.category || "—",
      type: e.type || e.direction || "—",
      cashIn: e.type === "IN" || e.direction === "IN" ? Number(e.amount || 0) : 0,
      cashOut: e.type === "OUT" || e.direction === "OUT" ? Number(e.amount || 0) : 0,
      runningCash: Number(e.runningBalance || e.balance || 0)
    })),
    cashIn,
    cashOut
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
    totalCredit
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
    kpiSubText: `Assets: ${fmtCurrency(totalAssets)}  Liabilities + Equity: ${fmtCurrency(totalLiabilities)}`,
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
    kpiSubText: `Opening: ${fmtCurrency(opening)}  Closing: ${fmtCurrency(closing)}`,
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
    kpiSubText: `Customers: ${customers}  Vendors: ${vendors}`,
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
    kpiSubText: `Taxable: ${fmtCurrency(totalTaxable)}  Tax: ${fmtCurrency(totalTax)}`,
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
    kpiSubText: `Items: ${rows.length}  Total Units: ${rows.reduce((s: number, r: any) => s + (Number(r.quantity || r.currentStock) || 0), 0)}`,
    rows: rows.map((r: any) => ({
      itemName: r.name || r.itemName || "—",
      category: r.category?.name || r.categoryName || r.group || "—",
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
    kpiSubText: rows.length > 0 ? "Requires immediate reorder" : "All stock levels healthy",
    rows: rows.map((r: any) => ({
      itemName: r.item?.name || r.name || r.itemName || "—",
      category: r.item?.category || r.category || "—",
      unit: r.unit || r.item?.unit || "—",
      currentStock: String(Number(r.currentStock || r.quantity || r.stock || 0)),
      minStock: String(Number(r.minQuantity || r.reorderPoint || r.threshold || 0)),
      shortfall: String(Math.max(0, (Number(r.minQuantity || r.reorderPoint || 0)) - (Number(r.currentStock || r.quantity || 0)))),
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
    kpiSubText: `Total In: ${totalIn}  Total Out: ${totalOut}`,
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
    kpiSubText: `Paid: ${fmtCurrency(paid)}  Pending: ${fmtCurrency(total - paid)}`,
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
    kpiSubText: `Total: ${rows.length}  Pending: ${pending}  Completed: ${rows.length - pending}`,
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
    kpiValue: rows.length > 0 ? fmtCurrency(totalAmount) : "—",
    kpiSubText: rows.length > 0 ? `${rows.length} records` : "No data for selected period",
    rows: rows.map((r: any) => {
      if (meta?.columns) {
        const row: Record<string, any> = {};
        meta.columns.forEach((col) => {
          const val = r[col.key];
          if (val !== undefined) {
            row[col.key] = val;
          } else if (col.key === "date") {
            row[col.key] = fmtDate(r.date || r.createdAt);
          } else if (["amount", "total", "value"].some((k) => col.key.toLowerCase().includes(k))) {
            row[col.key] = fmtCurrency(r[col.key] || r.amount);
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

// ─── Main Fetch Dispatcher ────────────────────────────────────────────────────

async function fetchReport(
  label: string,
  params: { startDate: string; endDate: string; search?: string }
): Promise<ReportData> {
  const meta = REPORT_METADATA[label];
  try {
    switch (label) {
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
      case "Bank Statement":
        return transformGeneric((await reportsApi.getBankStatement(params)).data, meta);
      case "Discount Report":
        return transformGeneric((await reportsApi.getDiscountReport(params)).data, meta);
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
      case "Expense":
        return transformExpenses((await accountingApi.getExpenses(params)).data);
      case "Expense Category Report":
        return transformGeneric((await reportsApi.getExpenseCategory(params)).data, meta);
      case "Expense Item Report":
        return transformGeneric((await reportsApi.getExpenseItem(params)).data, meta);
      case "Sale Orders":
        return transformSaleOrders((await reportsApi.getSaleOrders(params)).data);
      case "Loan Statement":
        return transformGeneric((await reportsApi.getLoanStatement(params)).data, meta);
      default:
        return { kpiValue: "—", kpiSubText: "Report coming soon", rows: [] };
    }
  } catch {
    return { kpiValue: "—", kpiSubText: "No data for selected period", rows: [] };
  }
}

// ─── Navigation href map ──────────────────────────────────────────────────────

function getReportHref(label: string): string {
  switch (label) {
    case "Sale":
    case "Sale Summary By HSN":
      return "/sales/invoices";
    case "Purchase":
      return "/purchases/orders";
    case "Day book":
    case "All Transactions":
    case "Profit And Loss":
    case "Bill Wise Profit":
    case "Trial Balance Report":
    case "Balance Sheet":
    case "Cash flow":
      return "/accounting/profit-loss";
    case "Party Statement":
      return "/franchise/performance";
    case "All parties":
      return "/franchise/dues";
    case "Sale Orders":
    case "Sale Purchase By Party":
    case "Sale Purchase By Party Group":
      return "/sales/orders";
    case "Stock summary":
    case "Item Report By Party":
    case "Stock Detail":
    case "Item Detail":
    case "Sale/ Purchase Report By Item Category":
    case "Stock Summary Report By Item Category":
      return "/inventory/stock-value";
    case "Item Wise Profit And Loss":
    case "Item Category Wise Profit And Loss":
    case "Item Wise Discount":
      return "/inventory/product-pnl";
    case "Low Stock Summary":
      return "/inventory/forecast";
    case "Expense":
    case "Expense Category Report":
    case "Expense Item Report":
    case "GST Report":
    case "GST Rate Report":
    case "Form No. 27EQ":
    case "TCS Receivable":
    case "TDS Payable":
    case "TDS Receivable":
    case "GSTR 1":
    case "GSTR 2":
    case "GSTR 3 B":
    case "GSTR 9":
    case "SAC Report":
      return "/accounting/expenses";
    case "Bank Statement":
    case "Loan Statement":
      return "/accounting/ledgers";
    case "Discount Report":
    case "Party wise Profit & Loss":
      return "/accounting/profit-loss";
    default:
      return "/reports";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CentralReports() {
  const [mounted, setMounted] = useState(false);
  const [selectedReport, setSelectedReport] = useState("Sale");
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState("");
  const [tableSearchTerm, setTableSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("This Month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [plViewType, setPlViewType] = useState<'vyapar' | 'accounting'>('vyapar');
  const [plExpanded, setPlExpanded] = useState({
    directExpenses: true,
    taxPayable: true,
    taxReceivable: true,
    indirectExpenses: true,
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("report");
      if (r) {
        setSelectedReport(r);
      }
    }
  }, []);

  // Debounce the table search so it doesn't refetch on every keystroke.
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(tableSearchTerm), 400);
    return () => clearTimeout(t);
  }, [tableSearchTerm]);

  // Reload whenever report, date range, or search term changes. The search
  // term is forwarded to the backend (currently only consumed by the
  // Purchase report's poNumber/vendor search) so a match outside the
  // currently-loaded page/date-scoped rows still gets found — the client-side
  // `filteredRows` filter below only ever sees whatever this fetch loaded.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
    setLoading(true);
    setReportData(null);
    fetchReport(selectedReport, { startDate: from, endDate: to, search: debouncedSearchTerm || undefined })
      .then((d) => { if (!cancelled) setReportData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mounted, selectedReport, dateFilter, customStartDate, customEndDate, debouncedSearchTerm]);

  if (!mounted) return <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" />;

  const currentMeta = REPORT_METADATA[selectedReport] ?? DEFAULT_META;
  const { from, to } = getDateRange(dateFilter, customStartDate, customEndDate);
  const displayRange = `${fmtDisplayDate(from)} To ${fmtDisplayDate(to)}`;

  // Filter sidebar
  const filteredCategories = REPORT_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) =>
      item.label.toLowerCase().includes(sidebarSearchTerm.toLowerCase())
    ),
  })).filter((c) => c.items.length > 0);

  // Filter table rows
  const filteredRows = (reportData?.rows ?? []).filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(tableSearchTerm.toLowerCase())
    )
  );

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
      link.setAttribute("download", `${selectedReport.replace(/\s+/g, "_").toLowerCase()}_${from}_${to}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV Exported", { id: toastId });
    } catch {
      toast.error("Export failed", { id: toastId });
    }
  };

  const handleOpen = (itemLabel: string) => {
    const href = getReportHref(itemLabel);
    window.location.href = href;
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-[#020617] -m-8">
      {/* Left Sidebar */}
      <div className="w-[280px] shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full bg-white dark:bg-slate-900/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={sidebarSearchTerm}
              onChange={(e) => setSidebarSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredCategories.map((category, catIdx) => (
            <div key={catIdx} className="mb-4">
              <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 select-none">
                <category.icon size={12} className="text-orange-500" />
                {category.title}
              </div>
              <div className="divide-y divide-[#F9F7F9]/10">
                {category.items.map((item, itemIdx) => {
                  const isActive = selectedReport === item.label;
                  return (
                    <div
                      key={itemIdx}
                      onClick={() => {
                        setSelectedReport(item.label);
                        setTableSearchTerm("");
                      }}
                      className={clsx(
                        "px-4 py-2.5 text-[13px] font-semibold flex items-center justify-between cursor-pointer transition-all duration-150 border-l-4 select-none group/item",
                        isActive
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-l-orange-500 font-bold"
                          : "text-[#555] dark:text-slate-300 hover:bg-[#F2F0F2] dark:hover:bg-slate-800/50 border-l-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="truncate">{item.label}</span>
                        {item.isNew && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
                        )}
                        {item.isVip && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400 shrink-0">
                            <CrownIcon size={10} className="fill-current" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpen(item.label); }}
                          className="text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 p-0.5 transition-colors"
                          title="Open Page"
                        >
                          <ExternalLinkIcon size={13} className="stroke-[2.5]" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleExportCSV(); }}
                          className="text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 p-0.5 transition-colors"
                          title="Export CSV"
                        >
                          <DownloadIcon size={13} className="stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Content Pane */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#090D1A]">
        {/* Top Control Header */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="relative w-64 max-w-full">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${currentMeta.title}...`}
              value={tableSearchTerm}
              onChange={(e) => setTableSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.location.href = "/sales/invoices"}
              className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 transition-colors uppercase tracking-wider shadow-sm shadow-orange-500/10"
            >
              + Add Sale
            </button>
            <button
              onClick={() => window.location.href = "/purchases/orders"}
              className="px-3.5 py-1.5 rounded-lg text-xs font-black text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 dark:text-orange-400 transition-colors uppercase tracking-wider border border-orange-200 dark:border-orange-900/30"
            >
              + Add Purchase
            </button>
            <button
              onClick={() => window.location.href = getReportHref(selectedReport)}
              className="p-2 rounded-lg text-white bg-orange-500 hover:bg-orange-600 transition-colors shadow-sm"
            >
              <PlusIcon size={14} className="stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {currentMeta.title}
            </h1>
            {currentMeta.addBtnLabel && (
              <button
                onClick={() => window.location.href = getReportHref(selectedReport)}
                className={clsx(
                  "px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2",
                  currentMeta.addBtnColor || "bg-[#f97316] hover:bg-purple-700"
                )}
              >
                {currentMeta.addBtnLabel}
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Filter by:</span>
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer focus:border-orange-500"
                >
                  <option>This Month</option>
                  <option>Today</option>
                  <option>Yesterday</option>
                  <option>Last 7 Days</option>
                  <option>This Year</option>
                  <option>Custom</option>
                </select>
                <ChevronDownIcon size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {dateFilter === "Custom" ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500"
                />
                <span className="text-slate-400 font-bold">To</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg font-bold text-slate-700 dark:text-slate-200">
                <CalendarIcon size={12} className="text-slate-400" />
                <span>{displayRange}</span>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <LoaderIcon size={12} className="animate-spin" />
                <span className="text-[11px] font-semibold">Loading...</span>
              </div>
            )}
          </div>

          {selectedReport === "Profit And Loss" ? (
            <CentralProfitLossReport 
              reportData={reportData}
              loading={loading}
              viewType={plViewType}
              setViewType={setPlViewType}
              expanded={plExpanded}
              setExpanded={setPlExpanded}
            />
          ) : selectedReport === "Bill Wise Profit" ? (
            <CentralBillWiseProfitReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Cash flow" ? (
            <CentralCashFlowReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Trial Balance Report" ? (
            <CentralTrialBalanceReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Balance Sheet" ? (
            <CentralBalanceSheetReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Party Statement" ? (
            <CentralPartyStatementReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Party wise Profit & Loss" ? (
            <CentralPartyProfitLossReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "All parties" ? (
            <CentralAllPartiesReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Party Report By Item" ? (
            <CentralPartyReportByItem 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Sale Purchase By Party" ? (
            <CentralSalePurchaseByParty 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Sale Purchase By Party Group" ? (
            <CentralSalePurchaseByPartyGroup 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Loan Statement" ? (
            <CentralLoanStatementReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Sale Orders" ? (
            <CentralSaleOrdersReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Sale Order Item" ? (
            <CentralSaleOrderItemReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Expense" ? (
            <CentralExpenseReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Expense Category Report" ? (
            <CentralExpenseCategoryReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Expense Item Report" ? (
            <CentralExpenseItemReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "GSTR 1" ? (
            <CentralGSTR1Report />
          ) : selectedReport === "GSTR 2" ? (
            <CentralGSTR2Report />
          ) : selectedReport === "GSTR 3 B" ? (
            <CentralGSTR3BReport />
          ) : selectedReport === "GSTR 9" ? (
            <CentralGSTR9Report />
          ) : selectedReport === "Sale Summary By HSN" ? (
            <CentralSaleSummaryByHSNReport />
          ) : selectedReport === "SAC Report" ? (
            <CentralSACReport />
          ) : selectedReport === "GST Report" ? (
            <CentralGSTReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "GST Rate Report" ? (
            <CentralGSTRateReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "TCS Receivable" ? (
            <CentralTCSReceivableReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Form No. 27EQ" ? (
            <CentralForm27eqReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "TDS Payable" ? (
            <CentralTDSPayableReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "TDS Receivable" ? (
            <CentralTDSReceivableReport 
              reportData={reportData}
              loading={loading}
            />
          ) : selectedReport === "Bank Statement" ? (
            <CentralBankStatementReport />
          ) : selectedReport === "Discount Report" ? (
            <CentralDiscountReport />
          ) : selectedReport === "Stock summary" ? (
            <CentralStockSummaryReport />
          ) : selectedReport === "Item Report By Party" ? (
            <CentralItemReportByParty />
          ) : selectedReport === "Item Wise Profit And Loss" ? (
            <CentralItemWiseProfitLossReport />
          ) : selectedReport === "Item Category Wise Profit And Loss" ? (
            <CentralItemCategoryWiseProfitLossReport />
          ) : selectedReport === "Low Stock Summary" ? (
            <CentralLowStockSummaryReport />
          ) : selectedReport === "Stock Detail" ? (
            <CentralStockDetailReport />
          ) : selectedReport === "Item Detail" ? (
            <CentralItemDetailReport />
          ) : selectedReport === "Sale/ Purchase Report By Item Category" ? (
            <CentralSalePurchaseByCategoryReport />
          ) : selectedReport === "Stock Summary Report By Item Category" ? (
            <CentralStockSummaryByCategoryReport />
          ) : selectedReport === "Item Wise Discount" ? (
            <CentralItemWiseDiscountReport />
          ) : (
            <>
              {/* KPI Card */}
              <div className="max-w-md">
                <div className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#12141c] rounded-2xl p-5 shadow-sm space-y-3 relative group overflow-hidden">
                  <div className="absolute -right-8 -top-8 w-16 h-16 rounded-full bg-[#f97316]/5 blur-xl group-hover:bg-[#f97316]/10 transition-all duration-300" />
                  {loading ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-3 w-56 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                            {currentMeta.kpiLabel}
                          </span>
                          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {reportData?.kpiValue ?? "—"}
                          </p>
                        </div>
                        {reportData?.kpiTrend && (
                          <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase rounded-lg shadow-sm">
                            {reportData.kpiTrend}
                          </span>
                        )}
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                        <span>{reportData?.kpiSubText ?? "—"}</span>
                        <InfoIcon size={12} className="opacity-60 cursor-pointer hover:opacity-100" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-[#12141c] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    {currentMeta.tableTitle}
                  </h2>
                  <div className="flex items-center gap-2 text-slate-400">
                    <button className="p-1.5 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Search">
                      <SearchIcon size={14} className="stroke-[2.5]" />
                    </button>
                    <button className="p-1.5 hover:text-orange-500 transition-colors" title="Analytics View">
                      <ChartIcon size={14} className="stroke-[2.5]" />
                    </button>
                    <button onClick={handleExportCSV} className="p-1.5 hover:text-emerald-600 transition-colors" title="Export CSV">
                      <ExcelIcon size={14} className="stroke-[2.5]" />
                    </button>
                    <button onClick={handlePrint} className="p-1.5 hover:text-orange-500 transition-colors" title="Print">
                      <PrinterIcon size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {loading ? (
                    <div className="p-6 space-y-3 animate-pulse">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                          {currentMeta.columns.map((col, idx) => (
                            <th key={idx} className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
                              <div className="flex items-center gap-1">
                                {col.label}
                                <ChevronDownIcon size={10} className="opacity-60" />
                              </div>
                            </th>
                          ))}
                          <th className="px-5 py-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length > 0 ? (
                          filteredRows.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                            >
                              {currentMeta.columns.map((col, colIdx) => (
                                <td key={colIdx} className="px-5 py-4 text-xs font-semibold text-slate-700 dark:text-slate-350">
                                  {row[col.key] ?? "—"}
                                </td>
                              ))}
                              <td className="px-5 py-4 text-right">
                                <div className="inline-flex items-center gap-2.5 text-slate-400">
                                  <button onClick={() => handlePrintRow(row)} className="p-1 hover:text-orange-500 transition-colors" title="Print">
                                    <PrinterIcon size={12} />
                                  </button>
                                  <button onClick={() => handleShareRow(row)} className="p-1 hover:text-orange-500 transition-colors" title="Share">
                                    <ShareIcon size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={currentMeta.columns.length + 1} className="px-5 py-12 text-center">
                              <div className="flex flex-col items-center gap-2 text-slate-400">
                                <AlertCircleIcon size={24} className="opacity-40" />
                                <span className="text-xs font-bold">
                                  {tableSearchTerm ? "No entries match your search." : "No data for the selected period."}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

