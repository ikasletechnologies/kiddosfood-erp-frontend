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
        isNew: true,
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
        label: "Customer Payments",
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
    items: [
      {
        icon: Factory,
        label: "Production",
        href: "/reports?parent=production",
        roles: SUPER_ONLY,
      },
      {
        icon: Package,
        label: "Inventory",
        href: "/reports?parent=inventory",
        roles: SUPER_ONLY,
      },
      {
        icon: FileText,
        label: "Inventory Ledger",
        href: "/reports?parent=inventory-ledger",
        roles: SUPER_ONLY,
      },
      {
        icon: Landmark,
        label: "Financial",
        href: "/reports?parent=financial",
        roles: SUPER_ONLY,
      },
      {
        icon: BarChart3,
        label: "Franchise",
        href: "/reports?report=Party Statement",
        roles: SUPER_ONLY,
      },
    ],
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
      {
        icon: UserCheck,
        label: "Approval Workflows",
        href: "/admin/approvals",
        roles: SUPER_ONLY,
      },
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
