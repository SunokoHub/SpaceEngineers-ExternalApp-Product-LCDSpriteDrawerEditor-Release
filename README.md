# LCD Sprite Drawer Editor

Space Engineers の LCD Sprite Drawer 向け設定編集アプリ。Windows x64 向け。

## ダウンロードと起動

[Releases](https://github.com/SunokoHub/SpaceEngineers-ExternalApp-Product-LCDSpriteDrawerEditor-Release/releases) の公開済み ZIP を使用。ZIP 全体を展開し、版別フォルダーの `LCD Sprite Drawer Editor.exe` を起動。Node.js の導入は不要。リリースがない場合はソースからビルド。

## 操作

1. ゲーム側の LCD Sprite Drawer で対象 LCD の設定と面情報を準備。
2. 「ゲームから読み込む」へ対象 LCD の CustomData 全文を入力。
3. 対象面を選択し、画像・文字・動作・変数連動を編集。
4. 「保存」で編集用プロジェクトを `.lcdproj` に保存。既存の対応 `.json` も読込可能。
5. 「ゲームへ書き出す」へ出力先 LCD の最新 CustomData 全文を入力し、対象面を選択して貼付け用データを作成。
6. 元文書を控えた上で、作成した全文を対象 LCD の CustomData へ保存し、ゲーム側スクリプトで再読込。

ゲームとの直接接続・自動書込は行わない。プレビューは簡易図形・代替フォントによる近似表示。ゲーム内アセットは同梱せず、入出力する素材名と FontId は保持。

保存形式5に対応し、現行契約の形式4は読込時に変換。形式1〜3と旧契約は非対応。ConfigFormatVersion・SurfaceInfoFormatVersion は1。ゲーム側との互換性は形式番号だけでは判定できない。対応契約は `src/model.ts` の `CONTRACT` を参照。

Windows 実機での配布 EXE の起動・設定／復旧保持とゲーム内の結合照合は確認待ち。自動テストの成功は実機確認を意味しない。

## 開発

Node.js 24 と npm が必要。

```sh
npm ci
npm test
npm run build
npm start
```

ブラウザーでの開発確認は `npm run dev`。

```sh
npx playwright install chromium
npm run test:ui
npm run test:desktop
npm run dist:win
```

Windows x64 の ZIP は `release/` に生成。同名 ZIP が存在する場合は停止。依存ファイルを内包したポータブル EXE と README.txt をアプリ名／バージョン直下に配置。

`tests/fixtures/` は架空の面情報・設定を使うテストデータ。`examples/` は入力例。ゲーム内アセットは含まない。

## ライセンス

本プロジェクトのソースコードは [MIT License](LICENSE)。Electron 等の依存ソフトウェアは各ライセンスに従う。MIT の適用対象にゲーム内アセットや第三者の権利は含まれない。
