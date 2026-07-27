import { expect, test } from "@playwright/test";

const email = process.env.E2E_DIRECTOR_EMAIL;
const password = process.env.E2E_DIRECTOR_PASSWORD;

test.describe("configuração do agente de atendimento", () => {
  test.skip(!email || !password, "Defina E2E_DIRECTOR_EMAIL e E2E_DIRECTOR_PASSWORD para executar o fluxo autenticado.");

  test("Diretor configura a identidade do agente e vê a confirmação", async ({ page }) => {
    test.setTimeout(90000);
    await page.goto("/login");
    await page.getByLabel(/e-mail/i).fill(email!);
    await page.getByRole("textbox", { name: "Senha", exact: true }).fill(password!);
    await Promise.all([
      page.waitForURL(/\/(dashboard|diretor\/resume|settings)/),
      page.getByRole("button", { name: "Entrar no painel", exact: true }).click(),
    ]);

    await page.goto("/settings?tab=ia");
    await expect(page.locator('[data-slot="card-title"]', { hasText: "Atendimento inteligente" })).toBeVisible();

    const assistantName = page.getByLabel("Nome do assistente");
    await assistantName.fill("Agente de teste");
    await expect(page.locator('input[name="maxQuestions"]')).toHaveValue("6");
    await page.getByRole("button", { name: /salvar configuração/i }).click();

    await expect(page.getByRole("status")).toHaveText("Configuração do atendimento salva.", { timeout: 30000 });
    await expect(assistantName).toHaveValue("Agente de teste");
  });
});
