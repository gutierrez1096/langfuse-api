module.exports = {
    env: {
      node: true,
      commonjs: true,
      es2021: true,
      jest: true,
    },
    extends: [
      'eslint:recommended',
      'plugin:node/recommended',
      'plugin:jest/recommended',
      'prettier',
    ],
    plugins: ['jest', 'prettier'],
    parserOptions: {
      ecmaVersion: 2022,
    },
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'warn',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'node/no-unsupported-features/es-syntax': [
        'error',
        { ignores: ['modules'] },
      ],
      'jest/expect-expect': 'warn',
      'node/no-unpublished-require': [
        'error', 
        { allowModules: ['supertest'] }
      ],
      'node/no-missing-require': 'error',
      'node/no-extraneous-require': 'error',
      'node/no-deprecated-api': 'warn',
      'strict': ['error', 'global'],
    },
    overrides: [
      {
        files: ['tests/**/*.js', '**/*.test.js'],
        rules: {
          'node/no-unpublished-require': 'off',
        },
      },
    ],
  };