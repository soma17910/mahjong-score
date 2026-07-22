import { defineConfig } from 'vitest/config';

// テスト専用の設定。Vite プラグイン（React / Tailwind）を読み込まず、
// 純粋なロジック（score.ts）だけを高速にテストします。
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
