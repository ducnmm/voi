import test from "node:test";
import assert from "node:assert/strict";
import {
  SKILL_RANKS, SKILL_ALIASES, SKILL_SCALE_CODE, normalizeSkillText,
  matchesSkillRequirement, validateSkillRequirement, formatSkillRequirements,
} from "../dist/skill-normalization.js";

const matches = (text, audience, rank, includeUnknown = false) => matchesSkillRequirement(normalizeSkillText(text), { audience, rank, includeUnknown });

test("catalog preserves distinct suffix ranks and stable ordered codes", () => {
  assert.equal(SKILL_SCALE_CODE, "VN_COMMUNITY_V1");
  assert.equal(new Set(SKILL_RANKS.map(rank => rank.code)).size, SKILL_RANKS.length);
  assert.equal(SKILL_ALIASES.find(alias => alias.token === "tb-")?.rankCode, "TB_MINUS");
  assert.ok(SKILL_RANKS.every((rank, index) => !index || SKILL_RANKS[index - 1].order < rank.order));
  for (const [source, code] of [["TBY", "TBY"], ["TBY+", "TBY_PLUS"], ["TB-", "TB_MINUS"], ["TB", "TB"], ["TB+", "TB_PLUS"], ["Yếu+", "YEU_PLUS"]]) {
    const result = normalizeSkillText(source);
    assert.equal(result.status, "COMPLETE", source);
    assert.equal(result.requirements[0].minRank, code, source);
    assert.equal(result.requirements[0].maxRank, code, source);
  }
});

test("real male/female arrow ranges are separate and inclusive", () => {
  const result = normalizeSkillText("Nam Tby → Tb / Nữ Yếu+ → Tb-");
  assert.equal(result.status, "COMPLETE");
  assert.deepEqual(result.requirements.map(({ audience, minRank, maxRank }) => ({ audience, minRank, maxRank })), [
    { audience: "MALE", minRank: "TBY", maxRank: "TB" },
    { audience: "FEMALE", minRank: "YEU_PLUS", maxRank: "TB_MINUS" },
  ]);
  assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "YEU_PLUS" }), true);
  assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "TB" }), false);
});

test("slash and comma lists are OR alternatives, not expanded ranges", () => {
  const result = normalizeSkillText("Nam: TBY / TB- / Nữ: Y+ trở lên");
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.requirements.filter(rule => rule.audience === "MALE").length, 2);
  assert.equal(matchesSkillRequirement(result, { audience: "MALE", rank: "TBY" }), true);
  assert.equal(matchesSkillRequirement(result, { audience: "MALE", rank: "TBY_PLUS" }), false);
  assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "TB_PLUS" }), true);
  assert.equal(matches("Newbie, Yếu, TBY", "ALL", "YEU_PLUS"), false);
});

test("one-sided limits and strict inequalities keep their meaning", () => {
  assert.equal(matches("TB- trở lên", "ALL", "TB_MINUS"), true);
  assert.equal(matches("TB- đổ lên", "ALL", "TBY"), false);
  assert.equal(matches("Trên TB", "ALL", "TB"), false);
  assert.equal(matches("Trên TB", "ALL", "TB_PLUS"), true);
  assert.equal(matches("Dưới TB", "ALL", "TB"), false);
  assert.equal(matches("Tối đa TB", "ALL", "TB"), true);
  assert.equal(matches("TB trở xuống", "ALL", "TB_PLUS"), false);
});

test("standalone and joined hyphen ranges do not erase rank suffixes", () => {
  for (const source of ["TBY-TB", "TBY đến TB", "TBY ➝ TB", "Yếu - TBY", "TB-–TB+"]) {
    assert.equal(normalizeSkillText(source).status, "COMPLETE", source);
  }
  assert.equal(matches("TBY-TB", "ALL", "TBY_PLUS"), true);
  assert.equal(matches("TB-, TB", "ALL", "TBY_PLUS"), false);
  assert.equal(normalizeSkillText("Trình trung bình (-) trở lên").requirements[0].minRank, "TB_MINUS");
  assert.equal(normalizeSkillText("Nam: Y / Tby / Tb - / Nữ: Y / Tby").requirements.find(rule => rule.minRank === "TB_MINUS")?.audience, "MALE");
  assert.equal(normalizeSkillText("Yếu – TB(-)").requirements[0].maxRank, "TB_MINUS");
  assert.equal(normalizeSkillText("newbie, yếu +-").status, "PARTIAL");
  assert.equal(normalizeSkillText("TB1").status, "UNRESOLVED");
  assert.equal(normalizeSkillText("TB−").requirements[0].minRank, "TB_MINUS");
});

test("unknown requirements never become unrestricted", () => {
  for (const source of [null, "", "Không ghi rõ", "khá", "TB nhỉnh", "Y++", "TBY-", "Yếu-+"]) {
    const result = normalizeSkillText(source);
    assert.equal(result.status, "UNRESOLVED", String(source));
    assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "TB" }), false);
    assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "TB", includeUnknown: true }), true);
  }
  const open = normalizeSkillText("Mọi trình độ");
  assert.equal(open.status, "COMPLETE");
  assert.equal(open.requirements[0].mode, "UNRESTRICTED");
  assert.equal(matchesSkillRequirement(open, { audience: "FEMALE", rank: "NEWBIE" }), true);
});

test("unmentioned female requirements are unknown, not female exclusion", () => {
  const result = normalizeSkillText("Nam TBY–TB");
  assert.equal(result.recruitmentAudience, "UNKNOWN");
  assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "TBY" }), false);
  assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "TBY", includeUnknown: true }), true);
  const maleOnly = normalizeSkillText("Chỉ tuyển nam: TBY–TB");
  assert.equal(maleOnly.recruitmentAudience, "MALE_ONLY");
  assert.equal(matchesSkillRequirement(maleOnly, { audience: "FEMALE", rank: "TBY", includeUnknown: true }), false);
});

