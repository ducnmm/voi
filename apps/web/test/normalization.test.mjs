import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSkillText } from "@voi/shared";
import { emptyNormalizationFilters, normalizationQuery, normalizedSkillLabel, validVenueCoordinate, sessionMapCoordinate, sessionMapsHref, venueMapsHref } from "../src/lib/normalization.ts";

const t = text => text;
const venue = { id: "venue-1", name: "The B Hòa Bình", address: "316 Hòa Bình", areaCode: "hcm", latitude: 10.7, longitude: 106.6, locationVerified: true, mapsUrl: "https://www.google.com/maps/search/?api=1&query=The+B", status: "VERIFIED" };

test("structured gender requirements preserve ranks while unresolved text remains a fallback", () => {
  assert.equal(normalizedSkillLabel({ skillNormalization: undefined }, t), null);
  assert.equal(normalizedSkillLabel({ skillNormalization: normalizeSkillText("không rõ") }, t), null);
  const label = normalizedSkillLabel({ skillNormalization: normalizeSkillText("Nam TBY đến TB; Nữ Yếu+ trở lên") }, t);
  assert.match(label, /Nam: TBY–TB/);
  assert.match(label, /Nữ: ≥ Yếu\+/);
});

test("rank query explicitly chooses unknown inclusion and never applies it to an unfiltered feed", () => {
  assert.deepEqual(normalizationQuery({ ...emptyNormalizationFilters, includeUnknown: true }), {});
  assert.deepEqual(normalizationQuery({ ...emptyNormalizationFilters, audience: "FEMALE", rank: "TB_MINUS", venueId: "v1" }), { audience: "FEMALE", rank: "TB_MINUS", includeUnknown: "false", venueId: "v1" });
});

test("a matched identity never revives expired or unverified location coordinates", () => {
  assert.equal(validVenueCoordinate(venue), true);
  assert.equal(validVenueCoordinate({ ...venue, locationVerified: false }), false);
  assert.equal(validVenueCoordinate({ ...venue, longitude: NaN }), false);
  assert.equal(validVenueCoordinate({ ...venue, latitude: 91 }), false);
  assert.equal(sessionMapCoordinate({ venue: { ...venue, locationVerified: false }, venueLat: 10.8, venueLng: 106.7 }), null);
  assert.deepEqual(sessionMapCoordinate({ venue, venueLat: 12, venueLng: 110 }), { lat: 10.7, lng: 106.6 });
  assert.equal(sessionMapCoordinate({ venueLat: null, venueLng: null }), null);
  assert.deepEqual(sessionMapCoordinate({ venueLat: 10.8, venueLng: 106.7 }), { lat: 10.8, lng: 106.7 });
});

test("Maps actions use safe provider links or escaped source searches", () => {
  assert.equal(venueMapsHref(venue, "old source"), venue.mapsUrl);
  for (const mapsUrl of ["javascript:alert(1)", "https://www.google.com.evil.test/maps", "https://evil.test", "https://user:pass@www.google.com/maps"])
    assert.match(venueMapsHref({ ...venue, mapsUrl }, "old source"), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.equal(venueMapsHref(null, null), null);
  assert.match(sessionMapsHref({ venueLat: 10.8, venueLng: 106.7, venueName: "Source name" }), /query=10\.8%2C106\.7$/);
  assert.match(venueMapsHref(null, "Sân A & B", "123 Đường X"), /S%C3%A2n%20A%20%26%20B/);
});
