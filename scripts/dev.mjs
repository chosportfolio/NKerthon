import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viteEntry = path.join(rootDirectory, 'node_modules', 'vite', 'bin', 'vite.js')
const chatbotDirectory = path.join(rootDirectory, 'chatbot')

// 챗봇(파이썬) 실행 파일: CHATBOT_PYTHON 환경변수 > 활성화된 conda 환경 > conda 'kku' 환경 > python
function findPython() {
  if (process.env.CHATBOT_PYTHON) return process.env.CHATBOT_PYTHON
  const exe = process.platform === 'win32' ? 'python.exe' : path.join('bin', 'python')
  const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
  const candidates = [
    process.env.CONDA_PREFIX && path.join(process.env.CONDA_PREFIX, exe),
    path.join('C:\\miniconda3', 'envs', 'kku', exe),
    path.join(home, 'miniconda3', 'envs', 'kku', exe),
    path.join(home, 'anaconda3', 'envs', 'kku', exe),
  ].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate)) ?? 'python'
}

let shuttingDown = false

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

// 챗봇은 선택 사항: 꺼지거나 실행에 실패해도 앱은 계속 동작한다 (CHATBOT_DISABLED=1 이면 켜지 않음)
let chatbot = null
if (process.env.CHATBOT_DISABLED !== '1' && existsSync(path.join(chatbotDirectory, 'app_server.py'))) {
  const python = findPython()
  chatbot = spawn(python, ['app_server.py'], {
    cwd: chatbotDirectory,
    stdio: 'inherit',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  })
  chatbot.on('error', () => {
    console.warn(`[chatbot] 파이썬을 실행하지 못했습니다 (${python}). CHATBOT_PYTHON 환경변수로 경로를 지정하세요.`)
  })
  chatbot.on('exit', (code) => {
    if (!shuttingDown) console.warn(`[chatbot] 챗봇 서버가 종료되었습니다 (code ${code}). 앱은 계속 동작합니다.`)
  })
}

const stopAll = (exitCode = 0) => {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of [...children, chatbot].filter(Boolean)) {
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