test("ALL applies as fallback and specific rules override it", () => {
  const shared = normalizeSkillText("Nam/Nữ-TB- đến TB+");
  assert.equal(shared.recruitmentAudience, "ANY");
  assert.equal(shared.requirements[0].audience, "ALL");
  assert.equal(matchesSkillRequirement(shared, { audience: "FEMALE", rank: "TB" }), true);
  const override = normalizeSkillText("TBY đến TB; nữ Yếu+ đến TBY");
  assert.equal(matchesSkillRequirement(override, { audience: "MALE", rank: "TB" }), true);
  assert.equal(matchesSkillRequirement(override, { audience: "FEMALE", rank: "TB" }), false);
  const adjacent = normalizeSkillText("nam nữ yếu");
  assert.equal(adjacent.status, "COMPLETE");
  assert.equal(adjacent.requirements[0].audience, "ALL");
});

test("experience clauses do not manufacture a female rank", () => {
  const result = normalizeSkillText("Nam: Y+ / TBY / TB- / Nữ: Từ 3 tháng trở lên (đã biết luật)");
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.requirements.find(rule => rule.audience === "FEMALE").mode, "UNKNOWN");
  assert.ok(result.reasons.includes("ADDITIONAL_CONDITIONS"));
  assert.equal(matchesSkillRequirement(result, { audience: "FEMALE", rank: "YEU_PLUS" }), false);
});

test("unresolved per-court and time-specific scope is not unioned", () => {
  for (const source of ["1 sân : yếu++( ko tuyển newbie ) / 1 sân: tb- / tb", "8H-10H: TBY, TB- / 10H-12H: TB-, TB (nữ TBY trở lên)"]) {
    const result = normalizeSkillText(source);
    assert.equal(result.status, "UNRESOLVED");
    assert.ok(result.reasons.includes("SCOPED_SKILL_REQUIREMENTS"));
  }
});

test("ambiguous aliases, mixed range/list expressions and reversed bounds stay unresolved", () => {
  for (const source of ["Nam TB ➡️ TB nhỉnh", "Yếu + Tby", "YẾU+ đến TBY/TB-", "TB đến TBY"]) {
    assert.equal(normalizeSkillText(source).status, "UNRESOLVED", source);
  }
});

test("năm in experience text is not a male gender marker, yêu cầu is not rank yếu", () => {
  const result = normalizeSkillText("TBY (chơi liên tục trên 1 năm)");
  assert.equal(result.requirements[0].audience, "ALL");
  assert.equal(result.requirements[0].minRank, "TBY");
  const qualified = normalizeSkillText("Nam : TB-, TB ( yêu cầu nho nhỏ là đúng trình ạ )");
  assert.deepEqual(qualified.requirements.map(rule => rule.minRank), ["TB_MINUS", "TB"]);
  assert.equal(qualified.status, "PARTIAL");
});

test("negation, dangling ranges and conflicting audience clauses never become confident ranks", () => {
  for (const source of ["Không nhận newbie", "Yếu đến C", "C đến TB", "Nam TB; nam TBY", "TB(-/+)"]) {
    const result = normalizeSkillText(source);
    assert.equal(result.status, "UNRESOLVED", source);
    assert.equal(matchesSkillRequirement(result, { audience: "ALL", rank: "NEWBIE" }), false);
  }
  assert.equal(normalizeSkillText("TB có điều kiện thêm").status, "PARTIAL");
  assert.equal(normalizeSkillText("Mọi trình độ nam nữ").status, "COMPLETE");
  assert.equal(normalizeSkillText("Chỉ tuyển nam TB; chỉ tuyển nữ TBY").status, "PARTIAL");
});

test("validation rejects invalid, empty and reversed ranges", () => {
  const rule = normalizeSkillText("TB").requirements[0];
  assert.deepEqual(validateSkillRequirement(rule), []);
  assert.ok(validateSkillRequirement({ ...rule, minRank: null, maxRank: null }).includes("MISSING_RANGE_BOUND"));
  assert.ok(validateSkillRequirement({ ...rule, minRank: "TB_PLUS", maxRank: "TB" }).includes("EMPTY_OR_REVERSED_RANGE"));
  assert.ok(validateSkillRequirement({ ...rule, minInclusive: false }).includes("EMPTY_OR_REVERSED_RANGE"));
  assert.ok(validateSkillRequirement({ ...rule, minRank: "YEU_PLUS_PLUS" }).includes("INVALID_RANK"));
  assert.ok(validateSkillRequirement({ ...rule, mode: "UNKNOWN" }).includes("UNEXPECTED_RANGE_BOUND"));
});

test("normalization is deterministic and evidence is preserved", () => {
  const source = "Nam Tb-, Tb; nữ tby+";
  const result = normalizeSkillText(source);
  assert.deepEqual(result, normalizeSkillText(source));
  assert.ok(result.requirements.every(rule => rule.evidence.length));
  assert.equal(formatSkillRequirements(result), "Nam: TB- / TB · Nữ: TBY+");
  assert.equal(formatSkillRequirements(normalizeSkillText("không rõ")), null);
  assert.equal(formatSkillRequirements(result, { audienceLabels: { MALE: "Men", FEMALE: "Women" } }), "Men: TB- / TB · Women: TBY+");
  const publicResult = { ...result, requirements: result.requirements.map(({ evidence, ...rule }) => rule) };
  assert.equal(formatSkillRequirements(publicResult), "Nam: TB- / TB · Nữ: TBY+");
});
