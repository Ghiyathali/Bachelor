import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths are required when the packaged app is loaded via file://.
  base: './',
  plugins: [react(), tailwindcss()],
})
