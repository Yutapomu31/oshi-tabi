// ESLint の設定（Flat Config 形式）
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // 整形のルールは Prettier に任せるため、ESLint 側の整形ルールを無効にする（最後に置く）
  eslintConfigPrettier,
);
