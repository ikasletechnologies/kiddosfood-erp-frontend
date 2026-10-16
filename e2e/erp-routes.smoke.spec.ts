import { expect, test, type Page, type Route } from "@playwright/test";

const moduleRoutes: Record<string, string[]> = {
  dashboard: ["/", "/alerts", "/audit/logs"],
  procurement: [
    "/vendors",
    "/vendors/payments",
    "/purchases/orders",
    "/purchases/new",
    "/purchases/grn",
    "/purchases/qc",
    "/purchases/invoices",
    "/purchases/returns",
    "/purchases/rfq",
    "/purchases/requests",
  ],
  inventory: [
    "/products",
    "/products/add",
    "/inventory/stock",
    "/inventory/raw-material-stock",
    "/inventory/raw-material-ledger",
    "/inventory/raw-material-consumption",
    "/inventory/reconciliation",
    "/inventory/expiry-tracking",
    "/inventory/warehouses",
  ],
  production: [
    "/production",
    "/production/batches",
    "/production/recipes",
    "/production/wastage",
    "/production/batch-recall",
    "/packaging/queue",
    "/packaging/carton",
    "/packaging/labels",
    "/packaging/confirm",
  ],
  sales: [
    "/customers",
    "/sales/estimation",
    "/sales/orders",
    "/sales/proforma-invoice",
    "/sales/invoices",
    "/sales/invoices/new",
    "/sales/payment-in",
    "/sales/returns",
    "/sales/delivery-challan",
    "/sales/eway-bill",
    "/sales/set-price",
    "/dispatch/transit-stock",
    "/delivery",
  ],
  pos: ["/pos", "/pos/invoices", "/pos/settlement", "/pos/cheque-settle"],
  franchise: [
    "/franchise",
    "/franchise-orders",
    "/franchise/dealers",
    "/franchise/requests",
    "/franchise/transfers",
    "/franchise/payments",
    "/franchise/stock",
    "/franchise/analytics",
    "/franchise/bank-accounts",
  ],
  accounting: [
    "/accounting/chart",
    "/accounting/expenses",
    "/accounting/payments",
    "/accounting/cash-flow",
    "/accounting/receivables",
    "/accounting/payables",
    "/accounting/ledgers",
    "/accounting/trial-balance",
    "/accounting/balance-sheet",
    "/accounting/profit-loss",
    "/accounting/day-book",
    "/accounting/cheques",
    "/banking/accounts",
    "/reports",
    "/reports/gst/gstr-1",
    "/reports/gst/gstr-2",
    "/reports/gst/gstr-3b",
    "/reports/gst/gstr-9",
    "/reports/gst/hsn-summary",
  ],
  people: [
    "/hr/employees",
    "/hr/attendance",
    "/hr/leaves",
    "/hr/shifts",
    "/hr/payroll",
    "/hr/payroll/components",
  ],
  administration: [
    "/admin/users",
    "/warehouse",
    "/warehouse/manage",
    "/settings/user/profile",
    "/settings/user/security",
    "/settings/user/notifications",
    "/settings/user/config",
    "/settings/company",
  ],
};

// Keep the report-heavy accounting journey below the per-test timeout when
// Next.js compiles pages on first access.
moduleRoutes.gstReports = moduleRoutes.accounting.splice(12);
const emptyDashboard = {
  stats: {},
  historicalSales: [],
  recentPurchases: [],
  recentB2BSales: [],
  recentB2CBills: [],
  topSellers: [],
  lowStock: [],
  supplierPaymentsDue: [],
};

async function mockBackend(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;

  if (path === "/api/setup/status") {
    return route.fulfill({ json: { initialized: true, hqConfigured: true, hqWarehouseConfigured: true, hq: { id: "hq-e2e", name: "HQ" }, warehouse: { id: "wh-e2e", name: "Central Warehouse" } } });
  }
  if (path === "/api/dashboard/summary") return route.fulfill({ json: emptyDashboard });
  if (path === "/api/me") return route.fulfill({ json: { id: "e2e-admin", fullName: "E2E Admin", email: "admin@example.com", role: "SUPER_ADMIN" } });
  if (path.includes("/summary") || path.includes("/stats")) return route.fulfill({ json: {} });
  if (request.method() === "GET") return route.fulfill({ json: [] });
  if (request.method() === "DELETE") return route.fulfill({ status: 204, body: "" });
  return route.fulfill({ status: 200, json: { id: "e2e-record", status: "SUCCESS" } });
}

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "e2e-access-token");
    localStorage.setItem("refresh_token", "e2e-refresh-token");
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: "e2e-admin",
        fullName: "E2E Admin",
        email: "admin@example.com",
        role: "SUPER_ADMIN",
      }),
    );
  });
  await page.route("**/api/**", mockBackend);
  await page.route("**/alerts**", mockBackend);
}

for (const [moduleName, routes] of Object.entries(moduleRoutes)) {
  test(`${moduleName} screens remain reachable through the authenticated shell`, async ({ page }) => {
    test.setTimeout(180_000);
    await authenticate(page);

    for (const target of routes) {
      const response = await page.goto(target, { waitUntil: "commit", timeout: 60_000 });
      if (response) expect(response.status(), `${target} HTTP status`).toBeLessThan(500);
      await expect(page, `${target} must not redirect to login`).not.toHaveURL(/\/login$/);
      await expect(page.locator("body"), `${target} must render a body`).toBeVisible();
      await expect(page.getByText("Application error: a client-side exception has occurred"), `${target} client crash`).toHaveCount(0);
    }
  });
}
// @ts-nocheck
