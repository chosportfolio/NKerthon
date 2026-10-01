#!/usr/bin/env python3
"""
AI 선배 — 건국대 글로컬캠퍼스 RAG 챗봇 (하이브리드 검색 + LLM 답변)

  python kku_rag.py index    --data kku_data          # chunks.jsonl → 임베딩 (바뀐 청크만 새로 계산)
  python kku_rag.py retrieve --data kku_data "질문"   # 검색 결과만 확인 (LLM 비용 없음)
  python kku_rag.py ask      --data kku_data "질문"   # 한 번 묻기
  python kku_rag.py chat     --data kku_data          # 대화형

설정은 같은 폴더의 .env 파일 (.env.example 참고):
  OPENAI_API_KEY   API 키 (필수)
  OPENAI_BASE_URL  기본 https://api.openai.com/v1 (학교/대회에서 별도 주소를 줬다면 그 값)
  CHAT_MODEL       기본 gpt-6-luna
  EMBED_MODEL      기본 text-embedding-3-small

검색 흐름
  1) 키워드 검색(kku_keywords.Searcher, bigram BM25 + 주제 사전)  상위 30개
  2) 벡터 검색(질문 임베딩과 코사인 유사도)                        상위 30개
  3) 두 순위를 RRF로 합치고, 오래된 게시글은 감점 → 문서당 최대 2조각, 상위 6조각
  4) 조각을 [1]~[6] 번호를 붙여 LLM에 넘기고, 근거 번호를 달아 답하게 함
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import requests

import kku_courses as kc
import kku_keywords as kw

HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------------------
# 설정 / API
# ---------------------------------------------------------------------------
def load_env(path: Path = HERE / ".env"):
    if not path.exists():
        return
    for line in path.read_text("utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


class LLM:
    def __init__(self):
        load_env()
        self.key = os.environ.get("OPENAI_API_KEY", "")
        self.base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        self.chat_model = os.environ.get("CHAT_MODEL", "gpt-6-luna")
        self.embed_model = os.environ.get("EMBED_MODEL", "text-embedding-3-small")
        self.usage = {"embed_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0}
        if not self.key:
            sys.exit("OPENAI_API_KEY가 없습니다. .env.example을 복사해 .env를 만들고 키를 넣어 주세요.")

    def _post(self, path: str, body: dict, timeout: float = 120) -> dict:
        for attempt in range(5):
            r = requests.post(f"{self.base}{path}", json=body, timeout=timeout,
                              headers={"Authorization": f"Bearer {self.key}"})
            if r.status_code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(2 ** attempt * 2)
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"API 오류 {r.status_code}: {r.text[:500]}")
            return r.json()
        raise RuntimeError("API 재시도 초과")

    def embed(self, texts: list) -> np.ndarray:
        data = self._post("/embeddings", {"model": self.embed_model, "input": texts})
        self.usage["embed_tokens"] += (data.get("usage") or {}).get("total_tokens", 0)
        vecs = np.array([d["embedding"] for d in sorted(data["data"], key=lambda d: d["index"])],
                        dtype="float32")
        return vecs / np.linalg.norm(vecs, axis=1, keepdims=True)

    def chat(self, messages: list) -> str:
        data = self._post("/chat/completions", {"model": self.chat_model, "messages": messages})
        u = data.get("usage") or {}
        self.usage["prompt_tokens"] += u.get("prompt_tokens", 0)
        self.usage["completion_tokens"] += u.get("completion_tokens", 0)
        return (data["choices"][0]["message"].get("content") or "").strip()


# ---------------------------------------------------------------------------
# 임베딩 색인 (embeddings.npy + embeddings_meta.json)
# ---------------------------------------------------------------------------
def _hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _embed_input(chunk: dict) -> str:
    return chunk["text"][:3000]


def build_index(data: Path, llm: LLM, batch: int = 64):
    chunks = kw.read_jsonl(data / "chunks.jsonl")
    hashes = [_hash(_embed_input(c)) for c in chunks]

    cache = {}
    meta_path, vec_path = data / "embeddings_meta.json", data / "embeddings.npy"
    if meta_path.exists() and vec_path.exists():
        old = json.loads(meta_path.read_text("utf-8"))
        if old.get("model") == llm.embed_model:
            old_vecs = np.load(vec_path)
            cache = {h: old_vecs[i] for i, h in enumerate(old["hashes"])}

    todo = [i for i, h in enumerate(hashes) if h not in cache]
    print(f"청크 {len(chunks)}개 중 새로 임베딩할 것 {len(todo)}개 (나머지는 재사용)")
    for s in range(0, len(todo), batch):
        idx = todo[s:s + batch]
        vecs = llm.embed([_embed_input(chunks[i]) for i in idx])
        for i, v in zip(idx, vecs):
            cache[hashes[i]] = v
        print(f"  {min(s + batch, len(todo))}/{len(todo)}  (누적 {llm.usage['embed_tokens']:,} 토큰)")

    dim = len(next(iter(cache.values()))) if cache else 0
    mat = np.stack([cache[h] for h in hashes]) if chunks else np.zeros((0, dim), "float32")
    np.save(vec_path, mat.astype("float32"))
    meta_path.write_text(json.dumps({"model": llm.embed_model, "ids": [c["id"] for c in chunks],
                                     "hashes": hashes, "built_at": datetime.now().isoformat(timespec="seconds")},
                                    ensure_ascii=False), "utf-8")
    print(f"완료: {vec_path} ({mat.shape[0]}×{dim}), 임베딩 토큰 {llm.usage['embed_tokens']:,}")


# ---------------------------------------------------------------------------
# 하이브리드 검색
# ---------------------------------------------------------------------------
def _years_in(title: str) -> set:
    """'2018·2019학년도', '2022~2024학년도', '2017학년도' 같은 제목 → 해당 연도 집합"""
    out = set()
    for a, b in re.findall(r"(20\d{2})\s*~\s*(20\d{2})", title):
        out |= set(range(int(a), int(b) + 1))
    out |= {int(y) for y in re.findall(r"20\d{2}", title)}
    return out


MANUAL_FORCE_SIM = 0.45                                     # 억지로 넣은 직접 작성 자료를 우대할 최소 유사도
EXTERNAL_BOARDS = {"외부행사/공모전", "사회봉사", "아르바이트"}
EXTERNAL_WORDS = ["공모전", "대외", "외부", "봉사", "알바", "아르바이트", "경진", "대회", "서포터즈", "모집", "참가", "행사"]


class Retriever:
    def __init__(self, data: Path, llm: LLM):
        self.llm = llm
        self.kw = kw.Searcher.from_dir(data)
        self.chunks = self.kw.chunks
        meta = json.loads((data / "embeddings_meta.json").read_text("utf-8"))
        if meta["ids"] != [c["id"] for c in self.chunks]:
            sys.exit("chunks.jsonl이 임베딩 이후 바뀌었습니다. 먼저 `python kku_rag.py index`를 실행하세요.")
        self.vecs = np.load(data / "embeddings.npy")
        self.pos = {c["id"]: i for i, c in enumerate(self.chunks)}
        self.manual_idx = [i for i, c in enumerate(self.chunks) if c.get("source") == "manual"]
        self.latest_yoram = max((c["metadata"].get("year", 0) for c in self.chunks if c.get("source") == "yoram"),
                                default=0)

    def search(self, query: str, k: int = 6, pool: int = 30, per_doc: int = 2, rrf_k: int = 60,
               year: Optional[int] = None) -> list:
        """year: 학생 입학연도 — 그 해 요람을 우선(없으면 최신 요람 우선)."""
        fused = {}
        for rank, r in enumerate(self.kw.search(query, k=pool, recency=False, per_doc=pool)):
            i = self.pos[r["id"]]
            fused[i] = fused.get(i, 0) + 1 / (rrf_k + rank)
        q = self.llm.embed([query])[0]
        sims = self.vecs @ q
        for rank, i in enumerate(np.argsort(-sims)[:pool]):
            fused[int(i)] = fused.get(int(i), 0) + 1 / (rrf_k + rank)
        # 직접 작성 자료는 수가 적고 검증된 자료라, 다른 문서가 후보를 다 차지해도 가장 가까운 3개는 후보에 넣음
        # 단, 이렇게 '억지로' 넣은 것은 질문과 충분히 비슷할 때만 우대한다 (무관한 자료가 끼어드는 것 방지)
        forced = set()
        if self.manual_idx:
            for rank, i in enumerate(sorted(self.manual_idx, key=lambda j: -sims[j])[:3]):
                if i not in fused:
                    fused[i] = 1 / (rrf_k + pool + rank)
                    forced.add(i)
        cq = kw._compact(query)
        wants_external = any(w in cq for w in EXTERNAL_WORDS)

        today = datetime.now()
        for i in fused:
            c = self.chunks[i]
            if c.get("source") == "manual":            # 직접 작성한 자료는 우대 (학번이 주어지면 해당 연도 섹션을 더)
                if i in forced and sims[i] < MANUAL_FORCE_SIM:
                    continue
                fused[i] *= 1.5
                if year:
                    t = c.get("title", "")             # 섹션 제목(' - ' 뒤)만 봄: 전체 제목엔 '2017~2026'이 들어 있음
                    span = _years_in(t.split(" - ", 1)[1]) if " - " in t else set()
                    if span:
                        fused[i] *= 1.5 if year in span else 0.5
            elif c.get("source") == "schedule":        # 학교 공식 학사일정도 우대
                fused[i] *= 1.5
            elif c.get("source") == "yoram":           # 학번이 주어지면 그 해 요람 우대, 아니면 최신 요람을 기본값으로
                y = c["metadata"].get("year")
                if year:
                    target = year if year <= self.latest_yoram else self.latest_yoram
                    fused[i] *= 1.5 if y == target else 0.4
                else:                                  # 학번 없는 질문에서 요람이 홈페이지 안내를 밀어내지 않도록
                    fused[i] *= 1.0 if y == self.latest_yoram else 0.4
            elif c.get("source") == "post":
                try:
                    d = datetime.strptime((c["metadata"].get("date") or "")[:10], "%Y-%m-%d")
                    fused[i] *= 1 / (1 + max((today - d).days, 0) / 730)
                except ValueError:
                    pass
                # 외부 기관 행사·공모전·봉사·알바 공지는 수가 많아 학교 안내를 밀어내므로, 그쪽을 묻는 질문이 아니면 감점
                if c["metadata"].get("board") in EXTERNAL_BOARDS and not wants_external:
                    fused[i] *= 0.4

        out, per = [], {}
        for i in sorted(fused, key=fused.get, reverse=True):
            c = self.chunks[i]
            if per.get(c["doc_id"], 0) >= per_doc:
                continue
            per[c["doc_id"]] = per.get(c["doc_id"], 0) + 1
            out.append({**c, "score": round(fused[i] * 1000, 2), "sim": round(float(sims[i]), 3)})
            if len(out) >= k:
                break
        return out


# ---------------------------------------------------------------------------
# 답변 생성
# ---------------------------------------------------------------------------
SYSTEM = """너는 건국대학교 글로컬캠퍼스(충주) 학생을 돕는 'AI 선배'야.
규칙:
1. 아래 [자료]에 있는 내용만 근거로 답해. 자료에 없는 내용은 추측하지 말고 "제가 가진 자료로는 확인이 안 돼요"라고 말한 뒤, 확인할 수 있는 곳(담당 부서, 홈페이지 메뉴)을 알려줘.
2. 날짜·기간·장소·금액·전화번호·과목명·학수번호는 자료에 적힌 그대로 옮겨(줄이거나 바꿔 쓰지 마).
3. 오늘은 {today}야. 공지의 작성일이나 기간을 보고 이미 지난 일정이면 지났다고 분명히 말해.
4. 문장 끝에 근거 자료 번호를 [1], [2]처럼 하나씩 붙여([1]–[6] 같은 범위 표기 금지). 번호는 그 문장의 내용을
   실제로 담고 있는 자료에만 붙이고, 답을 찾지 못했을 때 질문과 관련 없는 자료를 근거로 달지 마.
