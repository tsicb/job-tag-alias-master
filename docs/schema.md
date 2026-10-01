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
| 除外語 | 特定の出現箇所で誤爆を抑止する表現 | 複数値は `::` 区切り |
| match_policy | タグの判定方式 | `normal` / `strict_only` / `context` / `pattern` / `token_exact` |
| pattern_rule | pattern判定のルール | 空欄または文字列 |

## 除外語の適用単位

除外語は原則として文書全体を無効化するためではなく、canonical / alias と重なる、または近接する誤爆箇所を局所的に抑止するために使う。

例:

- `保育園で保育業務` では、「保育園」に含まれる「保育」は抑止してよいが、別の「保育業務」は有効。
- `接客なし。ただし電話での接客対応はあり` のように複数出現がある場合は、各出現単位で判定する。

## JSON

`data/job-tags.json` では複数値を配列化する。

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

現在のschema_version: `0.3.0`
