# AI 선배 — 건국대학교 글로컬캠퍼스 학생용 RAG 챗봇

학교 홈페이지(안내·공지·학사일정)와 학사요람(2017~2026학년도)을 근거로 학생 질문에 답하는 챗봇이다.
답변마다 근거 자료(링크, 요람 PDF 쪽 번호)를 붙이고, 자료에 없는 내용은 모른다고 답한다.

- 평가 질문 181개 기준 답변 정답률(엄격 기준) **59% → 97%** (아래 [평가](#평가))
- LLM: `gpt-6-luna`, 임베딩: `text-embedding-3-small` (학교 제공 키)

---

## 동작 방식

```
학생 질문 (+ 앱이 아는 학과·입학연도)
   │
   ├─ 학과·학번이 꼭 필요한데 없으면 → 되묻기 (clarify.json, LLM 호출 없음)
   │
   ├─ 검색 ─ 키워드 검색(2글자 단위 BM25 + 동의어 사전)  상위 30
   │        └ 벡터 검색(임베딩 유사도)                     상위 30
   │        → 합치기(RRF) + 보정: 직접 작성 자료·학사일정 우대, 입학연도 요람 우대, 오래된 공지 감점
   │        → 상위 6조각
   │
   └─ 생성 ─ gpt-6-luna: 자료에 있는 것만, 지난 일정 표시, 근거 번호 [1]
            → 말풍선 최대 4개 + 근거 자료 말풍선
```

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `kku_crawler.py` | 학교 홈페이지 수집 (안내 페이지, 게시판, 학사일정) |
| `kku_yoram.py` | 학사요람 PDF 수집 → 학과별 문서 (`kku_data/extra/yoram.jsonl`) |
| `kku_keywords.py` | 청크 만들기, 키워드 검색, 제외 규칙, 직접 작성 자료 읽기 |
| `kku_rag.py` | **챗봇 본체**: 임베딩, 하이브리드 검색, 되묻기, 답변 생성, 근거 |
| `app_server.py` | 앱 연동용 API 서버 (FastAPI, `POST /chat`) |
| `make_requirements.py` | 졸업요건 정리 엑셀(`졸업요건_정리.xlsx`) 생성 |
| `keywords.json` | 동의어 사전 (예: 기숙사 = 생활관, 셔틀 = 통학버스) |
| `exclude.json` | 검색에서 뺄 게시판·메뉴 (투데이뉴스 등) |
| `clarify.json` | 되묻기 규칙 (예: 졸업요건 → 학과·입학연도 필요) |
| `yoram_pages.json` | 서울·글로컬 통합본 요람(2017~2020)에서 쓸 글로컬 쪽 범위 |
| `manual/` | 직접 작성 자료 (교양 기준, 필수 교양, 학과 소속·수강한도, 문의처, 생활관 입사) |
| `eval/` | 평가 질문(`eval_questions.xlsx`), 자동 검증, 단계별 측정, 결과(`results/`) |
| `kku_data/` | 수집 데이터와 검색 색인 (git 제외, 약 1GB — 대부분 요람 PDF 원본) |
| `.env` | API 키 (공유 금지, `.env.example` 참고) |

## 설치

```bash
conda create -n kku python=3.12 -y
conda activate kku
pip install -r requirements.txt
```

`.env.example`을 복사해 `.env`를 만들고 `OPENAI_API_KEY`를 넣는다.
Windows 보안 정책으로 `kiwipiepy`가 막히면 자동으로 간이 키워드 추출을 쓴다.

## 실행

VS Code에서는 실행 및 디버그 탭(Ctrl+Shift+D)에서 항목을 골라 실행한다.

| 하고 싶은 일 | 명령 |
|---|---|
| 챗봇과 대화 | `python kku_rag.py chat` |
| 한 번 묻기 | `python kku_rag.py ask "2학기 중간고사 언제야?"` |
| 검색 결과만 보기 (LLM 비용 없음) | `python kku_rag.py retrieve "기숙사 신청"` |

## 데이터 갱신

| 상황 | 명령 |
|---|---|
| 홈페이지 전체 재수집 (약 10분) | `python kku_crawler.py --out kku_data --exclude-menus 1780,1800,1870` |
| 새 공지만 (매일) | `python kku_crawler.py --out kku_data --since 2026-10-01 --skip-pages` |
| 새 학년도 요람 | `python kku_yoram.py --from-year 2017` |
| `manual/`, `keywords.json`, `exclude.json` 수정 후 | `python kku_rag.py refresh` |
| 졸업요건 엑셀 다시 만들기 | `python make_requirements.py` |

`refresh`는 바뀐 조각만 임베딩하므로 비용이 거의 들지 않는다.
`kku_data/extra/*.jsonl`에 `{id, source, title, url, text, metadata}` 형식으로 문서를 넣으면 자동으로 검색 대상이 된다(앱 데이터 연동에 사용).

### 직접 작성 자료 (`manual/`)

사이트에 없거나 찾기 어려운 정보를 사람이 정리한다. `manual/_양식.md`를 복사해서 쓴다.
- 첫 줄 `# 제목`, 다음 줄 `출처: URL`(선택), 본문
- `## 소제목`으로 나누면 섹션마다 따로 검색된다 (입학연도별 자료는 소제목에 연도를 넣으면 해당 학번 질문에서 우대됨)
- 검색에서 우대되고, LLM에게 다른 자료와 다르면 이것을 우선하라고 지시되어 있다

### 이상한 답이 나올 때

1. `retrieve`로 검색 결과를 본다.
2. 정답 자료가 없으면 → `manual/`에 추가 / 순위가 밀리면 → `keywords.json`·`exclude.json` / 자료는 맞는데 답이 틀리면 → `kku_rag.py`의 `SYSTEM` 규칙
3. `python eval/run_eval.py --stages 8 --answers none`으로 다른 문항이 망가지지 않았는지 확인한다.

## 앱 연동

### API 서버 (시연용 로컬 서버)

```bash
python app_server.py          # 이 PC에서만: http://localhost:8000  (시험 화면: /docs)
python app_server.py --lan    # 같은 와이파이·핫스팟의 휴대폰에서도 접속 (실행 시 주소 출력)
```

- 앱은 `POST /chat`으로 질문만 보낸다. **API 키는 서버(.env)에만 있고 앱에는 넣지 않는다.**
- 요청: `{"question": "...", "history": [{"role": "user", "content": "..."}, ...], "profile": {"학과": "경영학과", "입학연도": "2022"}}`
- 응답: `bubbles`(말풍선), `source_bubble`(근거 말풍선), `sources`(출처 카드), `clarify`(되물었는지), `answer`(다음 history에 넣을 값), `cached`
- 기기(IP)별 하루 100회 제한, 대화 맥락 없는 같은 질문은 1시간 캐시
- 안드로이드 에뮬레이터에서는 `http://10.0.2.2:8000`, 실제 휴대폰은 `http://<PC 내부 IP>:8000` (학교 와이파이는 기기 간 접속을 막을 수 있어 휴대폰 핫스팟 권장, 첫 실행 시 Windows 방화벽 허용 필요)

### 파이썬에서 직접 호출

```python
from kku_rag import Bot

bot = Bot()                                    # kku_data/ 색인을 읽음 (프로세스당 한 번)
res = bot.answer(
    "졸업학점 몇 학점이야?",
    history=[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],  # 직전 대화 (선택)
    profile={"학과": "경영학과", "입학연도": "2022"},   # 앱 로그인 정보 (선택) — 있으면 되묻지 않음
)
```

| 반환 키 | 내용 |
|---|---|
| `bubbles` | 답변 말풍선 목록 (순서대로 표시) |
| `source_bubble` | "근거 자료" 말풍선 텍스트 (마지막에 표시) |
| `sources` | 근거 목록 `[{n, title, url, kind, date, page, note, cited}]` — 출처 카드용 |
| `clarify` | 되묻기였으면 규칙 이름, 아니면 `None` |
| `answer` | 말풍선을 합친 전체 텍스트 (대화 기록 `history`에 넣을 값) |

## 평가

| 단계 | 검색 상위6 | 답변 정답률(엄격) |
|---|---|---|
| ① 키워드 검색만 | 52% | 59% |
| ④ + 학사요람 | 77% | - |
| ⑤ + 직접 작성 자료 | 92% | - |
| ⑥ + 학번 인식 버그 수정 | 92% | 88% |
| ⑦ + 실패 분석 후 개선 | 90% | 94% |
| ⑧ + 남은 오류 수정 | 92% | 97% |

전체 표와 설명은 `eval/results/summary.md`, 문항별 답변은 `eval/results/stage*_answers.jsonl`.

```bash
python eval/verify_eval.py                         # 평가 정답이 원문과 맞는지 자동 대조
python eval/run_eval.py --stages 8 --answers none  # 검색 정확도 (비용 거의 없음)
python eval/run_eval.py --stages 8 --answers 8     # 답변까지 (LLM 181회, 입력 약 55만 토큰)
python eval/run_eval.py --regrade                  # 저장된 답변 재채점 (비용 없음)
```

- 평가 질문 181개: 원문(요람 표, 공지, 안내 페이지)에서 정답을 뽑고, 원문 자동 대조 + 무작위 15개 사람 검수
- 엄격 기준: 숫자가 맞아도 첫 말풍선에서 "확인이 안 돼요"라고 하면 정답에서 제외
- LLM 답변은 실행마다 조금씩 달라 1~2%p 차이는 오차 범위

## 넘겨줄 때

- 코드·설정·`manual/`·`eval/`은 그대로 넘긴다. **`.env`(API 키)는 넘기지 않는다.**
- 챗봇 실행에 필요한 데이터: `kku_data/chunks.jsonl`, `embeddings.npy`, `embeddings_meta.json` (약 30MB). 재구축까지 하려면 `documents.jsonl`, `extra/`도 필요.
- `kku_data/files/`(요람 PDF 원본, 약 800MB)와 `kku_data/ablation/`(평가용)은 필요할 때만.

## 알려진 한계

- 요람에서 표가 그림인 쪽(연도당 약 30쪽)은 내용이 없다 (예: 일부 학과 교육과정표).
- 학식 메뉴는 홈페이지에 데이터가 없다.
- 남은 오답: 등록휴학 마감 날짜, 조기졸업 신청 기간·조건 일부 누락 (자료는 찾지만 LLM이 다른 날짜를 고름).

## 주의사항

- 학교 홈페이지는 공개 정보지만 학교 콘텐츠다. 외부에 공개 서비스로 운영하기 전 학교(정보운영팀·대외협력처)와 협의한다.
- 학생 질문은 답변 생성을 위해 OpenAI(해외)로 전송된다. 앱 개인정보처리방침에 명시해야 한다.
- 질문 로그로 통계(인기 주제 등)를 만들 때는 계정과 분리하고, 원문 대신 주제로 집계하며, 여러 명이 물은 항목만 노출한다.
- 수집 대상은 www.kku.ac.kr 공개 페이지이며 요청 간 1초 간격을 둔다. 에브리타임 등 외부 서비스는 수집하지 않는다.
