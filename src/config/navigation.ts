import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  AlertTriangle,
  Users,
  BarChart3,
  FileText,
  Settings,
  ClipboardList,
  Building2,
  Send,
  Factory,
  ChefHat,
  Store,
  UserCheck,
  Layers,
  Landmark,
  Truck,
  TrendingUp,
  PackageCheck,
  CreditCard,
  Undo2,
  Clock,
  User,
  Calculator,
  Receipt,
  FileClock,
  Wallet,
  FilePlus2,
  Barcode,
  MapPin,
  ShieldAlert,
} from "lucide-react";

export interface MenuItem {
  icon: any;
  label: string;
  href: string;
  roles: string[];
  isNew?: boolean;
  isHot?: boolean;
  isComingSoon?: boolean;
  children?: {
    label: string;
    href: string;
    isNew?: boolean;
  }[];
}

export interface MenuSection {
  title: string;
  emoji?: string;
  items: MenuItem[];
}

const SUPER_ONLY = ["SUPER_ADMIN"];
const FRANCHISE_ONLY = ["FRANCHISE_ADMIN"];
const ALL_ROLES = ["SUPER_ADMIN", "FRANCHISE_ADMIN"];

// Deep-links into the existing generic report catalog (src/app/reports/page.tsx),
// which already supports selecting a specific child report via ?report=<id>.
// Built with URLSearchParams (not encodeURIComponent) so the query-string
// encoding matches what Sidebar.tsx's active-route check compares against at
// runtime (searchParams.toString() also uses URLSearchParams serialization,
// e.g. space -> "+") — any other encoding would silently break active
// highlighting for report ids containing spaces.
const reportLink = (parent: string, report: string) =>
  `/reports?${new URLSearchParams({ parent, report }).toString()}`;

// Single source of truth for every "REPORTS" subgroup. Each entry becomes one
// collapsible MenuItem (icon + label + children) inside the REPORTS section
// below — add a new report to an existing group, or a whole new group, here
// rather than hand-editing the section's items array.
const REPORT_GROUPS: { icon: any; label: string; items: { label: string; href: string }[] }[] = [
  {
    icon: Landmark,
    label: "Transaction Reports",
    items: [
      { label: "Sale", href: reportLink("financial", "Sale") },
      { label: "Purchase", href: reportLink("financial", "Purchase") },
      { label: "Day Book", href: "/accounting/day-book" },
      { label: "Payment Register", href: reportLink("financial", "All Transactions") },
      { label: "Profit & Loss", href: "/accounting/profit-loss" },
      { label: "Bill Wise Profit", href: reportLink("financial", "Bill Wise Profit") },
      { label: "Cash Flow", href: "/accounting/cash-flow" },
      { label: "Trial Balance", href: "/accounting/trial-balance" },
      { label: "Balance Sheet", href: "/accounting/balance-sheet" },
    ],
  },
  {
    icon: Users,
    label: "Party Reports",
    items: [
      { label: "Party Statement", href: reportLink("franchise", "Party Statement") },
      { label: "Party Wise Profit & Loss", href: reportLink("franchise", "Party wise Profit & Loss") },
      { label: "All Parties", href: reportLink("franchise", "All parties") },
      { label: "Party Report By Item", href: reportLink("franchise", "Party Report By Item") },
      { label: "Sale Purchase By Party", href: reportLink("franchise", "Sale Purchase By Party") },
      { label: "Sale Purchase By Party Group", href: reportLink("franchise", "Sale Purchase By Party Group") },
    ],
  },
  {
    icon: Package,
    label: "Item / Stock Reports",
    items: [
      { label: "Stock Summary", href: reportLink("inventory", "Stock summary") },
      { label: "Item Report By Party", href: reportLink("inventory", "Item Report By Party") },
      { label: "Item Wise Profit & Loss", href: reportLink("inventory", "Item Wise Profit And Loss") },
      { label: "Item Category Wise Profit", href: reportLink("inventory", "Item Category Wise Profit And Loss") },
      { label: "Low Stock Summary", href: reportLink("inventory", "Low Stock Summary") },
      { label: "Stock Detail", href: reportLink("inventory", "Stock Detail") },
      { label: "Item Detail", href: reportLink("inventory", "Item Detail") },
      { label: "Sale / Purchase By Item Category", href: reportLink("inventory", "Sale/ Purchase Report By Item Category") },
      { label: "Stock Summary By Item Category", href: reportLink("inventory", "Stock Summary Report By Item Category") },
      { label: "Item Wise Discount", href: reportLink("inventory", "Item Wise Discount") },
    ],
  },
  {
    icon: TrendingUp,
    label: "Business Status",
    items: [
      { label: "Bank Statement", href: reportLink("financial", "Bank Statement") },
      { label: "Discount Report", href: reportLink("financial", "Discount Report") },
    ],
  },
  {
    icon: Receipt,
    label: "Tax / GST Reports",
    items: [
      { label: "GST Report", href: reportLink("financial", "GST Report") },
      { label: "GST Rate Report", href: reportLink("financial", "GST Rate Report") },
      { label: "TDS Payable", href: reportLink("financial", "TDS Payable") },
      { label: "TDS Receivable", href: reportLink("financial", "TDS Receivable") },
    ],
  },
  {
    icon: Wallet,
    label: "Expense Reports",
    items: [
      { label: "Expense Report", href: reportLink("financial", "Expense") },
      { label: "Expense Category Report", href: reportLink("financial", "Expense Category Report") },
      { label: "Expense Item Report", href: reportLink("financial", "Expense Item Report") },
    ],
  },
  {
    icon: ClipboardList,
    label: "Sales Order Reports",
    items: [
      { label: "Sale Orders", href: reportLink("financial", "Sale Orders") },
      { label: "Sale Order Item", href: reportLink("financial", "Sale Order Item") },
    ],
  },
  {
    icon: Store,
    label: "Franchise Reports",
    items: [
      { label: "Franchise Performance", href: reportLink("franchise", "Franchise Performance Summary") },
      { label: "Franchise Outstanding", href: reportLink("franchise", "Franchise Dues & Balances") },
    ],
  },
  {
    icon: CreditCard,
    label: "Loan Account Reports",
    items: [
      { label: "Loan Statement", href: reportLink("financial", "Loan Statement") },
    ],
  },
  {
    icon: Receipt,
    label: "GST Reports",
    items: [
      { label: "GSTR-1", href: "/reports/gst/gstr-1" },
      { label: "GSTR-2", href: "/reports/gst/gstr-2" },
      { label: "GSTR-3B", href: "/reports/gst/gstr-3b" },
      { label: "GSTR-9", href: "/reports/gst/gstr-9" },
      { label: "Sales Summary (HSN)", href: "/reports/gst/hsn-summary" },
    ],
  },
];

