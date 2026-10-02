# KUSTOM — 나에게 맞춘 캠퍼스의 하루

건국대학교 글로컬캠퍼스 학생의 **학과·학번·시간표에 맞춰(Custom)** 학교 정보를 알려주는 캠퍼스 앱.
2026 제1회 컴퓨터공학과 해커톤 **L/NKerthon** 출품작.

| 기능 | 설명 |
|---|---|
| AI 선배 | 학교 공지·학사요람·강의시간표를 근거로 답하는 챗봇 (근거 링크 표시, 학과·학번 맞춤) |
| 시간표 + 졸업 달성도 | 강의시간표에서 수업을 담으면 학과·학번 기준 졸업요건 달성도 자동 계산 (계정별 서버 저장) |
| 지도 | 교내 건물·시설과 학교 앞 가게(운영시간·대표 메뉴) |
| 택시 파티 | 같은 방향 학생과 택시 동승 모집·채팅 |

## 폴더 구조

```text
NKerthon/
├─ src/                      화면 (React + TypeScript + Vite) — 자세한 구조는 src/README.md
│  ├─ app/                   앱 뼈대, 탭 전환
│  ├─ features/              기능별 폴더
│  │  ├─ auth/               로그인·회원가입
│  │  ├─ home/               홈 (다음 수업, 학사일정, 추천)
│  │  ├─ chat/               AI 선배 채팅
│  │  ├─ schedule/           시간표·강의 검색·졸업 달성도·학점 계산기
│  │  ├─ map/                캠퍼스 지도
│  │  └─ taxi/               택시 파티
│  ├─ shared/                여러 기능이 같이 쓰는 컴포넌트·유틸
│  ├─ styles/                앱 전체 스타일
│  └─ assets/                이미지
├─ public/
│  └─ course-catalog/        학기별 강의시간표 (2017-1 ~ 2026-2, JSON)
├─ server/                   API 서버 (Node.js + SQLite)
│  ├─ index.mjs              로그인·시간표·택시·채팅 기록·챗봇 중계·백업
│  ├─ create-admin.mjs       관리자 계정 만들기
│  └─ export-feedback.mjs    AI 선배 👍/👎 피드백을 CSV로 내보내기
├─ chatbot/                  AI 선배 서버 (Python + FastAPI) — 자세한 내용은 chatbot/README.md
│  ├─ app_server.py          챗봇 API (/chat)
│  ├─ kku_rag.py             검색 + 답변 생성
│  ├─ kku_courses.py         강의시간표·내 시간표 검색
│  ├─ kku_keywords.py        키워드 검색·자료 조각내기
│  ├─ kku_crawler.py, kku_yoram.py, make_requirements.py   자료 수집·요람 정리 도구
│  ├─ keywords.json, slang.json, clarify.json, exclude.json   검색어·줄임말·되묻기·제외 규칙
│  ├─ manual/                직접 정리한 자료 (교양 기준, 문의처 등)
│  ├─ kku_data/              검색 데이터 (자료 조각 + 임베딩)
│  └─ eval/                  정확도 평가 (평가 질문 201개, 강건성 테스트)
├─ scripts/
│  ├─ dev.mjs                개발 실행 (화면 + API + 챗봇 한 번에)
│  ├─ start-production.mjs   배포 실행 (API + 챗봇)
│  └─ import_course_catalog.py   강의시간표 엑셀 → JSON 변환
├─ Dockerfile, railway.toml  Railway 배포 설정
├─ .github/workflows/        GitHub Pages 배포
└─ DEPLOYMENT.md             배포·데이터 보호·백업 복구 안내
```

## 실행

```bash
npm install
pip install -r chatbot/requirements.txt   # Python 3.11+ (conda 환경 권장)
npm run dev                               # http://localhost:5173
```

필요한 설정 파일 (둘 다 Git에 올리지 않는다):

| 파일 | 내용 |
|---|---|
| `.env` | `VITE_NAVER_MAP_KEY=` 네이버 지도 Client ID (`.env.example` 복사) |
| `chatbot/.env` | `OPENAI_API_KEY=` 등 챗봇 키 (`chatbot/.env.example` 참고) |

`.env`를 바꾼 뒤에는 `npm run dev`를 다시 켜야 반영된다.

## 자주 쓰는 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (화면 :5173, API :5174, 챗봇 :8000) |
| `npm run build` / `npm run lint` | 빌드 / 코드 검사 |
| `npm run create:admin` | 관리자 계정 만들기 |
| `npm run export:feedback` | AI 선배 피드백 내보내기 → `chatbot/eval/results/feedback.csv` |
| `cd chatbot && python eval/run_eval.py --stages 9 --answers 9` | 챗봇 정확도 평가 |
| `cd chatbot && python eval/robustness.py` | 오타·줄임말·이어지는 질문 테스트 |
| `railway up --service web` | Railway에 직접 배포 |
