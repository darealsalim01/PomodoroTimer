import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from directory '.', 'process.cwd()' is standard for TS
  const env = loadEnv(mode, process.cwd(), '');

  return {
    /** * CRITICAL: This matches your exact GitHub Repository name.
     * This ensures assets like index.js are loaded from:
     * darealsalim01.github.io/PomodoroTimer/assets/...
     */
    base: '/PomodoroTimer/',

    plugins: [
      react(),
      tailwindcss(),
    ],

    define: {
      // Prevents "process is not defined" errors in the browser
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },

    resolve: {
      alias: {
        // Sets '@' as an alias for your root directory
        '@': path.resolve(__dirname, '.'),
      },
    },

    build: {
      // Standard output directory for Netlify and GitHub Actions
      outDir: 'dist',
      // Ensures assets are hashed for cache busting
      assetsDir: 'assets',
      // Generates smaller, cleaner production builds
      sourcemap: false,
    },

    server: {
      // Enabled for your local Arch Linux development
      hmr: true,
    },
  };
});
