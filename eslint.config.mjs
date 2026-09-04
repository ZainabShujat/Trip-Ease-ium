import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Architecture rule (Phase 0, §15.2): the planning engine must stay pure
  // TypeScript. It may not import React, Next.js, Prisma or any provider —
  // it takes plain data in and returns plain data out so it can be unit
  // tested without a server, a database or an API key.
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/engine must stay framework-free.' },
            { name: 'next', message: 'src/engine must stay framework-free.' },
            { name: '@prisma/client', message: 'src/engine must not touch the database.' },
          ],
          patterns: [
            {
              group: ['next/*', '@/app/*', '@/components/*', '@/server/*', '@/providers/*'],
              message:
                'src/engine must stay pure: accept plain data as arguments instead of importing app, server or provider modules.',
            },
          ],
        },
      ],
    },
  },

  // Prettier last so formatting rules win.
  prettier,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'src/generated/**',
  ]),
]);

export default eslintConfig;
