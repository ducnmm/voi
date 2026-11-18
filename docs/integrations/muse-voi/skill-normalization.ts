/** Voi's versioned recreational vocabulary; orders are not measured ability scores. */
export const SKILL_SCALE_CODE = "VN_COMMUNITY_V1" as const;
export const SKILL_NORMALIZATION_VERSION = "vn-community-v1.0";
export const SKILL_RANKS = [
  { code: "NEWBIE", label: "Newbie", order: 10 },
  { code: "YEU", label: "Yếu", order: 20 },
  { code: "YEU_PLUS", label: "Yếu+", order: 30 },
  { code: "TBY", label: "TBY", order: 40 },
  { code: "TBY_PLUS", label: "TBY+", order: 45 },
  { code: "TB_MINUS", label: "TB-", order: 50 },
  { code: "TB", label: "TB", order: 60 },
  { code: "TB_PLUS", label: "TB+", order: 70 },
] as const;

export type SkillRankCode = typeof SKILL_RANKS[number]["code"];
const approvedAliases = {
  newbie: "NEWBIE", nguoimoi: "NEWBIE", moichoi: "NEWBIE", moitap: "NEWBIE",
  yeu: "YEU", y: "YEU", "yeu+": "YEU_PLUS", "y+": "YEU_PLUS",
  tby: "TBY", tbyeu: "TBY", trungbinhyeu: "TBY",
  "tby+": "TBY_PLUS", "tbyeu+": "TBY_PLUS", "trungbinhyeu+": "TBY_PLUS",
  tb: "TB", trungbinh: "TB", "tb-": "TB_MINUS", "trungbinh-": "TB_MINUS",
  "tb+": "TB_PLUS", "trungbinh+": "TB_PLUS",
} as const satisfies Record<string, SkillRankCode>;
/** Approved tokens are accent-folded and whitespace-free; suffix punctuation is significant. */
export const SKILL_ALIASES: readonly { token: string; rankCode: SkillRankCode }[] = Object.entries(approvedAliases).map(([token, rankCode]) => ({ token, rankCode }));
export type SkillAudience = "ALL" | "MALE" | "FEMALE";
export type SkillNormalizationStatus = "COMPLETE" | "PARTIAL" | "UNRESOLVED";
export type RecruitmentAudience = "UNKNOWN" | "ANY" | "MALE_ONLY" | "FEMALE_ONLY";
export type SkillRequirement = {
  audience: SkillAudience;
  mode: "RANGE" | "UNRESTRICTED" | "UNKNOWN";
  minRank: SkillRankCode | null;
  maxRank: SkillRankCode | null;
  minInclusive: boolean;
  maxInclusive: boolean;
  alternative: number;
  evidence: string;
};
export type SkillNormalization = {
  version: string;
  scaleCode: typeof SKILL_SCALE_CODE;
  status: SkillNormalizationStatus;
  requirements: SkillRequirement[];
  recruitmentAudience: RecruitmentAudience;
  notes: string[];
  reasons: string[];
};

const ranks = new Map<string, typeof SKILL_RANKS[number]>(SKILL_RANKS.map((rank) => [rank.code, rank]));
export function isSkillRankCode(value: unknown): value is SkillRankCode {
  return typeof value === "string" && ranks.has(value);
}
function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}
function unknown(audience: SkillAudience, evidence: string, alternative = 0): SkillRequirement {
  return { audience, mode: "UNKNOWN", minRank: null, maxRank: null, minInclusive: true, maxInclusive: true, alternative, evidence };
}
function rankToken(value: string): SkillRankCode | null {
  const token = value.replace(/\s+/g, "");
  return (approvedAliases as Record<string, SkillRankCode>)[token] ?? null;
}