// ─── SUPER_ADMIN (HQ CONTROL CENTER) ──────────────────────────────────────────
export const SUPER_ADMIN_SIDEBAR: MenuSection[] = [
  {
    title: "DASHBOARD",
    items: [
      {
        icon: LayoutDashboard,
        label: "Executive Dashboard",
        href: "/",
        roles: SUPER_ONLY,
      },
      {
        icon: AlertTriangle,
        label: "Inventory Alerts",
        href: "/alerts",
        roles: SUPER_ONLY,
      },
      {
        icon: BarChart3,
        label: "Franchise Performance",
        href: "/franchise/analytics",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "PROCUREMENT",
    items: [
      {
        icon: Users,
        label: "Vendors",
        href: "/vendors",
        roles: SUPER_ONLY,
      },
      {
        icon: ClipboardList,
        label: "Purchase Orders",
        href: "/purchases/orders",
        roles: SUPER_ONLY,
      },
      {
        icon: PackageCheck,
        label: "GRN",
        href: "/purchases/grn",
        roles: SUPER_ONLY,
      },
      {
        icon: Receipt,
        label: "Purchase Bills",
        href: "/purchases/invoices",
        roles: SUPER_ONLY,
      },
      {
        icon: Undo2,
        label: "Purchase Returns",
        href: "/purchases/returns",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "FORMULATION",
    items: [
      {
        icon: ChefHat,
        label: "Recipes",
        href: "/production/recipes",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "PRODUCTION",
    items: [
      {
        icon: ClipboardList,
        label: "Production Planning",
        href: "/production",
        roles: SUPER_ONLY,
      },
      {
        icon: Factory,
        label: "Batch Manufacturing",
        href: "/production/batches",
        roles: SUPER_ONLY,
      },
      {
        icon: UserCheck,
        label: "QC",
        href: "/purchases/qc",
        roles: SUPER_ONLY,
      },
      {
        icon: Undo2,
        label: "Wastage",
        href: "/production/wastage",
        roles: SUPER_ONLY,
      },
      {
        icon: ShieldAlert,
        label: "Batch Recall",
        href: "/production/batch-recall",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "PACKAGING",
    items: [
      {
        icon: ClipboardList,
        label: "Packaging Queue",
        href: "/packaging/queue",
        roles: SUPER_ONLY,
      },
      {
        icon: Barcode,
        label: "Labels & Barcodes",
        href: "/packaging/labels",
        roles: SUPER_ONLY,
      },
      {
        icon: PackageCheck,
        label: "Confirm Packaging",
        href: "/packaging/confirm",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "WAREHOUSE",
    items: [
      {
        icon: Building2,
        label: "Warehouse",
        href: "/warehouse",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "INVENTORY",
    items: [
      {
        icon: ClipboardList,
        label: "Item Master",
        href: "/inventory/raw-material-stock",
        roles: SUPER_ONLY,
      },
      {
        icon: Layers,
        label: "Stock Hub",
        href: "/inventory/stock",
        roles: SUPER_ONLY,
      },
      {
        icon: Send,
        label: "Stock Transfer",
        href: "/franchise/transfers",
        roles: SUPER_ONLY,
      },
      {
        icon: ClipboardList,
        label: "Stock Reconciliation",
        href: "/inventory/reconciliation",
        roles: SUPER_ONLY,
      },
      {
        icon: Clock,
        label: "Expiry Tracking",
        href: "/inventory/expiry-tracking",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "DISPATCH",
    items: [
      {
        icon: FileText,
        label: "Delivery Challan",
        href: "/sales/delivery-challan",
        roles: SUPER_ONLY,
      },
      {
        icon: Truck,
        label: "Transit Stock",
        href: "/dispatch/transit-stock",
        roles: SUPER_ONLY,
      },
      {
        icon: MapPin,
        label: "Dispatch Tracking",
        href: "/delivery",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "SALES",
    items: [
      {
        icon: Calculator,
        label: "Estimate",
        href: "/sales/estimation",
        roles: SUPER_ONLY,
      },
      {
        icon: ClipboardList,
        label: "Sales Orders",
        href: "/sales/orders",
        roles: SUPER_ONLY,
      },
      {
        icon: FilePlus2,
        label: "Proforma Invoice",
        href: "/sales/proforma-invoice",
        roles: SUPER_ONLY,
      },
      {
        icon: Receipt,
        label: "Tax Invoice",
        href: "/sales/invoices",
        roles: SUPER_ONLY,
      },
      {
        icon: Wallet,
        label: "Payments",
        href: "/sales/payment-in",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "POS",
    items: [
      {
        icon: Store,
        label: "Counter Billing",
        href: "/pos",
        roles: SUPER_ONLY,
      },
      {
        icon: Undo2,
        label: "Returns",
        href: "/sales/returns",
        roles: SUPER_ONLY,
      },
      {
        icon: Clock,
        label: "Day Closing",
        href: "/pos/settlement",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "FRANCHISE",
    items: [
      {
        icon: Building2,
        label: "Franchise Management",
        href: "/franchise",
        roles: SUPER_ONLY,
      },
      // {
      //   icon: Package,
      //   label: "Outlet Inventory",
      //   href: "/franchise/stock",
      //   roles: SUPER_ONLY,
      // },
      {
        icon: ShoppingCart,
        label: "Franchise Orders",
        href: "/franchise-orders",
        roles: SUPER_ONLY,
      },
      {
        icon: CreditCard,
        label: "Settlement",
        href: "/franchise/payments",
        roles: SUPER_ONLY,
      },
      {
        icon: Landmark,
        label: "Outstanding",
        href: "/accounting/ledgers",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "PARTNERS",
    items: [
      {
        icon: Users,
        label: "Customers",
        href: "/customers",
        roles: SUPER_ONLY,
      },
      {
        icon: Store,
        label: "Dealers",
        href: "/franchise/dealers",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "ACCOUNTS",
    items: [
      {
        icon: Wallet,
        label: "Cash Flow",
        href: "/accounting/cash-flow",
        roles: SUPER_ONLY,
      },
      {
        icon: Landmark,
        label: "Receivables",
        href: "/accounting/receivables",
        roles: SUPER_ONLY,
      },
      {
        icon: Landmark,
        label: "Payables",
        href: "/accounting/payables",
        roles: SUPER_ONLY,
      },
      {
        icon: TrendingUp,
        label: "Expenses",
        href: "/accounting/expenses",
        roles: SUPER_ONLY,
      },
      {
        icon: Landmark,
        label: "Bank Accounts",
        href: "/banking/accounts",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "REPORTS",
    items: REPORT_GROUPS.map((g) => ({
      icon: g.icon,
      label: g.label,
      href: g.items[0].href,
      roles: SUPER_ONLY,
      children: g.items,
    })),
  },
  {
    title: "SYSTEM",
    items: [
      {
        icon: User,
        label: "Users",
        href: "/admin/users",
        roles: SUPER_ONLY,
      },
      // {
      //   icon: UserCheck,
      //   label: "Approval Workflows",
      //   href: "/admin/approvals",
      //   roles: SUPER_ONLY,
      // },
      {
        icon: FileClock,
        label: "Audit Logs",
        href: "/audit/logs",
        roles: SUPER_ONLY,
      },
      {
        icon: Settings,
        label: "Settings",
        href: "/settings/user/profile",
        roles: SUPER_ONLY,
      },
    ],
  },
];

// ─── FRANCHISE_ADMIN (BRANCH OPERATOR) ────────────────────────────────────────
export const franchiseMenuSections: MenuSection[] = [
  {
    title: "DASHBOARD",
    items: [
      {
        icon: LayoutDashboard,
        label: "Branch Dashboard",
        href: "/franchise/dashboard",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: BarChart3,
        label: "Branch Reports",
        href: "/reports",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
  {
    title: "POS",
    items: [
      {
        icon: ShoppingCart,
        label: "New Invoice",
        href: "/pos",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: FileText,
        label: "Settlement",
        href: "/pos/settlement",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
  {
    title: "WAREHOUSE",
    items: [
      {
        icon: Building2,
        label: "Warehouse",
        href: "/warehouse",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
  {
    title: "INVENTORY",
    items: [
      {
        icon: Package,
        label: "Product Inventory",
        href: "/franchise/stock",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: AlertTriangle,
        label: "Low Stock Alerts",
        href: "/alerts",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: Clock,
        label: "Expiry Tracking",
        href: "/inventory/expiry-tracking",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
  {
    title: "STOCK PROCUREMENT",
    items: [
      {
        icon: Send,
        label: "Product Orders",
        href: "/franchise-orders",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: PackageCheck,
        label: "Incoming Stock",
        href: "/purchases/inward",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: Landmark,
        label: "Supplier Ledger (HQ)",
        href: "/franchise/supplier-ledger",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
  {
    title: "FINANCE",
    items: [
      {
        icon: Landmark,
        label: "Business Accounts",
        href: "/banking/accounts",
        roles: SUPER_ONLY,
      },
      {
        icon: CreditCard,
        label: "Collections",
        href: "/accounting/payments",
        roles: SUPER_ONLY,
      },
      {
        icon: TrendingUp,
        label: "Outstanding",
        href: "/accounting/ledgers",
        roles: SUPER_ONLY,
      },
      {
        icon: FileText,
        label: "Cheque Management",
        href: "/accounting/cheques",
        roles: SUPER_ONLY,
      },
    ],
  },
  {
    title: "PARTNERS",
    items: [
      {
        icon: Users,
        label: "Dealers",
        href: "/franchise/dealers",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: User,
        label: "Parties",
        href: "/customers",
        roles: FRANCHISE_ONLY,
      },
      {
        icon: Undo2,
        label: "Returns",
        href: "/sales/returns",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
  {
    title: "APPROVALS",
    items: [
      {
        icon: UserCheck,
        label: "Approval Workflows",
        href: "/admin/approvals",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      {
        icon: Settings,
        label: "Branch Profile",
        href: "/profile/agency",
        roles: FRANCHISE_ONLY,
      },
    ],
  },
];

export const menuItems = [
  ...SUPER_ADMIN_SIDEBAR.flatMap(s => s.items),
  ...franchiseMenuSections.flatMap(s => s.items)
];
