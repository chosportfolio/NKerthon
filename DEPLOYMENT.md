# 배포 구성

## 구조

- 프런트엔드: GitHub Pages (`https://chosportfolio.github.io/NKerthon/`)
  - 저장소가 비공개(private)면 무료 계정에서는 Pages를 쓸 수 없다. 이때는 Railway 주소 하나로 화면과 API를 함께 서비스한다 (Docker 이미지가 화면(dist)도 빌드해 서빙한다).
- API + RAG: Railway의 Docker 서비스 (Node 서버 + 내부 전용 Python 챗봇)
- DB: Railway 영구 볼륨의 `/data/campus.db`
- 공개 가능한 값: `VITE_NAVER_MAP_KEY` (도메인 제한 필수)
- 서버 전용 비밀값: `OPENAI_API_KEY`, 관리자 계정 환경변수

GitHub Pages는 정적 호스팅이라 Node, Python, SQLite를 실행할 수 없다. 따라서 API와 DB는 반드시 별도 서버에서 실행한다.

```
브라우저 ──HTTPS──▶ (GitHub Pages 또는 Railway가 서빙하는 화면)
       └──HTTPS──▶ Railway: Node 서버 :PORT ── 127.0.0.1:8000 AI 선배 (외부에서 접근 불가)
                         └─ /data 볼륨: campus.db + backups/
```

## Railway 환경변수

다음 값은 Railway 서비스 Variables에만 저장한다.

```text
OPENAI_API_KEY=<서버 전용 키>
ALLOWED_ORIGINS=https://chosportfolio.github.io,http://localhost:5173
DATABASE_PATH=/data/campus.db
VITE_NAVER_MAP_KEY=<네이버 지도 Client ID>   # Railway 주소로 화면을 열 때 필요 (빌드 시 화면에 들어감)
```

선택: `DB_BACKUP_KEEP`(백업 보관 개수, 기본 7), `DB_BACKUP_INTERVAL_HOURS`(백업 간격, 기본 24), `DB_BACKUP=0`(백업 끄기)

서비스에 `/data` 경로의 Volume을 연결한다. DB 파일은 Git과 Docker 이미지에 포함되지 않는다.
**볼륨이 없으면 재배포할 때마다 회원·대화·택시 데이터가 전부 사라진다.** 볼륨 없이 뜨면 로그에 `[경고] Railway 볼륨이 연결되지 않았습니다`가 찍힌다.

배포 확인: `https://<railway 주소>/api/health` → `{"ok":true}`

## GitHub 저장소 설정

Settings → Secrets and variables → Actions에서 설정한다.

- Secret `VITE_NAVER_MAP_KEY`: 네이버 지도 Client ID
- Variable `VITE_API_BASE_URL`: Railway HTTPS 서비스 주소(마지막 `/` 제외)

Settings → Pages → Build and deployment → Source는 `GitHub Actions`로 설정한다.

## 네이버 지도 도메인 제한

네이버 클라우드 콘솔의 Dynamic Map Web 서비스 URL에는 실제로 화면을 여는 주소만 등록한다.

```text
http://localhost:5173
https://chosportfolio.github.io
https://<railway 주소>          # Railway 주소로 화면을 열 때
```

Client ID는 브라우저 SDK 요청에 포함되므로 사용자에게 보이는 값이다. 보안은 Git 비공개 처리만으로 해결되지 않으며, 허용 도메인 제한이 핵심이다.

지도가 안 뜰 때 확인 순서:
1. 개발 서버 재시작 — Vite는 켜질 때만 `.env`를 읽는다
2. 배포판은 빌드 시점에 키가 있어야 한다 — Railway Variables의 `VITE_NAVER_MAP_KEY` 확인 후 재배포
3. 네이버 콘솔 Web 서비스 URL에 지금 접속한 주소(프로토콜 포함)가 있는지

## 데이터 보호 장치

| 위험 | 대응 |
|---|---|
| 재배포 때 데이터 소실 | DB를 볼륨 `/data`에 저장 + 볼륨 미연결 시 로그 경고 |
| 파일 손상·실수로 삭제 | 시작할 때와 24시간마다 `/data/backups/`에 스냅샷 (`VACUUM INTO`, 최근 7개 보관) |
| 재배포 중 강제 종료 | SIGTERM을 받으면 요청을 마무리하고 DB 변경분(WAL)을 합친 뒤 닫고 종료 (최대 10초) |
| 동시 쓰기 충돌 | SQLite WAL 모드 + `busy_timeout` 5초 |
| 비밀번호 대입 | 같은 아이디 10회 / 같은 IP 50회 실패 시 15분 차단 (학교 와이파이는 IP를 여럿이 써서 IP 기준은 넉넉히) |
| 로그인 정보 유출 | 비밀번호 scrypt 해시, 로그인 토큰은 해시로만 저장, HTTPS |
| API 키 유출 | 키는 Railway 변수에만, `.env`는 Git·Docker 이미지에서 제외 |
| 챗봇 서버 직접 호출 | 챗봇은 컨테이너 내부(127.0.0.1)에서만 열림, 질문은 로그인한 사용자만 |
| 다른 사이트에서 API 호출 | `ALLOWED_ORIGINS`에 등록된 화면 주소만 허용 (CORS) |

### 백업에서 되돌리기

1. `railway ssh`로 서비스에 접속
2. `/data/backups/campus-<날짜>.db` 중 되돌릴 파일을 `/data/campus.db`로 복사하고 `campus.db-wal`, `campus.db-shm`이 있으면 지운다
3. 서비스 재시작

### 관리자 계정 만들기 (배포 후 한 번)

`railway ssh`로 접속해서:
```bash
ADMIN_LOGIN_ID=admin ADMIN_PASSWORD='강한비밀번호' ADMIN_NAME=관리자 ADMIN_DEPARTMENT=컴퓨터공학과 ADMIN_STUDENT_NUMBER=000000000 node server/create-admin.mjs
```

## 주의

- 회원 정보(이름·학번)와 대화 기록은 개인정보다. 백업 파일을 개인 PC나 메신저로 옮기지 않는다.
- AI 선배 질문은 OpenAI(해외)로 전송된다. 공개 서비스로 운영하면 개인정보 처리방침에 이 사실을 밝힌다.
- OpenAI 사용량은 사용자당 하루 100회로 제한되어 있다 (`chatbot/app_server.py`의 `DAILY_LIMIT`). 예산을 넘지 않는지 OpenAI 대시보드에서 확인한다.
