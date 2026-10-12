import { expect, test } from "@playwright/test";

test.describe("ERP login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForFunction(() => {
      const form = document.querySelector("form");
      return Boolean(form && Object.keys(form).some((key) => key.startsWith("__reactProps$")));
    });
  });

  test("renders the login form", async ({ page }) => {
    await expect(page.getByAltText("Kiddos Food Logo")).toBeVisible();
    await expect(page.getByText("Integrated Food Enterprise Management")).toBeVisible();
    await expect(page.getByText("Identification")).toBeVisible();
    await expect(page.getByText("Access Token")).toBeVisible();
    await expect(page.getByRole("button", { name: "Initiate Session" })).toBeVisible();
  });

  test("toggles password visibility", async ({ page }) => {
    const password = page.locator('input[type="password"]');
    await password.fill("test-password");
    await page.locator('form button[type="button"]').click();
    await expect(page.locator('input[type="text"][value="test-password"]')).toBeVisible();
  });

  test("rejects invalid credentials without creating a session", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      });
    });

    await page.getByPlaceholder("email@example.com").fill("invalid@example.com");
    await page.locator('input[type="password"]').fill("wrong-password");

    const responsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/auth/login") && response.status() === 401,
    );
    await page.getByRole("button", { name: "Initiate Session" }).click();
    await responsePromise;

    await expect(page).toHaveURL(/\/login$/);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("access_token")))
      .toBeNull();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("refresh_token")))
      .toBeNull();
  });

  test("stores a valid session and redirects a franchise user", async ({ page }) => {
    test.setTimeout(60_000);
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "e2e-access-token",
          refreshToken: "e2e-refresh-token",
          user: {
            id: "e2e-user",
            fullName: "E2E Franchise User",
            email: "e2e@example.com",
            role: "FRANCHISE_ADMIN",
            franchiseId: "e2e-franchise",
          },
        }),
      });
    });

    await page.getByPlaceholder("email@example.com").fill("e2e@example.com");
    await page.locator('input[type="password"]').fill("valid-password");
    const loginResponse = page.waitForResponse(
      (response) => response.url().endsWith("/api/auth/login") && response.status() === 200,
    );
    await page.getByRole("button", { name: "Initiate Session" }).click();
    await loginResponse;

    await expect
      .poll(async () => {
        try {
          return await page.evaluate(() =>
            [
              localStorage.getItem("access_token"),
              localStorage.getItem("refresh_token"),
              JSON.parse(localStorage.getItem("user") || "null")?.role,
            ].join("|"),
          );
        } catch {
          return "navigation-in-progress";
        }
      }, { timeout: 30_000 })
      .toBe("e2e-access-token|e2e-refresh-token|FRANCHISE_ADMIN");
    await page.waitForURL(/\/franchise\/dashboard$/, { timeout: 30_000, waitUntil: "commit" });
  });
});
// @ts-nocheck
