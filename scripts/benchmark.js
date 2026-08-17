import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const all = resolve(dirname(fileURLToPath(import.meta.url)), 'e2e-all-formats.js')
const env = { ...process.env, BENCHMARK: '1', CONCURRENCY: process.env.CONCURRENCY ?? '6' }
if (!process.env.FULL) {
  env.FAST = '1'
}
const result = spawnSync(process.execPath, [all], { env, stdio: 'inherit' })
process.exit(result.status ?? 0)
