#!/usr/bin/env python3
"""
평가 질문 자동 검증 — 정답 키워드가 정답 문서 원문에 실제로 있는지 대조

  python eval/verify_eval.py

결과는 eval_questions.xlsx의 '자동검증' 열에 기록하고, 사람이 볼 문항(검증 실패 + 무작위 표본)을
'검수' 칸에 '검수 대상'으로 표시한다. 이미 사람이 고른 검수 값은 건드리지 않는다.
"""
import json
import random
import re
from pathlib import Path

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "eval" / "eval_questions.xlsx"
SAMPLE = 15

texts = {}
for f in [ROOT / "kku_data" / "documents.jsonl", *sorted((ROOT / "kku_data" / "extra").glob("*.jsonl"))]:
    for line in open(f, encoding="utf-8"):
        d = json.loads(line)
        texts[d["id"]] = d["text"]
for f in (ROOT / "manual").glob("*.md"):
    if not f.name.startswith("_"):
        texts[f"manual-{f.stem}"] = f.read_text("utf-8")

squash = lambda s: re.sub(r"\s+", "", s)


def check(kw: str, gold: str):
    """모든 ';' 조건이 정답 문서들 중 하나에 있으면 통과. '|'는 또는."""
    docs = [texts.get(g) for g in gold.split(";")]
    if any(d is None for d in docs):
        return "실패: 정답 문서 없음 " + ",".join(g for g, d in zip(gold.split(";"), docs) if d is None)
    body = squash(" ".join(docs))
    missing = [term for term in kw.split(";") if not any(squash(alt) in body for alt in term.split("|"))]
    return "통과" if not missing else "실패: 원문에 없음 → " + ", ".join(missing)


def dates_in(s: str) -> set:
    """'8.18', '8. 18', '08. 18.', '2026-10-19', '10월 19일' → {(8,18), ...}"""
    out = set()
    for m in re.finditer(r"(?<![\d:])(\d{1,2})\s*\.\s*(\d{1,2})(?![\d:])", s):       # 8.18 / 8. 18.
        out.add((int(m.group(1)), int(m.group(2))))
    for m in re.finditer(r"(?<![\d:])(\d{1,2})/(\d{1,2})(?![\d:])", s):              # 9/30 (공백 없는 경우만)
        out.add((int(m.group(1)), int(m.group(2))))
    for m in re.finditer(r"20\d{2}-(\d{2})-(\d{2})", s):
        out.add((int(m.group(1)), int(m.group(2))))
    for m in re.finditer(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일", s):
        out.add((int(m.group(1)), int(m.group(2))))
    return {d for d in out if 1 <= d[0] <= 12 and 1 <= d[1] <= 31}


def check_dates(answer: str, gold: str):
    """정답 요약에 적힌 날짜(월.일)가 원문에 모두 있는지 — 숫자 키워드보다 엄격한 검사"""
    want = dates_in(answer)
    if not want:
        return None
    have = set()
    for g in gold.split(";"):
        have |= dates_in(texts.get(g, ""))
        if g.startswith("schedule-"):   # 학사일정은 연도 문서가 '2026-10-19' 형식
            have |= dates_in(texts.get(g, ""))
    miss = sorted(want - have)
    return None if not miss else "실패: 날짜가 원문과 다름 → " + ", ".join(f"{a}.{b}" for a, b in miss)


wb = openpyxl.load_workbook(XLSX)
ws = wb["평가질문"]
head = [c.value for c in ws[1]]
if "자동검증" not in head:
    ws.cell(row=1, column=len(head) + 1, value="자동검증")
    hc = ws.cell(row=1, column=len(head) + 1)
    hc.font = Font(name="Arial", bold=True, color="FFFFFF")
    hc.fill = PatternFill("solid", fgColor="1F4E78")
    ws.column_dimensions[openpyxl.utils.get_column_letter(len(head) + 1)].width = 36
    head.append("자동검증")
col = {h: i for i, h in enumerate(head)}

results, passed = [], []
for r in range(2, ws.max_row + 1):
    get = lambda h: ws.cell(row=r, column=col[h] + 1).value or ""
    if get("기대 동작") != "답변":
        res = "해당 없음 (되묻기/모름 문항)"
    else:
        res = check(str(get("채점 키워드")), str(get("정답 문서 ID")))
        if res == "통과":
            res = check_dates(str(get("정답")), str(get("정답 문서 ID"))) or "통과"
    c = ws.cell(row=r, column=col["자동검증"] + 1, value=res)
    c.font = Font(name="Arial", size=10, color="C00000" if res.startswith("실패") else "000000")
    c.alignment = Alignment(wrap_text=True, vertical="top")
    results.append((r, get("ID"), get("질문"), res))
    if res == "통과":
        passed.append(r)

random.seed(1)
sample = set(random.sample(passed, min(SAMPLE, len(passed))))
todo = 0
for r, qid, q, res in results:
    cell = ws.cell(row=r, column=col["검수"] + 1)
    if cell.value == "검수 대상":          # 이전 실행의 표시는 지우고 다시 고름 (사람이 고른 값은 유지)
        cell.value = None
    if cell.value in (None, ""):
        if res.startswith("실패") or r in sample:
            cell.value = "검수 대상"
            todo += 1
try:
    wb.save(XLSX)
    saved = True
except PermissionError:
    saved = False

fails = [x for x in results if x[3].startswith("실패")]
print(f"답변 문항 {sum(1 for x in results if not x[3].startswith('해당'))}개 중 통과 {len(passed)}, 실패 {len(fails)}")
for _, qid, q, res in fails:
    print(f"  {qid} {q} → {res}")
print(f"검수 대상 표시: {todo}개 (실패 {len(fails)} + 무작위 표본 {len(sample)})")
if not saved:
    print("※ 엑셀에서 eval_questions.xlsx가 열려 있어 저장하지 못했습니다. 파일을 닫고 다시 실행하세요.")
