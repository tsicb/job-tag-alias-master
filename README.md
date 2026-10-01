# job-tag-alias-master

求人広告テキストから求人タグを判定するための、タグ定義・別表記（alias）・判定ルールを管理するマスタリポジトリです。

## 現在の正式版

- Google Sheets: `求人タグ_aliasマスタ_第3版`
- JSON schema_version: `0.3.0`
- タグ数: 1617
- alias衝突: 0

## 役割分担

- **Google Sheets**: 人がレビュー・編集する作業用正本
- **GitHub**: 仕様書、変更履歴、アプリ向けCSV/JSON配布先
- **config/matching-defaults.json**: 各アプリで共通利用するグローバル判定ルール

## データ構造

1. タグコード
2. 大分類
3. 中分類
4. 求人タグ
5. canonical
6. alias_strict
7. alias_loose
8. 判定難易度
9. 除外語
10. match_policy
11. pattern_rule

詳細は `docs/schema.md`、判定方法は `docs/matching-rules.md` を参照してください。

## 重要原則

- aliasは関連語ではなく、原則として同義表現。
- 給与条件は推測で意味を広げない。
- 就業場所は施設名が出ただけでは確定しない。
- 短い英数字はraw substringで判定しない。
- 除外語は文書全体ではなく誤爆する出現箇所へ局所適用する。
- `可` / `OK` の直前に入る `も` は、aliasを大量生成せず共通マッチングルールで吸収する。

## AI / ChatGPTで使う場合

> GitHubプラグインで `job-tag-alias-master` の README.md と AGENTS.md を確認し、現在の求人タグ判定仕様に従ってください。

AIは `AGENTS.md`、`docs/schema.md`、`docs/matching-rules.md`、`config/matching-defaults.json` を優先して確認してください。
