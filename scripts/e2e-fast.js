import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const all = resolve(dirname(fileURLToPath(import.meta.url)), 'e2e-all-formats.js')
const result = spawnSync(process.execPath, [all], {
  env: { ...process.env, FAST: '1', CONCURRENCY: process.env.CONCURRENCY ?? '1' },
  stdio: 'inherit',
})
process.exit(result.status ?? 0)
