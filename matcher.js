const DEFAULTS_URL = "./config/matching-defaults.json";
const MASTER_URL = "./data/job-tags.json";
const LOCATION_ENTITIES_URL = "./data/location-entities.json";

let cache = null;

export async function loadResources() {
  if (cache) return cache;
  const responses = await Promise.all([
    fetch(MASTER_URL, { cache: "no-store" }),
    fetch(DEFAULTS_URL, { cache: "no-store" }),
    fetch(LOCATION_ENTITIES_URL, { cache: "no-store" })
  ]);
  const masterRes = responses[0];
  const defaultsRes = responses[1];
  const entitiesRes = responses[2];
  if (!masterRes.ok) throw new Error("Master load failed: " + masterRes.status);
  if (!defaultsRes.ok) throw new Error("Defaults load failed: " + defaultsRes.status);
  if (!entitiesRes.ok) throw new Error("Location entities load failed: " + entitiesRes.status);
  const values = await Promise.all([masterRes.json(), defaultsRes.json(), entitiesRes.json()]);
  cache = { master: values[0], defaults: values[1], entities: values[2] };
  cache.compiled = compileMatcher(cache.master, cache.defaults, cache.entities);
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

function hasSemanticSuffixBoundary(text, start, length) {
  const after = start + length < text.length ? text[start + length] : "";
  if (!after) return true;
  return /[\s、。・,.;:：；!！?？/／\\|｜()（）\[\]【】「」『』<>＜＞=＝+＋\-—–]/u.test(after);
}

function findAllNormalized(text, needle, options) {
  const tokenBoundary = !!(options && options.tokenBoundary);
  const semanticSuffixBoundary = !!(options && options.semanticSuffixBoundary);
  if (!needle) return [];
  const hits = [];
  let from = 0;
  while (from <= text.length - needle.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) break;
    const tokenOk = !tokenBoundary || hasAsciiTokenBoundary(text, index, needle.length);
    const suffixOk = !semanticSuffixBoundary || hasSemanticSuffixBoundary(text, index, needle.length);
    if (tokenOk && suffixOk) {
      hits.push({ start: index, end: index + needle.length, text: text.slice(index, index + needle.length) });
    }
    from = index + Math.max(1, needle.length);
  }
  return hits;
}

function findAll(text, rawNeedle, options) {
  return findAllNormalized(text, normalizeText(rawNeedle), options);
}

function addAllowanceVariants(term) {
  const out = [term];
  if (/も(?:可|OK)$/i.test(term)) return out;
  if (term.endsWith("可")) out.push(term.slice(0, -1) + "も可");
  else if (/OK$/i.test(term)) out.push(term.slice(0, -2) + "も" + term.slice(-2));
  return Array.from(new Set(out));
}

function addPresenceAbsenceVariants(spec) {
  const term = spec.term;
  const out = [];

  function pushVariant(nextTerm, shortKanji) {
    if (!nextTerm || nextTerm === term) return;
    out.push(Object.assign({}, spec, {
      term: nextTerm,
      generated: true,
      generatedType: "presence_absence",
      semanticSuffixBoundary: !!shortKanji
    }));
  }

  if (term.endsWith("なし") || term.endsWith("無し") || term.endsWith("ナシ")) {
    const stem = term.slice(0, -2);
    pushVariant(stem + "なし", false);
    pushVariant(stem + "無し", false);
    pushVariant(stem + "ナシ", false);
    pushVariant(stem + "無", true);
  }

  if (term.endsWith("あり") || term.endsWith("有り") || term.endsWith("アリ")) {
    const stem = term.slice(0, -2);
    pushVariant(stem + "あり", false);
    pushVariant(stem + "有り", false);
    pushVariant(stem + "アリ", false);
    pushVariant(stem + "有", true);
  }

  return out;
}

