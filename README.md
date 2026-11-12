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

## 鍵情報の扱い

- 鍵・トークン・パスワードは、コードにもリポジトリにも入れません。
- `.env` と `.env.*` は Git の管理外です（`.env.example` のみ管理対象で、実際の値は書きません）。
- コミット時と、競合のない merge で merge コミットを作るときに、[secretlint](https://github.com/secretlint/secretlint) が、コミットしようとしているファイルをチェックし、鍵らしき文字列があればコミットを止めます（simple-git-hooks + lint-staged）。
- rebase と cherry-pick ではこのチェックが動きません。CI の鍵チェック（`npm run secretlint`）で確かめます。
- ブラウザで動くコードに書いた値は、利用者から見えます。秘密の値をブラウザ側に置かないでください。

## ライセンス

MIT
