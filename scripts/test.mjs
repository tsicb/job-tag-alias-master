import fs from "node:fs";
import { analyzeFields, analyzeText, compileMatcher } from "../matcher.js";

const master = JSON.parse(fs.readFileSync(new URL("../data/job-tags.json", import.meta.url), "utf8"));
const defaults = JSON.parse(fs.readFileSync(new URL("../config/matching-defaults.json", import.meta.url), "utf8"));
const entities = JSON.parse(fs.readFileSync(new URL("../data/location-entities.json", import.meta.url), "utf8"));
const cases = JSON.parse(fs.readFileSync(new URL("../tests/cases.json", import.meta.url), "utf8"));
const compiled = compileMatcher(master, defaults, entities);

function has(list, canonical) {
  return list.some((r) => r.canonical === canonical);
}

let passed = 0;
const failures = [];

for (const tc of cases) {
  const result = tc.fields
    ? compiled.analyzeFields(tc.fields)
    : compiled.analyzeText(tc.text);
  const compatibilityResult = tc.fields
    ? analyzeFields(tc.fields, master, defaults, entities)
    : analyzeText(tc.text, master, defaults, entities);
  const errors = [];

  const signature = (value) => value.results.map((r) => [
    r.decision,
    r.tag_code,
    r.hit_source,
    r.hit_text,
    r.reason,
    r.field_name || "",
    r.entity_name || ""
  ].join("|")).join("\n");

  if (signature(result) !== signature(compatibilityResult)) {
    errors.push("compiled / compatibility 判定差分");
  }

  for (const c of tc.matched || []) if (!has(result.matched, c)) errors.push("確定にならない: " + c);
  for (const c of tc.review || []) if (!has(result.review, c)) errors.push("要確認にならない: " + c);
  for (const c of tc.absent || []) if (has(result.results, c)) errors.push("誤HIT: " + c);
  for (const c of tc.notMatched || []) if (has(result.matched, c)) errors.push("誤確定: " + c);
  for (const c of tc.suppressed || []) if (!has(result.suppressed, c)) errors.push("抑止されない: " + c);

  if (errors.length === 0) {
    passed++;
    console.log("PASS", tc.name);
  } else {
    failures.push({ name: tc.name, errors, result });
    console.error("FAIL", tc.name, "-", errors.join(" / "));
  }
}

console.log("");
console.log(passed + " / " + cases.length + " PASS");
console.log("compiled terms:", compiled.stats.termCount,
  "/ entity terms:", compiled.stats.entityTermCount,
  "/ compile:", compiled.stats.compileMs.toFixed(2) + "ms");

if (failures.length) {
  process.exitCode = 1;
}
