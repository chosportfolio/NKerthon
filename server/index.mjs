import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(serverDirectory, '..')
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(serverDirectory, 'data', 'campus.db')
const dataDirectory = path.dirname(databasePath)
const distDirectory = path.join(rootDirectory, 'dist')
const port = Number(process.env.PORT) || 5174
const chatbotUrl = process.env.CHATBOT_URL || 'http://127.0.0.1:8000'

mkdirSync(dataDirectory, { recursive: true })

const database = new DatabaseSync(databasePath)
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_id TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    student_number TEXT NOT NULL UNIQUE,
    gender TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
`)

const userColumns = database.prepare('PRAGMA table_info(users)').all()
if (!userColumns.some((column) => column.name === 'role')) {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")
}
if (!userColumns.some((column) => column.name === 'profile_image')) {
  database.exec('ALTER TABLE users ADD COLUMN profile_image TEXT')
}

// 챗봇 답변 피드백 — 누가 썼는지(계정)는 저장하지 않는다
database.exec(`
  CREATE TABLE IF NOT EXISTS chat_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    department TEXT,
    admission_year TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    auto_flag TEXT,
    rating TEXT,
    reason TEXT,
    comment TEXT,
    rated_at TEXT
  );
`)

// 답변 직후 피드백을 받을 수 있도록 최근 답변만 메모리에 잠시 보관한다.
// DB에는 학생이 평가했거나, 답을 못 찾은 것으로 보이는 경우에만 남긴다.
const recentAnswers = new Map()
const RECENT_ANSWER_TTL_MS = 6 * 60 * 60 * 1000
const RECENT_ANSWER_LIMIT = 5000
const FEEDBACK_REASONS = ['wrong', 'bad_source', 'not_found', 'misunderstood', 'other']
const HEDGE_WORDS = ['확인이안', '확인되지않', '확인할수없', '자료에없', '자료에는없', '알수없', '찾지못']

function rememberAnswer(answerId, entry) {
  const now = Date.now()
  for (const [id, saved] of recentAnswers) {
    if (recentAnswers.size < RECENT_ANSWER_LIMIT && now - saved.createdAt < RECENT_ANSWER_TTL_MS) break
    recentAnswers.delete(id)
  }
  recentAnswers.set(answerId, { ...entry, createdAt: now })
}

/** 답을 못 찾았거나(단서 표현) 근거를 하나도 못 붙인 답변은 자동으로 모은다 */
function detectAutoFlag(answer, sources) {
  const compact = answer.replace(/\s/g, '')
  if (HEDGE_WORDS.some((word) => compact.includes(word))) return 'uncertain'
  if (!sources.some((source) => source?.url)) return 'no_source'
  return null
}

function insertFeedback(record, fields = {}) {
  const result = database.prepare(`
    INSERT INTO chat_feedback
      (department, admission_year, question, answer, sources, auto_flag, rating, reason, comment, rated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.department, record.admissionYear, record.question, record.answer,
    JSON.stringify(record.sources), record.autoFlag,
    fields.rating ?? null, fields.reason ?? null, fields.comment ?? null, fields.ratedAt ?? null,
  )
  return Number(result.lastInsertRowid)
}

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8' }

function sendJson(response, status, payload) {
  response.writeHead(status, jsonHeaders)
  response.end(JSON.stringify(payload))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 2_000_000) reject(new Error('요청 데이터가 너무 큽니다.'))
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('올바른 요청 형식이 아닙니다.'))
      }
    })
    request.on('error', reject)
  })
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

function isPasswordValid(password, salt, savedHash) {
  const received = Buffer.from(hashPassword(password, salt), 'hex')
  const saved = Buffer.from(savedHash, 'hex')
  return received.length === saved.length && timingSafeEqual(received, saved)
}

function publicUser(user) {
  return {
    id: user.id,
    loginId: user.login_id,
    name: user.name,
    department: user.department,
    studentNumber: user.student_number,
    gender: user.gender,
    role: user.role,
    profileImage: user.profile_image ?? null,
  }
}

function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  database.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
  ).run(tokenHash, userId, expiresAt)

  return token
}

function getSessionUser(request) {
  const authorization = request.headers.authorization ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return null

  const tokenHash = createHash('sha256').update(token).digest('hex')
  return database.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, new Date().toISOString())
}

