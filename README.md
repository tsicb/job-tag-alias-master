# job-tag-alias-master

求人広告テキストから求人タグを判定するための、タグ定義・別表記（alias）・判定ルールを管理するマスタリポジトリです。

## 現在の正式版

- Google Sheets: `求人タグ_aliasマスタ_第3版`
- JSON schema_version: `0.3.0`
- タグ数: 1617
- alias衝突: 0
- match_policy: token_exact=116, normal=1321, context=173, pattern=7

## 役割分担

- **Google Sheets**: 人がレビュー・編集する作業用正本
- **GitHub**: 仕様書、変更履歴、アプリ向けCSV/JSON配布先

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

## match_policy

- `normal`: canonical / strict aliasを通常判定
- `context`: 周辺文脈・関係性を確認
- `pattern`: 数値・形式から判定
- `token_exact`: 短い英数字をトークン境界で判定
- `strict_only`: 予約済み。canonical単独では確定しない方式

## 重要原則

- aliasは関連語ではなく、原則として同義表現。
- 給与条件は推測で意味を広げない。
- 就業場所は施設名が出ただけでは確定しない。
- 短い英数字はraw substringで判定しない。
- 除外語は文書全体ではなく、誤爆する出現箇所へ局所適用する。
- 数値条件は必要に応じてpattern化する。

## AI / ChatGPTで使う場合

別チャットでは次のように指定できます。

> GitHubプラグインで `job-tag-alias-master` の README.md と AGENTS.md を確認し、現在の求人タグ判定仕様に従ってください。

AIは `AGENTS.md`、`docs/schema.md`、`docs/matching-rules.md` を優先して確認してください。

## リポジトリ構成

```text
.
├─ README.md
├─ AGENTS.md
├─ CHANGELOG.md
├─ data/
│  ├─ job-tags.csv
│  └─ job-tags.json
├─ docs/
│  ├─ schema.md
│  ├─ matching-rules.md
│  └─ examples.md
├─ schema/
│  └─ job-tags.schema.json
└─ scripts/
   └─ build-json.mjs
```

`policy候補レビュー` タブは第3版作成時の判断履歴として保持しています。