function addActivityVariants(tag, spec) {
  if (!tag.canonical.endsWith("活躍中") || !spec.term.endsWith("活躍中")) return [];

  const stem = spec.term.slice(0, -3);
  return [
    Object.assign({}, spec, {
      term: stem + "活躍",
      generated: true,
      generatedType: "activity",
      loose: !!spec.loose
    }),
    Object.assign({}, spec, {
      term: stem + "在籍",
      generated: true,
      generatedType: "presence_review",
      loose: true
    })
  ];
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

function normalizeFieldName(value) {
  return String(value == null ? "" : value).trim();
}

function locationFieldGroup(fieldName, defaults) {
  if (!fieldName) return "unknown";
  const groups = defaults && defaults.location_matching && defaults.location_matching.field_groups;
  if (!groups) return "unknown";
  for (const group of Object.keys(groups)) {
    if ((groups[group] || []).includes(fieldName)) return group;
  }
  return "unknown";
}

function fieldInfoForHit(fieldRanges, hit, defaults) {
  if (!fieldRanges || !fieldRanges.length) return { name:null, group:"unknown" };
  const range = fieldRanges.find(function(r) {
    return hit.start >= r.start && hit.end <= r.end;
  });
  if (!range) return { name:null, group:"unknown" };
  return { name:range.name, group:locationFieldGroup(range.name, defaults) };
}

function hasLocationMobilityContext(text, hit) {
  const after = text.slice(hit.end, Math.min(text.length, hit.end + 40));
  if (/^\s*(?:から|より)[^。\n]{0,28}(?:運ぶ|運び|運搬|配送|配達|集荷|出発|積み込|積込)/u.test(after)) return true;
  if (/^\s*(?:へ|に)[^。\n]{0,28}(?:配送|配達|納品|集荷|訪問|送迎|戻る|戻り|帰る|帰着)/u.test(after)) return true;
  if (/^\s*を[^。\n]{0,22}(?:訪問|巡回)/u.test(after)) return true;
  return false;
}

function hasPositiveLocationContext(text, hit) {
  const after = text.slice(hit.end, Math.min(text.length, hit.end + 30));
  if (/^\s*(?:内(?:で|にて)|で|にて)/u.test(after)) return true;
  if (/^\s*(?:で|に|へ)?(?:勤務|就業|配属)/u.test(after)) return true;
  if (/^\s*(?:勤務|就業)(?:です|となります|する|します|予定|$)/u.test(after)) return true;
  return false;
}

function seaPatternMatches(text) {
  const patterns = [
    /海の家/gu,
    /海辺/gu,
    /海沿い/gu,
    /海(?:で|にて)(?:の)?(?:勤務|仕事|作業|業務)?/gu,
    /ビーチ(?:スタッフ|業務|勤務|施設|リゾート)?/gu,
    /マリン(?:レジャー|スポーツ|スタッフ|業務|施設)/gu,
    /海上(?:作業|業務|勤務|スタッフ)/gu
  ];
  const hits = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      hits.push({ start:m.index, end:m.index + m[0].length, text:m[0] });
    }
  }
  return hits;
}

function classifyLocationContext(tag, text, hit, term, fieldInfo) {
  const group = fieldInfo && fieldInfo.group ? fieldInfo.group : "unknown";
  const mobility = hasLocationMobilityContext(text, hit);
  const positive = hasPositiveLocationContext(text, hit);

  if (group === "primary" || group === "identity") {
    return { decision:"matched", reason:"就業場所を強く示すフィールドで一致" };
  }

  if (group === "weak") {
    return { decision:"review", reason:"住所・交通・選考等の弱いフィールドでの一致" };
  }

  if (mobility) {
    return { decision:"review", reason:"配送・納品・訪問・移動先等の可能性があるため要確認" };
  }

  if (group === "description") {
    if (positive) return { decision:"matched", reason:"仕事内容内の就業場所文脈を確認" };
    if (tag.difficulty === "低") return { decision:"matched", reason:"仕事内容内で明示的な施設・業態名を確認" };
    return { decision:"review", reason:"仕事内容内の場所名だが就業関係の確認が必要" };
  }

  if (group === "support") {
    if (positive) return { decision:"matched", reason:"補助フィールド内で就業場所文脈を確認" };
    return { decision:"review", reason:"補助フィールド内の場所名のため要確認" };
  }

  if (hasLocationContext(text, hit, term) || positive) {
    return { decision:"matched", reason:"就業場所を示す文脈を確認" };
  }
  return { decision:"review", reason:"施設・場所名のみでは就業関係の確認が必要" };
}

