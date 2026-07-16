import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under the Harris Exteriors site at /work/sales/
export default defineConfig({
  base: '/work/sales/',
  plugins: [react()],
})
