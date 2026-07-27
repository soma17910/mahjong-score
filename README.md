# 麻雀 点数計算アプリ 🀄

麻雀の点数を計算できるWebアプリです。麻雀のルールに詳しくない人でも使えるよう、専門用語には画面上で簡単な説明を添えています。

**公開URL**: https://soma17910.github.io/mahjong-score/

## 機能

### フェーズ1：翻・符から計算
翻数・符数・親/子・ロン/ツモ・本場を選ぶと、支払い点数を計算します。

### フェーズ2：手牌から自動計算
牌ボタンで14枚の手牌を入力すると、和了形を判定し、役・翻・符・点数を自動計算します（門前＝鳴きなしの手に対応）。

対応役：リーチ / 門前ツモ / ピンフ / タンヤオ / 役牌 / 一盃口 / 二盃口 / 三色同順 / 一気通貫 / チャンタ / 純チャン / 対々和 / 三暗刻 / 小三元 / 七対子 / 混一色 / 清一色、役満は 国士無双 / 四暗刻 / 大三元 / 字一色。

### ゲーム人数（4人 / 3人）
3人麻雀のツモ損ルール、2〜8萬の除外、北抜き（抜きドラ）、「北を役牌にする」トグルに対応。

### 写真から入力（AIによる牌認識・Vercel公開時のみ）
手牌の写真を撮る/選ぶと、Claudeの画像認識で牌を読み取り、フェーズ2に自動入力します。認識は完璧ではないので、確認・修正してから計算します。サーバーレス関数 `api/recognize.ts` がAPIキーを安全に保持します。

## 技術スタック

- React + TypeScript + Vite
- Tailwind CSS
- 点数計算ロジックは外部ライブラリを使わず自前実装（Vitest 44件のテスト）
- 写真認識：Vercel サーバーレス関数 + Anthropic Claude（画像入力）

## 開発

```bash
npm install     # 依存関係のインストール
npm run dev     # 開発サーバー起動（http://localhost:5173/mahjong-score/）
npm test        # テスト実行
npm run build   # 本番ビルド（dist/ に出力）
```

## デプロイ

### GitHub Pages（写真機能なし）
```bash
npm run deploy   # ビルドして gh-pages ブランチへ公開
```
`gh-pages` ブランチが公開元。base は `/mahjong-score/`。写真機能は非表示になります。

### Vercel（写真機能あり）
1. Vercelにこのリポジトリを import（Framework: Vite が自動検出される）。
2. プロジェクトの Settings → Environment Variables に `ANTHROPIC_API_KEY` を登録（値は https://console.anthropic.com のAPIキー）。
3. デプロイすると `/api/recognize` が有効になり、写真機能が使えます（base は `/`）。

> APIキーはVercelの環境変数にのみ保存され、ブラウザには出ません。写真1枚あたり数円程度の従量課金です。