5. 친근한 존댓말로, 핵심부터 짧게. 필요하면 목록을 써. 이모지는 쓰지 마.
   [직접 작성 자료]는 운영자가 확인해 보충한 정보야. 다른 자료와 내용이 다르면 이것을 우선해.
   '학사요람'은 입학연도별로 적용돼. 학생 입학연도의 요람을 기준으로 답하고, 어느 학년도 요람 기준인지 밝혀.
   요람에 없는 학과·연도라면 그렇다고 말하고, 학과 사무실이나 학사지원팀(043-840-3253)에 확인하라고 안내해.
6. 메신저 말풍선처럼 나눠서 답해. 첫 말풍선은 질문에 대한 핵심 답 1~2문장, 다음 말풍선부터 세부 내용(시간표·목록·주의사항·문의처 등)을 주제별로 하나씩.
   말풍선은 최대 {max_bubbles}개, 하나에 300자 이내. 말풍선 사이에는 [[NEXT]] 한 줄만 넣어. 짧은 답이면 말풍선 1개로 충분해.
7. 답이 학과·학년·입학연도 등에 따라 달라지는데 [학생 정보]에도 질문에도 그 정보가 없으면, 공통으로 해당하는 내용만 짧게 말한 뒤 필요한 정보를 물어봐.
8. '강의시간표' 자료는 그 학기에 실제로 열리는 강좌 목록이야. 과목의 학점·담당 교수·요일·시간·강의실은 이 자료를 우선해.
   질문에 학기가 없으면 몇 학년도 몇 학기 기준인지 밝혀. 분반마다 교수·시간·강의실이 다르면 분반별로 나눠 알려줘.
   목록이 길면 대표 과목 위주로 보여주고, 전체는 앱 '시간표' 탭의 강의 검색에서 볼 수 있다고 안내해.
   '내 시간표' 자료는 학생이 앱에 직접 등록한 수업이야. 오늘·내일 수업 질문은 오늘 요일을 기준으로 이 자료에서 답해.
   등록된 수업이 없으면 '확인이 안 돼요' 대신, 시간표 탭에서 수업을 추가하면 알려줄 수 있다고 안내해.
