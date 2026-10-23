import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths are required when the packaged app is loaded via file://.
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Keep renderer requests same-origin during development. Vite forwards them
      // to the ASP.NET server, avoiding a development-only CORS requirement.
      '/api': {
        target: 'https://localhost:5001',
        changeOrigin: true,
        // Only this local development proxy accepts the self-signed .NET certificate.
        secure: false,
      },
    },
  },
})
