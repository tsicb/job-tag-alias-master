# CHANGELOG

## 2026-10-02 - 第3版確定

policy候補336件のレビューを完了し、`求人タグ_aliasマスタ_第3版` を正式化。

### Review result

- 採用: 289
- 見送り: 47
- 未確認: 0

### Medium-priority review

中優先度203件:
- 採用173
  - 就業場所context: 109
  - token_exact: 60
  - その他context: 2（認証、候補）
  - pattern: 2（1日4時間以内OK、駅近5分以内）
- 見送り30
  - 短いスキル語は、短さだけを理由にcontext化しない
  - 整体、透析、PCスキル、残業なし、誕生日休暇ありは局所除外で対応
  - 週4日以上OK、18歳以上はpattern化せずstrict aliasを補強

### Collision fix

`週4日からOK` のalias衝突を解消し、`週4日以上OK` 側へ一意化。

### Final snapshot

- タグ数: 1617
- strict aliasあり: 619
- loose aliasあり: 41
- alias衝突: 0
- match_policy: token_exact=116, normal=1321, context=173, pattern=7
- pattern_ruleあり: 7

## 2026-10-02 - High-priority policy review

高優先度133件を精査。
- 採用116
- 見送り17
- 就業場所context 60、token_exact 56を反映
- strict_only一括化を見送り、局所除外方式を採用

## 2026-10-01 - 第3版候補

- 固定給25万円以上 / 35万円以上をpattern化
- policy候補レビュータブを作成

## 2026-10-01 - Repository initialization

- リポジトリ初期化
- 第2版SheetのCSV / JSON、Schema、AGENTS、判定ルールを追加
