#!/usr/bin/env python3
"""
단계별 성공률 측정 (ablation) — 같은 평가 질문으로 개선 단계를 하나씩 켜 가며 점수 비교

  python eval/run_eval.py                 # 6단계 검색 정확도 + 처음/현재 답변 정확도
  python eval/run_eval.py --answers all   # 모든 단계 답변 정확도 (LLM 호출 많음)
  python eval/run_eval.py --stages 6 --answers 6

단계
  1 키워드 검색만        (홈페이지 전체, 제외 규칙 없음)
  2 + 임베딩(하이브리드)
  3 + 불필요한 자료 제외 (exclude.json)
  4 + 학사요람           (kku_data/extra)
  5 + 직접 작성 자료     (manual/)
  6 + 버그 수정          (학번 인식 정규식, 되묻기 예외 단어) = 현재 코드

결과: eval/results/ (단계별 상세 CSV/JSONL + summary.md)
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import kku_keywords as kw  # noqa: E402
import kku_courses as kc   # noqa: E402
import kku_rag as rag      # noqa: E402

DATA = ROOT / "kku_data"
ABL = DATA / "ablation"
OUT = ROOT / "eval" / "results"
XLSX = ROOT / "eval" / "eval_questions.xlsx"

STAGES = {
    1: dict(name="① 키워드 검색만", data="all", hybrid=False, fixed=False),
    2: dict(name="② + 임베딩(하이브리드)", data="all", hybrid=True, fixed=False),
    3: dict(name="③ + 불필요한 자료 제외", data="excl", hybrid=True, fixed=False),
    4: dict(name="④ + 학사요람", data="yoram", hybrid=True, fixed=False),
    5: dict(name="⑤ + 직접 작성 자료", data="full", hybrid=True, fixed=False),
    6: dict(name="⑥ + 학번 인식 버그 수정", data="full", hybrid=True, fixed=True),
    7: dict(name="⑦ + 실패 분석 후 개선", data="full", hybrid=True, fixed=True),
    8: dict(name="⑧ + 남은 오류 수정", data="full", hybrid=True, fixed=True),
    9: dict(name="⑨ + 강의시간표 연동 (현재)", data="full", hybrid=True, fixed=True, courses=True),
}


# ---------------------------------------------------------------- 데이터 구성
def data_dir(kind: str) -> Path:
    if kind == "full":
        return DATA
    d = ABL / kind
    if (d / "chunks.jsonl").exists() and (d / "embeddings.npy").exists():
        return d
    d.mkdir(parents=True, exist_ok=True)
    docs = kw.read_jsonl(DATA / "documents.jsonl")
    if kind in ("excl", "yoram"):
        docs = [x for x in docs if not kw.is_excluded(x, kw.load_exclude())]
    if kind == "yoram":
        docs += kw.load_extra_docs(DATA)
    n = kw.write_chunks(docs, d / "chunks.jsonl", kw.load_topics(), 800, manual_dir=d / "_no_manual")
    print(f"[{kind}] 청크 {n}개 → 임베딩 (기존 것은 재사용)")
    for f in ("embeddings.npy", "embeddings_meta.json"):        # 같은 청크는 기존 임베딩 재사용
        shutil.copy(DATA / f, d / f)
    rag.build_index(d, rag.LLM(), batch=128)
    return d


# ---------------------------------------------------------------- 단계별 동작 차이
OLD_SLOT = (r"(20\d{2})\s*(?:년도?|학번)?\s*(?:입학|학번)", r"(?<!\d)(\d{2})\s*(?:학번|년도?\s*입학)")
_new_extract = rag.extract_slots


def _old_extract(text: str) -> dict:
    slots = _new_extract(text)
    slots.pop("입학연도", None)
    m = re.search(OLD_SLOT[0], text) or re.search(OLD_SLOT[1], text)
    if m:
        y = m.group(1)
        slots["입학연도"] = y if len(y) == 4 else f"20{y}"
    return slots


class KeywordOnly:
    """임베딩 없이 키워드(BM25)만 쓰는 검색기 — 1단계"""

    def __init__(self, d: Path):
        self.kw = kw.Searcher.from_dir(d)

    def search(self, query, k=6, year=None, **_):
        return self.kw.search(query, k=k, recency=True, per_doc=2)


def make_bot(stage: dict):
    d = data_dir(stage["data"])
    rag.extract_slots = _new_extract if stage["fixed"] else _old_extract
    bot = object.__new__(rag.Bot)
    bot.llm = rag.LLM()
    bot.retriever = rag.Retriever(d, bot.llm) if stage["hybrid"] else KeywordOnly(d)
    bot.rules = rag.load_clarify()
    # 강의시간표 연동 전 단계는 빈 폴더를 넘겨 시간표 검색을 끔
    bot.courses = kc.CourseCatalog() if stage.get("courses") else kc.CourseCatalog(ROOT / "_no_catalog")
    if not stage["fixed"]:
        bot.rules = [{k: v for k, v in r.items() if k != "except"} for r in bot.rules]
    return bot


# ---------------------------------------------------------------- 채점
def load_questions():
    ws = openpyxl.load_workbook(XLSX, read_only=True)["평가질문"]
    rows = list(ws.iter_rows(values_only=True))
    head = rows[0]
    out = []
    for r in rows[1:]:
        q = dict(zip(head, r))
        if q.get("검수") == "삭제" or not q.get("질문"):
            continue
        out.append(q)
    return out


squash = lambda s: re.sub(r"\s+", "", s or "")


def kw_ok(answer: str, spec: str) -> bool:
    a = squash(answer)
    return all(any(squash(alt) in a for alt in term.split("|")) for term in str(spec).split(";") if term)


DONT_KNOW = ["확인이안", "확인되지", "자료에없", "자료로는", "알수없", "제공되지", "포함되어있지", "찾을수없",
             "정보가없", "나와있지", "답변드리기어렵", "도와드리기어렵", "어려워요", "범위", "모르",
             "수는없", "할수없", "드릴수없", "써드리기보다", "대신써드릴수"]


HEDGE = ["확인이안", "확인되지않", "확인할수없", "확인이필요", "단정할수없", "단정하기", "확정하기", "확정해드리",
         "확정확인", "직접확인되지", "자료에없어", "자료에는없", "알수없"]


def strict_grade(q: dict, ans: str, ok: bool) -> str:
    """정답 / 불확실(맞는 숫자를 말하면서 '확인이 안 된다'고 함) / 오답"""
    if q["기대 동작"] != "답변":
        return "정답" if ok else "오답"
    if not ok:
        return "오답"
    head = squash(ans.split("\n\n")[0])                 # 첫 말풍선(핵심 답)에 단서가 붙었는지로 판단
    return "불확실" if any(h in head for h in HEDGE) else "정답"


def grade(q: dict, res: dict) -> tuple[bool, str]:
    exp = q["기대 동작"]
    text = res.get("answer", "")
    if exp == "되묻기":
        ok = bool(res.get("clarify")) or ("알려주" in text and ("학과" in text or "학년" in text))
        return ok, "되묻기" if ok else "되묻지 않음"
    if exp == "모름":
        ok = any(w in squash(text) for w in DONT_KNOW)
        return ok, "모른다고 함" if ok else "지어냈을 가능성"
    if res.get("clarify"):
        return False, "불필요한 되묻기"
    ok = kw_ok(text, q["채점 키워드"])
    return ok, "정답" if ok else "키워드 누락"


def profile(q):
    p = {}
    if q.get("학과(프로필)"):
        p["학과"] = q["학과(프로필)"]
    if q.get("입학연도(프로필)"):
        p["입학연도"] = str(q["입학연도(프로필)"])
    return p


def eval_retrieval(bot, qs):
    by = defaultdict(lambda: [0, 0, 0])
    rows = []
    for q in qs:
        if q["기대 동작"] != "답변" or not q.get("정답 문서 ID"):
            continue
        gold = set(q["정답 문서 ID"].split(";"))
        p = profile(q)
        query = " ".join(x for x in [q["질문"], p.get("학과", ""), p.get("입학연도", "")] if x)
        s = rag.extract_slots(q["질문"])
        y = int(p.get("입학연도") or s.get("입학연도") or 0) or None
        hits = bot.retriever.search(query, k=6, year=y)
        ids = [h["doc_id"] for h in hits]
        rank = next((i + 1 for i, d in enumerate(ids) if d in gold or d.split("#")[0] in gold), None)
        b = by[q["종류"]]
        b[0] += 1; b[1] += rank == 1; b[2] += rank is not None
        rows.append([q["ID"], q["종류"], q["질문"], rank or "", hits[0]["title"][:50] if hits else ""])
    return by, rows


def eval_answers(bot, qs, path: Path):
    by = defaultdict(lambda: [0, 0])
    out = open(path, "w", encoding="utf-8")
    for i, q in enumerate(qs, 1):
        try:
            res = bot.answer(q["질문"], [], profile=profile(q) or None)
        except Exception as e:                      # API 오류도 기록하고 계속
            res = {"answer": f"[오류] {e}", "clarify": None}
        ok, why = grade(q, res)
        by[q["종류"]][0] += 1; by[q["종류"]][1] += ok
        out.write(json.dumps({"ID": q["ID"], "종류": q["종류"], "질문": q["질문"], "기대": q["기대 동작"],
                              "정답": q["정답"], "결과": "O" if ok else "X", "사유": why,
                              "답변": res.get("answer", "")}, ensure_ascii=False) + "\n")
        if i % 20 == 0:
            print(f"    {i}/{len(qs)}  (누적 입력 토큰 {bot.llm.usage['prompt_tokens']:,})", flush=True)
    out.close()
    return by


def pct(a, b):
    return f"{a / b:.0%}" if b else "-"


def write_summary(summary: dict):
    lines = ["| 단계 | 검색 1위 | 검색 상위6 | 답변 정답률(엄격) | 불확실 | 오답 | 답변 문항 |", "|---|---|---|---|---|---|---|"]
    for s in sorted(summary, key=int):
        r = summary[s]
        R, S = r.get("retrieval", {}), r.get("strict")
        name = STAGES.get(int(s), {}).get("name", r["name"])
        cells = ([pct(S["ok"], S["n"]), pct(S["unsure"], S["n"]), pct(S["bad"], S["n"]), str(S["n"])]
                 if S else ["-", "-", "-", "-"])
        lines.append(f"| {name} | {pct(R.get('top1', 0), R.get('n', 0))} | {pct(R.get('top6', 0), R.get('n', 0))} | "
                     + " | ".join(cells) + " |")
    lines += ["", "- 검색: 정답 문서가 1위 / 상위 6개(LLM에 넘기는 범위) 안에 있는 비율 (정답 문서가 지정된 답변형 문항)",
              "- 답변(엄격): 핵심 키워드가 있고 첫 말풍선에 '확인이 안 돼요' 같은 단서가 없는 답만 정답",
              "- 답변 문항 수가 다른 단계는 그 뒤에 평가 질문이 추가된 것 (⑨부터 강의시간표 16문항 추가)",
              "- 답변은 비용 때문에 일부 단계만 측정"]
    (OUT / "summary.md").write_text("\n".join(lines) + "\n", "utf-8")
    print("\n" + "\n".join(lines))


def regrade(stage: int, qs: list) -> dict:
    """저장된 답변을 다시 채점 (LLM 호출 없음) → {종류: [n, 정답, 불확실, 오답]}"""
    qmap = {q["ID"]: q for q in qs}
    path = OUT / f"stage{stage}_answers.jsonl"
    rows = [json.loads(l) for l in open(path, encoding="utf-8")]
    by = defaultdict(lambda: [0, 0, 0, 0])
    for r in rows:
        q = qmap.get(r["ID"])
        if not q:
            continue
        ok, why = grade(q, {"answer": r["답변"], "clarify": "되묻기" if r["사유"] == "되묻기" else None})
        g = strict_grade(q, r["답변"], ok)
        r["판정"] = g
        b = by[q["종류"]]
        b[0] += 1; b[1] += g == "정답"; b[2] += g == "불확실"; b[3] += g == "오답"
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return by


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--stages", default="1,2,3,4,5,6")
    ap.add_argument("--answers", default="1,6", help="답변까지 채점할 단계 (all = 전부, none = 안 함)")
    ap.add_argument("--regrade", action="store_true", help="저장된 답변만 엄격 기준으로 다시 채점 (LLM 호출 없음)")
    a = ap.parse_args(argv)
    if a.regrade:
        qs = load_questions()
        summary = json.loads((OUT / "summary.json").read_text("utf-8"))
        for s in sorted(summary, key=int):
            if not (OUT / f"stage{s}_answers.jsonl").exists():
                continue
            by = regrade(int(s), qs)
            n, ok, unsure, bad = (sum(v[i] for v in by.values()) for i in range(4))
            summary[s]["strict"] = {"n": n, "ok": ok, "unsure": unsure, "bad": bad, "by": dict(by)}
            print(f"\n{summary[s]['name']}: 정답 {pct(ok, n)} / 불확실 {pct(unsure, n)} / 오답 {pct(bad, n)}  ({n}문항)")
            for k, v in by.items():
                print(f"   {k}: 정답 {v[1]}, 불확실 {v[2]}, 오답 {v[3]} / {v[0]}")
        (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), "utf-8")
        write_summary(summary)
        return
    stages = [int(s) for s in a.stages.split(",")]
    ans = stages if a.answers == "all" else [] if a.answers == "none" else [int(s) for s in a.answers.split(",")]
    OUT.mkdir(parents=True, exist_ok=True)
    qs = load_questions()
    summary = json.loads((OUT / "summary.json").read_text("utf-8")) if (OUT / "summary.json").exists() else {}

    for s in stages:
        st = STAGES[s]
        print(f"\n=== {st['name']} ===")
        bot = make_bot(st)
        by, rows = eval_retrieval(bot, qs)
        with open(OUT / f"stage{s}_retrieval.csv", "w", encoding="utf-8-sig", newline="") as f:
            csv.writer(f).writerows([["ID", "종류", "질문", "정답 문서 순위(없으면 빈칸)", "1위 문서"]] + rows)
        n, a1, a6 = (sum(v[i] for v in by.values()) for i in range(3))
        rec = summary.setdefault(str(s), {"name": st["name"]})
        rec["retrieval"] = {"n": n, "top1": a1, "top6": a6, "by": {k: v for k, v in by.items()}}
        print(f"  검색: 1위 {pct(a1, n)}, 상위6 {pct(a6, n)}  ({n}문항)")
        if s in ans:
            print("  답변 채점 중...")
            byA = eval_answers(bot, qs, OUT / f"stage{s}_answers.jsonl")
            N, OK = sum(v[0] for v in byA.values()), sum(v[1] for v in byA.values())
            rec["answers"] = {"n": N, "ok": OK, "by": {k: v for k, v in byA.items()}, "usage": bot.llm.usage}
            print(f"  답변: 정답 {pct(OK, N)} ({OK}/{N})  토큰 {bot.llm.usage}")
        (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), "utf-8")

    rag.extract_slots = _new_extract
    print("\n엄격 기준 재채점:")
    main(["--regrade"])


if __name__ == "__main__":
    main()
