#!/usr/bin/env python3
"""
AI 선배 챗봇 API 서버 (시연용 로컬 서버)

  python app_server.py            # 이 PC에서만 접속 (http://localhost:8000)
  python app_server.py --lan      # 같은 와이파이의 휴대폰에서도 접속 (http://<PC 내부 IP>:8000)

  POST /chat     {"question": "...", "history": [...], "profile": {"학과": "...", "입학연도": "2022"}}
  GET  /health   서버 상태, 누적 토큰
  GET  /docs     요청을 직접 보내 볼 수 있는 시험 화면 (FastAPI 자동 문서)

API 키는 이 PC의 .env에만 있고, 앱은 이 서버에 질문만 보낸다.
"""
from __future__ import annotations

import argparse
import socket
import threading
import time
from collections import OrderedDict, defaultdict
from datetime import date

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import kku_rag

DAILY_LIMIT = 100          # 접속 기기(IP)별 하루 질문 수 — 100달러 예산 보호
CACHE_TTL = 3600           # 같은 질문(대화 맥락 없음)은 1시간 동안 저장된 답을 재사용
CACHE_MAX = 500


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500, examples=["경영학과 22학번 졸업학점 몇이야?"])
    history: list[Turn] = Field(default_factory=list, description="직전 대화 (앱이 보관, 최근 6개까지 사용)")
    profile: dict[str, str] = Field(default_factory=dict, examples=[{"학과": "경영학과", "입학연도": "2022"}],
                                    description="앱 로그인 정보. 있으면 학과·학번을 되묻지 않음")
    language: str = Field(default="ko", pattern="^(ko|en|zh)$", description="답변 언어")


class Source(BaseModel):
    n: list[int]
    title: str
    url: str
    kind: str | None
    note: str = ""
    page: int | None = None
    cited: bool


class ChatResponse(BaseModel):
    bubbles: list[str] = Field(description="답변 말풍선 (순서대로 표시)")
    source_bubble: str = Field(description="마지막에 붙이는 '근거 자료' 말풍선 텍스트")
    sources: list[Source] = Field(description="출처 카드용 목록")
    clarify: str | None = Field(description="학과·학번을 되물은 경우 규칙 이름")
    answer: str = Field(description="말풍선을 합친 텍스트 (다음 요청의 history에 assistant로 넣을 값)")
    cached: bool = False


app = FastAPI(title="AI 선배 챗봇 API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])  # 시연용

bot: kku_rag.Bot | None = None
lock = threading.Lock()
cache: "OrderedDict[tuple, tuple[float, dict]]" = OrderedDict()
counts: dict = defaultdict(int)
started = time.time()


@app.on_event("startup")
def load_bot():
    global bot
    bot = kku_rag.Bot()
    print(f"챗봇 준비 완료: 검색 조각 {len(bot.retriever.chunks):,}개, 모델 {bot.llm.chat_model}")


@app.get("/health")
def health():
    return {"ok": bot is not None, "chunks": len(bot.retriever.chunks) if bot else 0,
            "chat_model": bot.llm.chat_model if bot else None, "usage": bot.llm.usage if bot else None,
            "uptime_sec": int(time.time() - started), "cache_size": len(cache)}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    if bot is None:
        raise HTTPException(503, "챗봇을 불러오는 중이에요. 잠시 후 다시 시도해 주세요.")
    # Node 서버를 거치면 접속 주소가 모두 같으므로, 넘겨받은 사용자 ID(X-Client-Id)가 있으면 그것으로 한도를 셈
    client = request.headers.get("x-client-id") or (request.client.host if request.client else "?")
    who = (client, date.today().isoformat())
    with lock:
        if counts[who] >= DAILY_LIMIT:
            raise HTTPException(429, f"오늘 질문 한도({DAILY_LIMIT}회)를 다 썼어요. 내일 다시 이용해 주세요.")
        counts[who] += 1

    key = (req.question.strip(), tuple(sorted(req.profile.items())), req.language) if not req.history else None
    if key:
        with lock:
            hit = cache.get(key)
            if hit and time.time() - hit[0] < CACHE_TTL:
                return {**hit[1], "cached": True}

    try:
        res = bot.answer(req.question.strip(), [t.model_dump() for t in req.history][-6:],
                         profile=req.profile or None, lang=req.language)
    except Exception as e:                                   # OpenAI 지연·오류 등
        print("오류:", e)
        raise HTTPException(502, "답변을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.")

    out = {"bubbles": res["bubbles"], "source_bubble": res.get("source_bubble", ""),
           "sources": [{k: s.get(k) for k in ("n", "title", "url", "kind", "note", "page", "cited")}
                       for s in res.get("sources", [])],
           "clarify": res.get("clarify"), "answer": res["answer"]}
    if key and not res.get("clarify"):
        with lock:
            cache[key] = (time.time(), out)
            while len(cache) > CACHE_MAX:
                cache.popitem(last=False)
    return out


def lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "알 수 없음"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--lan", action="store_true", help="같은 네트워크의 다른 기기(휴대폰)에서 접속 허용")
    a = ap.parse_args()
    host = "0.0.0.0" if a.lan else "127.0.0.1"
    print(f"이 PC:   http://localhost:{a.port}/docs")
    if a.lan:
        print(f"휴대폰:  http://{lan_ip()}:{a.port}  (같은 와이파이/핫스팟이어야 함)")
    uvicorn.run(app, host=host, port=a.port, log_level="warning")
