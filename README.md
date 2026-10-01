# job-tag-alias-master

求人広告テキストから求人タグを判定するための、タグ定義・別表記（alias）・判定ルールを管理するマスタリポジトリです。

## 目的

このリポジトリは、複数の求人関連アプリから共通利用できる「求人タグ判定マスタ」を保持します。

主な用途:

- 求人原稿から該当タグ候補を抽出する
- canonical と別表記（alias）の対応を共通管理する
- 誤爆しやすいタグに context / pattern などの判定方針を持たせる
- Google Sheets の編集用マスタからアプリ向け CSV / JSON を生成する
- 別チャットや別AIエージェントでも判定仕様を短時間で復元できるようにする

## 正本と配布データ

当面の役割分担は次のとおりです。

- **Google Sheets**: 人がレビュー・編集する作業用マスタ
- **GitHub**: 仕様書、変更履歴、アプリ配布用 CSV / JSON の保存先

GitHub上の `data/` は、Google Sheetsのある時点のスナップショットです。  
SheetとGitHubの同期を自動化するまでは、更新日時とCHANGELOGを確認してください。

## 現在のデータ構造

Google Sheets側の列:

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

詳しい意味は [docs/schema.md](docs/schema.md) を参照してください。

判定方法は [docs/matching-rules.md](docs/matching-rules.md) を参照してください。

## 重要な原則

- alias は「関連語」ではなく、原則として同じ意味を表す別表記を登録する。
- `alias_strict` は自動判定に比較的安全な表記。
- `alias_loose` は文脈依存で、確認候補として扱う表記。
- 短い語や一般名詞は単純部分一致で確定しない。
- 「採用」「介護」のように求人本文で別の意味でも出現しやすい語は `context` 扱いにする。
- 数値条件は可能な限り文字列aliasではなく `pattern` で判定する。
- 給与条件は保守的に扱う。たとえば「月給26万円」を「固定給25万円以上」と推測して付与しない。
- より具体的なタグや否定表現との包含関係に注意する。

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

## AI / ChatGPT でこのリポジトリを使う場合

別チャットでは、GitHubプラグインを接続したうえで、たとえば次のように指定できます。

> `job-tag-alias-master` リポジトリの README.md と AGENTS.md を確認し、現在の求人タグ判定仕様に従ってください。

AIは最初に `AGENTS.md`、`docs/schema.md`、`docs/matching-rules.md` を確認してください。

## ステータス

現在は設計・精度調整中です。  
実求人での誤爆・取りこぼしを確認しながら alias、context、pattern を更新していきます。
