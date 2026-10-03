const DEFAULTS_URL = "./config/matching-defaults.json";
const MASTER_URL = "./data/job-tags.json";

let cache = null;

export async function loadResources() {
  if (cache) return cache;
  const responses = await Promise.all([
    fetch(MASTER_URL, { cache: "no-store" }),
    fetch(DEFAULTS_URL, { cache: "no-store" })
  ]);
  const masterRes = responses[0];
  const defaultsRes = responses[1];
  if (!masterRes.ok) throw new Error("Master load failed: " + masterRes.status);
  if (!defaultsRes.ok) throw new Error("Defaults load failed: " + defaultsRes.status);
  const values = await Promise.all([masterRes.json(), defaultsRes.json()]);
  cache = { master: values[0], defaults: values[1] };
  return cache;
}

export function normalizeText(value) {
  return String(value == null ? "" : value).normalize("NFKC").toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function charLength(value) {
  return Array.from(String(value == null ? "" : value)).length;
}

function isAsciiTokenChar(ch) {
  return !!ch && /[A-Za-z0-9_]/.test(ch);
}

function isAsciiOnly(value) {
  return /^[A-Za-z0-9_]+$/.test(value);
}

function hasAsciiTokenBoundary(text, start, length) {
  const before = start > 0 ? text[start - 1] : "";
  const after = start + length < text.length ? text[start + length] : "";
  return !isAsciiTokenChar(before) && !isAsciiTokenChar(after);
}

function findAll(text, rawNeedle, options) {
  const tokenBoundary = !!(options && options.tokenBoundary);
  const needle = normalizeText(rawNeedle);
  if (!needle) return [];
  const hits = [];
  let from = 0;
  while (from <= text.length - needle.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) break;
    if (!tokenBoundary || hasAsciiTokenBoundary(text, index, needle.length)) {
      hits.push({ start: index, end: index + needle.length, text: text.slice(index, index + needle.length) });
    }
    from = index + Math.max(1, needle.length);
  }
  return hits;
}

function addAllowanceVariants(term) {
  const out = [term];
  if (/も(?:可|OK)$/i.test(term)) return out;
  if (term.endsWith("可")) out.push(term.slice(0, -1) + "も可");
  else if (/OK$/i.test(term)) out.push(term.slice(0, -2) + "も" + term.slice(-2));
  return Array.from(new Set(out));
}

function isBaseWelcomeTerm(term) {
  return term.endsWith("歓迎") &&
    !term.endsWith("大歓迎") &&
    !term.endsWith("応募歓迎");
}

function addWelcomeApplicationVariants(tag, spec) {
  if (tag.middle_category !== "応募歓迎" || !isBaseWelcomeTerm(spec.term)) return [];

  const stem = spec.term.slice(0, -2);
  const inheritedLoose = !!spec.loose;
  const variants = [
    { term: stem + "応募歓迎", loose: inheritedLoose, variant: "application" },
    { term: stem + "応募OK", loose: inheritedLoose, variant: "application" },
    { term: stem + "も応募OK", loose: inheritedLoose, variant: "application" },
    { term: stem + "応募可", loose: true, variant: "application" },
    { term: stem + "も応募可", loose: true, variant: "application" },
    { term: stem + "応募可能", loose: true, variant: "application" },
    { term: stem + "も応募可能", loose: true, variant: "application" }
  ];

  return variants.map(function(v) {
    return Object.assign({}, spec, {
      term: v.term,
      loose: v.loose,
      generated: true,
      generatedType: v.variant
    });
  });
}

function exclusionRanges(text, tag) {
  return (tag.exclude_terms || []).flatMap(function(term) {
    return findAll(text, term).map(function(hit) {
      return Object.assign({}, hit, { term: term });
    });
  });
}

function isLocallyExcluded(hit, exclusions) {
  return exclusions.some(function(ex) {
    return hit.start >= ex.start && hit.end <= ex.end;
  });
}

function contextSnippet(text, start, end, radius) {
  const r = radius == null ? 36 : radius;
  return text.slice(Math.max(0, start - r), Math.min(text.length, end + r));
}

function hasLocationContext(text, hit, term) {
  const before = text.slice(Math.max(0, hit.start - 28), hit.start);
  const after = text.slice(hit.end, Math.min(text.length, hit.end + 28));
  const local = contextSnippet(text, hit.start, hit.end, 40);
  const escaped = escapeRegExp(normalizeText(term));

  if (/(勤務地|勤務先|就業場所|配属先|職場)(?:\s|[:：=＝、はが])*$/u.test(before)) return true;
  if (/^(?:内)?(?:で|にて)?(?:の)?(?:勤務|就業|配属)/u.test(after)) return true;
  if (/^(?:勤務|勤務です|勤務となります)/u.test(after)) return true;

  const relation = new RegExp("(?:勤務地|勤務先|就業場所|配属先|職場)(?:\\s|[:：=＝、はが]){0,4}[^。\\n]{0,18}" + escaped, "u");
  return relation.test(local);
}

