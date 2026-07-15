import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under the Harris Exteriors site at /sales/
export default defineConfig({
  base: '/sales/',
  plugins: [react()],
})
