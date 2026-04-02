import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  return {
    // CRITICAL: This matches your exact repo name on GitHub
    // If you ever rename the repo, you must update this string.
    base: '/PomodoroTimer/',

    plugins: [react(), tailwindcss()],
    
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    
    resolve: {
      alias: {
        // Points '@' to the current directory (root)
        '@': path.resolve(__dirname, '.'),
      },
    },

    build: {
      // Ensures the output goes to 'dist', which your deploy script expects
      outDir: 'dist',
    },

    server: {
      // Re-enabled HMR for your local Arch Linux development
      hmr: true,
    },
  };
});
