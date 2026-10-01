# CHANGELOG

## 2026-10-01

### Repository initialization

- `job-tag-alias-master` を求人タグ判定マスタの共有リポジトリとして初期化。
- Google Sheets `求人タグ_aliasマスタ_第2版` のスナップショットを `data/job-tags.csv` / `data/job-tags.json` に収録。
- スキーマ、判定ルール、判定例、AI向け `AGENTS.md` を追加。
- CSV → JSON の依存ライブラリ不要ビルドスクリプトを追加。

### Snapshot stats

- タグ数: 1617
- strict aliasあり: 618
- loose aliasあり: 41
- aliasの別canonical間衝突: 0
- match_policy: normal=1612, context=2, pattern=3
- pattern_ruleあり: 3

### Next design items

- `固定給25万円以上` / `固定給35万円以上` を、月給等へ意味拡張せず「固定給」明示時のみ数値patternで扱う。
- `海` / `病院` など就業場所のcontext判定を整理する。
- 短い一般名詞および英数字タグのsubstring誤爆を調査し、`strict_only` / context / token境界判定を整理する。
