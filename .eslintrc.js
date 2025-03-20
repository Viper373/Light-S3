// This file is kept for backward compatibility with older tools
// The main ESLint configuration is now in eslint.config.cjs
module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es6: true
  },
  globals: {
    process: 'readonly',
    console: 'readonly',
    window: 'readonly',
    document: 'readonly',
    localStorage: 'readonly',
    fetch: 'readonly',
    URL: 'readonly',
    URLSearchParams: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly'
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/essential'
  ],
  parserOptions: {
    parser: '@babel/eslint-parser',
    ecmaVersion: 2020,
    sourceType: 'module',
    requireConfigFile: false
  },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/multi-word-component-names': 'off'
  },
  overrides: [
    {
      files: ['**/*.cjs'],
      env: {
        node: true
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'writable',
        require: 'readonly'
      }
    }
  ]
};