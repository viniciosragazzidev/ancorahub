import { test, expect } from "@playwright/test";

const email = process.env.E2E_DIRECTOR_EMAIL;
const password = process.env.E2E_DIRECTOR_PASSWORD;

async function loginAsDirector(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(email!);
  await page.getByRole("textbox", { name: "Senha", exact: true }).fill(password!);
  await Promise.all([
    page.waitForURL(/\/(dashboard|diretor\/resume|settings)/),
    page.getByRole("button", { name: "Entrar no painel", exact: true }).click(),
  ]);
}

test.describe("Fluxos Core CorreTop E2E", () => {
  test("deve carregar a tela de login com sucesso", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Ancora Corretora CRM/);
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("deve carregar a tela de login administrativo", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("h1")).toContainText(/Super administração/i);
  });

  test.skip(!email || !password, "Defina E2E_DIRECTOR_EMAIL e E2E_DIRECTOR_PASSWORD para executar as rotas autenticadas.");

  test("diretor percorre as superfícies do ciclo operacional", async ({ page }) => {
    test.setTimeout(90000);
    await loginAsDirector(page);

    await page.goto("/leads");
    await expect(page).toHaveURL(/\/leads$/);
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/conversas");
    await expect(page).toHaveURL(/\/conversas$/);
    await expect(page.getByRole("main").first()).toBeVisible();

    await page.goto("/leads/distribuicao/plantao");
    await expect(page).toHaveURL(/\/leads\/distribuicao\/plantao$/);
    await expect(page.getByRole("heading", { name: "Plantões", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo plantão", exact: true })).toBeVisible();

    await page.goto("/financeiro");
    await expect(page).toHaveURL(/\/financeiro$/);
    await expect(page.getByText("Financeiro", { exact: true }).first()).toBeVisible();
  });
});
