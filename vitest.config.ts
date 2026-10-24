import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    // Development-only aids used by the password-reset regression test.
    // assertProductionSecrets() refuses to boot if these are enabled in production.
    env: {
      NODE_ENV: 'test',
      MAIL_PROVIDER: 'console',
      EXPOSE_DEV_RESET_TOKEN: 'true',
      SESSION_SECRET: 'test-only-session-secret-0123456789abcdef',
    },
  },
});