type ParsedClause = { requirements: SkillRequirement[]; reasons: string[]; notes: string[] };
function parseClause(evidence: string, audience: SkillAudience): ParsedClause {
  let text = fold(evidence).replace(/[−﹣－]/g, "-").replace(/[＋﹢]/g, "+").replace(/^\s*[:\-–—/&,|]+/, "").trim();
  const reasons: string[] = [];
  const notes: string[] = [];
  if (!text) return { requirements: [unknown(audience, evidence)], reasons: ["MISSING_SKILL_REQUIREMENT"], notes };
  if (/\b(?:nhinh|kha|gioi|cao thu)\b/.test(text)) {
    return { requirements: [unknown(audience, evidence)], reasons: ["UNAPPROVED_RANK_ALIAS"], notes: [evidence] };
  }
  if (/\b(?:trung\s*binh\s*yeu|tby|trung\s*binh|tb|yeu|y)\s*\([^)]*[+\-][^)]*\)/.test(text)
    && /\b(?:trung\s*binh\s*yeu|tby|trung\s*binh|tb|yeu|y)\s*\(\s*(?![+\-]+\s*\))[^)]*[+\-][^)]*\)/.test(text)) {
    return { requirements: [unknown(audience, evidence)], reasons: ["AMBIGUOUS_RANK_MODIFIER"], notes: [evidence] };
  }
  if (/\b(?:khong|ko|k)\s+(?:nhan|tuyen|lay|danh cho)\s+(?:newbie|yeu|y\b|tby|tb)\b/.test(text)) {
    return { requirements: [unknown(audience, evidence)], reasons: ["NEGATED_SKILL_REQUIREMENT"], notes: [evidence] };
  }
  // A spaced + between rank words is ambiguous between suffix and list punctuation.
  if (/\b(?:yeu|y|tby|tb)\s+\+\s+(?=yeu\b|y\b|tby\b|tb\b)/.test(text)) {
    return { requirements: [unknown(audience, evidence)], reasons: ["AMBIGUOUS_PLUS"], notes: [evidence] };
  }
  const unrestricted = /\b(?:moi trinh do|khong gioi han trinh do|tat ca trinh do|open level|all levels)\b/.test(text);
  const extraConditions = /\b(?:thang|nam lien tuc|biet luat|khong nhan newbie|khong tuyen newbie|da choi|choi lien tuc)\b/.test(text);
  if (extraConditions) { reasons.push("ADDITIONAL_CONDITIONS"); notes.push(evidence); }
  // "yêu cầu" is not the rank "yếu" after removing Vietnamese diacritics.
  text = text.replace(/\byeu cau\b/g, "condition");
  text = text.replace(/\b(trung\s*binh\s*yeu|tb\s*yeu|tby|trung\s*binh|tb|yeu|y)\s*\(\s*([+\-]+)\s*\)/g, "$1$2");
  text = text.replace(/\b(tby|tb|yeu|y)-(tby|tb|yeu|y)(?=\b|[+\-])/g, "$1 → $2");
  const tokenPattern = /\b(?:trung\s*binh\s*yeu|tb\s*yeu|tby|trung\s*binh|tb|newbie|nguoi\s*moi|moi\s*choi|moi\s*tap|yeu|y)(?:[+\-]+|\s+[+\-]+(?!\s*(?:yeu\b|y\b|tby\b|tb\b)))?(?![a-z0-9])/g;
  const tokens = [...text.matchAll(tokenPattern)].map((match) => ({ text: match[0], start: match.index!, end: match.index! + match[0].length, rank: rankToken(match[0]) }));
  if (unrestricted) {
    if (tokens.length) return { requirements: [unknown(audience, evidence)], reasons: [...reasons, "CONFLICTING_SKILL_REQUIREMENT"], notes: [evidence] };
    return { requirements: [{ ...unknown(audience, evidence), mode: "UNRESTRICTED" }], reasons, notes };
  }
  if (!tokens.length) return { requirements: [unknown(audience, evidence)], reasons: [...reasons, "UNRECOGNIZED_SKILL_REQUIREMENT"], notes: [evidence] };
  const separators = tokens.slice(0, -1).map((token, index) => text.slice(token.end, tokens[index + 1]!.start).trim());
  const rangeSeparator = (value: string) => /^(?:den|toi|[-–—→➝➡️]+|->|=>)$/u.test(value);
  const ranges = separators.map(rangeSeparator);
  const prefix = text.slice(0, tokens[0]!.start);
  const suffix = text.slice(tokens[tokens.length - 1]!.end);
  let residual = text;
  for (const token of [...tokens].reverse()) residual = residual.slice(0, token.start) + " " + residual.slice(token.end);
  residual = residual.replace(/\b(?:trinh do|trinh|muc|tu|den|toi da|khong qua|toi|tren|duoi|tro len|do len|tro xuong|do xuong|va|hoac|or|and above|and below)\b/g, "").replace(/[^a-z0-9]/g, "");
  if (residual) { reasons.push("UNPARSED_CONDITIONS"); notes.push(evidence); }
  if (ranges.some(Boolean)) {
    if (tokens.length !== 2 || !ranges.every(Boolean) || !tokens[0]!.rank || !tokens[1]!.rank) {
      return { requirements: [unknown(audience, evidence)], reasons: [...reasons, "AMBIGUOUS_SKILL_RANGE"], notes: [evidence] };
    }
    const minRank = tokens[0]!.rank!, maxRank = tokens[1]!.rank!;
    if (ranks.get(minRank)!.order > ranks.get(maxRank)!.order) {
      return { requirements: [unknown(audience, evidence)], reasons: [...reasons, "REVERSED_SKILL_RANGE"], notes: [evidence] };
    }
    return { requirements: [{ ...unknown(audience, evidence), mode: "RANGE", minRank, maxRank }], reasons, notes };
  }
  if (/\b(?:den|toi)\s*$|[→➝➡]\s*$/u.test(prefix) || /^\s*(?:den\b|toi\b|[→➝➡])/u.test(suffix)) {
    return { requirements: [unknown(audience, evidence)], reasons: [...reasons, "AMBIGUOUS_SKILL_RANGE"], notes: [evidence] };
  }
  if (separators.some((separator) => !/^(?:[,/|•·;&+\s]*|hoac|va|or)$/.test(separator))) {
    return { requirements: [unknown(audience, evidence)], reasons: [...reasons, "AMBIGUOUS_SKILL_EXPRESSION"], notes: [evidence] };
  }
  const lower = /\b(?:tu|tren)\s*$/.test(prefix) || /\b(?:tro len|do len|len tro len|and above)\b/.test(suffix) || /[≥>]\s*$/.test(prefix);
  const upper = /\b(?:duoi|toi da|khong qua)\s*$/.test(prefix) || /\b(?:tro xuong|do xuong|and below)\b/.test(suffix) || /[≤<]\s*$/.test(prefix);
  if ((lower || upper) && tokens.length !== 1 || lower && upper) {
    return { requirements: [unknown(audience, evidence)], reasons: [...reasons, "AMBIGUOUS_SKILL_RANGE"], notes: [evidence] };
  }
  const requirements = tokens.map((token, alternative): SkillRequirement => {
    if (!token.rank) { reasons.push("UNAPPROVED_RANK_ALIAS"); return unknown(audience, evidence, alternative); }
    return {
      ...unknown(audience, evidence, alternative), mode: "RANGE",
      minRank: upper ? null : token.rank, maxRank: lower ? null : token.rank,
      minInclusive: !/\btren\s*$/.test(prefix) && !/>\s*$/.test(prefix),
      maxInclusive: !/\bduoi\s*$/.test(prefix) && !/<\s*$/.test(prefix),
    };
  });
  return { requirements, reasons, notes };
}

