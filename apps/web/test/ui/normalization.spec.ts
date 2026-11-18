import { test, expect, type Page } from "@playwright/test";
import { normalizeSkillText, SKILL_RANKS } from "@voi/shared";

const BASE = process.env.WEB_UI_BASE_URL ?? "http://127.0.0.1:43388";
const venue = { id: "venue-normalized", name: "The B Hòa Bình", address: "316 Hòa Bình, Tân Phú", areaCode: "hcm", latitude: null, longitude: null, mapsUrl: "https://www.google.com/maps/search/?api=1&query=The+B+Hoa+Binh", locationVerified: false, status: "VERIFIED" };
const user = { id: "normalization-ui-user", email: "normalization@example.test", displayName: "Normalization QA", avatarUrl: null, defaultSkillLevel: "OPEN" };
const listing = {
  id: "normalized-listing", title: "Kèo giao lưu tại sân nguồn", description: null,
  startsAt: "2030-11-18T12:00:00Z", endsAt: "2030-11-18T14:00:00Z", timeZone: "Asia/Ho_Chi_Minh",
  venueName: "TheB HB source", venueAddress: "316 HB source", areaCode: "hcm", areaLabel: "TP.HCM",
  venueId: venue.id, venue, venueResolution: { status: "MATCHED", version: "1", candidateIds: [] },
  skillLevel: "UNKNOWN", skillText: "Nam TBY đến TB; Nữ Yếu+ trở lên", skillNormalization: normalizeSkillText("Nam TBY đến TB; Nữ Yếu+ trở lên"),
  feeVnd: null, feeBasis: "UNKNOWN", feeText: null, requestedPlayers: 3, organizerName: "Chủ kèo QA", contacts: [],
  source: { id: "source-normalized", name: "Nhóm QA", platform: "FACEBOOK", url: "https://www.facebook.com/groups/123" },
  sourceUrl: "https://www.facebook.com/groups/123/posts/456/", sourcePostedAt: "2030-11-17T12:00:00Z", lastVerifiedAt: "2030-11-18T09:00:00Z", effectiveStatus: "OPEN", stale: false,
};

async function mockApi(page: Page, authenticated = false) {
  await page.addInitScript(({ authenticated, user }) => {
    localStorage.setItem("voi.language", "vi");
    localStorage.setItem("voi.theme", "light");
    if (authenticated) {
      localStorage.setItem("voi.token", "synthetic-normalization-ui-token");
      localStorage.setItem(`voi.onboarding.${user.id}`, "done");
    }
  }, { authenticated, user });
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const body = path === "/me" ? { user }
      : path === "/me/badges" ? { chats: [], alertsUnread: 0 }
      : path === "/community-listings/skills" ? { scale: { code: "VN_COMMUNITY_V1", version: "1" }, ranks: SKILL_RANKS }
      : path === "/community-listings/areas" ? { areas: [{ code: "hcm", label: "TP.HCM" }] }
      : path === "/venues" ? { venues: [venue] }
      : path === "/community-listings" ? { listings: [listing], nextCursor: null }
      : path === `/community-listings/${listing.id}` ? { listing }
      : path === "/groups" ? { groups: [{ id: "group-normalization", name: "Nhóm QA", defaultSkillLevel: "OPEN", defaultVenueName: null, memberCount: 1 }] }
      : path === "/sessions" ? { sessions: [], nextCursor: null }
      : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("community catalogue filters send rank/audience/venue IDs and normalized details retain original evidence", async ({ page }) => {
  await mockApi(page);
  await page.goto(`${BASE}/discover`);
  await expect(page.locator(".community-card h2")).toContainText(venue.name);
  await expect(page.locator(".community-skill")).toContainText("Nam: TBY–TB");
  await expect(page.locator(".community-skill")).toContainText("Nữ: ≥ Yếu+");
  await page.getByRole("combobox", { name: "Yêu cầu trình độ cho", exact: true }).click();
  await page.getByRole("option", { name: "Nữ", exact: true }).click();
  await page.getByRole("combobox", { name: "Mức trình độ của bạn", exact: true }).click();
  const ranked = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname.endsWith("/community-listings") && url.searchParams.get("audience") === "FEMALE" && url.searchParams.get("rank") === "TB_MINUS" && url.searchParams.get("includeUnknown") === "false";
  });
  await page.getByRole("option", { name: "TB-", exact: true }).click();
  await ranked;
  await page.getByRole("checkbox", { name: "Gồm bài chưa rõ trình độ", exact: true }).check();
  await page.getByRole("combobox", { name: "Sân đã đối chiếu", exact: true }).click();
  const selected = page.waitForRequest(request => new URL(request.url()).searchParams.get("venueId") === venue.id);
  await page.getByRole("option", { name: `${venue.name} · ${venue.address}`, exact: true }).click();
  await selected;
  await page.locator(`.community-card h2 a`).click();
  await expect(page.locator(".community-details")).toContainText("Bài gốc: Nam TBY đến TB; Nữ Yếu+ trở lên");
  await expect(page.getByRole("link", { name: "Tìm sân trên Google Maps", exact: true })).toHaveAttribute("href", venue.mapsUrl);
  await expect(page.getByText("Chưa xác minh tọa độ sân", { exact: true })).toBeVisible();
});

test("authenticated community rank filtering is not narrowed by the native coarse level", async ({ page }) => {
  await mockApi(page, true);
  await page.goto(BASE);
  await expect(page.locator("[data-app-shell]")).toBeVisible();
  await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Trình độ", exact: true }).click();
  await page.getByRole("option", { name: "Trung bình", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Mức trình độ của bạn", exact: true }).click();
  const request = page.waitForRequest(request => {
    const url = new URL(request.url());
    return url.pathname.endsWith("/community-listings") && url.searchParams.get("rank") === "TB" && !url.searchParams.has("skillLevel");
  });
  await page.getByRole("option", { name: "TB", exact: true }).click();
  await request;
  await page.getByRole("button", { name: "Xem kết quả", exact: true }).click();
  await expect(page.locator(".community-card")).toHaveCount(1);
});

test("native session venue picker resolves a branch while allowing a return to free text", async ({ page }) => {
  await mockApi(page, true);
  await page.goto(`${BASE}/sessions/new`);
  await page.getByRole("combobox", { name: "Chọn đúng chi nhánh sân", exact: true }).click();
  await page.getByRole("option", { name: `${venue.name} · ${venue.address}`, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Sân cầu lông", exact: true })).toHaveValue(venue.name);
  await expect(page.getByText(venue.address, { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Sân cầu lông", exact: true }).fill("Sân tự nhập");
  await expect(page.getByRole("combobox", { name: "Chọn đúng chi nhánh sân", exact: true })).toContainText("Dùng tên sân tự nhập");
});
