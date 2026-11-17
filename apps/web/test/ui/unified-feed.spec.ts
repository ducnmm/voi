import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.WEB_UI_BASE_URL ?? "http://127.0.0.1:43388";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixturePath = resolve(process.env.UNIFIED_UI_FIXTURES ?? resolve(ROOT, "scratch/community-unified-20261117/fixtures.json"));
const fixtures = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, "utf8")) as { ids: { open: string }; nativeIds: { saved: string; past: string } }
  : undefined;
type Pair = { accessToken: string; refreshToken: string; user: { id: string } };
const pairs: Partial<Record<"mixed" | "empty", Pair>> = {};
const evidence = resolve(ROOT, "scratch/community-unified-20261117/evidence");

test.beforeAll(async ({ request }) => {
  if (!fixtures) return;
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(BASE)) {
    throw new Error("Unified feed QA requires a disposable localhost backend");
  }
  for (const kind of ["mixed", "empty"] as const) {
    const response = await request.post(`${BASE}/api/v1/auth/dev`, {
      data: { email: `unified-${kind}@example.test`, displayName: `${kind} feed QA` },
    });
    expect(response.ok(), "Disposable local API must be available").toBeTruthy();
    pairs[kind] = await response.json();
  }
});

async function authenticate(page: Page, kind: "mixed" | "empty", language: "vi" | "en" = "vi", theme: "light" | "dark" = "light") {
  const pair = pairs[kind];
  if (!pair) throw new Error("Local QA auth fixture missing");
  await page.addInitScript(({ pair, language, theme }) => {
    localStorage.setItem("voi.token", pair.accessToken);
    localStorage.setItem("voi.refresh", pair.refreshToken);
    localStorage.setItem(`voi.onboarding.${pair.user.id}`, "done");
    localStorage.setItem("voi.language", language);
    localStorage.setItem("voi.theme", theme);
  }, { pair, language, theme });
}

async function openHome(page: Page, kind: "mixed" | "empty") {
  await authenticate(page, kind);
  await page.goto(BASE);
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await expect(page.locator(".community-card").first()).toBeVisible();
}

