# AGENTS.md

このリポジトリは求人広告テキストから求人タグ候補を抽出するためのマスタと判定仕様を管理する。

## 最初に読むもの

1. `README.md`
2. `docs/schema.md`
3. `docs/matching-rules.md`
4. `config/matching-defaults.json`
5. 必要に応じて `docs/examples.md`
6. 実データは `data/job-tags.json` / `data/job-tags.csv`

## 主要原則

- aliasは原則として同義表現。
- `alias_strict` は比較的安全な同義表現、またはその表現があればcanonicalの条件を確実に満たす表現。
- `alias_loose` は文脈依存性・意味の広さがあり、自動確定より確認候補を優先。
- 給与条件は意味推測で広げない。
- 就業場所はフィールドと文脈を考慮する。求人との合理的な関連性は一定範囲で許容するが、文字列の偶然一致は抑止する。
- 除外語は文書全体ではなく、誤爆する出現箇所へ局所適用する。

## 短いASCII語・alias

`token_exact` および3文字以下のASCII aliasはraw substring禁止。

ASCII token文字を `[A-Za-z0-9_]` とし、候補語の直前・直後がASCII token文字でない場合だけ一致させる。

- `AI活用`、`生成AI` → AIに一致
- `mail` → AIに一致しない
- `STスタッフ` → STに一致
- `staff` → STに一致しない
- `JavaScript` → Javaに一致しない
- `GitHub` → Gitに一致しない

日本語文字との直結は許容する。

HTTPSのようにURL構文そのものが通常本文へ出現するタグは、token境界だけでは不足する。URL `https://...` は除外語で抑止し、`HTTPS通信` / `HTTPS設定` のような技術要件だけを残す。

PT / OT / ST はそれぞれ理学療法士 / 作業療法士 / 言語聴覚士のloose aliasとして登録している。資格・職種の意味が文脈で曖昧な場合は自動確定よりreviewを優先する。

## 許可表現の助詞ゆれ

canonicalまたはstrict aliasが `可` / `OK` で終わる場合、語尾直前の `も` を任意として扱う。

例:
- `車通勤可` ≒ `車通勤も可`
- `副業OK` ≒ `副業もOK`

一般的な「も」の削除は行わず、この語尾ルールに限定する。

## 変更時チェック

1. tag_code / canonical件数
2. aliasの別canonical間衝突
3. aliasが意味を広げすぎていないか
4. context / pattern / token_exactをraw substringで扱っていないか
5. 短いASCII aliasへtoken境界ルールを適用しているか
6. CSV / JSON / config / CHANGELOGを同期したか

## alias追加時の境界

- 別canonicalが既に存在する語を、別タグのaliasへ統合しない。
- 表記揺れの横断追加は、canonical衝突・alias衝突が0件であることを確認してから反映する。
- NFKCで吸収できる全角/半角差はaliasへ過剰追加しない。
- 「短期3ヶ月」のように閾値条件を保証しない表現はlooseへ置く。

## 歓迎系alias

`応募歓迎` の `X歓迎` について:

- `XOK` / `X大歓迎` / `X積極採用` はstrict。
- `X可` は原則loose。
- `Xも可` は `X可` のconfidenceを維持した共通語尾variant。
- 既存loose表現から派生したOK等をstrictへ昇格させない。
- `活躍中` / `在籍` を歓迎タグへ一括変換しない。別canonicalがあれば必ず分離する。

## 応募表現variant

応募歓迎タグの `X歓迎` から `X応募OK` 等を大量alias化しない。matcher/configの `welcome_application_variants` を使う。

- strict source → 応募歓迎 / 応募OK / も応募OK はstrict
- loose source → 上記もlooseのまま
- 応募可 / も応募可 / 応募可能 / も応募可能 は常にloose
- 大歓迎・応募歓迎から再帰生成しない
- LINE応募可等の応募方法へ適用しない

## あり/なし・活躍表現

- あり / 有り / アリ、なし / 無し / ナシはmatcher共通variantを使い、同じconfidenceを維持する。
- 1文字の有 / 無は後続境界必須。残業有無、駐車場無料のような包含誤爆を許可しない。
- canonicalが活躍中で終わるタグは、X活躍を元confidenceで派生、X在籍はloose。
- X多数は共通variantにしない。
- 既存aliasがあるからといって、同じ機械的表記揺れをSheetへ重複追加し続けない。


## 就業場所判定

- Advancedでは `analyzeFields()` を使い、入力列名を保持したままmatcherへ渡す。
- 勤務場所名1・仕事名は強い証拠、仕事内容は文脈依存、住所・交通・面接地住所等は弱い証拠。
- `Xで / Xにて / X内で / X勤務` 等はpositive context。
- `Xへ配送 / Xへ納品 / Xを訪問 / Xを巡回 / Xから運ぶ / Xへ戻る` 等は原則reviewへ弱める。即suppressedにはしない。
- 就業場所タグは厳密な勤務地分類より広告マッチング上の合理的関連性を優先する。
- `海` はraw substring禁止。海老名・東京海上日動等の文字列事故を許可しない。
- オフィスの職種推論、ブランド名からの業態推定、点数制は現時点では未導入。
- `リサイクルショップ → サイクルショップ`、`居酒屋 → 酒屋`、`販売店 → 売店`、`ネットカフェ → カフェ` のような文字列包含だけの誤爆は除外語で抑止する。
- 上位就業場所タグを付ける場合は `config/matching-defaults.json` の `location_matching.implications` に明示する。matchedの子タグだけが親タグをmatchedへ派生させ、review/suppressedからは派生しない。


## 就業場所entity mapping

- 固有ブランド名・施設名は `data/location-entities.json` で管理し、alias列へ混ぜない。
- entityは最も特徴的で安定して言えるcanonicalへ直接mapする。上位タグは `location_matching.implications` へ委ねる。
- entity HITだけで即matchedにしない。勤務場所名・仕事名は強い証拠、仕事内容は就業文脈でmatched、配送・納品・訪問等はreview、住所・交通等はreview。
- `セントレア → 空港`、`セブンイレブン → コンビニエンスストア` のような固有名詞→カテゴリ変換はentity mapping。
- 企業名から業態を推測する一般推論は行わない。
- 短いASCII entity alias（KFC / USJ / GU / DCM等）はASCII token境界を要求する。