function classifyContext(tag, text, hit, term) {
  const c = normalizeText(tag.canonical);
  const local = contextSnippet(text, hit.start, hit.end, 42);

  if (tag.middle_category === "就業場所") {
    if (hasLocationContext(text, hit, term)) return { decision: "matched", reason: "就業場所を示す文脈を確認" };
    return { decision: "review", reason: "施設・場所名のみでは就業場所と確定できない" };
  }
  if (c === "採用") {
    if (/(採用業務|採用活動|採用担当|人材採用|新卒採用|中途採用|採用実務)/u.test(local)) return { decision: "matched", reason: "採用業務の文脈を確認" };
    return { decision: "review", reason: "採用人数・募集文脈などとの区別が必要" };
  }
  if (c === "介護") {
    if (/(介護業務|介護職|介護スタッフ|介護経験|介護サービス|介護を担当)/u.test(local)) return { decision: "matched", reason: "介護業務・経験の文脈を確認" };
    return { decision: "review", reason: "介護休暇・施設名などとの区別が必要" };
  }
  if (c === "認証") {
    if (/(認証基盤|認証設計|認証機能|認証システム|ユーザー認証|多要素認証|oauth|saml|sso|認証api)/iu.test(local)) return { decision: "matched", reason: "IT・セキュリティの認証文脈を確認" };
    return { decision: "review", reason: "ITスキルとしての認証か確認が必要" };
  }
  if (c === "候補") {
    if (/(店長候補|管理者候補|責任者候補|管理職候補|幹部候補|リーダー候補|マネージャー候補|所長候補)/u.test(local)) return { decision: "matched", reason: "役割・キャリア候補の文脈を確認" };
    return { decision: "review", reason: "候補者など一般語との区別が必要" };
  }
  return { decision: "review", reason: "context policyのため周辺文脈確認が必要" };
}