/** Raw source text stays outside this result; normalization never means a new observation. */
export function normalizeSkillText(input: string | null | undefined): SkillNormalization {
  const source = typeof input === "string" ? input.normalize("NFC").trim() : "";
  const base: SkillNormalization = {
    version: SKILL_NORMALIZATION_VERSION, scaleCode: SKILL_SCALE_CODE, status: "UNRESOLVED",
    requirements: [], recruitmentAudience: "UNKNOWN", notes: [], reasons: [],
  };
  if (!source) return { ...base, requirements: [unknown("ALL", "")], reasons: ["MISSING_SKILL_REQUIREMENT"] };
  const folded = fold(source);
  const maleOnly = /\bchi\s+(?:(?:tuyen|nhan|danh cho)\s+)?nam\b/.test(folded);
  const femaleOnly = /\bchi\s+(?:(?:tuyen|nhan|danh cho)\s+)?nu\b/.test(folded);
  if (maleOnly && femaleOnly) base.reasons.push("CONFLICTING_RECRUITMENT_AUDIENCE");
  else if (maleOnly) base.recruitmentAudience = "MALE_ONLY";
  else if (femaleOnly) base.recruitmentAudience = "FEMALE_ONLY";
  if (/\b(?:nam\s*[/&]|nam\s+va|nam\s+lan|nam\s+)\s*nu\b/.test(folded)) base.recruitmentAudience = "ANY";
  if (source.length > 2000 || /\b\d+\s*san\b|\b\d{1,2}\s*(?:h|gio)\s*[-–→]/.test(folded)) {
    return { ...base, requirements: [unknown("ALL", source.slice(0, 500))], reasons: [source.length > 2000 ? "SKILL_TEXT_TOO_LONG" : "SCOPED_SKILL_REQUIREMENTS"], notes: [source.slice(0, 500)] };
  }
  const genderPattern = /\b(?:nam(?:\s*(?:\/|&|va|lan)\s*|\s+)nu|nu(?:\s*(?:\/|&|va)\s*|\s+)nam|nam|nu)\b/g;
  const markers = [...folded.matchAll(genderPattern)].filter((match) => !/năm/i.test(source.slice(match.index!, match.index! + match[0].length)));
  const clauses: { audience: SkillAudience; evidence: string }[] = [];
  if (!markers.length) clauses.push({ audience: "ALL", evidence: source });
  else {
    const first = markers[0]!.index!;
    const before = source.slice(0, first).trim();
    if (before && /\b(?:tby|tb|yeu|newbie|moi trinh do)\b/.test(fold(before))) clauses.push({ audience: "ALL", evidence: before });
    markers.forEach((marker, index) => {
      const word = marker[0];
      const audience = word.includes("nam") && word.includes("nu") ? "ALL" : word === "nam" ? "MALE" : "FEMALE";
      const evidence = source.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? source.length).trim().replace(/[\/;&|]+$/, "").trim();
      if (audience !== "ALL" || evidence || !clauses.some((clause) => clause.audience === "ALL")) clauses.push({ audience, evidence });
    });
  }
  for (const clause of clauses) {
    const result = parseClause(clause.evidence, clause.audience);
    const nextAlternative = base.requirements.filter((rule) => rule.audience === clause.audience).length;
    base.requirements.push(...result.requirements.map((rule) => ({ ...rule, alternative: rule.alternative + nextAlternative })));
    base.reasons.push(...result.reasons);
    base.notes.push(...result.notes);
  }
  for (const audience of ["ALL", "MALE", "FEMALE"] as const) {
    const sameAudience = clauses.filter((clause) => clause.audience === audience);
    if (sameAudience.length > 1 && new Set(sameAudience.map((clause) => fold(clause.evidence))).size > 1) {
      const evidence = sameAudience.map((clause) => clause.evidence).join("; ");
      base.requirements = [...base.requirements.filter((rule) => rule.audience !== audience), unknown(audience, evidence)];
      base.reasons.push("CONFLICTING_AUDIENCE_REQUIREMENTS");
      base.notes.push(evidence);
    }
  }
  base.requirements = base.requirements.filter((rule, index, items) => items.findIndex((candidate) => candidate.audience === rule.audience && candidate.mode === rule.mode && candidate.minRank === rule.minRank && candidate.maxRank === rule.maxRank && candidate.minInclusive === rule.minInclusive && candidate.maxInclusive === rule.maxInclusive) === index);
  base.reasons = [...new Set(base.reasons)];
  base.notes = [...new Set(base.notes)];
  const known = base.requirements.some((requirement) => requirement.mode !== "UNKNOWN");
  const unknownRequirements = base.requirements.some((requirement) => requirement.mode === "UNKNOWN");
  base.status = known ? unknownRequirements || base.reasons.length ? "PARTIAL" : "COMPLETE" : "UNRESOLVED";
  return base;
}

