import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url:
      process.env.DATABASE_URL ||
      'mysql://root:test@localhost:3307/task_management',
  },
});
