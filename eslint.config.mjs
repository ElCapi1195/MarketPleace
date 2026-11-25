import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const restrict = (group, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group, message }] }],
});

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/next-env.d.ts', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
    rules: {
      'max-lines': ['error', { max: 500 }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: restrict(
      ['pg', 'ioredis', '@prisma/*', '@nestjs/*', '**/apps/api/**'],
      'La web solo presenta: no accede a persistencia ni al backend por dentro.',
    ),
  },
  {
    files: ['apps/api/src/**/*.controller.ts'],
    rules: restrict(
      ['pg', 'ioredis', '@prisma/*', '**/*.repository.js'],
      'Un controlador solo llama a servicios.',
    ),
  },
);
