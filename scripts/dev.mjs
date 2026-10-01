import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteEntry = path.join(rootDirectory, 'node_modules', 'vite', 'bin', 'vite.js')
const children = [
  spawn(process.execPath, [path.join(rootDirectory, 'server', 'index.mjs')], {
    cwd: rootDirectory,
    stdio: 'inherit',
  }),
  spawn(process.execPath, [viteEntry], {
    cwd: rootDirectory,
    stdio: 'inherit',
  }),
]

let shuttingDown = false

const stopAll = (exitCode = 0) => {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill()
  }

  process.exit(exitCode)
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!shuttingDown) stopAll(signal ? 1 : (code ?? 0))
  })
}

process.on('SIGINT', () => stopAll())
process.on('SIGTERM', () => stopAll())
