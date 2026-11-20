import { defineConfig, configDefaults } from 'vitest/config';
import fs from 'node:fs';

const hasWorkbuddy = fs.existsSync(new URL('./workbuddy-expert-team', import.meta.url)) || fs.existsSync('./workbuddy-expert-team');

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: [
      ...configDefaults.exclude,
      ...(!hasWorkbuddy ? ['tests/workbuddy/**'] : []),
    ],
  },
});
