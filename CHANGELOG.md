# CHANGELOG

## 2026-10-02 - Alias and global matcher refinements

### Alias additions

- 例外事由3号イ / ニ / ロ
  - 「3号のイ」「3号 イ」等をstrict aliasへ追加。
- U・Iターン歓迎 / 支援あり
  - `UIターン`、`U/Iターン`、`Uターン・Iターン` 表記を追加。
- 三交代制 / 二交代制
  - 算用数字、`交替`、`勤務` 表記を追加。
- 理学療法士 / 作業療法士 / 言語聴覚士
  - `PT` / `OT` / `ST` をloose aliasへ追加。

### Global matching defaults

`config/matching-defaults.json` を追加。

- token_exactと3文字以下のASCII aliasにASCII token境界を適用。
- `mail` 中のAI、`staff` 中のSTなどを抑止。
- 日本語直結（`生成AI`、`STスタッフ`）は許容。
- `可` / `OK` の直前の `も` を任意化し、`車通勤も可` 等をalias大量生成なしで吸収。

### Snapshot

- タグ数: 1617
- strict aliasあり: 625
- loose aliasあり: 44
- alias衝突: 0
- match_policy: token_exact=116, normal=1321, context=173, pattern=7
- pattern_ruleあり: 7

## 2026-10-02 - 第3版確定

policy候補336件のレビューを完了。
- 採用289
- 見送り47
- alias衝突0

## 2026-10-01 - Repository initialization

- リポジトリ初期化。
