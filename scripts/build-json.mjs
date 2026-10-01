import fs from "node:fs";

const inputPath = new URL("../data/job-tags.csv", import.meta.url);
const outputPath = new URL("../data/job-tags.json", import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") {
      if (cell.endsWith("\r")) cell = cell.slice(0, -1);
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const splitList = (v) => String(v ?? "").split("::").map((x) => x.trim()).filter(Boolean);
const table = parseCsv(fs.readFileSync(inputPath, "utf8"));
const headers = table[0];
const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

const tags = table.slice(1).filter((r) => r.some(Boolean)).map((r) => ({
  tag_code: r[idx["タグコード"]] ?? "",
  major_category: r[idx["大分類"]] ?? "",
  middle_category: r[idx["中分類"]] ?? "",
  job_tag: r[idx["求人タグ"]] ?? "",
  canonical: r[idx["canonical"]] ?? "",
  alias_strict: splitList(r[idx["alias_strict"]]),
  alias_loose: splitList(r[idx["alias_loose"]]),
  difficulty: r[idx["判定難易度"]] ?? "",
  exclude_terms: splitList(r[idx["除外語"]]),
  match_policy: r[idx["match_policy"]] || "normal",
  pattern_rule: r[idx["pattern_rule"]] || null
}));

const policyCounts = {};
for (const tag of tags) policyCounts[tag.match_policy] = (policyCounts[tag.match_policy] || 0) + 1;

const aliasOwners = new Map();
for (const tag of tags) {
  for (const alias of [...tag.alias_strict, ...tag.alias_loose]) {
    const key = alias.normalize("NFKC").trim().toLowerCase();
    if (!aliasOwners.has(key)) aliasOwners.set(key, new Set());
    aliasOwners.get(key).add(tag.canonical);
  }
}
const collisions = [...aliasOwners.values()].filter((owners) => owners.size > 1).length;

const output = {
  schema_version: "0.3.0",
  snapshot_date: new Date().toISOString().slice(0, 10),
  source: {
    spreadsheet_title: "求人タグ_aliasマスタ_第3版",
    spreadsheet_id: "1HJJ4cD9hiKuW7qZr9SDOb4miooZnmq7rFIddwGSOqR0",
    sheet_name: "求人タグ",
    alias_delimiter: "::"
  },
  stats: {
    tag_count: tags.length,
    strict_alias_coverage: tags.filter((t) => t.alias_strict.length).length,
    loose_alias_coverage: tags.filter((t) => t.alias_loose.length).length,
    cross_canonical_alias_collisions: collisions,
    match_policy_counts: policyCounts,
    pattern_rule_count: tags.filter((t) => t.pattern_rule).length
  },
  tags
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`Wrote ${tags.length} tags to data/job-tags.json`);