function parseJpy(numberText, unit) {
  const n = Number(String(numberText).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (unit === "万円" || unit === "万") return n * 10000;
  return n;
}

function patternMatches(tag, text) {
  const c = tag.canonical;
  const evidence = [];

  if (c === "固定給25万円以上" || c === "固定給35万円以上") {
    const threshold = c.includes("35") ? 350000 : 250000;
    const re = /固定給(?:制)?(?:\s|[:：]|は|が|月額|[()（）]){0,10}(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)\s*(万円|万|円)/g;
    for (const m of text.matchAll(re)) {
      const value = parseJpy(m[1], m[2]);
      if (value !== null && value >= threshold) evidence.push({ start:m.index, end:m.index+m[0].length, text:m[0], reason:"固定給 " + value.toLocaleString() + "円 >= " + threshold.toLocaleString() + "円" });
    }
  }

  if (c === "年間休日120日以上") {
    const re = /(?:年間休日|年休)[^\d\n]{0,8}?(\d{2,3})\s*日/g;
    for (const m of text.matchAll(re)) {
      const value = Number(m[1]);
      if (value >= 120) evidence.push({ start:m.index, end:m.index+m[0].length, text:m[0], reason:"年間休日 " + value + "日 >= 120日" });
    }
  }

  if (c === "残業月平均20時間以上" || c === "残業月平均20時間以内") {
    const re = /(?:残業|時間外(?:労働|勤務)?)[^\d\n。]{0,30}?(\d+(?:\.\d+)?)\s*(?:時間|h)(?:\s*\/\s*月)?/gi;
    for (const m of text.matchAll(re)) {
      const local = text.slice(Math.max(0,m.index-12), Math.min(text.length,m.index+m[0].length+8));
      if (!/(月|\/\s*月)/.test(local)) continue;
      const value = Number(m[1]);
      const ok = c.endsWith("以上") ? value >= 20 : value <= 20;
      if (ok) evidence.push({ start:m.index, end:m.index+m[0].length, text:m[0], reason:"月平均残業 " + value + "時間" });
    }
  }

  if (c === "1日4時間以内OK") {
    const re = /1日(?:の)?(?:実働)?[^\d\n]{0,8}(\d+(?:\.\d+)?)\s*(?:時間|h)(?:以内|まで)/gi;
    for (const m of text.matchAll(re)) {
      const value = Number(m[1]);
      if (value <= 4) evidence.push({ start:m.index, end:m.index+m[0].length, text:m[0], reason:"1日 " + value + "時間 <= 4時間" });
    }
  }

  if (c === "駅近5分以内") {
    const re = /(?:最寄(?:り)?駅|[一-龠ぁ-んァ-ヶA-Za-z0-9・ー]+駅)(?:から|より)?[^\n\d]{0,8}徒歩\s*(\d+(?:\.\d+)?)\s*分/g;
    for (const m of text.matchAll(re)) {
      const value = Number(m[1]);
      if (value <= 5) evidence.push({ start:m.index, end:m.index+m[0].length, text:m[0], reason:"駅徒歩 " + value + "分 <= 5分" });
    }
  }

  return evidence;
}

function buildTermSpecs(tag) {
  const specs = [{ term: tag.canonical, source: "canonical", loose: false }];
  for (const term of tag.alias_strict || []) specs.push({ term: term, source: "strict", loose: false });
  for (const term of tag.alias_loose || []) specs.push({ term: term, source: "loose", loose: true });

  const expanded = [];
  for (const spec of specs) {
    const allowanceVariants = addAllowanceVariants(spec.term);
    for (const term of allowanceVariants) {
      expanded.push(Object.assign({}, spec, {
        term: term,
        generated: term !== spec.term,
        generatedType: term !== spec.term ? "allowance" : null
      }));
    }

    for (const applicationSpec of addWelcomeApplicationVariants(tag, spec)) {
      expanded.push(applicationSpec);
    }
  }

  const seen = new Set();
  return expanded.filter(function(spec) {
    const key = normalizeText(spec.term) + "|" + (spec.loose ? "loose" : "strict");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyzeText(sourceText, master, defaults) {
  const text = normalizeText(sourceText);
  const results = [];

  for (const tag of master.tags || []) {
    const exclusions = exclusionRanges(text, tag);
    const evidences = [];

    if (tag.match_policy === "pattern") {
      for (const hit of patternMatches(tag, text)) {
        evidences.push({ decision:"matched", source:"pattern", term:tag.canonical, hitText:hit.text, start:hit.start, end:hit.end, reason:hit.reason });
      }
    }

    for (const spec of buildTermSpecs(tag)) {
      const normalizedTerm = normalizeText(spec.term);
      const ascii = isAsciiOnly(normalizedTerm);
      const tokenBoundary = ascii && (tag.match_policy === "token_exact" || charLength(normalizedTerm) <= 3);

      for (const hit of findAll(text, spec.term, { tokenBoundary: tokenBoundary })) {
        if (isLocallyExcluded(hit, exclusions)) {
          evidences.push({ decision:"suppressed", source:spec.source, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:"除外語の出現範囲内" });
          continue;
        }
        if (spec.loose) {
          const looseSource = spec.generatedType === "application" ? "generated_application" : "loose";
          const looseReason = spec.generatedType === "application"
            ? "応募表現variant（要確認）"
            : (tokenBoundary ? "loose alias（トークン境界一致）" : "loose alias");
          evidences.push({ decision:"review", source:looseSource, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:looseReason });
          continue;
        }
        if (tag.match_policy === "context") {
          const ctx = classifyContext(tag, text, hit, spec.term);
          evidences.push({ decision:ctx.decision, source:spec.source, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:ctx.reason });
          continue;
        }
        if (tag.match_policy === "pattern" && spec.source === "canonical") {
          evidences.push({ decision:"matched", source:spec.source, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:"patternタグのcanonical明示" });
          continue;
        }
        const matchedSource = spec.generatedType === "application"
          ? "generated_application"
          : (spec.generated ? "generated_variant" : spec.source);
        const matchedReason = spec.generatedType === "application"
          ? "応募表現variant"
          : (tokenBoundary ? "ASCIIトークン境界一致" : "文字列一致");
        evidences.push({ decision:"matched", source:matchedSource, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:matchedReason });
      }
    }

    if (!evidences.length) continue;
    const rank = { matched:3, review:2, suppressed:1 };
    let decision = "suppressed";
    for (const e of evidences) if (rank[e.decision] > rank[decision]) decision = e.decision;
    const primary = evidences.find(function(e){ return e.decision === decision; }) || evidences[0];

    results.push({
      decision:decision,
      tag_code:tag.tag_code,
      canonical:tag.canonical,
      job_tag:tag.job_tag,
      major_category:tag.major_category,
      middle_category:tag.middle_category,
      match_policy:tag.match_policy,
      hit_text:primary.hitText,
      hit_source:primary.source,
      reason:primary.reason,
      context:contextSnippet(text, primary.start, primary.end, 50),
      evidences:evidences
    });
  }

  const order = { matched:0, review:1, suppressed:2 };
  results.sort(function(a,b) {
    return order[a.decision]-order[b.decision] ||
      a.major_category.localeCompare(b.major_category,"ja") ||
      a.middle_category.localeCompare(b.middle_category,"ja") ||
      a.canonical.localeCompare(b.canonical,"ja");
  });

  return {
    results:results,
    matched:results.filter(function(r){return r.decision==="matched";}),
    review:results.filter(function(r){return r.decision==="review";}),
    suppressed:results.filter(function(r){return r.decision==="suppressed";}),
    confirmedCodes:results.filter(function(r){return r.decision==="matched";}).map(function(r){return r.tag_code;}),
    reviewCodes:results.filter(function(r){return r.decision==="review";}).map(function(r){return r.tag_code;})
  };
}

export async function analyze(sourceText) {
  const resources = await loadResources();
  return analyzeText(sourceText, resources.master, resources.defaults);
}