function classifyContext(tag, text, hit, term, fieldInfo) {
  const c = normalizeText(tag.canonical);
  const local = contextSnippet(text, hit.start, hit.end, 42);

  if (tag.middle_category === "就業場所") {
    return classifyLocationContext(tag, text, hit, term, fieldInfo);
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

    for (const presenceSpec of addPresenceAbsenceVariants(spec)) {
      expanded.push(presenceSpec);
    }

    for (const activitySpec of addActivityVariants(tag, spec)) {
      expanded.push(activitySpec);
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



function hasEntityPositiveLocationContext(text, hit) {
  if (hasPositiveLocationContext(text, hit)) return true;
  const after = text.slice(hit.end, Math.min(text.length, hit.end + 36));
  return /^(?:[^。\n]{0,16}(?:店|店舗|支店|空港|パーク|ランド|館|センター))?(?:内)?(?:で|にて|勤務|配属)/u.test(after);
}

function hasEntityIndirectContext(text, hit) {
  const after = text.slice(hit.end, Math.min(text.length, hit.end + 32));
  return /^\s*(?:向け|用|の(?:商品|製品|資材|案件|システム))/u.test(after);
}

function classifyEntityLocationContext(tag, text, hit, fieldInfo, entity) {
  const group = fieldInfo && fieldInfo.group ? fieldInfo.group : "unknown";
  const mobility = hasLocationMobilityContext(text, hit);
  const indirect = hasEntityIndirectContext(text, hit);
  const positive = hasEntityPositiveLocationContext(text, hit);

  if (group === "primary") {
    return { decision:"matched", reason:"固有名詞を勤務場所フィールドで確認" };
  }
  if (group === "identity") {
    if (mobility || indirect) return { decision:"review", reason:"仕事名内の固有名詞だが顧客・納品先等の可能性がある" };
    return { decision:"matched", reason:"固有名詞を仕事名で確認" };
  }
  if (group === "weak") {
    return { decision:"review", reason:"固有名詞が住所・交通・選考等の弱いフィールドに出現" };
  }
  if (mobility || indirect) {
    return { decision:"review", reason:"固有名詞は確認できるが顧客・配送・納品・訪問・移動先等の可能性がある" };
  }
  if (group === "description") {
    if (positive) return { decision:"matched", reason:"仕事内容内で固有名詞と就業場所文脈を確認" };
    return { decision:"review", reason:"仕事内容内の固有名詞だが就業場所としての関係確認が必要" };
  }
  if (group === "support") {
    return { decision:"review", reason:"補助フィールド内の固有名詞のため要確認" };
  }
  if (positive) {
    return { decision:"matched", reason:"固有名詞と就業場所を示す文脈を確認" };
  }
  return { decision:"review", reason:"固有名詞は確認できるが就業場所としての関係確認が必要" };
}

function compileEntityTerms(master, entities) {
  const out = [];
  if (!entities || !Array.isArray(entities.entities)) return out;

  const tagByCanonical = new Map((master.tags || []).map(function(tag) {
    return [tag.canonical, tag];
  }));

  for (const entity of entities.entities) {
    const targets = (entity.maps_to || [])
      .map(function(canonical) { return tagByCanonical.get(canonical); })
      .filter(function(tag) { return tag && tag.middle_category === "就業場所"; });
    if (!targets.length) continue;

    for (const rawTerm of [entity.canonical_entity].concat(entity.aliases || [])) {
      const normalizedTerm = normalizeText(rawTerm);
      if (!normalizedTerm) continue;
      out.push({
        rawTerm:rawTerm,
        normalizedTerm:normalizedTerm,
        tokenBoundary:isAsciiOnly(normalizedTerm),
        entity:entity,
        targets:targets
      });
    }
  }
  return out;
}

function buildLocationEntityEvidence(text, master, defaults, fieldRanges, entities, runtime) {
  const out = new Map();
  const preparedTerms = runtime && runtime.entityTerms
    ? runtime.entityTerms
    : compileEntityTerms(master, entities);

  for (const prepared of preparedTerms) {
    for (const hit of findAllNormalized(text, prepared.normalizedTerm, { tokenBoundary:prepared.tokenBoundary })) {
      const fieldInfo = fieldInfoForHit(fieldRanges, hit, defaults);

      for (const tag of prepared.targets) {
        const ctx = classifyEntityLocationContext(tag, text, hit, fieldInfo, prepared.entity);
        const evidence = {
          decision:ctx.decision,
          source:"entity",
          term:prepared.rawTerm,
          hitText:hit.text,
          start:hit.start,
          end:hit.end,
          reason:ctx.reason,
          fieldName:fieldInfo.name,
          fieldGroup:fieldInfo.group,
          entityCanonical:prepared.entity.canonical_entity,
          entityKind:prepared.entity.kind || null
        };
        if (!out.has(tag.canonical)) out.set(tag.canonical, []);
        out.get(tag.canonical).push(evidence);
      }
    }
  }

  return out;
}

function applyLocationImplications(results, master, defaults, runtime) {
  const implications = defaults && defaults.location_matching && defaults.location_matching.implications;
  if (!implications) return;

  const tagByCanonical = runtime && runtime.tagByCanonical
    ? runtime.tagByCanonical
    : new Map((master.tags || []).map(function(tag) {
        return [tag.canonical, tag];
      }));
  const resultByCanonical = new Map(results.map(function(result) {
    return [result.canonical, result];
  }));

  let changed = true;
  while (changed) {
    changed = false;
    const matchedSnapshot = results.filter(function(result) {
      return result.decision === "matched";
    });

    for (const child of matchedSnapshot) {
      const parents = implications[child.canonical] || [];
      for (const parentCanonical of parents) {
        const parentTag = tagByCanonical.get(parentCanonical);
        if (!parentTag) continue;

        const evidence = {
          decision:"matched",
          source:"implication",
          term:child.canonical,
          hitText:child.hit_text,
          start:0,
          end:0,
          reason:child.canonical + " の明示的な包含関係から派生",
          fieldName:child.field_name || null,
          fieldGroup:child.field_group || null
        };

        const existing = resultByCanonical.get(parentCanonical);
        if (existing) {
          if (existing.decision !== "matched") {
            existing.decision = "matched";
            existing.hit_text = child.hit_text;
            existing.hit_source = "implication";
            existing.reason = evidence.reason;
            existing.context = child.context;
            existing.field_name = child.field_name || null;
            existing.field_group = child.field_group || null;
            existing.evidences = (existing.evidences || []).concat([evidence]);
            changed = true;
          }
          continue;
        }

        const derived = {
          decision:"matched",
          tag_code:parentTag.tag_code,
          canonical:parentTag.canonical,
          job_tag:parentTag.job_tag,
          major_category:parentTag.major_category,
          middle_category:parentTag.middle_category,
          match_policy:parentTag.match_policy,
          hit_text:child.hit_text,
          hit_source:"implication",
          reason:evidence.reason,
          context:child.context,
          field_name:child.field_name || null,
          field_group:child.field_group || null,
          implied_by:child.canonical,
          evidences:[evidence]
        };
        results.push(derived);
        resultByCanonical.set(parentCanonical, derived);
        changed = true;
      }
    }
  }
}

function nowMs() {
  if (typeof performance !== "undefined" && performance && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function compileTagRuntime(tag) {
  const specs = buildTermSpecs(tag).map(function(spec) {
    const normalizedTerm = normalizeText(spec.term);
    return Object.assign({}, spec, {
      normalizedTerm:normalizedTerm,
      tokenBoundary:isAsciiOnly(normalizedTerm) &&
        (tag.match_policy === "token_exact" || charLength(normalizedTerm) <= 3)
    });
  });

  const excludeTerms = (tag.exclude_terms || []).map(function(term) {
    return { rawTerm:term, normalizedTerm:normalizeText(term) };
  });

  return {
    tag:tag,
    specs:specs,
    excludeTerms:excludeTerms,
    isSea:tag.middle_category === "就業場所" && normalizeText(tag.canonical) === "海"
  };
}

function buildCandidateIndex(runtimeTags) {
  const termOwners = new Map();

  runtimeTags.forEach(function(runtimeTag, tagIndex) {
    for (const spec of runtimeTag.specs || []) {
      const term = spec.normalizedTerm;
      if (!term) continue;
      if (!termOwners.has(term)) termOwners.set(term, new Set());
      termOwners.get(term).add(tagIndex);
    }
  });

  const nodes = [{ next:new Map(), fail:0, outputs:[] }];

  for (const [term, owners] of termOwners.entries()) {
    let state = 0;
    for (let i = 0; i < term.length; i++) {
      const ch = term[i];
      let nextState = nodes[state].next.get(ch);
      if (nextState == null) {
        nextState = nodes.length;
        nodes[state].next.set(ch, nextState);
        nodes.push({ next:new Map(), fail:0, outputs:[] });
      }
      state = nextState;
    }
    nodes[state].outputs.push.apply(nodes[state].outputs, Array.from(owners));
  }

  const queue = [];
  for (const nextState of nodes[0].next.values()) {
    nodes[nextState].fail = 0;
    queue.push(nextState);
  }

  let head = 0;
  while (head < queue.length) {
    const state = queue[head++];
    for (const [ch, nextState] of nodes[state].next.entries()) {
      queue.push(nextState);
      let fallback = nodes[state].fail;
      while (fallback && !nodes[fallback].next.has(ch)) {
        fallback = nodes[fallback].fail;
      }
      const fallbackNext = nodes[fallback].next.get(ch);
      nodes[nextState].fail = fallbackNext == null ? 0 : fallbackNext;
      if (nodes[nodes[nextState].fail].outputs.length) {
        nodes[nextState].outputs = nodes[nextState].outputs.concat(
          nodes[nodes[nextState].fail].outputs
        );
      }
    }
  }

  return {
    nodes:nodes,
    uniqueTermCount:termOwners.size
  };
}

function collectCandidateTagIndexes(text, candidateIndex, alwaysTagIndexes) {
  const candidates = new Set(alwaysTagIndexes || []);
  if (!candidateIndex || !candidateIndex.nodes || !candidateIndex.nodes.length || !text) {
    return candidates;
  }

  const nodes = candidateIndex.nodes;
  let state = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    while (state && !nodes[state].next.has(ch)) {
      state = nodes[state].fail;
    }

    const nextState = nodes[state].next.get(ch);
    state = nextState == null ? 0 : nextState;

    const outputs = nodes[state].outputs;
    for (let j = 0; j < outputs.length; j++) {
      candidates.add(outputs[j]);
    }
  }

  return candidates;
}

function compileRuntime(master, defaults, entities) {
  const started = nowMs();
  const tags = (master.tags || []).map(compileTagRuntime);
  const tagByCanonical = new Map((master.tags || []).map(function(tag) {
    return [tag.canonical, tag];
  }));
  const tagIndexByCanonical = new Map(tags.map(function(runtimeTag, index) {
    return [runtimeTag.tag.canonical, index];
  }));
  const entityTerms = compileEntityTerms(master, entities);
  const candidateIndex = buildCandidateIndex(tags);
  const alwaysTagIndexes = [];

  tags.forEach(function(runtimeTag, index) {
    if (runtimeTag.isSea || runtimeTag.tag.match_policy === "pattern") {
      alwaysTagIndexes.push(index);
    }
  });

  return {
    master:master,
    defaults:defaults,
    entities:entities,
    tags:tags,
    tagByCanonical:tagByCanonical,
    tagIndexByCanonical:tagIndexByCanonical,
    entityTerms:entityTerms,
    candidateIndex:candidateIndex,
    alwaysTagIndexes:alwaysTagIndexes,
    stats:{
      tagCount:tags.length,
      termCount:tags.reduce(function(sum, item) { return sum + item.specs.length; }, 0),
      uniqueIndexedTermCount:candidateIndex.uniqueTermCount,
      indexNodeCount:candidateIndex.nodes.length,
      alwaysTagCount:alwaysTagIndexes.length,
      excludeTermCount:tags.reduce(function(sum, item) { return sum + item.excludeTerms.length; }, 0),
      entityTermCount:entityTerms.length,
      compileMs:nowMs() - started
    }
  };
}

function exclusionRangesPrepared(text, prepared) {
  if (!prepared || !prepared.length) return [];
  const out = [];
  for (const item of prepared) {
    for (const hit of findAllNormalized(text, item.normalizedTerm)) {
      out.push(Object.assign({}, hit, { term:item.rawTerm }));
    }
  }
  return out;
}

function normalizeFieldsInput(fields) {
  const chunks = [];
  const ranges = [];
  let cursor = 0;

  for (const field of fields || []) {
    const value = normalizeText(field && field.value);
    if (!value) continue;
    if (chunks.length) {
      chunks.push("\n");
      cursor += 1;
    }
    const start = cursor;
    chunks.push(value);
    cursor += value.length;
    ranges.push({
      name:normalizeFieldName(field && field.name),
      start:start,
      end:cursor
    });
  }

  return { text:chunks.join(""), ranges:ranges };
}

function analyzeNormalized(text, master, defaults, fieldRanges, entities, runtime, options) {
  const profileEnabled = !!(options && options.profile);
  const profile = profileEnabled ? {
    entityMs:0,
    candidateMs:0,
    candidateTagCount:0,
    tagScanMs:0,
    implicationMs:0,
    sortMs:0,
    totalMs:0
  } : null;
  const totalStarted = profileEnabled ? nowMs() : 0;

  const results = [];
  const entityStarted = profileEnabled ? nowMs() : 0;
  const entityEvidenceByCanonical = buildLocationEntityEvidence(text, master, defaults, fieldRanges, entities, runtime);
  if (profileEnabled) profile.entityMs = nowMs() - entityStarted;

  const candidateStarted = profileEnabled ? nowMs() : 0;
  let runtimeTags;

  if (runtime && runtime.tags && runtime.candidateIndex) {
    const candidateIndexes = collectCandidateTagIndexes(
      text,
      runtime.candidateIndex,
      runtime.alwaysTagIndexes
    );

    for (const canonical of entityEvidenceByCanonical.keys()) {
      const tagIndex = runtime.tagIndexByCanonical.get(canonical);
      if (tagIndex != null) candidateIndexes.add(tagIndex);
    }

    const orderedIndexes = Array.from(candidateIndexes).sort(function(a,b) { return a-b; });
    runtimeTags = orderedIndexes.map(function(index) { return runtime.tags[index]; });

    if (profileEnabled) profile.candidateTagCount = runtimeTags.length;
  } else {
    runtimeTags = master.tags || [];
    runtimeTags = runtimeTags.map(compileTagRuntime);
    if (profileEnabled) profile.candidateTagCount = runtimeTags.length;
  }

  if (profileEnabled) profile.candidateMs = nowMs() - candidateStarted;
  const scanStarted = profileEnabled ? nowMs() : 0;

  for (const runtimeTag of runtimeTags) {
    const tag = runtimeTag.tag;
    const exclusions = runtime
      ? exclusionRangesPrepared(text, runtimeTag.excludeTerms)
      : exclusionRanges(text, tag);
    const evidences = (entityEvidenceByCanonical.get(tag.canonical) || []).slice();

    if (tag.match_policy === "pattern") {
      for (const hit of patternMatches(tag, text)) {
        evidences.push({ decision:"matched", source:"pattern", term:tag.canonical, hitText:hit.text, start:hit.start, end:hit.end, reason:hit.reason });
      }
    }

    if (runtimeTag.isSea) {
      for (const hit of seaPatternMatches(text)) {
        const fieldInfo = fieldInfoForHit(fieldRanges, hit, defaults);
        let decision = "matched";
        let reason = "海が仕事環境として意味を持つ表現を確認";
        if (fieldInfo.group === "weak") {
          decision = "review";
          reason = "住所・交通等の弱いフィールド内の海関連表現";
        } else if (fieldInfo.group === "support") {
          decision = "review";
          reason = "補助フィールド内の海関連表現";
        }
        evidences.push({ decision:decision, source:"semantic_pattern", term:tag.canonical, hitText:hit.text, start:hit.start, end:hit.end, reason:reason, fieldName:fieldInfo.name, fieldGroup:fieldInfo.group });
      }
    } else for (const spec of runtimeTag.specs) {
      const tokenBoundary = spec.tokenBoundary;

      for (const hit of findAllNormalized(text, spec.normalizedTerm, {
        tokenBoundary: tokenBoundary,
        semanticSuffixBoundary: !!spec.semanticSuffixBoundary
      })) {
        if (isLocallyExcluded(hit, exclusions)) {
          evidences.push({ decision:"suppressed", source:spec.source, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:"除外語の出現範囲内" });
          continue;
        }
        if (spec.loose) {
          const looseSource = spec.generatedType === "application"
            ? "generated_application"
            : (spec.generatedType === "presence_review" ? "generated_presence" : "loose");
          const looseReason = spec.generatedType === "application"
            ? "応募表現variant（要確認）"
            : (spec.generatedType === "presence_review"
              ? "在籍表現variant（要確認）"
              : (tokenBoundary ? "loose alias（トークン境界一致）" : "loose alias"));
          evidences.push({ decision:"review", source:looseSource, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:looseReason });
          continue;
        }
        if (tag.match_policy === "context") {
          const fieldInfo = fieldInfoForHit(fieldRanges, hit, defaults);
          const ctx = classifyContext(tag, text, hit, spec.term, fieldInfo);
          evidences.push({ decision:ctx.decision, source:spec.source, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:ctx.reason, fieldName:fieldInfo.name, fieldGroup:fieldInfo.group });
          continue;
        }
        if (tag.match_policy === "pattern" && spec.source === "canonical") {
          evidences.push({ decision:"matched", source:spec.source, term:spec.term, hitText:hit.text, start:hit.start, end:hit.end, reason:"patternタグのcanonical明示" });
          continue;
        }
        const matchedSource = spec.generatedType === "application"
          ? "generated_application"
          : (spec.generatedType === "presence_absence"
            ? "generated_presence_absence"
            : (spec.generatedType === "activity"
              ? "generated_activity"
              : (spec.generated ? "generated_variant" : spec.source)));
        const matchedReason = spec.generatedType === "application"
          ? "応募表現variant"
          : (spec.generatedType === "presence_absence"
            ? "あり・なし表記variant"
            : (spec.generatedType === "activity"
              ? "活躍表現variant"
              : (tokenBoundary ? "ASCIIトークン境界一致" : "文字列一致")));
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
      field_name:primary.fieldName || null,
      field_group:primary.fieldGroup || null,
      entity_name:primary.entityCanonical || null,
      evidences:evidences
    });
  }

  if (profileEnabled) profile.tagScanMs = nowMs() - scanStarted;

  const implicationStarted = profileEnabled ? nowMs() : 0;
  applyLocationImplications(results, master, defaults, runtime);
  if (profileEnabled) profile.implicationMs = nowMs() - implicationStarted;

  const sortStarted = profileEnabled ? nowMs() : 0;
  const order = { matched:0, review:1, suppressed:2 };
  results.sort(function(a,b) {
    return order[a.decision]-order[b.decision] ||
      a.major_category.localeCompare(b.major_category,"ja") ||
      a.middle_category.localeCompare(b.middle_category,"ja") ||
      a.canonical.localeCompare(b.canonical,"ja");
  });
  if (profileEnabled) {
    profile.sortMs = nowMs() - sortStarted;
    profile.totalMs = nowMs() - totalStarted;
  }

  return {
    results:results,
    matched:results.filter(function(r){return r.decision==="matched";}),
    review:results.filter(function(r){return r.decision==="review";}),
    suppressed:results.filter(function(r){return r.decision==="suppressed";}),
    confirmedCodes:results.filter(function(r){return r.decision==="matched";}).map(function(r){return r.tag_code;}),
    reviewCodes:results.filter(function(r){return r.decision==="review";}).map(function(r){return r.tag_code;}),
    profile:profile
  };
}


export function compileMatcher(master, defaults, entities) {
  const runtime = compileRuntime(master, defaults, entities);
  return {
    runtime:runtime,
    stats:runtime.stats,
    analyzeText(sourceText, options) {
      return analyzeNormalized(normalizeText(sourceText), master, defaults, null, entities, runtime, options);
    },
    analyzeFields(fields, options) {
      const normalized = normalizeFieldsInput(fields);
      return analyzeNormalized(normalized.text, master, defaults, normalized.ranges, entities, runtime, options);
    }
  };
}

export function analyzeText(sourceText, master, defaults, entities, options) {
  return analyzeNormalized(normalizeText(sourceText), master, defaults, null, entities, null, options);
}

export function analyzeFields(fields, master, defaults, entities, options) {
  const normalized = normalizeFieldsInput(fields);
  return analyzeNormalized(normalized.text, master, defaults, normalized.ranges, entities, null, options);
}

export async function analyze(sourceText) {
  const resources = await loadResources();
  const compiled = resources.compiled || compileMatcher(resources.master, resources.defaults, resources.entities);
  return compiled.analyzeText(sourceText);
}
