// ESLint の設定（Flat Config 形式）
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// MVP のプライバシーの決まり（位置情報を使わない・撮影画像や推しの画像を外部に送らない）を守るため、
// 位置情報と外部送信の API を使うとエラーにする。限界と理由は README の「プライバシーの決まりと lint」を参照。
// 将来サーバーを使うことになったら、このルールは外すか調整する。
const privacyMessage =
  'MVP では位置情報を使わず、撮影画像や推しの画像を外部に送りません（README の「プライバシーの決まりと lint」を参照）。';

// 外部送信に使えるグローバルの API
const networkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket'];
// window.fetch のように、グローバルのオブジェクト経由で書いた場合も止める
const globalObjects = ['window', 'globalThis', 'self'];

const privacyRules = {
  'no-restricted-globals': [
    'error',
    ...networkGlobals.map((name) => ({
      name,
      message: privacyMessage,
    })),
  ],
  'no-restricted-properties': [
    'error',
    // navigator.geolocation と navigator.sendBeacon（どのオブジェクト経由でも止める）
    { property: 'geolocation', message: privacyMessage },
    { property: 'sendBeacon', message: privacyMessage },
    ...globalObjects.flatMap((object) =>
      networkGlobals.map((property) => ({
        object,
        property,
        message: privacyMessage,
      })),
    ),
  ],
};

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // アプリのコード（ブラウザで動く src/ 配下）にだけプライバシーのルールを当てる
  {
    files: ['src/**/*.{js,ts}'],
    rules: privacyRules,
  },
  // 整形のルールは Prettier に任せるため、ESLint 側の整形ルールを無効にする（最後に置く）
  eslintConfigPrettier,
);
