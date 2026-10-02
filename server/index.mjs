import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
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
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
)
const academicCalendarSourceUrl = 'https://www.kku.ac.kr/cms/FR_CON/index.do?MENU_ID=1350'
const academicCalendarApiUrl = 'https://www.kku.ac.kr/ajax/FR_SCH_SVC/ScheduleListData.do'
const academicCalendarFallback = [
  { startDate: '2026-02-20', endDate: '2026-02-20', title: '2026년도 전기 학위수여식' },
  { startDate: '2026-03-03', endDate: '2026-03-03', title: '2026학년도 1학기 개강(학기개시일)' },
  { startDate: '2026-04-08', endDate: '2026-04-08', title: '수업일수 1/3선' },
  { startDate: '2026-04-21', endDate: '2026-04-27', title: '중간고사 (4.20.(월)까지 등록휴학 가능)' },
  { startDate: '2026-05-12', endDate: '2026-05-12', title: '학원창립 95주년 기념일' },
  { startDate: '2026-05-15', endDate: '2026-05-15', title: '개교 80주년 기념일' },
  { startDate: '2026-06-16', endDate: '2026-06-22', title: '기말고사' },
  { startDate: '2026-06-23', endDate: '2026-08-30', title: '하계방학' },
  { startDate: '2026-08-31', endDate: '2026-08-31', title: '2026학년도 2학기 개강(학기개시일)' },
  { startDate: '2026-10-06', endDate: '2026-10-06', title: '수업일수 1/3선' },
  { startDate: '2026-10-19', endDate: '2026-10-23', title: '중간고사 (10.18.(일)까지 등록휴학 가능)' },
  { startDate: '2026-12-14', endDate: '2026-12-18', title: '기말고사' },
  { startDate: '2026-12-21', endDate: '2027-02-26', title: '동계방학' },
]
let academicCalendarCache = null

mkdirSync(dataDirectory, { recursive: true })

const database = new DatabaseSync(databasePath)
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
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

database.exec(`
  CREATE TABLE IF NOT EXISTS chat_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_conversation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS chat_conversations_user_updated_idx
    ON chat_conversations(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS chat_conversation_items_conversation_idx
    ON chat_conversation_items(conversation_id, id);
`)

