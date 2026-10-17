import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), {
    name: 'operations-static-entry',
    apply: 'build',
    async writeBundle(output) {
      const directory = resolve(output.dir || 'dist')
      const html = await readFile(resolve(directory, 'index.html'), 'utf8')
      await mkdir(resolve(directory, 'operations'), { recursive: true })
      await writeFile(resolve(directory, 'operations/index.html'), html)
    },
  }],
})