async function handleApi(request, response, pathname) {
  if (request.method === 'POST' && pathname === '/api/signup') {
    const body = await readJson(request)
    const loginId = String(body.loginId ?? '').trim()
    const password = String(body.password ?? '')
    const name = String(body.name ?? '').trim()
    const department = String(body.department ?? '').trim()
    const studentNumber = String(body.studentNumber ?? '').trim()
    const gender = String(body.gender ?? '').trim()

    if (!loginId || !password || !name || !department || !studentNumber || !gender) {
      return sendJson(response, 400, { message: '모든 회원가입 정보를 입력해 주세요.' })
    }
    if (!/^[a-zA-Z0-9._-]{4,30}$/.test(loginId)) {
      return sendJson(response, 400, { message: '아이디는 영문, 숫자, 특수문자(._-)로 4~30자여야 합니다.' })
    }
    if (password.length < 8) {
      return sendJson(response, 400, { message: '비밀번호는 8자 이상이어야 합니다.' })
    }

    const duplicate = database.prepare(
      'SELECT login_id, student_number FROM users WHERE login_id = ? OR student_number = ?',
    ).get(loginId, studentNumber)

    if (duplicate) {
      const message = duplicate.login_id === loginId
        ? '이미 사용 중인 아이디입니다.'
        : '이미 등록된 학번입니다.'
      return sendJson(response, 409, { message })
    }

    const salt = randomBytes(16).toString('hex')
    database.prepare(`
      INSERT INTO users (login_id, password_hash, password_salt, name, department, student_number, gender)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(loginId, hashPassword(password, salt), salt, name, department, studentNumber, gender)

    return sendJson(response, 201, { message: '회원가입이 완료되었습니다.' })
  }

  if (request.method === 'POST' && pathname === '/api/login') {
    const body = await readJson(request)
    const loginId = String(body.loginId ?? '').trim()
    const password = String(body.password ?? '')
    const user = database.prepare('SELECT * FROM users WHERE login_id = ?').get(loginId)

    if (!user || !isPasswordValid(password, user.password_salt, user.password_hash)) {
      return sendJson(response, 401, { message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    }

    database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString())
    return sendJson(response, 200, { token: createSession(user.id), user: publicUser(user) })
  }

  if (request.method === 'GET' && pathname === '/api/me') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    return sendJson(response, 200, { user: publicUser(user) })
  }

  if (request.method === 'PATCH' && pathname === '/api/me/profile-image') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const body = await readJson(request)
    const profileImage = String(body.profileImage ?? '')
    const supportedImage = /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(profileImage)

    if (!supportedImage) {
      return sendJson(response, 400, { message: 'JPG, PNG 또는 WebP 이미지만 등록할 수 있습니다.' })
    }
    if (Buffer.byteLength(profileImage, 'utf8') > 1_500_000) {
      return sendJson(response, 413, { message: '프로필 이미지 용량이 너무 큽니다.' })
    }

    database.prepare('UPDATE users SET profile_image = ? WHERE id = ?').run(profileImage, user.id)
    const updatedUser = database.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    return sendJson(response, 200, { user: publicUser(updatedUser) })
  }

  if (request.method === 'POST' && pathname === '/api/chat') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const body = await readJson(request)
    const question = String(body.question ?? '').trim()
    if (!question || question.length > 500) {
      return sendJson(response, 400, { message: '질문은 1~500자로 입력해 주세요.' })
    }
    const history = Array.isArray(body.history)
      ? body.history
        .filter((turn) => ['user', 'assistant'].includes(turn?.role) && typeof turn?.content === 'string')
        .slice(-6)
        .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 4000) }))
      : []
    const language = ['ko', 'en', 'zh'].includes(body.language) ? body.language : 'ko'
    // 앱 시간표에 등록한 이번 학기 수업 ('오늘 수업 어디야?' 같은 질문에만 챗봇이 사용)
    const timetable = Array.isArray(body.timetable)
      ? body.timetable.slice(0, 30).flatMap((course) => {
        if (typeof course?.name !== 'string' || !course.name.trim()) return []
        const meetings = (Array.isArray(course.meetings) ? course.meetings : [])
          .filter((meeting) => /^[월화수목금토일]$/.test(meeting?.day ?? ''))
          .slice(0, 7)
          .map((meeting) => ({
            day: meeting.day,
            startTime: String(meeting.startTime ?? '').slice(0, 5),
            endTime: String(meeting.endTime ?? '').slice(0, 5),
            room: String(meeting.room ?? '').slice(0, 60),
          }))
        return [{
          name: course.name.trim().slice(0, 80),
          credits: Number(course.credits) || 0,
          professor: String(course.professor ?? '').slice(0, 40),
          meetings,
        }]
      })
      : []

    // 학과·학번은 화면이 아니라 로그인 정보에서 서버가 직접 붙인다 (위조 방지)
    const profile = {}
    if (user.department) profile['학과'] = user.department
    const admissionYear = String(user.student_number ?? '').match(/^(20\d{2})/)?.[1]
    if (admissionYear) profile['입학연도'] = admissionYear

    let chatbotResponse
    try {
      chatbotResponse = await fetch(`${chatbotUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': `user-${user.id}` },
        body: JSON.stringify({ question, history, profile, language, timetable }),
        signal: AbortSignal.timeout(60_000),
      })
    } catch {
      return sendJson(response, 503, { message: '챗봇 서버에 연결할 수 없습니다.', fallback: true })
    }
    const data = await chatbotResponse.json().catch(() => ({}))
    if (!chatbotResponse.ok) {
      const message = typeof data.detail === 'string' ? data.detail : '답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'
      return sendJson(response, chatbotResponse.status, { message })
    }
    const bubbles = Array.isArray(data.bubbles) ? data.bubbles : []
    const sources = Array.isArray(data.sources) ? data.sources : []
    const answer = typeof data.answer === 'string' ? data.answer : ''
    const clarify = data.clarify ?? null

    // 되묻기(학과·학번 확인)는 평가 대상이 아니다
    let answerId = null
    let autoFlag = null
    if (!clarify && answer) {
      answerId = randomBytes(12).toString('hex')
      autoFlag = detectAutoFlag(answer, sources)
      const record = {
        department: profile['학과'] ?? null,
        admissionYear: profile['입학연도'] ?? null,
        question,
        answer,
        sources: sources.map(({ title, url, kind, page }) => ({ title, url, kind, page })),
        autoFlag,
      }
      const feedbackId = autoFlag ? insertFeedback(record) : null
      rememberAnswer(answerId, { ownerId: user.id, record, feedbackId })
    }

    return sendJson(response, 200, { bubbles, sources, clarify, answer, answerId, autoFlag })
  }

  if (request.method === 'POST' && pathname === '/api/chat/feedback') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const body = await readJson(request)
    const saved = recentAnswers.get(String(body.answerId ?? ''))
    if (!saved || saved.ownerId !== user.id) {
      return sendJson(response, 404, { message: '평가할 수 있는 시간이 지났어요.' })
    }
    const rating = body.rating === 'up' || body.rating === 'down' ? body.rating : null
    if (!rating) return sendJson(response, 400, { message: '평가 값이 올바르지 않습니다.' })
    const reason = rating === 'down' && FEEDBACK_REASONS.includes(body.reason) ? body.reason : null
    const comment = rating === 'down' ? String(body.comment ?? '').trim().slice(0, 300) || null : null
    const ratedAt = new Date().toISOString()

    if (saved.feedbackId) {
      database.prepare('UPDATE chat_feedback SET rating = ?, reason = ?, comment = ?, rated_at = ? WHERE id = ?')
        .run(rating, reason, comment, ratedAt, saved.feedbackId)
    } else {
      saved.feedbackId = insertFeedback(saved.record, { rating, reason, comment, ratedAt })
    }
    return sendJson(response, 200, { ok: true })
  }

  if (request.method === 'DELETE' && pathname === '/api/logout') {
    const authorization = request.headers.authorization ?? ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''

    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex')
      database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    }

    return sendJson(response, 200, { message: '로그아웃되었습니다.' })
  }

  return sendJson(response, 404, { message: '요청한 API를 찾을 수 없습니다.' })
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

function serveStatic(response, pathname) {
  if (!existsSync(distDirectory)) {
    return sendJson(response, 404, { message: '프런트엔드 빌드 파일이 없습니다.' })
  }

  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1)
  let filePath = path.resolve(distDirectory, requestedPath)
  if (!filePath.startsWith(distDirectory) || !existsSync(filePath)) {
    filePath = path.join(distDirectory, 'index.html')
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
  })
  response.end(readFileSync(filePath))
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url.pathname)
      return
    }

    if (request.method === 'GET') {
      serveStatic(response, url.pathname)
      return
    }

    sendJson(response, 404, { message: '요청한 경로를 찾을 수 없습니다.' })
  } catch (error) {
    console.error(error)
    sendJson(response, 500, { message: '서버 처리 중 오류가 발생했습니다.' })
  }
})

server.listen(port, () => {
  console.log(`Campus API server: http://localhost:${port}`)
})
