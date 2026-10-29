import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        XLSX: 'readonly',
        buildSmashizaDemo: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-import-assign': 'error',
      'no-unused-vars': ['warn', { vars: 'all', args: 'none', caughtErrors: 'none' }],
    },
  },
];
