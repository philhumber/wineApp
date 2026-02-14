import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser
      }
    }
  },
  // Global rule overrides — suppress noisy rules until WIN-315 cleanup
  {
    rules: {
      // Allow _prefixed unused vars (destructuring, mock params)
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // Warn on explicit any — too many to fix at once
      '@typescript-eslint/no-explicit-any': 'warn',
      // Svelte navigation rules — SvelteKit resolve() pattern not yet adopted
      'svelte/no-navigation-without-resolve': 'warn',
      // Reactive loop detection has false positives in our patterns
      'svelte/infinite-reactive-loop': 'warn',
      // Each key warnings — valid but non-critical
      'svelte/require-each-key': 'warn',
      // Case block declarations — need braces but non-critical
      'no-case-declarations': 'warn',
      // Svelte reactivity rules — false positives in our patterns
      'svelte/no-reactive-functions': 'warn',
      'svelte/no-immutable-reactive-statements': 'warn',
      'svelte/no-unused-svelte-ignore': 'warn',
      'svelte/no-at-html-tags': 'warn',
      'svelte/prefer-svelte-reactivity': 'warn'
    }
  },
  // Svelte files — suppress false-positive no-undef for Svelte internals
  {
    files: ['**/*.svelte'],
    rules: {
      'no-undef': 'off'  // $$Generic, ScrollBehavior etc. are valid in Svelte/TS context
    }
  },
  // Relax rules further in test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**', 'src/test-setup.ts', 'src/app-mocks/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/', 'coverage/']
  }
);
