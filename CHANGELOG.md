# CHANGELOG

## 2026-10-01 - 第3版候補

### Confirmed changes

- `固定給25万円以上` を `pattern` 化。
- `固定給35万円以上` を `pattern` 化。
- 固定給patternは「固定給」の明示を必須とし、`月給` / `基本給` / `月収` からは推測しない。
- `万円` / `万` / `円` を `PARSE:jpy` で正規化する方針をpattern_ruleへ記録。

### Review candidates

Google Sheets `求人タグ_aliasマスタ_第3版候補` に `policy候補レビュー` タブを追加。

- 候補総数: 336
- context候補: 202
- strict_only候補: 14
- token_exact候補: 116
- pattern候補: 4
- 優先度 高: 133
- 優先度 中: 203

候補タブは自動抽出によるレビュー用であり、`求人タグ` 本体へは未反映。

主な検出観点:

- 就業場所名が配送先・顧客先として出る誤爆
- 短い一般スキル語
- 否定・別用途のより具体的なcanonicalへの包含
- 短い英数字タグのraw substring
- 数値閾値を含むタグ

### Snapshot stats

- タグ数: 1617
- strict aliasあり: 618
- loose aliasあり: 41
- aliasの別canonical間衝突: 0
- match_policy: normal=1610, context=2, pattern=5
- pattern_ruleあり: 5

---

## 2026-10-01 - Repository initialization

- `job-tag-alias-master` を求人タグ判定マスタの共有リポジトリとして初期化。
- Google Sheets `求人タグ_aliasマスタ_第2版` のスナップショットを `data/job-tags.csv` / `data/job-tags.json` に収録。
- スキーマ、判定ルール、判定例、AI向け `AGENTS.md` を追加。
- CSV → JSON の依存ライブラリ不要ビルドスクリプトを追加。

### Initial snapshot stats

- タグ数: 1617
- strict aliasあり: 618
- loose aliasあり: 41
- aliasの別canonical間衝突: 0
- match_policy: normal=1612, context=2, pattern=3
- pattern_ruleあり: 3
