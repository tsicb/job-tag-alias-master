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

## 求人タグ判定テスター

リポジトリ直下に、実求人を第3版マスタへ通す検証用ブラウザアプリを収録しています。

- `index.html`: 求人原稿を貼り付ける判定画面
- `matcher.js`: 判定エンジン
- `app.js`: 画面ロジック
- `test-runner.html`: ブラウザ回帰テスト
- `tests/cases.json`: 代表テストケース
- `scripts/test.mjs`: Node回帰テスト

判定結果は次の3段階です。

- `matched`: 確定。タグコード出力対象。
- `review`: 要確認。loose aliasやcontext未確定など。
- `suppressed`: 文字列上はHITしたが、除外語・関係性によって抑止。

確定タグコードだけを `::` 区切りでコピーできます。

### 現在の代表回帰テスト

- `mail` 内の `AI` を誤検出しない
- `生成AI` はAIとして検出
- `staff` 内の `ST` を誤検出しない
- 単独 `ST` は言語聴覚士の要確認候補
- `UIターン歓迎` はU・Iターン歓迎として検出し、ITスキルUIは抑止
- `例外事由3号のイ`
- `3交替勤務`
- 配送先の病院と勤務地の病院を区別
- `マイカー通勤も可`
- 固定給閾値判定
- 駅徒歩5分以内判定

現在 13 / 13 ケース通過。

## 自動テスト

依存ライブラリなしで実行できます。

```bash
npm test
```

`.github/workflows/matcher-tests.yml` により、matcher・master・config・tests変更時にGitHub Actionsでも回帰テストを実行します。

## GitHub Pages

GitHub Pagesを `main / root` で有効化すれば、静的テスターとしてそのまま公開できます。

想定URL:

```text
https://tsicb.github.io/job-tag-alias-master/
```

Pages側でサーバー処理やAPIキーは不要です。ブラウザが同じrepo内の `data/job-tags.json` と `config/matching-defaults.json` を読み込みます。