database.exec(`
  CREATE TABLE IF NOT EXISTS taxi_parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    departure TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_at TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 2 AND 4),
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS taxi_party_members (
    party_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (party_id, user_id),
    FOREIGN KEY (party_id) REFERENCES taxi_parties(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS taxi_party_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES taxi_parties(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS taxi_parties_departure_at_idx ON taxi_parties(departure_at);
  CREATE INDEX IF NOT EXISTS taxi_party_members_user_idx ON taxi_party_members(user_id);
  CREATE INDEX IF NOT EXISTS taxi_party_messages_party_idx ON taxi_party_messages(party_id, id);
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

function normalizeChatHistoryItem(value) {
  if (!value || typeof value !== 'object') return null
  const id = String(value.id ?? '').slice(0, 100)
  const time = String(value.time ?? '').slice(0, 30)

  if (value.kind === 'user' || value.kind === 'bot') {
    const text = String(value.text ?? '').trim().slice(0, 8000)
    if (!text) return null
    const normalized = { id, kind: value.kind, text, time }
    if (value.kind === 'bot' && Array.isArray(value.links)) {
      normalized.links = value.links.slice(0, 20).flatMap((link) => {
        const url = String(link?.url ?? '').trim()
        if (!/^https?:\/\//i.test(url)) return []
        return [{ text: String(link?.text ?? '').slice(0, 120), url: url.slice(0, 2000) }]
      })
    }
    return normalized
  }

  if (value.kind === 'sources' && Array.isArray(value.sources)) {
    return {
      id,
      kind: 'sources',
      sources: value.sources.slice(0, 30).map((source) => ({
        n: Array.isArray(source?.n) ? source.n.filter(Number.isInteger).slice(0, 10) : [],
        title: String(source?.title ?? '').slice(0, 300),
        url: /^https?:\/\//i.test(String(source?.url ?? '')) ? String(source.url).slice(0, 2000) : '',
        kind: source?.kind == null ? null : String(source.kind).slice(0, 40),
        note: String(source?.note ?? '').slice(0, 500),
        page: Number.isInteger(source?.page) ? source.page : null,
        cited: Boolean(source?.cited),
      })),
    }
  }

  return null
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

function givenName(name) {
  const normalized = String(name ?? '').trim()
  return normalized.length >= 2 ? normalized.slice(1) : normalized
}

function publicTaxiParty(row) {
  const memberCount = Number(row.member_count)
  return {
    id: Number(row.id),
    departure: row.departure,
    destination: row.destination,
    departureAt: row.departure_at,
    capacity: Number(row.capacity),
    memberCount,
    note: row.note,
    status: row.status === 'open' && memberCount >= Number(row.capacity) ? 'full' : row.status,
    creatorName: givenName(row.creator_name),
    creatorDepartment: row.creator_department,
    isOwner: Boolean(row.is_owner),
    isMember: Boolean(row.is_member),
  }
}

function getTaxiParties(userId) {
  return database.prepare(`
    SELECT
      parties.*,
      creators.name AS creator_name,
      creators.department AS creator_department,
      COUNT(members.user_id) AS member_count,
      MAX(CASE WHEN members.user_id = ? THEN 1 ELSE 0 END) AS is_member,
      CASE WHEN parties.creator_id = ? THEN 1 ELSE 0 END AS is_owner
    FROM taxi_parties AS parties
    JOIN users AS creators ON creators.id = parties.creator_id
    LEFT JOIN taxi_party_members AS members ON members.party_id = parties.id
    WHERE parties.status != 'cancelled' AND parties.departure_at > ?
    GROUP BY parties.id
    ORDER BY parties.departure_at ASC, parties.created_at ASC
  `).all(userId, userId, new Date().toISOString()).map(publicTaxiParty)
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

function normalizeScheduleDate(value) {
  const date = String(value ?? '').trim()
  if (/^\d{8}$/.test(date)) return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

async function fetchAcademicCalendar() {
  const now = Date.now()
  if (academicCalendarCache?.expiresAt > now) return academicCalendarCache.payload

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 1, currentYear, currentYear + 1]
  const results = await Promise.allSettled(years.map(async (year) => {
    const body = new URLSearchParams({ SCH_YEAR: String(year), SCH_SITE_NO: '2' })
    const result = await fetch(academicCalendarApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': academicCalendarSourceUrl,
        'User-Agent': 'Mozilla/5.0 KKU-Campus-App/1.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body,
      signal: AbortSignal.timeout(5_000),
    })
    if (!result.ok) throw new Error(`학사일정 응답 오류: ${result.status}`)
    return result.json()
  }))

  const events = results
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value?.data ?? [])
    .map((item) => ({
      startDate: normalizeScheduleDate(item.START_DAY),
      endDate: normalizeScheduleDate(item.END_DAY) ?? normalizeScheduleDate(item.START_DAY),
      title: String(item.SUBJECT ?? '').trim(),
    }))
    .filter((event) => event.startDate && event.endDate && event.title)

  const uniqueEvents = [...new Map(events.map((event) => [
    `${event.startDate}|${event.endDate}|${event.title}`,
    event,
  ])).values()].sort((first, second) => first.startDate.localeCompare(second.startDate))
  const usingFallback = uniqueEvents.length === 0
  const payload = {
    events: usingFallback ? academicCalendarFallback : uniqueEvents,
    sourceUrl: academicCalendarSourceUrl,
    updatedAt: new Date().toISOString(),
    usingFallback,
  }

  academicCalendarCache = { expiresAt: now + (usingFallback ? 10 * 60_000 : 6 * 60 * 60_000), payload }
  return payload
}

// 로그인 실패가 반복되면 잠시 막아 비밀번호 대입을 어렵게 한다 (IP·아이디별, 메모리에만 보관)
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_FAILURES = { id: 10, ip: 50 }          // 학교 와이파이는 여러 명이 같은 IP라 IP 기준은 넉넉히
const loginFailures = new Map()

function clientIp(request) {
  // Railway 같은 호스팅은 프록시 뒤에서 실제 접속 주소를 X-Forwarded-For 첫 값으로 넘겨준다
  const forwarded = String(request.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  return forwarded || request.socket.remoteAddress || 'unknown'
}

function loginBlocked(key) {
  const entry = loginFailures.get(key)
  if (!entry) return false
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginFailures.delete(key)
    return false
  }
  return entry.count >= LOGIN_MAX_FAILURES[key.startsWith('ip:') ? 'ip' : 'id']
}

function recordLoginFailure(key) {
  const now = Date.now()
  const entry = loginFailures.get(key)
  if (!entry || now - entry.first > LOGIN_WINDOW_MS) loginFailures.set(key, { first: now, count: 1 })
  else entry.count += 1
  if (loginFailures.size > 10000) {                          // 오래된 기록 정리
    for (const [k, v] of loginFailures) if (now - v.first > LOGIN_WINDOW_MS) loginFailures.delete(k)
  }
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, { ok: true })
  }

  if (request.method === 'GET' && pathname === '/api/academic-calendar') {
    return sendJson(response, 200, await fetchAcademicCalendar())
  }

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
    const ipKey = `ip:${clientIp(request)}`
    const idKey = `id:${loginId.toLowerCase()}`
    if (loginBlocked(ipKey) || loginBlocked(idKey)) {
      return sendJson(response, 429, { message: '로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요.' })
    }
    const user = database.prepare('SELECT * FROM users WHERE login_id = ?').get(loginId)

    if (!user || !isPasswordValid(password, user.password_salt, user.password_hash)) {
      recordLoginFailure(ipKey)
      recordLoginFailure(idKey)
      return sendJson(response, 401, { message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    }
    loginFailures.delete(idKey)

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

  if (request.method === 'GET' && pathname === '/api/taxi-parties') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    return sendJson(response, 200, { parties: getTaxiParties(user.id) })
  }

  if (request.method === 'POST' && pathname === '/api/taxi-parties') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const body = await readJson(request)
    const departure = String(body.departure ?? '').trim()
    const destination = String(body.destination ?? '').trim()
    const departureAt = String(body.departureAt ?? '')
    const capacity = Number(body.capacity)
    const note = String(body.note ?? '').trim()
    const departureTime = new Date(departureAt).getTime()

    if (!departure || !destination || departure.length > 60 || destination.length > 60) {
      return sendJson(response, 400, { message: '출발지와 도착지를 60자 이내로 입력해 주세요.' })
    }
    if (departure === destination) {
      return sendJson(response, 400, { message: '출발지와 도착지는 달라야 합니다.' })
    }
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 4) {
      return sendJson(response, 400, { message: '전체 탑승 인원은 2~4명으로 선택해 주세요.' })
    }
    if (!Number.isFinite(departureTime) || departureTime < Date.now() + 10 * 60_000) {
      return sendJson(response, 400, { message: '출발 시간은 현재보다 10분 이후로 설정해 주세요.' })
    }
    if (departureTime > Date.now() + 30 * 24 * 60 * 60_000) {
      return sendJson(response, 400, { message: '출발 시간은 30일 이내로 설정해 주세요.' })
    }
    if (note.length > 120) {
      return sendJson(response, 400, { message: '메모는 120자 이내로 입력해 주세요.' })
    }

    database.exec('BEGIN IMMEDIATE')
    try {
      const result = database.prepare(`
        INSERT INTO taxi_parties (creator_id, departure, destination, departure_at, capacity, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, departure, destination, new Date(departureTime).toISOString(), capacity, note)
      database.prepare('INSERT INTO taxi_party_members (party_id, user_id) VALUES (?, ?)')
        .run(result.lastInsertRowid, user.id)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return sendJson(response, 201, { parties: getTaxiParties(user.id) })
  }

  const taxiMessagesMatch = pathname.match(/^\/api\/taxi-parties\/(\d+)\/messages$/)
  if (taxiMessagesMatch && request.method === 'GET') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    const partyId = Number(taxiMessagesMatch[1])
    const membership = database.prepare(`
      SELECT parties.status
      FROM taxi_party_members AS members
      JOIN taxi_parties AS parties ON parties.id = members.party_id
      WHERE members.party_id = ? AND members.user_id = ?
    `).get(partyId, user.id)
    if (!membership || membership.status === 'cancelled') {
      return sendJson(response, 403, { message: '참여 중인 택시팟의 채팅만 볼 수 있습니다.' })
    }
    const messages = database.prepare(`
      SELECT messages.id, messages.message, messages.created_at, messages.user_id,
             users.name, users.department
      FROM taxi_party_messages AS messages
      JOIN users ON users.id = messages.user_id
      WHERE messages.party_id = ?
      ORDER BY messages.id DESC
      LIMIT 300
    `).all(partyId).reverse().map((message) => ({
      id: Number(message.id),
      message: message.message,
      createdAt: message.created_at,
      senderName: givenName(message.name),
      senderDepartment: message.department,
      isMine: message.user_id === user.id,
    }))
    return sendJson(response, 200, { messages })
  }

  if (taxiMessagesMatch && request.method === 'POST') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    const partyId = Number(taxiMessagesMatch[1])
    const membership = database.prepare(`
      SELECT parties.status
      FROM taxi_party_members AS members
      JOIN taxi_parties AS parties ON parties.id = members.party_id
      WHERE members.party_id = ? AND members.user_id = ?
    `).get(partyId, user.id)
    if (!membership || membership.status === 'cancelled') {
      return sendJson(response, 403, { message: '참여 중인 택시팟에만 메시지를 보낼 수 있습니다.' })
    }
    const body = await readJson(request)
    const message = String(body.message ?? '').trim()
    if (!message || message.length > 300) {
      return sendJson(response, 400, { message: '메시지는 1~300자로 입력해 주세요.' })
    }
    database.prepare(
      'INSERT INTO taxi_party_messages (party_id, user_id, message, created_at) VALUES (?, ?, ?, ?)',
    ).run(partyId, user.id, message, new Date().toISOString())
    const saved = database.prepare(`
      SELECT messages.id, messages.message, messages.created_at, users.name, users.department
      FROM taxi_party_messages AS messages
      JOIN users ON users.id = messages.user_id
      WHERE messages.id = last_insert_rowid()
    `).get()
    return sendJson(response, 201, {
      message: {
        id: Number(saved.id),
        message: saved.message,
        createdAt: saved.created_at,
        senderName: givenName(saved.name),
        senderDepartment: saved.department,
        isMine: true,
      },
    })
  }

  const taxiPartyMatch = pathname.match(/^\/api\/taxi-parties\/(\d+)$/)
  if (taxiPartyMatch && request.method === 'POST') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    const partyId = Number(taxiPartyMatch[1])

    database.exec('BEGIN IMMEDIATE')
    try {
      const party = database.prepare(`
        SELECT parties.*, COUNT(members.user_id) AS member_count
        FROM taxi_parties AS parties
        LEFT JOIN taxi_party_members AS members ON members.party_id = parties.id
        WHERE parties.id = ?
        GROUP BY parties.id
      `).get(partyId)
      if (!party || party.status !== 'open' || new Date(party.departure_at).getTime() <= Date.now()) {
        database.exec('ROLLBACK')
        return sendJson(response, 409, { message: '현재 참여할 수 없는 택시팟입니다.' })
      }
      if (Number(party.member_count) >= Number(party.capacity)) {
        database.exec('ROLLBACK')
        return sendJson(response, 409, { message: '이미 모집 인원이 모두 찼습니다.' })
      }
      const existing = database.prepare(
        'SELECT 1 FROM taxi_party_members WHERE party_id = ? AND user_id = ?',
      ).get(partyId, user.id)
      if (existing) {
        database.exec('ROLLBACK')
        return sendJson(response, 409, { message: '이미 참여 중인 택시팟입니다.' })
      }
      database.prepare('INSERT INTO taxi_party_members (party_id, user_id) VALUES (?, ?)')
        .run(partyId, user.id)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return sendJson(response, 200, { parties: getTaxiParties(user.id) })
  }

  if (taxiPartyMatch && request.method === 'DELETE') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    const partyId = Number(taxiPartyMatch[1])
    const party = database.prepare('SELECT * FROM taxi_parties WHERE id = ?').get(partyId)
    if (!party) return sendJson(response, 404, { message: '택시팟을 찾을 수 없습니다.' })

    if (party.creator_id === user.id) {
      database.prepare("UPDATE taxi_parties SET status = 'cancelled' WHERE id = ?").run(partyId)
    } else {
      const result = database.prepare(
        'DELETE FROM taxi_party_members WHERE party_id = ? AND user_id = ?',
      ).run(partyId, user.id)
      if (result.changes === 0) return sendJson(response, 404, { message: '참여 중인 택시팟이 아닙니다.' })
    }
    return sendJson(response, 200, { parties: getTaxiParties(user.id) })
  }

  if (taxiPartyMatch && request.method === 'PATCH') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    const partyId = Number(taxiPartyMatch[1])
    const body = await readJson(request)
    const status = body.status === 'closed' ? 'closed' : body.status === 'open' ? 'open' : null
    if (!status) return sendJson(response, 400, { message: '모집 상태가 올바르지 않습니다.' })
    const result = database.prepare(
      'UPDATE taxi_parties SET status = ? WHERE id = ? AND creator_id = ? AND status != ?',
    ).run(status, partyId, user.id, 'cancelled')
    if (result.changes === 0) return sendJson(response, 403, { message: '방장만 모집 상태를 변경할 수 있습니다.' })
    return sendJson(response, 200, { parties: getTaxiParties(user.id) })
  }

  if (request.method === 'GET' && pathname === '/api/chat/conversations') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const conversations = database.prepare(`
      SELECT id, title, created_at, updated_at,
        (SELECT COUNT(*) FROM chat_conversation_items WHERE conversation_id = chat_conversations.id) AS item_count
      FROM chat_conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 100
    `).all(user.id).map((conversation) => ({
      id: Number(conversation.id),
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      itemCount: Number(conversation.item_count),
    }))
    return sendJson(response, 200, { conversations })
  }

  if (request.method === 'POST' && pathname === '/api/chat/conversations') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const body = await readJson(request)
    const title = String(body.title ?? '').trim().replace(/\s+/g, ' ').slice(0, 80) || '새 대화'
    const now = new Date().toISOString()
    const result = database.prepare(`
      INSERT INTO chat_conversations (user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(user.id, title, now, now)
    return sendJson(response, 201, {
      conversation: { id: Number(result.lastInsertRowid), title, createdAt: now, updatedAt: now, itemCount: 0 },
    })
  }

  const chatConversationMatch = pathname.match(/^\/api\/chat\/conversations\/(\d+)$/)
  if (chatConversationMatch && request.method === 'GET') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const conversationId = Number(chatConversationMatch[1])
    const conversation = database.prepare(`
      SELECT id, title, created_at, updated_at
      FROM chat_conversations
      WHERE id = ? AND user_id = ?
    `).get(conversationId, user.id)
    if (!conversation) return sendJson(response, 404, { message: '대화 기록을 찾을 수 없습니다.' })

    const items = database.prepare(`
      SELECT payload FROM chat_conversation_items
      WHERE conversation_id = ?
      ORDER BY id ASC
    `).all(conversationId).flatMap((row) => {
      try {
        const item = normalizeChatHistoryItem(JSON.parse(row.payload))
        return item ? [item] : []
      } catch {
        return []
      }
    })
    return sendJson(response, 200, {
      conversation: {
        id: Number(conversation.id),
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        itemCount: items.length,
      },
      items,
    })
  }

  if (chatConversationMatch && request.method === 'DELETE') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })
    const result = database.prepare(
      'DELETE FROM chat_conversations WHERE id = ? AND user_id = ?',
    ).run(Number(chatConversationMatch[1]), user.id)
    if (result.changes === 0) return sendJson(response, 404, { message: '대화 기록을 찾을 수 없습니다.' })
    return sendJson(response, 200, { ok: true })
  }

  const chatConversationItemsMatch = pathname.match(/^\/api\/chat\/conversations\/(\d+)\/items$/)
  if (chatConversationItemsMatch && request.method === 'POST') {
    const user = getSessionUser(request)
    if (!user) return sendJson(response, 401, { message: '로그인이 필요합니다.' })

    const conversationId = Number(chatConversationItemsMatch[1])
    const owned = database.prepare(
      'SELECT id FROM chat_conversations WHERE id = ? AND user_id = ?',
    ).get(conversationId, user.id)
    if (!owned) return sendJson(response, 404, { message: '대화 기록을 찾을 수 없습니다.' })

    const body = await readJson(request)
    const item = normalizeChatHistoryItem(body.item)
    if (!item) return sendJson(response, 400, { message: '저장할 대화 내용이 올바르지 않습니다.' })
    const now = new Date().toISOString()
    database.prepare(`
      INSERT INTO chat_conversation_items (conversation_id, payload, created_at)
      VALUES (?, ?, ?)
    `).run(conversationId, JSON.stringify(item), now)
    database.prepare('UPDATE chat_conversations SET updated_at = ? WHERE id = ?').run(now, conversationId)
    return sendJson(response, 201, { item })
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
  const origin = String(request.headers.origin ?? '').replace(/\/$/, '')

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  }
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (request.method === 'OPTIONS') {
    if (!origin || !allowedOrigins.has(origin)) {
      return sendJson(response, 403, { message: '허용되지 않은 출처입니다.' })
    }
    response.writeHead(204)
    response.end()
    return
  }

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

// ---------------------------------------------------------------- DB 백업
// 배포 서버에서는 DB를 하루 한 번(시작할 때도) 같은 볼륨의 backups/ 폴더에 통째로 복사해 둔다.
// VACUUM INTO는 쓰는 중에도 일관된 스냅샷을 만들어, 백업 파일이 깨지지 않는다.
const backupEnabled = process.env.DB_BACKUP === '1' || (process.env.NODE_ENV === 'production' && process.env.DB_BACKUP !== '0')
const backupDirectory = path.join(dataDirectory, 'backups')
const backupKeep = Math.max(1, Number(process.env.DB_BACKUP_KEEP) || 7)
const backupIntervalMs = Math.max(1, Number(process.env.DB_BACKUP_INTERVAL_HOURS) || 24) * 60 * 60 * 1000

function backupDatabase() {
  try {
    mkdirSync(backupDirectory, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const target = path.join(backupDirectory, `campus-${stamp}.db`)
    database.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`)
    const old = readdirSync(backupDirectory).filter((name) => /^campus-.*\.db$/.test(name)).sort().reverse()
    for (const name of old.slice(backupKeep)) rmSync(path.join(backupDirectory, name), { force: true })
    console.log(`[backup] ${path.basename(target)} (최근 ${backupKeep}개 보관)`)
  } catch (error) {
    console.error('[backup] 실패:', error.message)
  }
}

// Railway는 볼륨을 붙이면 RAILWAY_VOLUME_MOUNT_PATH를 넣어 준다. 없으면 재배포 때 DB가 사라지므로 크게 경고
if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  console.warn('[경고] Railway 볼륨이 연결되지 않았습니다. 재배포하면 회원·대화·택시 데이터가 모두 사라집니다. '
    + `서비스 설정에서 볼륨을 ${dataDirectory} 에 연결하세요.`)
}

if (backupEnabled) {
  backupDatabase()
  setInterval(backupDatabase, backupIntervalMs).unref()
}

server.listen(port, () => {
  console.log(`Campus API server: http://localhost:${port}`)
})

// ---------------------------------------------------------------- 정상 종료
// 재배포·재시작 때 요청을 마무리하고 DB 변경분(WAL)을 본 파일에 합친 뒤 닫는다.
let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[server] ${signal} 받음 — 정리 후 종료`)
  const finish = () => {
    try {
      database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      database.close()
    } catch (error) {
      console.error('[server] DB 닫기 실패:', error.message)
    }
    process.exit(0)
  }
  server.close(finish)
  setTimeout(finish, 8000).unref()                    // 오래 걸리는 연결이 있어도 8초 안에는 끝냄
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
