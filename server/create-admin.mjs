import { randomBytes, scryptSync } from 'node:crypto'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(serverDirectory, 'data', 'campus.db')

const loginId = process.env.ADMIN_LOGIN_ID
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME
const department = process.env.ADMIN_DEPARTMENT
const studentNumber = process.env.ADMIN_STUDENT_NUMBER

if (!loginId || !password || !name || !department || !studentNumber) {
  throw new Error('관리자 계정 환경변수를 모두 입력해 주세요.')
}

const database = new DatabaseSync(databasePath)
const columns = database.prepare('PRAGMA table_info(users)').all()

if (!columns.some((column) => column.name === 'role')) {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")
}

const salt = randomBytes(16).toString('hex')
const passwordHash = scryptSync(password, salt, 64).toString('hex')

database.prepare(`
  INSERT INTO users (
    login_id, password_hash, password_salt, name,
    department, student_number, gender, role
  ) VALUES (?, ?, ?, ?, ?, ?, '선택 안 함', 'admin')
  ON CONFLICT(login_id) DO UPDATE SET
    password_hash = excluded.password_hash,
    password_salt = excluded.password_salt,
    name = excluded.name,
    department = excluded.department,
    student_number = excluded.student_number,
    gender = excluded.gender,
    role = 'admin'
`).run(loginId, passwordHash, salt, name, department, studentNumber)

database.close()
console.log(`관리자 계정 '${loginId}' 생성 완료`)