async function choose(page: Page, label: string, option: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function closeFilters(page: Page) {
  await page.getByRole("button", { name: "Xem kết quả", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("authenticated upcoming shows community in the main feed without the first-game empty state", async ({ page }) => {
  test.skip(!fixtures, `Missing disposable QA fixture: ${fixturePath}`);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await openHome(page, "empty");
  await expect(page.locator(".community-card")).toHaveCount(20);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("main#main .feed-tools")).toBeVisible();
    await expect(page.locator("main#main .community-card").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kèo đầu tiên bắt đầu từ bạn", exact: true })).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.scroll, `document overflow at ${width}px`).toBeLessThanOrEqual(width);
    expect(dimensions.body, `body overflow at ${width}px`).toBeLessThanOrEqual(width);
    if (width === 1440 || width === 390) {
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: resolve(evidence, `authenticated-empty-${width}.png`), fullPage: false });
    }
  }
  await page.getByRole("button", { name: /Xem thêm kèo/ }).click();
  await expect(page.locator(".community-card")).toHaveCount(22);
  expect(errors).toEqual([]);
});

test("native and community games share the home search and filter toolbar", async ({ page }) => {
  test.skip(!fixtures, `Missing disposable QA fixture: ${fixturePath}`);
  await openHome(page, "mixed");
  await expect(page.locator(".session-card")).toHaveCount(2);
  await expect(page.locator(".community-card").first()).toBeVisible();
  const search = page.getByRole("textbox", { name: "Tìm kèo hoặc sân", exact: true });
  await search.fill("Sân Thủ Đức");
  await expect(page.locator(".session-card")).toHaveCount(0);
  await expect(page.locator(".community-card")).toHaveCount(1);
  await expect(page.locator(".community-card h2")).toContainText("Sân Thủ Đức");
  await search.fill("Native Morning");
  await expect(page.locator(".session-card")).toHaveCount(1);
  await expect(page.locator(".community-card")).toHaveCount(0);
  await search.fill("");
  await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
  await choose(page, "Trình độ", "Trung bình");
  await closeFilters(page);
  await expect(page.locator(".session-card")).toHaveCount(1);
  await expect(page.locator(".community-card").first()).toBeVisible();
  await expect(page.locator(".community-card h2", { hasText: "Sân Thủ Đức" })).toHaveCount(0);
  await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
  await choose(page, "Sân", "Sân Bình Thạnh");
  await closeFilters(page);
  await expect(page.locator(".session-card")).toHaveCount(0);
  await expect(page.locator(".community-card").first()).toBeVisible();
  await expect(page.locator(".community-card h2", { hasText: "Sân Thủ Đức" })).toHaveCount(0);
});

test("saved, past, management and available-only preserve native-only semantics", async ({ page }) => {
  test.skip(!fixtures, `Missing disposable QA fixture: ${fixturePath}`);
  await openHome(page, "mixed");
  await page.getByRole("button", { name: "Đã lưu", exact: true }).click();
  await expect(page.locator(".community-card")).toHaveCount(0);
  await expect(page.locator(".session-card")).toHaveCount(1);
  await expect(page.locator(".session-card")).toHaveAttribute("href", `/sessions/${fixtures!.nativeIds.saved}`);
  await page.getByRole("button", { name: "Đã qua", exact: true }).click();
  await expect(page.locator(".community-card")).toHaveCount(0);
  await expect(page.locator(".session-card")).toHaveCount(1);
  await expect(page.locator(".session-card")).toHaveAttribute("href", `/sessions/${fixtures!.nativeIds.past}`);
  await page.getByRole("button", { name: "Sắp diễn ra", exact: true }).click();
  await expect(page.locator(".community-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
  await page.getByRole("checkbox", { name: "Chỉ kèo còn chỗ", exact: true }).check();
  await closeFilters(page);
  await expect(page.locator(".community-card")).toHaveCount(0);
  await expect(page.locator(".session-card")).toHaveCount(2);
  await page.goto(`${BASE}/sessions/manage`);
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await expect(page.locator(".session-card")).toHaveCount(2);
  await expect(page.locator(".community-card")).toHaveCount(0);
});

test("discover resolves to the home feed and community detail keeps the app navigation", async ({ page }) => {
  test.skip(!fixtures, `Missing disposable QA fixture: ${fixturePath}`);
  await authenticate(page, "empty");
  await page.goto(`${BASE}/discover`);
  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await expect(page.locator(".public-header")).toHaveCount(0);
  await page.locator(`.community-card a[href='/community-listings/${fixtures!.ids.open}']`).first().click();
  await expect(page.locator(".community-detail")).toBeVisible();
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await expect(page.locator(".public-header")).toHaveCount(0);
  await expect(page.locator(".community-back")).toHaveAttribute("href", "/");
});

test("guests can still browse and open public community games without signing in", async ({ page }) => {
  test.skip(!fixtures, `Missing disposable QA fixture: ${fixturePath}`);
  await page.goto(`${BASE}/discover`);
  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.locator(".public-header")).toBeVisible();
  await expect(page.locator("[data-app-shell]")).toHaveCount(0);
  await expect(page.locator(".community-card").first()).toBeVisible();
  await page.locator(`.community-card a[href='/community-listings/${fixtures!.ids.open}']`).first().click();
  await expect(page.locator(".community-detail")).toBeVisible();
  await expect(page.locator(".public-header")).toBeVisible();
});

test("authenticated community feed remains readable in English dark mode on desktop and mobile", async ({ page }) => {
  test.skip(!fixtures, `Missing disposable QA fixture: ${fixturePath}`);
  await authenticate(page, "empty", "en", "dark");
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BASE);
    await expect(page.locator("[data-app-shell]")).toBeVisible();
    await expect(page.locator(".community-card").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("textbox", { name: "Search sessions or venues", exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.scroll, `dark document overflow at ${width}px`).toBeLessThanOrEqual(width);
    expect(dimensions.body, `dark body overflow at ${width}px`).toBeLessThanOrEqual(width);
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: resolve(evidence, `authenticated-empty-${width}-en-dark.png`), fullPage: false });
  }
});

test("a failed feed source does not hide games from the other source", async ({ page }) => {
  test.skip(!fixtures, `Missing disposable QA fixture: ${fixturePath}`);
  await authenticate(page, "mixed");
  let unavailable: "native" | "community" = "native";
  await page.route("**/api/v1/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    const blockedPath = unavailable === "native" ? "/api/v1/sessions" : "/api/v1/community-listings";
    if (route.request().method() === "GET" && pathname === blockedPath) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Synthetic QA feed source unavailable" } }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto(BASE);
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await expect(page.locator(".community-card").first()).toBeVisible();
  await expect(page.locator("main#main").getByRole("alert")).toBeVisible();
  await expect(page.locator(".session-card")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kèo đầu tiên bắt đầu từ bạn", exact: true })).toHaveCount(0);
  unavailable = "community";
  await page.reload();
  await expect(page.locator(".session-card")).toHaveCount(2);
  await expect(page.locator(".community-card")).toHaveCount(0);
  await expect(page.locator("main#main").getByRole("alert")).toContainText("Không thể tải kèo cộng đồng");
  await expect(page.getByRole("heading", { name: "Kèo đầu tiên bắt đầu từ bạn", exact: true })).toHaveCount(0);
});
