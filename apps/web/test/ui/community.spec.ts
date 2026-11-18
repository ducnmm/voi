import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.WEB_UI_BASE_URL ?? "http://127.0.0.1:43288";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixturePath = resolve(process.env.COMMUNITY_UI_FIXTURES ?? resolve(REPO_ROOT, "scratch/community-qa/fixtures.json"));
const fixture = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as { ids: Record<"open" | "unknown" | "full" | "cancelled" | "stale" | "expired", string> }
  : undefined;
const IDS = fixture?.ids ?? { open: "", unknown: "", full: "", cancelled: "", stale: "", expired: "" };
const evidenceDir = resolve(REPO_ROOT, "scratch/community-qa/evidence");

async function setPresentation(page: Page, language: "vi" | "en", theme: "light" | "dark") {
  await page.addInitScript(({ language, theme }) => {
    localStorage.setItem("voi.language", language);
    localStorage.setItem("voi.theme", theme);
  }, { language, theme });
}

async function assertNoOverflow(page: Page, width: number) {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.scroll, `horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(width);
  expect(dimensions.body, `body overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(width);
}

test("guest community pages render in VI/EN and light/dark without mobile overflow", async ({ page }) => {
  test.skip(!fixture, `Community UI fixture manifest is missing: ${fixturePath}`);
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  for (const width of [1440, 768, 390, 320]) {
    for (const language of ["vi", "en"] as const) {
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: 900 });
        await setPresentation(page, language, theme);
        await page.goto(`${BASE}/discover`);
        await expect(page.locator(".community-card").first()).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await assertNoOverflow(page, width);
        const nav = page.getByRole("navigation", { name: language === "vi" ? "Điều hướng chính" : "Main navigation" });
        await expect(nav).toBeVisible();
        if (language === "vi" && (width === 1440 || width === 390)) {
          mkdirSync(evidenceDir, { recursive: true });
          await page.screenshot({ path: resolve(evidenceDir, `discover-${width}-${theme}.png`), fullPage: true });
        }
        await page.getByRole("link", { name: /Cầu lông tối mai tại Bình Thạnh/ }).first().click();
        await expect(page).toHaveURL(new RegExp(`/community-listings/${IDS.open}$`));
        await expect(page.getByRole("heading", { name: "Cầu lông tối mai tại Bình Thạnh" })).toBeVisible();
        await assertNoOverflow(page, width);
        if (language === "vi" && (width === 1440 || width === 390)) {
          await page.screenshot({ path: resolve(evidenceDir, `detail-${width}-${theme}.png`), fullPage: true });
        }
      }
    }
  }
  expect(errors, "browser page errors").toEqual([]);
  expect(consoleErrors, "browser console errors").toEqual([]);
});

test("guest home and discover filter, paginate, and expose safe contact targets", async ({ page }) => {
  test.skip(!fixture, `Community UI fixture manifest is missing: ${fixturePath}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(BASE);
  await expect(page.locator(".community-card")).toHaveCount(20);
  await page.getByRole("button", { name: "Xem thêm kèo" }).click();
  await expect(page.locator(".community-card")).toHaveCount(22);

  await page.goto(`${BASE}/discover`);
  await page.getByLabel("Khu vực").click();
  await page.getByRole("option", { name: "Thủ Đức" }).click();
  await expect(page.locator(".community-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Sân Thủ Đức" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.locator(".community-card")).toHaveCount(20);

  await page.goto(`${BASE}/community-listings/${IDS.open}`);
  const contactLinks = page.locator(".community-contact-actions a[href^='https://']");
  await expect(contactLinks.first()).toBeVisible();
  const outbound = await contactLinks.evaluateAll((anchors) => anchors.map((a) => ({
    href: (a as HTMLAnchorElement).href,
    target: (a as HTMLAnchorElement).target,
    rel: (a as HTMLAnchorElement).rel,
  })));
  expect(outbound.length).toBeGreaterThan(0);
  for (const link of outbound) {
    expect(link.href).toMatch(/^https:\/\/(?:www\.facebook\.com|facebook\.com)\//);
    if (link.target === "_blank") expect(link.rel).toContain("noopener");
  }
  await expect(contactLinks).toHaveAttribute("target", "_blank");
});

test("detail, unknown details, report submission, login, and private route guard", async ({ page }) => {
  test.skip(!fixture, `Community UI fixture manifest is missing: ${fixturePath}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/community-listings/${IDS.open}`);
  await expect(page.getByRole("heading", { name: "Cầu lông tối mai tại Bình Thạnh" })).toBeVisible();
  await page.getByRole("button", { name: "Báo sai hoặc yêu cầu gỡ" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Ghi chú").fill("Synthetic local UI QA report");
  await page.getByRole("button", { name: "Gửi báo cáo" }).click();
  await expect(page.getByRole("status")).toContainText("Đã nhận báo cáo");

  await page.goto(`${BASE}/community-listings/${IDS.unknown}`);
  await expect(page.getByRole("heading", { name: "Kèo giao lưu Thủ Đức" })).toBeVisible();
  await expect(page.locator(".community-details")).toContainText("Chưa rõ trình độ");
  await expect(page.locator(".community-details")).toContainText("Chưa rõ phí");
  await expect(page.locator(".community-contact-actions a")).toHaveCount(1);
  await expect(page.locator(".community-contact-actions a")).toHaveAttribute("href", /^https:\/\/www\.facebook\.com\//);

  await page.goto(`${BASE}/login`);
  await expect(page.getByRole("heading", { name: "Sẵn sàng ra sân?" })).toBeVisible();
  await page.goto(`${BASE}/settings`);
  await expect(page.getByRole("heading", { name: "Sẵn sàng ra sân?" })).toBeVisible();
});

test("status and stale indicators match fixture records", async ({ page }) => {
  test.skip(!fixture, `Community UI fixture manifest is missing: ${fixturePath}`);
  await page.addInitScript(() => localStorage.setItem("voi.language", "vi"));
  const cases = [
    [IDS.full, "Đã đủ người", false],
    [IDS.cancelled, "Đã hủy", false],
    [IDS.stale, "Thông tin chưa được cập nhật gần đây", true],
    [IDS.expired, "Đã qua giờ bắt đầu", false],
  ] as const;
  for (const [id, label, isStale] of cases) {
    await page.goto(`${BASE}/community-listings/${id}`);
    if (isStale) await expect(page.locator(".community-stale")).toContainText(label);
    else await expect(page.locator(".community-status")).toHaveText(label);
  }
});

test("contact click records analytics and keeps navigation on the synthetic page", async ({ page }) => {
  test.skip(!fixture, `Community UI fixture manifest is missing: ${fixturePath}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("voi.language", "vi"));
  await page.context().route("https://www.facebook.com/**", (route) => route.abort());
  await page.goto(`${BASE}/community-listings/${IDS.open}`);
  const link = page.getByRole("link", { name: "Mở bài gốc" });
  const responsePromise = page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== "POST" || !response.url().includes("/events")) return false;
    try {
      const body = request.postDataJSON();
      return body.type === "CONTACT" && body.contactType === "SOURCE";
    } catch { return false; }
  });
  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const [response, popup] = await Promise.all([responsePromise, popupPromise]);
  expect(response.status()).toBe(204);
  expect(new URL(response.url()).pathname).toContain(`/community-listings/${IDS.open}/events`);
  expect(["chrome-error://chromewebdata/", "about:blank", ""]).toContain(popup.url());
  await popup.close();
  await expect(page).toHaveURL(new RegExp(`/community-listings/${IDS.open}$`));
});
