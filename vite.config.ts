import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 公開先で base パスを切り替える：
//  - Vercel（VERCEL=1 がビルド時に付く）: ルート '/'（写真機能つき）
//  - GitHub Pages（npm run deploy）: '/mahjong-score/'（写真機能なし）
export default defineConfig({
  base: process.env.VERCEL ? '/' : '/mahjong-score/',
  plugins: [react()],
});
