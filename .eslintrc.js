// .eslintrc.js
module.exports = {
    root: true,
    env: {
        node: true,
        es6: true
    },
    extends: [
        'plugin:vue/vue3-essential',
        'eslint:recommended'
    ],
    parserOptions: {
        parser: 'babel-eslint',
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    rules: {
        'no-unused-vars': ['error', {
            argsIgnorePattern: '^_', // 允许以下划线开头的未使用参数
            varsIgnorePattern: '^_'
        }],
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'vue/multi-word-component-names': 'off'
    }
}