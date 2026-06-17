import { expect, test } from "@playwright/test";

test("free audit requires account creation before showing results", async ({ page }) => {
  await page.goto("/ai-visibility-checker");
  await page.getByPlaceholder("domain.com").fill("brandx.test");
  await page.getByPlaceholder("Ime znamke").fill("Brand X");
  await page.getByPlaceholder("ime@podjetje.si").fill("buyer@brandx.test");
  const prompts = page.locator('textarea[name="prompts"]');
  await prompts.nth(0).fill("Kateri ponudniki so najboljša izbira za Brand X?");
  await prompts.nth(1).fill("Primerjaj Brand X z najbližjimi konkurenti.");
  await prompts.nth(2).fill("Kdo je najbolj primeren za rešitev, ki jo ponuja Brand X?");
  await prompts.nth(3).fill("Katere storitve priporočate za podjetja, kot je Brand X?");
  await prompts.nth(4).fill("Zakaj bi kupec izbral Brand X?");
  await page.getByRole("button", { name: /zaženi brezplačen audit/i }).click();

  await expect(page).toHaveURL(/\/audit\//);
  await expect(page.getByText("Ustvari račun za ogled rezultata")).toBeVisible();
  await expect(page.getByText("AI Visibility Score")).toBeHidden();
});
