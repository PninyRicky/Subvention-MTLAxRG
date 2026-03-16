import { test, expect } from "@playwright/test";

test("la page de connexion s'affiche", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.getByRole("heading", { name: "Connexion interne" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recevoir un lien" })).toBeVisible();
});
