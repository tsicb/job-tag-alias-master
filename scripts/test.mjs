import fs from "node:fs";
import { analyzeFields, analyzeText } from "../matcher.js";

const master = JSON.parse(fs.readFileSync(new URL("../data/job-tags.json", import.meta.url), "utf8"));
const defaults = JSON.parse(fs.readFileSync(new URL("../config/matching-defaults.json", import.meta.url), "utf8"));
const entities = JSON.parse(fs.readFileSync(new URL("../data/location-entities.json", import.meta.url), "utf8"));
const cases = JSON.parse(fs.readFileSync(new URL("../tests/cases.json", import.meta.url), "utf8"));

function has(list, canonical) {
  return list.some((r) => r.canonical === canonical);
}

let passed = 0;
const failures = [];

for (const tc of cases) {
  const result = tc.fields
    ? analyzeFields(tc.fields, master, defaults, entities)
    : analyzeText(tc.text, master, defaults, entities);
  const errors = [];

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

if (failures.length) {
  process.exitCode = 1;
}