9. "머리가 아파", "배고파", "다쳤어"처럼 학생이 자기 상황을 말하면, 자료에 있는 학교 시설·서비스(보건실, 학생식당,
   상담센터 등)의 위치·운영시간·연락처를 먼저 안내해. 의학적 진단이나 처방은 하지 말고, 심하면 병원에 가라고 권해."""

BUBBLE_SEP = "[[NEXT]]"
LANG_RULE = {
    "en": "10. Answer in English. Keep Korean proper nouns (course names, buildings) in Korean with a short English gloss.",
    "zh": "10. 请用中文回答。课程名、建筑名等韩语专有名词保留韩语原文，并附简短中文说明。",
}
# 입학연도(학번)에 따라 답이 달라지는 주제 — 이 단어가 있으면 학번에 맞는 요람을 우대
YEAR_TOPICS = ["졸업", "교양", "전공", "학점", "교육과정", "커리큘럼", "요람", "필수", "이수", "다전공", "부전공",
               "kugep", "ku소양", "인성", "심화"]


# ---------------------------------------------------------------------------
# 되묻기 규칙 (clarify.json) + 학생 정보(학과·입학연도·학년) 추출
# ---------------------------------------------------------------------------
_NOT_DEPT = {"우리학과", "무슨학과", "어느학과", "다른학과", "타학과", "본학과", "해당학과",
             "복수전공", "부전공", "연계전공", "융합전공", "다전공", "제1전공", "제2전공", "주전공"}


def extract_slots(text: str) -> dict:
    slots = {}
    for m in re.finditer(r"([가-힣/]{2,}(?:학과|학부|전공))", text):
        if m.group(1) not in _NOT_DEPT:
            slots["학과"] = m.group(1)
    if "학과" not in slots:                                  # '컴공 전선 뭐 있어' 같은 줄임말
        slots.update({"학과": full for alias, full in kc.DEPT_ALIASES.items() if alias in text})
    m = (re.search(r"(20\d{2})\s*(?:학번|학년도|년도?\s*(?:에\s*)?(?:입학|들어))", text)
         or re.search(r"(?<!\d)(\d{2})\s*(?:학번|학년도|년도?\s*(?:에\s*)?입학)", text))
    if m:
        y = m.group(1)
        slots["입학연도"] = y if len(y) == 4 else f"20{y}"
    m = re.search(r"(?<!\d)([1-4])\s*학년(?!도)", text)       # '22학년도'의 '2학년'은 학년이 아님
    if m:
        slots["학년"] = f"{m.group(1)}학년"
    elif "신입생" in text or "새내기" in text:
        slots["학년"] = "1학년"
    return slots


_DEPT_SUFFIX = re.compile(r"(학과|학부|전공|트랙|과)$")


def _dept_core(name: str) -> str:
    """'컴퓨터공학과'·'컴퓨터공학전공' → '컴퓨터공학' (학과 이름이 해마다 바뀌어도 같은 학과로 보도록)"""
    s = re.sub(r"[\s·･()]", "", name)
    while _DEPT_SUFFIX.search(s) and len(s) > 2:
        s = _DEPT_SUFFIX.sub("", s)
    return s


def other_dept_yoram(h: dict, dept: str, question: str) -> bool:
    """학생 학과와 다른 학과·전공의 요람 자료인지. 학부·학사 안내 같은 공통 자료와 질문에 나온 학과는 제외."""
    if h.get("source") != "yoram" or not dept:
        return False
    m = re.search(r"학사요람 - (.+)$", h.get("title", ""))
    if not m:
        return False
    name = re.sub(r"\(.*", "", m.group(1)).strip()
    if "학부" in name or not re.search(r"(학과|전공|트랙)$", name.replace(" ", "")):
        return False
    a, b = _dept_core(name), _dept_core(dept)
    if not a or not b or a in b or b in a:
        return False
    q = kw._compact(question)
    return a not in q and a[:max(3, len(a) - 2)] not in q          # "메카트로닉스 과목"처럼 줄여 불러도 질문에 나온 학과로


def load_clarify(path: Path = HERE / "clarify.json") -> list:
    return json.loads(path.read_text("utf-8")) if path.exists() else []


def split_bubbles(text: str, max_bubbles: int = 4, max_chars: int = 300) -> list:
    """LLM이 [[NEXT]]로 나눴으면 그대로, 아니면 문단 단위로 잘라 max_chars 안쪽으로 묶는다."""
    if BUBBLE_SEP in text:
        parts = [p.strip() for p in text.split(BUBBLE_SEP)]
    else:
        parts, cur = [], ""
        for para in (p.strip() for p in text.split("\n\n")):
            if cur and len(cur) + 2 + len(para) > max_chars:
                parts.append(cur)
                cur = ""
            cur = f"{cur}\n\n{para}" if cur else para
        parts.append(cur)
    parts = [p for p in parts if p]
    if len(parts) > max_bubbles:                     # 너무 많으면 뒤쪽을 마지막 말풍선에 합침
        parts = parts[:max_bubbles - 1] + ["\n\n".join(parts[max_bubbles - 1:])]
    return parts or [text.strip()]


def _context(hits: list) -> str:
    blocks = []
    for n, h in enumerate(hits, 1):
        m = h.get("metadata") or {}
        info = ", ".join(x for x in [m.get("board") or h.get("source"), (m.get("date") or m.get("updated") or "")[:10]] if x)
        blocks.append(f"[{n}] {h['title']} ({info})\nURL: {h['url'] or '없음'}\n{h['text']}")
    return "\n\n---\n\n".join(blocks)


class Bot:
    """앱 서버에서도 그대로 쓸 수 있는 진입점: Bot(data).answer(질문, 이전대화, 학생정보)"""

    def __init__(self, data: Path = HERE / "kku_data"):
        self.llm = LLM()
        self.retriever = Retriever(Path(data), self.llm)
        self.rules = load_clarify()
        self.courses = kc.CourseCatalog()

    def answer(self, question: str, history: list | None = None, profile: dict | None = None,
               k: int = 6, max_bubbles: int = 4, lang: str = "ko", timetable: list | None = None) -> dict:
        """
        profile: 앱이 이미 아는 학생 정보 (예: {"학과": "컴퓨터공학과", "입학연도": "2022", "학년": "3학년"})
                 있으면 되묻지 않고 바로 답한다. 대화에서 말한 정보가 profile보다 우선.
        반환: {"bubbles": [말풍선...], "answer": 전체 텍스트, "sources": [...], "hits": [...],
               "clarify": 되물은 규칙 이름 또는 None, "missing": [부족한 정보]}
        """
        history = history or []
        last_q = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")
        last_a = next((m["content"] for m in reversed(history) if m["role"] == "assistant"), "")
        said = " ".join(m["content"] for m in history if m["role"] == "user") + " " + question
        slots = {**{k2: v for k2, v in (profile or {}).items() if v}, **extract_slots(said)}

        # 직전에 되물었던 규칙이면 이번 답을 원래 질문과 합쳐서 진행 (같은 걸 두 번 묻지 않음)
        pending = next((r for r in self.rules if last_a == r["ask"]), None)
        cq = kw._compact(question)
        rule = pending or next((r for r in self.rules
                                if any(kw._compact(x) in cq for x in r["keywords"])
                                and not any(kw._compact(x) in cq for x in r.get("except", []))), None)
        if rule and not pending:
            missing = [s for s in rule["need"] if s not in slots]
            if missing:
                return {"bubbles": [rule["ask"]], "answer": rule["ask"], "sources": [], "hits": [],
                        "clarify": rule["name"], "missing": missing}

        if pending or (last_q and len(question) < 25):
            query = f"{last_q} {question}".strip()
        else:
            query = question
        if rule:
            query += " " + " ".join(slots.get(s, "") for s in rule["need"])
        year = int(slots["입학연도"]) if str(slots.get("입학연도", "")).isdigit() else None
        # 앱은 로그인 정보로 학번을 항상 넘기므로, 입학연도가 답을 좌우하는 질문에만 연도별 요람 우대를 적용
        # (그 외 질문에서 요람이 홈페이지 안내를 밀어내지 않도록)
        said_year = "입학연도" in extract_slots(said)
        if not (said_year or rule or any(w in kw._compact(query) for w in YEAR_TOPICS)):
            year = None
        hits = self.retriever.search(query.strip(), k=k + 3, year=year)
        # 학과가 정해졌으면 다른 학과 요람은 빼서, 다른 학과 과목·학점을 근거로 답하지 않게 함
        if slots.get("학과"):
            hits = [h for h in hits if not other_dept_yoram(h, slots["학과"], query)]
        hits = hits[:k]
        # 과목·교수·개설강좌 질문은 강의시간표에서, '내 수업' 질문은 학생이 등록한 시간표에서 찾아 맨 앞에 붙임
        extra = []
        # 이어지는 질문이라도 이번 질문이 수업 얘기가 아니면 앞 질문의 과목을 다시 붙이지 않음 ('배고파' 등)
        if kc.wants_personal(question):                      # 비어 있어도 "등록된 수업이 없어요"라고 안내하도록
            extra.append(kc.personal_hit(timetable or []))
        course = self.courses.lookup(question, slots)
        if course is None and query != question and kc.asks_about_course(question):
            course = self.courses.lookup(query, slots)          # "그거 누가 가르쳐?" → 앞 질문의 과목으로
        if course:
            extra.append(course)
        hits = [h for h in extra if h] + hits

        now = datetime.now()
        today = f"{now.year}년 {now.month}월 {now.day}일 ({'월화수목금토일'[now.weekday()]})"
        student = ("[학생 정보] " + ", ".join(f"{k2}: {v}" for k2, v in slots.items()) + "\n\n") if slots else ""
        asked = f"{last_q} → {question}" if pending else question
        system = SYSTEM.format(today=today, max_bubbles=max_bubbles)
        if lang in LANG_RULE:
            system += "\n" + LANG_RULE[lang]
        messages = [{"role": "system", "content": system},
                    *history[-6:],
                    {"role": "user", "content": f"{student}[자료]\n{_context(hits)}\n\n[질문]\n{asked}"}]
        raw = self.llm.chat(messages)
        # '[1]–[6]' 같은 범위 표기는 낱개 번호로 풀어서, 아래 근거 검증이 하나씩 거르도록 함
        raw = re.sub(r"\[(\d+)\]\s*[–\-~]\s*\[(\d+)\]",
                     lambda m: "".join(f"[{n}]" for n in range(int(m.group(1)), int(m.group(2)) + 1)), raw)
        bubbles = split_bubbles(raw, max_bubbles)
        text = "\n\n".join(bubbles)
        sources = make_sources(hits, text, query)          # 이어지는 질문은 앞 질문과 합친 검색어로 검증
        # 검증에서 빠진 자료의 번호 표시는 본문에서도 지움 (카드 없는 번호가 남지 않게)
        kept = {n for s in sources for n in s["n"]}
        dropped = [n for n in range(1, len(hits) + 1) if f"[{n}]" in text and n not in kept]
        if dropped:
            pattern = re.compile(r"\s?\[(?:" + "|".join(map(str, dropped)) + r")\]")
            bubbles = [pattern.sub("", b) for b in bubbles]
            text = "\n\n".join(bubbles)
        return {"bubbles": bubbles, "answer": text, "sources": sources, "source_bubble": source_bubble(sources),
                "hits": hits, "clarify": None, "missing": []}


# ---------------------------------------------------------------------------
# 근거(출처) — 답변마다 항상 붙임. 요람은 PDF 쪽 번호까지
# ---------------------------------------------------------------------------
def _source_of(h: dict) -> dict:
    m = h.get("metadata") or {}
    src = h.get("source")
    s = {"title": h["title"], "url": h.get("url") or "", "kind": src,
         "date": (m.get("date") or m.get("updated") or "")[:10], "page": None}
    if src == "yoram":
        p = re.search(r"\[요람 (\d+)쪽\]", h.get("text", ""))
        s["page"] = int(p.group(1)) if p else (m.get("pages") or [None])[0]
        s["title"] = re.sub(r"\s*\(.*$", "", h["title"])
        t = re.search(r"\[졸업에 필요한 최저 이수 학점 — \d{4}학년도 요람 (\d+)쪽 표\]", h.get("text", ""))
        pages = []
        if t:
            pages.append(f"{t.group(1)}쪽(졸업학점 표)")
        if s["page"] and (not t or str(s["page"]) != t.group(1)):
            pages.append(f"{s['page']}쪽")
        s["note"] = ("PDF " + "·".join(pages) if pages else "PDF") + " (요람 게시판 첨부파일)"
    elif src == "post":
        s["note"] = f"{m.get('board', '공지')} {s['date']}"
    elif src == "page":
        s["note"] = "학교 홈페이지 안내"
    elif src == "manual":
        s["note"] = "운영자 정리 자료" + (" (원문 링크)" if s["url"] else "")
    elif src == "schedule":
        s["note"] = "학교 학사일정"
    elif src == "catalog":
        s["note"] = "학교 강의시간표 (앱 시간표 탭 강의 검색과 같은 자료)"
    elif src == "timetable":
        s["note"] = "앱 시간표에 등록한 수업"
    else:
        s["note"] = ""
    return s


_GENERIC = {"일정", "기간", "언제", "방법", "신청", "안내", "학교", "정보", "시간", "질문", "내용", "관련", "어디", "무엇",
            "가능", "오늘", "이번", "학기", "학년", "알려", "궁금", "건국", "건국대", "글로컬", "캠퍼스"}


def _question_terms(question: str) -> list:
    return [w for w in kw.nouns(question) if w not in _GENERIC and len(w) >= 2]


def is_relevant(h: dict, question: str, answer: str) -> bool:
    """근거 검증: 질문의 핵심 단어가 자료에 있거나, 답변이 그 자료(메뉴·제목)를 직접 언급하면 관련 있음."""
    if h.get("source") in ("catalog", "timetable"):      # 질문에 맞춰 골라 만든 자료라 항상 관련 있음
        return True
    terms = _question_terms(question)
    if not terms:
        return True
    body = kw._compact(h.get("title", "") + " " + h.get("text", ""))
    for t in terms:
        grams = kw.tokenize(t) or [t]
        if sum(g in body for g in grams) / len(grams) >= 0.5:
            return True
    name = re.split(r"\s*[>\-]\s*", h.get("title", ""))[-1].strip() or h.get("title", "")
    return len(name) >= 4 and kw._compact(name) in kw._compact(answer)


# 답이 아닌 문장: "확인이 안 돼요", "안내할 수 없어요", "~에 문의해 주세요" — 여기 붙은 번호는 근거로 치지 않음
NON_ANSWER = re.compile(r"확인이\s*안|확인되지\s*않|확인할\s*수\s*없|확인이\s*어렵|자료에\s*(?:는\s*)?없|알\s*수\s*없|"
                        r"안내할\s*수\s*없|도와드릴\s*수\s*없|드릴\s*수\s*없|"
                        r"문의해|문의하세요|문의 바|확인해\s*(?:주세요|보세요)|확인하시")
_SENTENCE = re.compile(r"[^.!?\n]+(?:[.!?]+|$)(?:\s*\[\d+\])*")      # 문장 + 뒤에 붙은 [n]


def evidence_text(text: str) -> str:
    """답변에서 실제로 무언가를 알려주는 문장만 남긴 텍스트 (번호 인용 판단용)"""
    return " ".join(m.group() for m in _SENTENCE.finditer(text) if not NON_ANSWER.search(m.group()))


def make_sources(hits: list, text: str, question: str = "") -> list:
    """답변이 실제 정보를 주는 문장에서 [n]으로 인용했고, 질문과 관련 있는 자료만 출처로.
    인용이 없거나('답할 수 없어요'·'문의해 주세요' 문장에만 번호가 붙은 경우 포함) 출처를 달지 않는다."""
    evidence = evidence_text(text)
    out = {}
    for n, h in enumerate(hits, 1):
        if (h.get("metadata") or {}).get("empty"):            # 빈 '내 시간표'는 근거가 아님
            continue
        if f"[{n}]" in evidence and (not question or is_relevant(h, question, text)):
            key = (h.get("url") or h["doc_id"], h.get("source"), _source_of(h)["page"])
            s = out.setdefault(key, {**_source_of(h), "n": [], "cited": True})
            s["n"].append(n)
    return list(out.values())


def source_bubble(sources: list) -> str:
    if not sources:
        return ""
    lines = ["근거 자료" if any(s["cited"] for s in sources) else "참고 자료 (답변과 가장 관련 높은 자료)"]
    for s in sources:
        nums = "".join(f"[{n}]" for n in s["n"]) if s["cited"] else "-"
        lines.append(f"{nums} {s['title']}" + (f" · {s['note']}" if s.get("note") else ""))
        if s["url"]:
            lines.append(f"    {s['url']}")
    return "\n".join(lines)


def _print_answer(res: dict, llm: LLM, delay: float = 0.6):
    for i, b in enumerate(res["bubbles"]):
        if i:
            time.sleep(delay)
        print("\nAI 선배> " + b.replace("\n", "\n         "))
    if res.get("source_bubble"):
        time.sleep(delay)
        print("\nAI 선배> " + res["source_bubble"].replace("\n", "\n         "))
    u = llm.usage
    print(f"\n(누적 토큰: 입력 {u['prompt_tokens']:,} / 출력 {u['completion_tokens']:,} / 임베딩 {u['embed_tokens']:,})")


# ---------------------------------------------------------------------------
def main(argv=None):
    p = argparse.ArgumentParser(description="AI 선배 RAG 챗봇")
    p.add_argument("cmd", choices=["refresh", "index", "retrieve", "ask", "chat"],
                   help="refresh = 청크 다시 만들기 + 임베딩 (manual/, keywords.json, exclude.json 수정 후)")
    p.add_argument("query", nargs="?")
    p.add_argument("--data", type=Path, default=HERE / "kku_data")
    p.add_argument("-k", type=int, default=6, help="LLM에 넘길 조각 수")
    a = p.parse_args(argv)

    if a.cmd in ("refresh", "index"):
        if a.cmd == "refresh":
            kw.main(["build", "--data", str(a.data)])
        build_index(a.data, LLM())
        return

    if a.cmd == "retrieve":
        llm = LLM()
        r = Retriever(a.data, llm)
        for n, h in enumerate(r.search(a.query or input("질문> "), k=a.k), 1):
            date = (h["metadata"].get("date") or "")[:10]
            print(f"\n[{n}] {h['title']}  ({h['source']}{', ' + date if date else ''}, 점수 {h['score']}, 유사도 {h['sim']})")
            print("    " + kw.snippet(h["text"], a.query or "", 200))
        return

    bot = Bot(a.data)
    if a.cmd == "ask":
        _print_answer(bot.answer(a.query or input("질문> "), k=a.k), bot.llm)
        return

    history = []
    print("AI 선배입니다. 무엇이든 물어보세요. (빈 줄 입력 시 종료)")
    while True:
        try:
            q = input("\n나> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q:
            break
        try:
            res = bot.answer(q, history, k=a.k)
        except Exception as e:
            print(f"오류: {e}")
            continue
        _print_answer(res, bot.llm)
        history += [{"role": "user", "content": q}, {"role": "assistant", "content": res["answer"]}]


if __name__ == "__main__":
    main()
