# マッチングルール

## 基本思想

求人の意味に沿ったタグ候補を安定して抽出する。誤爆コストが高い項目は保守的に扱う。

## グローバル設定

機械可読な既定値は `config/matching-defaults.json` を参照する。

### 短いASCIIトークン

`token_exact` と3文字以下のASCII aliasは、大小を無視しつつraw substringではなく境界一致する。

基本形:

```text
(?<![A-Za-z0-9_])TOKEN(?![A-Za-z0-9_])
```

日本語はASCII token文字に含めないため、`生成AI` / `AI活用` / `STスタッフ` は一致する。一方、`mail` 内のAI、`staff` 内のSTは一致しない。

この仕様では `OpenAI` 内のAIは自動一致しない。必要ならOpenAIを別aliasとして明示的に追加する。

### 可 / OK の「も」

canonical / strict aliasの末尾が `可` または `OK` の場合だけ、直前の `も` を任意として扱う。

- `車通勤可` → `車通勤も可` も一致
- `副業OK` → `副業もOK` も一致

「も」を文章全体から削除するような正規化は禁止。

## 今回追加した代表alias

- `例外事由3号イ` → `例外事由3号のイ` / `例外事由3号 イ`
- `U・Iターン歓迎` → `UIターン歓迎` / `U/Iターン歓迎` / `Uターン・Iターン歓迎`
- `三交代制` → `三交代` / `3交代` / `三交替` / `3交替` など
- 二交代制も同じ規則で補強
- PT / OT / ST → 理学療法士 / 作業療法士 / 言語聴覚士のloose alias

## match_policy

### normal
canonical / alias_strictを通常判定する。

### context
単語だけで意味や関係性が確定できないタグ。

### pattern
数値・形式・閾値で判断する。

### token_exact
短い英数字タグをASCII token境界で判定する。

### strict_only
予約済み。

## alias_loose

loose aliasは近い意味・業界略語などを保持するが、文脈次第で別意味になり得る。PT / OT / STのような短縮語はtoken境界に加え、必要に応じて医療・リハビリ文脈を確認する。
