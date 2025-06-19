import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import unusedImports from 'eslint-plugin-unused-imports'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'

export default [
  {
    ignores: [
      'dist',
      'node_modules',
      '*.svelte',
      '*.snap',
      '*.d.ts',
      'coverage',
      'js_test',
      'local-data',
      'prisma/**',
      'electron-builder.config.cjs',
      'scripts/**',
    ],
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    ignores: ['**/*.d.ts', 'prisma/**', 'scripts/**'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: {
        node: true,
        jest: true,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': typescriptEslint,
      'prettier': prettier,
    },
    rules: {
      ...prettierConfig.rules,
      'object-shorthand': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': [
        'error',
        // 개인 선호에 따라 prettier 문법 적용
        {
          singleQuote: true,
          semi: false,
          useTabs: false,
          tabWidth: 2,
          trailingComma: 'all',
          bracketSpacing: true,
          arrowParens: 'avoid',
          endOfLine: 'auto',
          printWidth: 120,
        },
      ],
    },
  },
]
