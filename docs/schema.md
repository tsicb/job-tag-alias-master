# データスキーマ

## Google Sheets / CSV

| 列 | 意味 | 形式 |
|---|---|---|
| タグコード | タグの識別コード | 文字列として扱うことを推奨 |
| 大分類 | タグの上位分類 | 文字列 |
| 中分類 | タグの中分類 | 文字列 |
| 求人タグ | 元タグ一覧の公式表示名 | 文字列 |
| canonical | 判定時の代表表記 | 文字列 |
| alias_strict | 自動判定に比較的安全な同義表現 | 複数値は `::` 区切り |
| alias_loose | 文脈確認を推奨する近似表現 | 複数値は `::` 区切り |
| 判定難易度 | 単純文字列判定の難しさ | `低` / `中` / `高` |
| 除外語 | 誤爆を抑止する代表表現 | 複数値は `::` 区切り |
| match_policy | タグの判定方式 | `normal` / `strict_only` / `context` / `pattern` |
| pattern_rule | pattern判定のルール | 空欄または文字列 |

## JSON

`data/job-tags.json` はアプリ利用しやすいよう、複数値を配列化する。

主なフィールド対応:

| CSV / Sheet | JSON |
|---|---|
| タグコード | `tag_code` |
| 大分類 | `major_category` |
| 中分類 | `middle_category` |
| 求人タグ | `job_tag` |
| canonical | `canonical` |
| alias_strict | `alias_strict[]` |
| alias_loose | `alias_loose[]` |
| 判定難易度 | `difficulty` |
| 除外語 | `exclude_terms[]` |
| match_policy | `match_policy` |
| pattern_rule | `pattern_rule` |

## pattern_rule

現段階では人間とAIが読める簡易DSLとして保持している。

例:

```text
REGEX:(?:年間休日|年休)[^\d]{0,8}?(\d{2,3})\s*日; TEST:value>=120
```

アプリがこの文字列を直接evalすることは推奨しない。実装時は許可された演算子・ルールへパースするか、tag_codeごとの安全な実装へ変換する。

## バージョニング

JSONトップレベルの `schema_version` は配布形式のバージョン。  
alias内容だけの変更と、JSON構造自体の変更を区別する。

現在: `0.2.0`
