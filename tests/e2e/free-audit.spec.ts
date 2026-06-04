import { expect, test } from "@playwright/test";

test("free audit creates lead and shows audit report", async ({ page }) => {
  await page.goto("/ai-visibility-checker");
  await page.getByPlaceholder("domain.com").fill("brandx.test");
  await page.getByPlaceholder("Brand name").fill("Brand X");
  await page.getByPlaceholder("you@company.com").fill("buyer@brandx.test");
  await page.getByRole("button", { name: /zaženi brezplačen audit/i }).click();
  await expect(page).toHaveURL(/\/audit\//);
  await expect(page.getByText("AI Visibility Score")).toBeVisible();
});
