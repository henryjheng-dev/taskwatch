import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/auth': {
        // 1. 只要看到前端網址是 /auth 開頭的請求
        target: 'http://localhost:3000', // 2. 悄悄幫我轉發到後端的 3000 Port
        changeOrigin: true, // 3. 欺騙後端。把請求的來源（Origin）偽裝成後端自己的網址，防止後端有些安全機制拒絕外部連線
        secure: false, // 4. 如果後端是沒有 SSL 憑證的 http（不是 https），也請放行
      },
    },
  },
});
