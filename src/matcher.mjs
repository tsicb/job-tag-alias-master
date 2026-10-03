const ASCII_TOKEN_CHAR = /[A-Za-z0-9_]/;

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase();
}

function isAsciiTokenChar(ch) {
  return ch ? ASCII_TOKEN_CHAR.test(ch) : false;
}

function isShortAsciiToken(term) {
  return /^[A-Za-z0-9_+#./-]{1,3}$/.test(term);
}

export function expandAllowanceVariants(term, config = {}) {
  const variants = [term];
  const enabled = config?.allowance_suffix_variants?.enabled;
  if (!enabled) return variants;

  const suffixes = config.allowance_suffix_variants.suffixes || ['可', 'OK'];
  const optionalParticles = config.allowance_suffix_variants.optional_particles || ['も'];

  for (const suffix of suffixes) {
    if (!term.toLowerCase().endsWith(String(suffix).toLowerCase())) continue;
    const stem = term.slice(0, term.length - String(suffix).length);
    for (const particle of optionalParticles) {
      if (stem.endsWith(particle)) continue;
      variants.push(`${stem}${particle}${suffix}`);
    }
  }
  return [...new Set(variants)];
}

export function findOccurrences(text, term, { tokenBoundary = false } = {}) {
  const haystack = normalizeText(text);
  const needle = normalizeText(term);
  if (!needle) return [];

  const hits = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    const end = index + needle.length;
    const before = index > 0 ? haystack[index - 1] : '';
    const after = end < haystack.length ? haystack[end] : '';

    if (!tokenBoundary || (!isAsciiTokenChar(before) && !isAsciiTokenChar(after))) {
      hits.push({ index, end, hit: text.slice(index, end) });
    }
    from = index + Math.max(needle.length, 1);
  }
  return hits;
}

function overlaps(a, b) {
  return a.index < b.end && b.index < a.end;
}

function findExclusionSpans(text, excludeTerms = []) {
  const spans = [];
  for (const term of excludeTerms) {
    for (const hit of findOccurrences(text, term)) {
      spans.push({ ...hit, term });
    }
  }
  return spans;
}

