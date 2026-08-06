# 支援教材 学習記録ブリッジ（Chrome拡張 / Manifest V3）

brain-program の学習「開始」と「結果（得点）」を検知して、支援教材管理アプリの
受信API（`/api/study/start` / `/api/study/finish`）へ自動送信します。
ダッシュボード（`/study`）にリアルタイム表示されます。

## 1. 設定（必須）
`background.js` の先頭を編集します。

```js
const API_BASE = "https://support-material-manager.vercel.app"; // 本番URL
const API_KEY  = "（Vercelの環境変数 STUDY_API_KEY と同じ値）";
```

- `API_KEY` は、アプリ側（Vercel）に設定する `STUDY_API_KEY` と **同じ文字列** にします。
- 適当な長めのランダム文字列を1つ決めて、両方に同じものを入れてください。

## 2. インストール

### A. PCのChrome / Edge（まず動作確認用）
1. `chrome://extensions` を開く
2. 右上の「デベロッパー モード」をON
3. 「パッケージ化されていない拡張機能を読み込む」→ この `extension` フォルダを選択

### B. Androidタブレット（Kiwi Browser・本番用）
Kiwi はフォルダを直接読めないので、**zipにして**読み込みます。
1. この `extension` フォルダの**中身**（`manifest.json` が **zipの直下**に来るように）をzip圧縮する
   - ※ フォルダごとではなく「中身」をzipにするのがポイント
2. Kiwi のメニュー →「拡張機能（Extensions）」
3. 「デベロッパー モード」をON →「＋（.zip/.crx/.user.js から）」→ 作ったzipを選択
4. 有効化する

## 3. 使い方
- タブレットで brain-program に生徒がログインし、**問題を開始**すると「開始」が送信されます。
- **結果画面（得点）**が表示されると「結果」が送信されます。
- 施設のPCで `https://support-material-manager.vercel.app/study` を開くと、
  **本日のリアルタイム学習状況**に反映されます（再読込不要）。

## 4. 調整について（重要）
結果画面からの項目抽出（`content.js` の `extractResult`）と、開始/結果の判定
（`content.js` の `CONFIG`）は、実際の画面に合わせて微調整が必要な場合があります。

- 画面で **F12 →「Console」** を開くと、`[学習記録ブリッジ]` のログで
  「何を検知・抽出・送信したか」が確認できます。
- うまく取れない項目があれば、そのログと結果画面のHTMLを開発者に共有してください。
  `CONFIG` の判定パターンや抽出ロジックを合わせます。

## 5. 送信されるデータ
- 開始：`{ studentId, roomId, title, startTime }`
- 結果：`{ studentId, roomId, studentName, title, score, average, max, cumulative, date }`

※ 認証情報（ID/パスワード）は一切送信しません。ログイン済みの画面の表示内容だけを読み取ります。