export function validateSkillRequirement(rule: Omit<SkillRequirement, "evidence">): string[] {
  const errors: string[] = [];
  if (!["ALL", "MALE", "FEMALE"].includes(rule.audience)) errors.push("INVALID_AUDIENCE");
  if (!["RANGE", "UNRESTRICTED", "UNKNOWN"].includes(rule.mode)) errors.push("INVALID_MODE");
  if (!Number.isInteger(rule.alternative) || rule.alternative < 0) errors.push("INVALID_ALTERNATIVE");
  if (typeof rule.minInclusive !== "boolean" || typeof rule.maxInclusive !== "boolean") errors.push("INVALID_BOUND_INCLUSIVITY");
  if (rule.minRank !== null && !isSkillRankCode(rule.minRank) || rule.maxRank !== null && !isSkillRankCode(rule.maxRank)) errors.push("INVALID_RANK");
  if (rule.mode === "RANGE") {
    if (!rule.minRank && !rule.maxRank) errors.push("MISSING_RANGE_BOUND");
    if (isSkillRankCode(rule.minRank) && isSkillRankCode(rule.maxRank)) {
      const min = ranks.get(rule.minRank)!.order, max = ranks.get(rule.maxRank)!.order;
      if (min > max || min === max && (!rule.minInclusive || !rule.maxInclusive)) errors.push("EMPTY_OR_REVERSED_RANGE");
    }
  } else if (rule.minRank !== null || rule.maxRank !== null) errors.push("UNEXPECTED_RANGE_BOUND");
  return errors;
}

