// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // 💡 兔哥改了這裡：把 prisma.config.ts 和 dist 等編譯產物一起放進全局忽略清單
    ignores: [
      'eslint.config.mjs',
      'prisma.config.ts',
      'dist/**/*',
      'node_modules/**/*',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        // Use relative path to root for monorepo support
        tsconfigRootDir: new URL('.', import.meta.url).pathname.replace(
          /^\/([A-Z]:\/)/,
          '$1',
        ),
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
);
