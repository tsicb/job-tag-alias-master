# AGENTS.md

このリポジトリは、求人広告テキストから求人タグ候補を抽出するためのタグマスタと判定仕様を管理する。

## 最初に読むもの

1. `README.md`
2. `docs/schema.md`
3. `docs/matching-rules.md`
4. 必要に応じて `docs/examples.md`
5. 実データは `data/job-tags.json` または `data/job-tags.csv`

## 正本

- Google Sheets: 人が編集・レビューする作業用マスタ
- GitHub: 仕様書、変更履歴、アプリ向け配布スナップショット

## 主要フィールド

- `canonical`: 判定基準の代表表記
- `alias_strict`: 比較的安全な同義表現
- `alias_loose`: 文脈依存の近似表現
- `除外語`: 誤爆する特定の出現箇所を局所的に抑止する表現
- `match_policy`: `normal` / `strict_only` / `context` / `pattern` / `token_exact`
- `pattern_rule`: 数値・構造判定ルール

CSVの複数値は `::` 区切り、JSONでは配列。

## 判定原則

- aliasは関連語ではなく、原則として同義表現。
- 給与条件は厳格に扱い、「月給」等を「固定給」へ推測変換しない。
- 一般名詞・短語をraw substringだけで確定しない。
- 就業場所タグは施設名の出現だけで確定しない。勤務地・勤務先・配属先・施設内勤務等の文脈を要求する。
- `token_exact` は短い英数字タグ向け。raw substringは禁止し、トークン境界で判定する。
- 除外語は文書全体を無効化せず、canonical / aliasと重なるか近接する出現箇所を抑止する。
- より具体的な表現・否定表現を先に評価する。

## 代表例

- `病院へ医薬品を配送` → 就業場所「病院」を確定しない。
- `JavaScript` → `Java` をsubstringだけで付与しない。
- `GitHub` → `Git` をsubstringだけで付与しない。
- `英語力不要` → 「英語」の該当出現を除外。
- `保育園で保育業務` → 「保育園」内の「保育」は抑止し、「保育業務」は有効にできる。
- `固定給26万円` → 固定給25万円以上のpattern候補。
- `月給26万円` → 固定給タグには変換しない。

## 変更時チェック

1. tag_code / canonical件数が意図せず変わっていないか
2. aliasの別canonical間衝突がないか
3. aliasが意味を広げすぎていないか
4. context / pattern / token_exactをnormal substringで扱っていないか
5. 除外語を文書全体抑止として実装していないか
6. CSVとJSONを再生成したか
7. JSON SchemaとCHANGELOGを更新したか
