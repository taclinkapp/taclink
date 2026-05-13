import { test, expect, type Page } from "@playwright/test";

const BANNER_TEXT = /Install TacLink for faster access/i;
const ARMED_KEY = "taclink_install_banner_armed";

// The banner is mounted globally and gated only by route + the
// `taclink:tour-completed` event — it is NOT role-specific. We use the
// guest-accessible `/student` route as the host page for both scenarios so
// the test does not depend on auth state. The "role" label here documents
// the user journey the test simulates (the tour fires once per role at the
// end of the crash-course).
const ROUTE = "/student";

const ensureFreshSession = async (page: Page) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("install-prompt-dismissed-at");
      localStorage.removeItem("install-prompt-snooze-until");
    } catch { /* ignore */ }
  });
};

const completeTour = (page: Page) =>
  page.evaluate((key) => {
    sessionStorage.setItem(key, "1");
    window.dispatchEvent(new CustomEvent("taclink:tour-completed"));
  }, ARMED_KEY);

for (const role of ["student", "instructor"] as const) {
  test.describe(`Install banner — ${role} flow`, () => {
    test.beforeEach(async ({ page }) => {
      await ensureFreshSession(page);
    });

    test("hidden until tour completes, persists until X is clicked", async ({ page }) => {
      await page.goto(ROUTE);

      // 1. Hidden before the tour completion event fires.
      await expect(page.getByText(BANNER_TEXT)).toHaveCount(0);

      // 2. Appears once `taclink:tour-completed` is dispatched.
      await completeTour(page);
      const banner = page.getByText(BANNER_TEXT);
      await expect(banner).toBeVisible();

      // 3. Stays visible across time + interaction (no auto-dismiss timer).
      await page.waitForTimeout(1500);
      await page.mouse.move(10, 10);
      await page.mouse.click(10, 10);
      await expect(banner).toBeVisible();

      // 4. Only the X button dismisses it.
      await page.getByRole("button", { name: /dismiss install reminder/i }).click();
      await expect(page.getByText(BANNER_TEXT)).toHaveCount(0);
    });
  });
}
