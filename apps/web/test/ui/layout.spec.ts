import {
  test,
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
let api: APIRequestContext;
let pair: { accessToken: string; refreshToken: string; user: { id: string } };
let groupId: string;
let sessionId: string;
const cache = new Map<
  string,
  { status: number; contentType: string; body: Buffer }
>();
test.beforeAll(async ({ playwright, baseURL }) => {
  api = await playwright.request.newContext({ baseURL });
  const login = await api.post("/api/v1/auth/dev", {
    data: { email: "web-qa-20261026@example.com", displayName: "Voi Web QA" },
  });
  expect(login.ok(), "Local development API must be running").toBeTruthy();
  pair = await login.json();
  const headers = { authorization: `Bearer ${pair.accessToken}` };
  const groups = await api.get("/api/v1/groups", { headers });
  groupId = (await groups.json()).groups[0]?.id;
  const sessions = await api.get("/api/v1/sessions", { headers });
  sessionId = (await sessions.json()).sessions[0]?.id;
  expect(groupId, "Use the existing dedicated QA group").toBeTruthy();
  expect(sessionId, "Use an existing QA session").toBeTruthy();
});
test.afterAll(async () => {
  await api?.dispose();
});
async function open(
  browser: Browser,
  baseURL: string | undefined,
  width: number,
  height: number,
  touch = width < 768,
) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height },
    isMobile: touch,
    hasTouch: touch,
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    ({ accessToken, refreshToken, userId }) => {
      localStorage.setItem("voi.token", accessToken);
      localStorage.setItem("voi.refresh", refreshToken);
      localStorage.setItem(`voi.onboarding.${userId}`, "done");
      if (!localStorage.getItem("voi.language"))
        localStorage.setItem("voi.language", "vi");
      if (!localStorage.getItem("voi.theme"))
        localStorage.setItem("voi.theme", "light");
    },
    {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      userId: pair.user.id,
    },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise actual API response shapes once, then cache GETs for deterministic
  // layout measurements and to avoid rate-limiting the development API.
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const key = route.request().url();
    let payload = cache.get(key);
    if (!payload) {
      const response = await api.get(key, {
        headers: { authorization: `Bearer ${pair.accessToken}` },
      });
      payload = {
        status: response.status(),
        contentType: response.headers()["content-type"] ?? "application/json",
        body: await response.body(),
      };
      cache.set(key, payload);
    }
    await route.fulfill(payload);
  });
  return { page, context, errors };
}
async function navigate(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await expect(page.locator("main#main .loading")).toHaveCount(0);
  // These geometry checks hard-load each route. Let its API/RSC requests finish
  // before the next document replaces it; WebKit otherwise reports the driver's
  // canceled old-document fetches as access-control errors. Live chat uses a
  // WebSocket, so this bounded HTTP-idle barrier does not wait on the chat socket.
  await page.waitForLoadState("networkidle", { timeout: 15000 });
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}
async function compactNavigation(page: Page) {
  const nav = page.locator(".bottom-nav");
  await expect(nav).toBeVisible();
  await expect(nav.locator("a")).toHaveCount(4);
  const dimensions = await page.evaluate(() => {
    const nav = document.querySelector(".bottom-nav")!.getBoundingClientRect();
    const main = document.querySelector("#main")!.getBoundingClientRect();
    const viewport = window.visualViewport;
    return {
      top: nav.top,
      bottom: nav.bottom,
      left: nav.left,
      right: nav.right,
      mainBottom: main.bottom,
      width: viewport?.width ?? innerWidth,
      height: viewport?.height ?? innerHeight,
    };
  });
  expect(dimensions.top).toBeGreaterThanOrEqual(0);
  expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.height + 1);
  expect(dimensions.left).toBeGreaterThanOrEqual(0);
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.mainBottom).toBeLessThanOrEqual(dimensions.top + 1);
  for (const link of await nav.locator("a").all())
    await expect(link).toBeInViewport({ ratio: 1 });
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    await page
      .locator("#main")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
}
for (const { width, height, touch } of [
  { width: 320, height: 568, touch: true },
  { width: 375, height: 667, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 430, height: 932, touch: true },
  { width: 767, height: 568, touch: true },
  { width: 844, height: 390, touch: true },
]) {
  test(`compact nav survives route changes and scrolling at ${width}x${height}`, async ({
    browser,
    baseURL,
  }, info) => {
    const { page, context, errors } = await open(
      browser,
      baseURL,
      width,
      height,
      touch,
    );
    try {
      for (const path of [
        "/",
        "/profile",
        "/settings",
        "/messages",
        "/groups",
        "/sessions/new",
        `/sessions/${sessionId}`,
        "/map",
      ]) {
        await navigate(page, path);
        await compactNavigation(page);
        await noHorizontalOverflow(page);
        const before = await page.locator(".bottom-nav").boundingBox();
        await page.locator("#main").evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await compactNavigation(page);
        const after = await page.locator(".bottom-nav").boundingBox();
        expect(Math.abs(before!.y - after!.y)).toBeLessThan(1);
        await page.locator("#main").evaluate((node) => {
          node.scrollTop = 0;
        });
        await compactNavigation(page);
      }
      await navigate(page, "/");
      await page.screenshot({
        path: info.outputPath(`home-${width}x${height}.png`),
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
for (const { width, height } of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`Settings aligns labels and controls at ${width}x${height}`, async ({
    browser,
    baseURL,
  }, info) => {
    const { page, context, errors } = await open(
      browser,
      baseURL,
      width,
      height,
    );
    try {
      await navigate(page, "/settings");
      await expect(page.getByRole("switch")).toHaveCount(3);
      await noHorizontalOverflow(page);
      const rows = await page
        .locator('.setting-row:has([role="switch"])')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const label = element
              .querySelector("label")!
              .getBoundingClientRect();
            const control = element
              .querySelector("input")!
              .getBoundingClientRect();
            return {
              labelRight: label.right,
              labelCenter: (label.top + label.bottom) / 2,
              right: control.right,
              left: control.left,
              center: (control.top + control.bottom) / 2,
              width: control.width,
              height: control.height,
            };
          }),
        );
      for (const row of rows) {
        expect(row.labelRight).toBeLessThan(row.left);
        expect(Math.abs(row.labelCenter - row.center)).toBeLessThan(1);
        expect(row.width).toBe(46);
        expect(row.height).toBe(28);
        expect(Math.abs(row.right - rows[0]!.right)).toBeLessThan(1);
      }
      const center = await page.evaluate(() => {
        const page = document
          .querySelector(".settings-page")!
          .getBoundingClientRect();
        const main = document.querySelector("#main")!.getBoundingClientRect();
        return Math.abs((page.left + page.right - main.left - main.right) / 2);
      });
      expect(center).toBeLessThan(1);
      if (width < 768) {
        await compactNavigation(page);
        await expect(
          page.locator('.bottom-nav a[aria-current="page"]'),
        ).toHaveAttribute("href", "/profile");
      } else {
        await expect(page.locator(".sidebar")).toBeVisible();
        await expect(
          page.locator('.sidebar a[href="/settings"]'),
        ).toHaveAttribute("aria-current", "page");
        await expect(page.locator(".topbar")).toBeHidden();
        await expect(page.getByRole("heading", { name: "Cài đặt", exact: true })).toBeVisible();
        await expect(page.locator(".bottom-nav")).toBeHidden();
      }
      await choose(page, "Ngôn ngữ", "English");
      await choose(page, "Appearance", "Dark");
      await noHorizontalOverflow(page);
      if (width < 768) await compactNavigation(page);
      await page.screenshot({
        path: info.outputPath(`settings-dark-en-${width}.png`),
      });
      await choose(page, "Language", "Tiếng Việt");
      await choose(page, "Chế độ giao diện", "Sáng");
      await page.screenshot({
        path: info.outputPath(`settings-light-vi-${width}.png`),
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
test("compact tabs remain clickable after scrolling and closing a sheet", async ({
  browser,
  baseURL,
}, info) => {
  const { page, context, errors } = await open(browser, baseURL, 390, 844);
  try {
    await navigate(page, "/");
    await page.locator("#main").evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await compactNavigation(page);
    await page.locator('.bottom-nav a[href="/profile"]').click();
    await expect(page).toHaveURL(/\/profile$/);
    await compactNavigation(page);
    await page.locator('.bottom-nav a[href="/"]').click();
    await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await compactNavigation(page);
    await expect(
      page.getByRole("button", { name: "Bộ lọc", exact: true }),
    ).toBeFocused();
    await page.locator('.bottom-nav a[href="/notifications"]').click();
    await expect(page).toHaveURL(/\/notifications$/);
    await compactNavigation(page);
    await page.screenshot({ path: info.outputPath("nav-after-modal.png") });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
test("focused chat input and nav fit a reduced viewport then recover", async ({
  browser,
  baseURL,
}, info) => {
  const { page, context, errors } = await open(browser, baseURL, 390, 844);
  try {
    await navigate(page, `/messages?group=${groupId}`);
    const input = page.getByRole("textbox", { name: "Tin nhắn", exact: true });
    await expect(input).toBeVisible();
    await input.fill("Unsent layout check");
    await input.focus();
    await page.setViewportSize({ width: 390, height: 400 });
    await expect
      .poll(async () =>
        Math.round(
          await page
            .locator(".app-shell")
            .evaluate((node) => node.getBoundingClientRect().height),
        ),
      )
      .toBe(400);
    await compactNavigation(page);
    await expect(input).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("button", { name: "Gửi tin nhắn", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    const inputBounds = await input.boundingBox(),
      navBounds = await page.locator(".bottom-nav").boundingBox();
    expect(inputBounds!.y + inputBounds!.height).toBeLessThanOrEqual(
      navBounds!.y,
    );
    await page.screenshot({ path: info.outputPath("chat-reduced-height.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await compactNavigation(page);
    await expect(input).toBeInViewport({ ratio: 1 });
    await input.fill("");
    await page
      .getByRole("button", { name: "Quay lại hội thoại", exact: true })
      .click();
    await expect(page.locator(".rooms")).toBeVisible();
    await compactNavigation(page);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("logged-out mobile sign-in still scrolls to its form", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    const button = page.getByRole("button", { name: "Tiếp tục", exact: true });
    await expect(button).toBeVisible();
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflowY),
    ).not.toBe("hidden");
    // Playwright cannot dispatch wheel input in mobile WebKit. Validate the
    // scrollable CSS contract above, then use the driver's scroll for reachability.
    if (browser.browserType().name() === "webkit")
      await button.scrollIntoViewIfNeeded();
    else await page.mouse.wheel(0, 1500);
    await expect(button).toBeInViewport({ ratio: 1 });
    await page.setViewportSize({ width: 320, height: 400 });
    // Playwright cannot dispatch wheel input in mobile WebKit. Validate the
    // scrollable CSS contract above, then use the driver's scroll for reachability.
    if (browser.browserType().name() === "webkit")
      await button.scrollIntoViewIfNeeded();
    else await page.mouse.wheel(0, 1500);
    await expect(button).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

for (const width of [1024, 1440, 1880]) {
  test(`page content stays centered in the workspace at ${width}px`, async ({ browser, baseURL }, info) => {
    const { page, context, errors } = await open(browser, baseURL, width, 1000, false);
    try {
      for (const path of ["/", "/profile", "/settings", "/groups", "/people", "/notifications", "/sessions/new", "/messages", "/map"]) {
        await navigate(page, path);
        await noHorizontalOverflow(page);
        const offsets = await page.evaluate(() => {
          const workspace = document.querySelector(".workspace")!.getBoundingClientRect();
          const main = document.querySelector("#main")!.getBoundingClientRect();
          const panel = document.querySelector("#main > .form-section, #main > .settings-page")?.getBoundingClientRect();
          const heading = document.querySelector("#main .page-title")!.getBoundingClientRect();
          const center = (rect: DOMRect) => (rect.left + rect.right) / 2;
          return [Math.abs(center(main) - center(workspace)), Math.abs(center(heading) - center(workspace)), ...(panel ? [Math.abs(center(panel) - center(workspace))] : [])];
        });
        for (const offset of offsets) expect(offset, `${path} must be centered`).toBeLessThan(1);
      }
      await navigate(page, "/profile");
      await page.screenshot({ path: info.outputPath(`profile-centered-${width}.png`), fullPage: true });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("custom dropdown supports keyboard, dismissal, selection and persistence", async ({ browser, baseURL }, info) => {
  const { page, context, errors } = await open(browser, baseURL, 320, 568);
  try {
    await navigate(page, "/settings");
    const theme = page.getByRole("combobox", { name: "Chế độ giao diện", exact: true });
    expect(await theme.evaluate((node) => node.tagName)).toBe("BUTTON");
    await theme.click();
    const menu = page.getByRole("listbox");
    await expect(menu).toBeVisible();
    await expect(page.getByRole("option", { selected: true })).toHaveText("Sáng");
    const bounds = await menu.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
    await page.screenshot({ path: info.outputPath("custom-dropdown-open-320.png") });
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(theme).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu).toBeVisible();
    await expect(page.getByRole("option", { selected: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByRole("option", { name: "Tối", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(theme).toHaveText("Tối");
    await expect(menu).toBeHidden();
    await page.reload();
    await expect(theme).toHaveText("Tối");
    await theme.click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole("option", { selected: true })).toBeFocused();
    // A viewport corner stays outside the menu and avoids scrolling the hidden background.
    await page.mouse.click(2, 100);
    await expect(menu).toBeHidden();
    await theme.click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole("option", { selected: true })).toBeFocused();
    await page.touchscreen.tap(2, 100);
    await expect(menu).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("custom dropdown works inside the filter dialog without closing its parent", async ({ browser, baseURL }, info) => {
  const { page, context, errors } = await open(browser, baseURL, 390, 844);
  try {
    await navigate(page, "/");
    await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const skill = dialog.getByRole("combobox", { name: /Trình độ/ });
    await skill.click();
    await expect(dialog.getByRole("listbox")).toBeVisible();
    await page.getByRole("option", { name: "Mới bắt đầu", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(skill).toContainText("Mới bắt đầu");
    await skill.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(skill).toBeFocused();
    await skill.click();
    await page.screenshot({ path: info.outputPath("custom-dropdown-in-dialog.png") });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("header is compact-only and follows light and dark appearance", async ({ browser, baseURL }, info) => {
  const { page, context, errors } = await open(browser, baseURL, 1440, 900, false);
  try {
    await navigate(page, "/settings");
    await expect(page.locator(".topbar")).toBeHidden();
    await expect(page.locator(".sidebar")).toBeVisible();
    await page.screenshot({ path: info.outputPath("desktop-without-topbar.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".topbar")).toBeVisible();
    await expect(page.locator(".sidebar")).toBeHidden();
    for (const [option, mode] of [["Tối", "dark"], ["Sáng", "light"]] as const) {
      await choose(page, "Chế độ giao diện", option);
      const colors = await page.locator(".topbar").evaluate((node) => {
        const css = getComputedStyle(node);
        const brightness = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).reduce((sum, channel) => sum + Number(channel), 0) / 3;
        return { background: brightness(css.backgroundColor), text: brightness(css.color) };
      });
      if (mode === "light") {
        expect(colors.background).toBeGreaterThan(200);
        expect(colors.text).toBeLessThan(80);
      } else {
        expect(colors.background).toBeLessThan(80);
        expect(colors.text).toBeGreaterThan(200);
      }
      await page.screenshot({ path: info.outputPath(`topbar-${mode}.png`) });
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const width of [390, 1440]) {
  test(`empty chat icon and prompt stay centered at ${width}px`, async ({ browser, baseURL }, info) => {
    const { page, context, errors } = await open(browser, baseURL, width, 900, width < 768);
    try {
      // A real QA room with only its history overridden avoids creating/deleting messages.
      await page.route("**/api/v1/groups/*/messages*", (route) => route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify({ messages: [], olderCursor: null }),
      }));
      await navigate(page, `/messages?group=${groupId}`);
      const empty = page.locator(".chat-history > .empty");
      await expect(empty).toBeVisible();
      const centers = await empty.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const icon = node.querySelector("svg")!.getBoundingClientRect();
        const prompt = node.querySelector("p")!.getBoundingClientRect();
        return {
          icon: Math.abs((icon.left + icon.right - bounds.left - bounds.right) / 2),
          prompt: Math.abs((prompt.left + prompt.right - bounds.left - bounds.right) / 2),
        };
      });
      expect(centers.icon).toBeLessThan(1);
      expect(centers.prompt).toBeLessThan(1);
      await noHorizontalOverflow(page);
      await page.screenshot({ path: info.outputPath(`chat-empty-centered-${width}.png`) });
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
