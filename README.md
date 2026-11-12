# oshi-tabi

推しと巡る「推し旅アプリ」（Webアプリ）のリポジトリです。ブラウザだけで動き、サーバーは使いません（MVP 時点）。

## 必要なもの

- Node.js 22（v22.13.1 で動作確認）
- Git

## セットアップ

```sh
git clone https://github.com/Yutapomu31/oshi-tabi.git
cd oshi-tabi
npm install
```

`npm install` を実行すると、コミット前に鍵の混入をチェックする仕組み（pre-commit フックと pre-merge-commit フック）も自動で設定されます。

## コマンド

| コマンド             | 説明                                                           |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | 開発用サーバーを起動します（表示された URL をブラウザで開く）  |
| `npm run build`      | 型チェックをしてから、公開用のファイルを `dist/` に作ります    |
| `npm run preview`    | `build` で作ったファイルを手元で確認します                     |
| `npm run lint`       | ESLint でコードの問題をチェックします                          |
| `npm run format`     | Prettier でコードの見た目を整えます（ファイルを書き換えます）  |
| `npm run typecheck`  | TypeScript の型チェックだけを行います                          |
| `npm test`           | Vitest でテストを実行します                                    |
| `npm run secretlint` | リポジトリ全体に鍵・トークンらしき文字列がないかチェックします |

`npm run format:check` は、ファイルを書き換えずに整形済みかどうかだけを確認します。

## プライバシーの決まりと lint

MVP では、位置情報を使わず、撮影画像や推しの画像を外部に送りません。この決まりに反するコードを見つけるため、ESLint の設定（`eslint.config.js`）で、次の API を使うとエラーにしています。対象はブラウザで動くアプリのコード（`src/` 配下）です。

| API                     | エラーにする理由                               |
| ----------------------- | ---------------------------------------------- |
| `navigator.geolocation` | 位置情報を取得する API のため                  |
| `fetch`                 | 外部にデータを送れるため                       |
| `XMLHttpRequest`        | 外部にデータを送れるため                       |
| `navigator.sendBeacon`  | ページを閉じるときなどに外部へデータを送るため |
| `WebSocket`             | 外部と通信し続けられるため                     |

`window.fetch`、`globalThis.fetch`、`self.fetch` のように、グローバルのオブジェクトを経由して書いた場合もエラーにします（`XMLHttpRequest` と `WebSocket` も同じです）。将来サーバーを使うことになったら、このルールは外すか調整します。

### lint では防げないこと

lint はコードの書き方を見るだけなので、次の場合は止められません。

- 変数に入れ直してから使う書き方（`const g = globalThis; g.fetch(url)`）や、名前を文字列で組み立てる書き方
- 上の表にない送信の方法（画像の `src` に URL を入れる、`EventSource`、`RTCPeerConnection`、フォームの送信、`import()` で外部の URL を読むなど）
- `index.html` や CSS に書いた外部の URL
- 依存パッケージ（`node_modules`）の中の通信
- `src/` の外のファイル

そのため、lint のほかに、PR の差分と、ブラウザの開発者ツールの Network タブでも、外部への通信がないかを確かめます。

## 鍵情報の扱い

- 鍵・トークン・パスワードは、コードにもリポジトリにも入れません。
- `.env` と `.env.*` は Git の管理外です（`.env.example` のみ管理対象で、実際の値は書きません）。
- コミット時と、競合のない merge で merge コミットを作るときに、[secretlint](https://github.com/secretlint/secretlint) が、コミットしようとしているファイルをチェックし、鍵らしき文字列があればコミットを止めます（simple-git-hooks + lint-staged）。
- rebase と cherry-pick ではこのチェックが動きません。CI の鍵チェック（`npm run secretlint`）で確かめます。
- ブラウザで動くコードに書いた値は、利用者から見えます。秘密の値をブラウザ側に置かないでください。

## ライセンス

MIT
