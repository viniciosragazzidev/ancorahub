import { test, expect } from "@playwright/test";

test.describe("Fluxos Core CorreTop E2E", () => {
  test("deve carregar a tela de login com sucesso", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/CorreTop/);
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("deve carregar a tela de login administrativo", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("h1")).toContainText(/Acesso administrativo/i);
  });
});
