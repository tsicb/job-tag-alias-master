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
- 就業場所は施設名の出現だけで確定しない。
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
