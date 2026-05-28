module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    // ── TypeScript: type annotations ─────────────────────────────────────────
    // Public interfaces and service boundaries should carry return types, but
    // internal helpers can be inferred — leave the choice to the developer.
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // Warn on `any` — use `unknown` for truly unknown values, or narrow the type.
    '@typescript-eslint/no-explicit-any': 'warn',

    // Unused vars: prefix with _ to intentionally suppress (e.g. _requestId).
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // ── TypeScript: async / Promise safety ───────────────────────────────────
    // Catch unhandled fire-and-forget promises — prefix with `void` when intentional.
    '@typescript-eslint/no-floating-promises': 'error',

    // Prevent `await`ing a non-Promise (common misuse / typo).
    '@typescript-eslint/await-thenable': 'error',

    // Prevent async functions where void-return is expected (e.g. Array.forEach).
    // checksVoidReturn: false — NestJS lifecycle hooks & route handlers are exempt.
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: false },
    ],

    // ── TypeScript: modern idioms ────────────────────────────────────────────
    // Prefer `?.` over `&&`-chaining: `a?.b?.c` vs `a && a.b && a.b.c`.
    '@typescript-eslint/prefer-optional-chain': 'warn',

    // Prefer `??` over `||` for null/undefined guards (preserves falsy 0 / '').
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',

    // Flag `as Type` casts when TypeScript already knows the type.
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',

    // Enforce `import type` for type-only imports — tree-shakable, zero runtime cost.
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],

    // ── General JS / TS quality ──────────────────────────────────────────────
    // Use NestJS Logger instead of console — consistent log format & log levels.
    'no-console': 'warn',

    // Strict equality everywhere — no implicit type coercion bugs.
    eqeqeq: ['error', 'always'],

    // Never use var — const/let only.
    'no-var': 'error',

    // Use const when a binding is never reassigned.
    'prefer-const': 'error',
  },

  // ── Per-file overrides ─────────────────────────────────────────────────────
  overrides: [
    {
      // Test files — relax rules that are noisy in mock/fixture code.
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'src/test/**/*.ts'],
      rules: {
        // Mock objects frequently need `as any` to bypass strict typing.
        '@typescript-eslint/no-explicit-any': 'off',
        // Test factories may have unhandled promises in beforeEach/afterEach.
        '@typescript-eslint/no-floating-promises': 'warn',
      },
    },
  ],
};
