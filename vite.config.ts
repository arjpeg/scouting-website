import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  server: {
    hmr: false, // disable Vite HMR/auto-reload; manual refresh only
  },
})
