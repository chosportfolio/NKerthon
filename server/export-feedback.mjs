// 챗봇 피드백을 엑셀에서 열 수 있는 CSV로 내보낸다.
//   npm run export:feedback            → 👎 + 자동 수집(답을 못 찾음 등)만
//   npm run export:feedback -- --all   → 👍 포함 전부
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const serverDirectory = path.dirname(fileURLToPath(import.meta.url))
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(serverDirectory, 'data', 'campus.db')
const outputPath = path.resolve(serverDirectory, '..', 'chatbot', 'eval', 'results', 'feedback.csv')

if (!existsSync(databasePath)) throw new Error(`DB 파일이 없습니다: ${databasePath}`)

const database = new DatabaseSync(databasePath, { readOnly: true })
const hasTable = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_feedback'").get()
if (!hasTable) {
  console.log('아직 모인 피드백이 없습니다.')
  process.exit(0)
}

const includeAll = process.argv.includes('--all')
const rows = database.prepare(`
  SELECT * FROM chat_feedback
  ${includeAll ? '' : "WHERE rating = 'down' OR (rating IS NULL AND auto_flag IS NOT NULL)"}
  ORDER BY created_at DESC
`).all()

const REASON_LABEL = {
  wrong: '틀린 정보',
  bad_source: '근거가 이상함',
  not_found: '답을 못 찾음',
  misunderstood: '질문을 잘못 이해함',
  other: '기타',
}
const FLAG_LABEL = { uncertain: '확인 안 된다고 답함', no_source: '근거 없음' }
const RATING_LABEL = { up: '👍', down: '👎' }

const columns = ['일시', '평가', '이유', '의견', '자동 분류', '학과', '입학연도', '질문', '답변', '근거']
const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
const lines = rows.map((row) => [
  row.created_at,
  RATING_LABEL[row.rating] ?? '',
  REASON_LABEL[row.reason] ?? '',
  row.comment,
  FLAG_LABEL[row.auto_flag] ?? '',
  row.department,
  row.admission_year,
  row.question,
  row.answer,
  JSON.parse(row.sources || '[]').map((source) => source.title).join(' / '),
].map(escape).join(','))

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `﻿${[columns.join(','), ...lines].join('\r\n')}\r\n`, 'utf8')

const count = (filter) => rows.filter(filter).length
console.log(`${rows.length}건 → ${outputPath}`)
console.log(`  👎 ${count((row) => row.rating === 'down')}건 · 👍 ${count((row) => row.rating === 'up')}건 · 평가 없이 자동 수집 ${count((row) => !row.rating)}건`)
