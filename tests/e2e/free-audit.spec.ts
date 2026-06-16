import { expect, test } from "@playwright/test";

test("free audit requires account creation before showing results", async ({ page }) => {
  await page.goto("/ai-visibility-checker");
  await page.getByPlaceholder("domain.com").fill("brandx.test");
  await page.getByPlaceholder("Ime znamke").fill("Brand X");
  await page.getByPlaceholder("ime@podjetje.si").fill("buyer@brandx.test");
  await page.getByRole("button", { name: /zaženi brezplačen audit/i }).click();

  await expect(page).toHaveURL(/\/audit\//);
  await expect(page.getByText("Ustvari račun za ogled rezultata")).toBeVisible();
  await expect(page.getByText("AI Visibility Score")).toBeHidden();
});
