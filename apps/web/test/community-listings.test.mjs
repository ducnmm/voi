import { test } from "node:test";
import assert from "node:assert/strict";
import { communityContactHref, communitySourceHref, communityFee, communityDate, communityTime } from "../src/lib/community-listings.ts";

const t = (text, values = []) => text.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)]));

test("contact links only open the declared service and never execute arbitrary schemes", () => {
  assert.equal(communityContactHref({ type: "PHONE", value: "+84 901 234 567" }), "tel:+84901234567");
  assert.equal(communityContactHref({ type: "ZALO", value: "https://zalo.me/0901234567" }), "https://zalo.me/0901234567");
  assert.equal(communityContactHref({ type: "FACEBOOK", value: "https://m.facebook.com/example" }), "https://m.facebook.com/example");
  for (const value of ["javascript:alert(1)", "https://facebook.com.evil.test/example", "https://facebook.com@evil.test", "http://facebook.com/example", "https://user:password@facebook.com/example", "https://www.facebook.com:8443/example"])
    assert.equal(communityContactHref({ type: "FACEBOOK", value }), null);
  assert.equal(communityContactHref({ type: "PHONE", value: "javascript:alert(1)" }), null);
  assert.equal(communityContactHref({ type: "ZALO", value: "https://facebook.com/example" }), null);
  assert.equal(communitySourceHref("data:text/html,<script>alert(1)</script>"), null);
});

test("fees preserve zero, unknown amounts and each fee basis", () => {
  assert.equal(communityFee({ feeVnd: null, feeText: null, feeBasis: "UNKNOWN" }, "vi-VN", t), "Chưa rõ phí");
  assert.equal(communityFee({ feeVnd: null, feeText: "Chia đều tiền sân", feeBasis: "OTHER" }, "vi-VN", t), "Chia đều tiền sân");
  assert.match(communityFee({ feeVnd: 0, feeText: null, feeBasis: "PER_PERSON" }, "vi-VN", t), /^0.*\/người$/);
  assert.match(communityFee({ feeVnd: 80000, feeText: null, feeBasis: "TOTAL" }, "vi-VN", t), /tổng phí$/);
  assert.match(communityFee({ feeVnd: 80000, feeText: null, feeBasis: "PER_HOUR" }, "vi-VN", t), /\/giờ$/);
  assert.match(communityFee({ feeVnd: 80000, feeText: null, feeBasis: "UNKNOWN" }, "vi-VN", t), /Chưa rõ cách tính$/);
});

test("date and time use the source timezone across midnight, including unknown end time", () => {
  const listing = { startsAt: "2026-11-10T17:30:00Z", endsAt: "2026-11-10T19:00:00Z", timeZone: "Asia/Ho_Chi_Minh" };
  assert.match(communityDate(listing.startsAt, listing.timeZone, "en-GB"), /11 Nov 2026/);
  assert.equal(communityTime(listing, "en-GB", t), "00:30 – 02:00");
  assert.match(communityTime({ ...listing, endsAt: null }, "en-GB", t), /^Từ 00:30 · Chưa rõ giờ kết thúc$/);
  assert.equal(communityTime({ ...listing, startsAt: null, endsAt: null }, "en-GB", t), "Chưa rõ giờ");
  assert.match(communityTime({ ...listing, startsAt: "2026-11-10T16:30:00Z" }, "en-GB", t), /23:30 – 02:00 \(Wed, 11 Nov 2026\)/);
});
