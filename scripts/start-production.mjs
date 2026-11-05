import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const python = process.env.CHATBOT_PYTHON || 'python3'
let stopping = false

// 챗봇 서버는 같은 컨테이너의 Node 서버만 부르므로 내부 주소(127.0.0.1)에만 연다 (--lan 쓰지 않음)
const chatbot = spawn(python, ['app_server.py', '--port', '8000'], {
  cwd: path.join(rootDirectory, 'chatbot'),
  stdio: 'inherit',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
})

const api = spawn(process.execPath, [path.join(rootDirectory, 'server', 'index.mjs')], {
  cwd: rootDirectory,
  stdio: 'inherit',
  env: { ...process.env, CHATBOT_URL: 'http://127.0.0.1:8000' },
})

const running = new Set([chatbot, api])
for (const child of running) child.on('exit', () => running.delete(child))

// 재배포 때 바로 끄지 않고, 각 서버가 정리(특히 DB 닫기)를 마칠 때까지 기다린 뒤 종료
function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of running) child.kill('SIGTERM')
  const done = () => process.exit(exitCode)
  const timer = setTimeout(done, 10_000)                    // 10초 안에 안 끝나면 강제 종료
  const check = setInterval(() => {
    if (running.size === 0) {
      clearInterval(check)
      clearTimeout(timer)
      done()
    }
  }, 100)
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
