# 배포 구성

## 구조

- 프런트엔드: GitHub Pages (`https://chosportfolio.github.io/NKerthon/`)
- API + RAG: Railway의 Docker 서비스
- DB: Railway 영구 볼륨의 `/data/campus.db`
- 공개 가능한 값: `VITE_NAVER_MAP_KEY` (도메인 제한 필수)
- 서버 전용 비밀값: `OPENAI_API_KEY`, 관리자 계정 환경변수

GitHub Pages는 정적 호스팅이라 Node, Python, SQLite를 실행할 수 없다. 따라서 API와 DB는 반드시 별도 서버에서 실행한다.

## Railway 환경변수

다음 값은 Railway 서비스 Variables에만 저장한다.

```text
OPENAI_API_KEY=<서버 전용 키>
ALLOWED_ORIGINS=https://chosportfolio.github.io,http://localhost:5173
DATABASE_PATH=/data/campus.db
```

서비스에 `/data` 경로의 Volume을 연결한다. DB 파일은 Git과 Docker 이미지에 포함되지 않는다.

## GitHub 저장소 설정

Settings → Secrets and variables → Actions에서 설정한다.

- Secret `VITE_NAVER_MAP_KEY`: 네이버 지도 Client ID
- Variable `VITE_API_BASE_URL`: Railway HTTPS 서비스 주소(마지막 `/` 제외)

Settings → Pages → Build and deployment → Source는 `GitHub Actions`로 설정한다.

## 네이버 지도 도메인 제한

네이버 클라우드 콘솔의 Dynamic Map Web 서비스 URL에는 아래 값만 등록한다.

```text
http://localhost:5173
https://chosportfolio.github.io
```

Client ID는 브라우저 SDK 요청에 포함되므로 사용자에게 보이는 값이다. 보안은 Git 비공개 처리만으로 해결되지 않으며, 허용 도메인 제한이 핵심이다.