export function matchesSkillRequirement(result: SkillNormalization, query: { audience: SkillAudience; rank: SkillRankCode; includeUnknown?: boolean }): boolean {
  if (!isSkillRankCode(query.rank) || !["ALL", "MALE", "FEMALE"].includes(query.audience)) return false;
  if (query.audience === "MALE" && result.recruitmentAudience === "FEMALE_ONLY" || query.audience === "FEMALE" && result.recruitmentAudience === "MALE_ONLY") return false;
  const explicit = result.requirements.filter((rule) => rule.audience === query.audience);
  const requirements = query.audience === "ALL" ? result.requirements : explicit.length ? explicit : result.requirements.filter((rule) => rule.audience === "ALL");
  if (!requirements.length) return query.includeUnknown === true;
  const order = ranks.get(query.rank)!.order;
  return requirements.some((rule) => {
    if (validateSkillRequirement(rule).length) return false;
    if (rule.mode === "UNKNOWN") return query.includeUnknown === true;
    if (rule.mode === "UNRESTRICTED") return true;
    const min = rule.minRank ? ranks.get(rule.minRank)!.order : null;
    const max = rule.maxRank ? ranks.get(rule.maxRank)!.order : null;
    return (min === null || (rule.minInclusive ? order >= min : order > min)) && (max === null || (rule.maxInclusive ? order <= max : order < max));
  });
}

export function formatSkillRequirements(result: Pick<SkillNormalization, "status"> & { requirements: Omit<SkillRequirement, "evidence">[] }, options: {
  audienceLabels?: Partial<Record<SkillAudience, string>>; unrestrictedLabel?: string; unknownLabel?: string;
  fromLabel?: string; toLabel?: string;
} = {}): string | null {
  if (result.status === "UNRESOLVED") return null;
  const labels = { ALL: "", MALE: "Nam", FEMALE: "Nữ", ...options.audienceLabels };
  const parts = (["ALL", "MALE", "FEMALE"] as const).flatMap((audience) => {
    const values = result.requirements.filter((rule) => rule.audience === audience && !validateSkillRequirement(rule).length).map((rule) => {
      if (rule.mode === "UNKNOWN") return options.unknownLabel ?? "Chưa rõ";
      if (rule.mode === "UNRESTRICTED") return options.unrestrictedLabel ?? "Mọi trình độ";
      const min = rule.minRank ? ranks.get(rule.minRank)!.label : null;
      const max = rule.maxRank ? ranks.get(rule.maxRank)!.label : null;
      if (min && max) return min === max ? min : `${rule.minInclusive ? "" : ">"}${min}–${rule.maxInclusive ? "" : "<"}${max}`;
      return min ? `${rule.minInclusive ? "≥" : ">"} ${min}` : `${rule.maxInclusive ? "≤" : "<"} ${max}`;
    });
    return values.length ? [`${labels[audience] ? labels[audience] + ": " : ""}${[...new Set(values)].join(" / ")}`] : [];
  });
  return parts.length ? parts.join(" · ") : null;
}
