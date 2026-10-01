# CHANGELOG

## 2026-10-02 - High-priority policy review

高優先度133件を精査。

### Adopted: 116

- 就業場所60タグを `context` へ変更。
- 短い英数字56タグを正式な `token_exact` へ変更。
- Google Sheetsのmatch_policy入力規則とJSON Schemaに `token_exact` を追加。

### Proposal rejected, alternative applied: 17

- `深夜` / `長期` / `英語`
  - context化を見送り、normalを維持。
  - 否定・別用途表現を除外語へ追加。
- `看護` / `臨床` / `調理` / `保育` / `指導` / `工事` / `製造` / `財務` / `事務` / `接客` / `運転` / `人事` / `労務` / `清掃`
  - strict_only一括化を見送り。
  - normalを維持し、誤爆する長い表現を局所除外語として追加、または具体表現を優先。

### Important semantic rule

除外語は文書全体を無効化せず、canonical / aliasと重なる・近接する出現箇所へ局所適用する。

### Snapshot stats

- タグ数: 1617
- strict aliasあり: 618
- loose aliasあり: 41
- alias衝突: 0
- match_policy: normal=1494, token_exact=56, context=62, pattern=5
- pattern_ruleあり: 5

---

## 2026-10-01 - 第3版候補

- 固定給25万円以上 / 35万円以上をpattern化。
- policy候補レビュータブを作成し336件を抽出。

## 2026-10-01 - Repository initialization

- リポジトリ初期化。
- 第2版SheetのCSV / JSONスナップショット、Schema、AGENTS、判定ルールを追加。
