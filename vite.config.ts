import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages（https://soma17910.github.io/mahjong-score/）で公開するため、
// アセットのパス基準を "/mahjong-score/" にしています。
export default defineConfig({
  base: '/mahjong-score/',
  plugins: [react()],
});
