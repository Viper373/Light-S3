const eslint = require('@eslint/js');
const vue = require('eslint-plugin-vue');
const babelParser = require('@babel/eslint-parser');
const vueParser = require('vue-eslint-parser');

// 避免使用展开操作符，直接使用vue推荐配置
module.exports = [
  eslint.configs.recommended,
  // 使用单个配置对象替代展开操作符，避免循环引用
  vue.configs['flat/essential'],
  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: babelParser,
        ecmaVersion: 2020,
        sourceType: 'module',
        requireConfigFile: false,
      },
      globals: {
        node: true,
        browser: true,
        es6: true,
        process: 'readonly',
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        node: true,
        process: 'readonly',
        console: 'readonly',
        module: 'writable',
        require: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
  },
];