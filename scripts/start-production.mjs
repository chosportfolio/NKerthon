import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.CHATBOT_PYTHON || 'python3'
let stopping = false

const chatbot = spawn(python, ['app_server.py', '--lan', '--port', '8000'], {
  cwd: path.join(rootDirectory, 'chatbot'),
  stdio: 'inherit',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
})

const api = spawn(process.execPath, [path.join(rootDirectory, 'server', 'index.mjs')], {
  cwd: rootDirectory,
  stdio: 'inherit',
  env: { ...process.env, CHATBOT_URL: 'http://127.0.0.1:8000' },
})

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of [chatbot, api]) {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.exit(exitCode)
}

chatbot.on('error', (error) => {
  console.error('[chatbot] 실행 실패:', error.message)
  stop(1)
})
api.on('error', (error) => {
  console.error('[api] 실행 실패:', error.message)
  stop(1)
})
chatbot.on('exit', (code) => { if (!stopping) stop(code ?? 1) })
api.on('exit', (code) => { if (!stopping) stop(code ?? 1) })
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
