# CHANGELOG

## 2026-10-04 - Welcome alias system

応募歓迎34タグの語尾・複合表記を体系化。

### strict

- 歓迎 → OK
- 歓迎 → 大歓迎
- 歓迎 → 積極採用
- strictの歓迎表現にも同じ派生を適用

### loose

- 歓迎 → 可
- looseの歓迎表現から派生したOK / 大歓迎 / 積極採用 / 可はloose維持
- `可` の `も可` variantをloose aliasにも適用

### Composite wording

- シングルマザー・ファーザー歓迎
- 管理職・マネジメント経験歓迎
- 主婦・主夫歓迎

について、区切り・括弧表記と片側表現をstrict / looseへ整理。

### Not expanded

`活躍中` / `在籍` は歓迎と同一視せず、横断alias化していない。独立canonicalがある場合はそちらを優先する。

### Snapshot

- strict aliasあり: 667
- loose aliasあり: 80
- alias衝突: 0

## 2026-10-03 - Alias orthography expansion

ユーザー提供候補と全1,617タグの表記揺れ再走査を反映。

### Main additions

- 短期3ヶ月系: 「3ヶ月以内」はstrict、「3ヶ月」はloose
- クルマ販売店: 車販売店 / カーディーラー等をstrict、ディーラーをloose
- スマホ販売 / 携帯販売
- 携帯代支給 / スマホ代支給
- 携帯貸与 / スマホ貸与
- 組立 / 組み立て / 組立て
- 社割 / 社員割引 / 従業員割引
- 食費補助 / 食事代補助
- 高速代 / 高速道路代 / 高速料金
- 研修あり / 研修充実
- 入社祝い金 / 入社祝金
- PCスキル / パソコンスキル
- ブラインドタッチ / タッチタイピング
- 日勤のみ / 日勤専従 → 夜勤なし
- 人柄重視、増員募集、欠員補充、出張費、契約更新、家庭都合休、寮/社宅、引越補助の表記揺れ

### Cross-master orthography scan

衝突のない表記揺れを横断補強:

- ヵ月 / ヶ月 / か月
- 祝い金 / 祝金
- 引っ越し / 引越し / 引越
- 組み立て / 組立て / 組立
- 持ち込み / 持込み / 持込
- 問い合わせ / 問合せ
- 取り扱い / 取扱い / 取扱
- 振り込み / 振込み / 振込

### Snapshot

- タグ数: 1617
- strict aliasあり: 643
- loose aliasあり: 47
- alias衝突: 0
- match_policy: token_exact=116, normal=1321, context=173, pattern=7
- pattern_ruleあり: 7

## 2026-10-03 - Matcher validation fixes

- 判定テスターと回帰テストを追加。
- `UIターン歓迎` がITスキル `UI` に誤HITすることを回帰テストで検出。
- `UI` タグの局所除外語へ `UIターン` を追加。
- `UIターン歓迎` はU・Iターン歓迎として判定し、ITスキルUIは抑止する。

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