function makeSnippet(text, index, end, radius = 28) {
  const start = Math.max(0, index - radius);
  const stop = Math.min(text.length, end + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, stop).replace(/\s+/g, ' ')}${stop < text.length ? '…' : ''}`;
}

function uniqueEvidence(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.index}:${item.end}:${item.source}:${normalizeText(item.term || item.hit)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function shouldUseTokenBoundary(tag, term) {
  if (tag.match_policy === 'token_exact') return true;
  return isShortAsciiToken(term);
}

function collectTermEvidence(text, tag, terms, source, config, exclusions) {
  const matched = [];
  const suppressed = [];
  for (const term of terms) {
    for (const variant of expandAllowanceVariants(term, config)) {
      const hits = findOccurrences(text, variant, {
        tokenBoundary: shouldUseTokenBoundary(tag, variant),
      });
      for (const hit of hits) {
        const exclusion = exclusions.find((span) => overlaps(hit, span));
        const evidence = {
          ...hit,
          term,
          variant,
          source,
          snippet: makeSnippet(text, hit.index, hit.end),
        };
        if (exclusion) {
          suppressed.push({
            ...evidence,
            exclusion_term: exclusion.term,
            reason: `除外語「${exclusion.term}」と重なる出現`,
          });
        } else {
          matched.push(evidence);
        }
      }
    }
  }
  return { matched: uniqueEvidence(matched), suppressed: uniqueEvidence(suppressed) };
}

export function parsePatternRule(rule) {
  if (!rule || !String(rule).startsWith('REGEX:')) return null;
  const parts = String(rule).split(';').map((s) => s.trim()).filter(Boolean);
  const regexPart = parts.find((p) => p.startsWith('REGEX:'));
  const parsePart = parts.find((p) => p.startsWith('PARSE:'));
  const testPart = parts.find((p) => p.startsWith('TEST:'));
  if (!regexPart || !testPart) return null;

  const regexSource = regexPart.slice('REGEX:'.length);
  const testMatch = testPart.match(/^TEST:value\s*(>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)$/);
  if (!testMatch) return null;

  return {
    regexSource,
    parser: parsePart ? parsePart.slice('PARSE:'.length) : 'number',
    operator: testMatch[1],
    threshold: Number(testMatch[2]),
  };
}

function compareValue(value, operator, threshold) {
  if (operator === '>=') return value >= threshold;
  if (operator === '<=') return value <= threshold;
  if (operator === '>') return value > threshold;
  if (operator === '<') return value < threshold;
  if (operator === '==') return value === threshold;
  return false;
}

function parseCapturedValue(match, parser) {
  const raw = String(match[1] ?? '').replace(/,/g, '');
  let value = Number(raw);
  if (!Number.isFinite(value)) return null;
  if (parser === 'jpy') {
    const unit = String(match[2] ?? '円');
    if (unit.includes('万')) value *= 10000;
  }
  return value;
}

export function evaluatePattern(text, tag) {
  const parsed = parsePatternRule(tag.pattern_rule);
  if (!parsed) return [];

  let regex;
  try {
    regex = new RegExp(parsed.regexSource, 'giu');
  } catch {
    return [];
  }

  const normalized = String(text ?? '').normalize('NFKC');
  const results = [];
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const value = parseCapturedValue(match, parsed.parser);
    if (value !== null && compareValue(value, parsed.operator, parsed.threshold)) {
      results.push({
        index: match.index,
        end: match.index + match[0].length,
        hit: match[0],
        term: tag.canonical,
        source: 'pattern',
        parsed_value: value,
        snippet: makeSnippet(normalized, match.index, match.index + match[0].length),
        reason: `pattern: value ${parsed.operator} ${parsed.threshold}`,
      });
    }
    if (match[0] === '') regex.lastIndex += 1;
  }
  return uniqueEvidence(results);
}

export function evaluateTag(text, tag, config = {}) {
  const exclusions = findExclusionSpans(text, tag.exclude_terms || []);
  const canonical = tag.canonical ? [tag.canonical] : [];
  const strict = tag.alias_strict || [];
  const loose = tag.alias_loose || [];

  const canonicalEvidence = collectTermEvidence(text, tag, canonical, 'canonical', config, exclusions);
  const strictEvidence = collectTermEvidence(text, tag, strict, 'strict', config, exclusions);
  const looseEvidence = collectTermEvidence(text, tag, loose, 'loose', config, exclusions);
  const patternEvidence = tag.match_policy === 'pattern' ? evaluatePattern(text, tag) : [];

  let matched = [];
  let review = [];
  const suppressed = uniqueEvidence([
    ...canonicalEvidence.suppressed,
    ...strictEvidence.suppressed,
    ...looseEvidence.suppressed,
  ]);

  switch (tag.match_policy) {
    case 'context':
      review = [...canonicalEvidence.matched, ...strictEvidence.matched, ...looseEvidence.matched];
      break;
    case 'strict_only':
      matched = [...strictEvidence.matched];
      review = [...canonicalEvidence.matched, ...looseEvidence.matched];
      break;
    case 'pattern':
      matched = [...patternEvidence, ...canonicalEvidence.matched, ...strictEvidence.matched];
      review = [...looseEvidence.matched];
      break;
    case 'token_exact':
    case 'normal':
    default:
      matched = [...canonicalEvidence.matched, ...strictEvidence.matched];
      review = [...looseEvidence.matched];
      break;
  }

  matched = uniqueEvidence(matched);
  review = uniqueEvidence(review);

  let decision = 'none';
  if (matched.length) decision = 'matched';
  else if (review.length) decision = 'review';
  else if (suppressed.length) decision = 'suppressed';

  return {
    tag_code: String(tag.tag_code),
    canonical: tag.canonical,
    job_tag: tag.job_tag,
    major_category: tag.major_category,
    middle_category: tag.middle_category,
    match_policy: tag.match_policy,
    difficulty: tag.difficulty,
    decision,
    matched,
    review,
    suppressed,
  };
}

export function analyzeText(text, master, config = {}) {
  const tags = Array.isArray(master) ? master : master?.tags || [];
  const results = tags
    .map((tag) => evaluateTag(text, tag, config))
    .filter((result) => result.decision !== 'none');

  const rank = { matched: 0, review: 1, suppressed: 2 };
  results.sort((a, b) => {
    const d = rank[a.decision] - rank[b.decision];
    if (d !== 0) return d;
    const an = Number(a.tag_code);
    const bn = Number(b.tag_code);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.tag_code.localeCompare(b.tag_code, 'ja');
  });

  return {
    results,
    matched: results.filter((r) => r.decision === 'matched'),
    review: results.filter((r) => r.decision === 'review'),
    suppressed: results.filter((r) => r.decision === 'suppressed'),
  };
}
