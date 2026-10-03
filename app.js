import { loadResources, analyzeText } from "./matcher.js";

const els = {
  status: document.querySelector("#status"),
  input: document.querySelector("#sourceText"),
  analyze: document.querySelector("#analyzeBtn"),
  clear: document.querySelector("#clearBtn"),
  sample: document.querySelector("#sampleBtn"),
  matchedCount: document.querySelector("#matchedCount"),
  reviewCount: document.querySelector("#reviewCount"),
  suppressedCount: document.querySelector("#suppressedCount"),
  codeOutput: document.querySelector("#codeOutput"),
  copyCodes: document.querySelector("#copyCodesBtn"),
  rows: document.querySelector("#resultRows"),
  empty: document.querySelector("#emptyState"),
  filter: document.querySelector("#decisionFilter"),
  query: document.querySelector("#resultQuery"),
  meta: document.querySelector("#masterMeta")
};

let resources = null;
let lastAnalysis = null;

const SAMPLE = "職種：医薬品配送ドライバー\n仕事内容：クリニックや病院へ医薬品を配送します。\n勤務地：東京都内の物流センター\n勤務：3交替勤務\n応募：未経験も可、UIターン歓迎\n待遇：車通勤も可\n連絡先 mail: recruit@example.com\n社内では生成AIを活用しています。";

function setStatus(message, kind) {
  els.status.textContent = message;
  els.status.dataset.kind = kind || "";
}

function render() {
  if (!lastAnalysis) return;
  const decision = els.filter.value;
  const q = els.query.value.trim().toLowerCase();
  const rows = lastAnalysis.results.filter(function(r) {
    if (decision !== "all" && r.decision !== decision) return false;
    if (!q) return true;
    return [r.tag_code,r.canonical,r.job_tag,r.major_category,r.middle_category,r.hit_text,r.reason]
      .join(" ").toLowerCase().includes(q);
  });

  els.matchedCount.textContent = lastAnalysis.matched.length;
  els.reviewCount.textContent = lastAnalysis.review.length;
  els.suppressedCount.textContent = lastAnalysis.suppressed.length;
  els.codeOutput.value = lastAnalysis.confirmedCodes.join("::");

  els.rows.replaceChildren();
  els.empty.hidden = rows.length > 0;

  for (const r of rows) {
    const tr = document.createElement("tr");
    const cells = [
      r.decision === "matched" ? "確定" : r.decision === "review" ? "要確認" : "抑止",
      r.tag_code,
      r.canonical,
      r.major_category + " / " + r.middle_category,
      r.hit_text,
      r.hit_source,
      r.reason,
      r.context
    ];
    cells.forEach(function(value, i) {
      const td = document.createElement("td");
      td.textContent = String(value == null ? "" : value);
      if (i === 0) td.className = "decision decision-" + r.decision;
      tr.appendChild(td);
    });
    els.rows.appendChild(tr);
  }
}

async function runAnalysis() {
  const source = els.input.value.trim();
  if (!source) {
    setStatus("求人原稿を貼り付けてください。", "warn");
    return;
  }
  setStatus("判定中...");
  try {
    lastAnalysis = analyzeText(source, resources.master, resources.defaults);
    render();
    setStatus("判定完了: 確定 " + lastAnalysis.matched.length + " / 要確認 " + lastAnalysis.review.length + " / 抑止 " + lastAnalysis.suppressed.length, "ok");
  } catch (error) {
    console.error(error);
    setStatus("判定エラー: " + error.message, "error");
  }
}

els.analyze.addEventListener("click", runAnalysis);
els.clear.addEventListener("click", function() {
  els.input.value = "";
  lastAnalysis = null;
  els.rows.replaceChildren();
  els.codeOutput.value = "";
  els.matchedCount.textContent = "0";
  els.reviewCount.textContent = "0";
  els.suppressedCount.textContent = "0";
  els.empty.hidden = false;
  setStatus("入力をクリアしました。");
});
els.sample.addEventListener("click", function() {
  els.input.value = SAMPLE;
  runAnalysis();
});
els.filter.addEventListener("change", render);
els.query.addEventListener("input", render);
els.copyCodes.addEventListener("click", async function() {
  if (!els.codeOutput.value) return;
  await navigator.clipboard.writeText(els.codeOutput.value);
  setStatus("確定タグコードをコピーしました。", "ok");
});

(async function() {
  try {
    setStatus("マスタを読み込んでいます...");
    resources = await loadResources();
    const s = resources.master.stats || {};
    els.meta.textContent = "schema " + resources.master.schema_version + " / " + (s.tag_count || "-") + " tags / snapshot " + resources.master.snapshot_date;
    els.analyze.disabled = false;
    els.sample.disabled = false;
    setStatus("準備完了。求人原稿を貼り付けて判定できます。", "ok");
  } catch (error) {
    console.error(error);
    setStatus("マスタ読込エラー: " + error.message, "error");
  }
})();
