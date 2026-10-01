#!/usr/bin/env python3
"""
졸업요건 정리 엑셀 만들기 (학사요람 2017~2026 기준)

  python make_requirements.py      → 졸업요건_정리.xlsx

시트: 설명 · 졸업학점 · 학점 세부 · 교양 기준 · 필수 교양 · 전공필수 요약 · 전공필수 과목
전공필수 과목은 요람 교육과정표에서 '전필' 행을 뽑은 것이며, 학점 합계를 요람 졸업학점 표의
전공필수 학점과 대조해 상태(일치 / 확인 필요)를 붙인다.
"""
import itertools
import json
import re
from collections import OrderedDict, defaultdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "kku_data"
OUT = ROOT / "졸업요건_정리.xlsx"

docs = [json.loads(l) for l in open(DATA / "extra" / "yoram.jsonl", encoding="utf-8")]
credits = {int(y): OrderedDict(v) for y, v in
           json.load(open(DATA / "files" / "yoram" / "credits_rows.json", encoding="utf-8")).items()}
post_url = {d["metadata"]["year"]: d["url"] for d in docs}
table_page = {d["metadata"]["year"]: d["metadata"]["pages"][0] for d in docs if d["id"].endswith("credits")}

sq = lambda t: re.sub(r"(?<=[가-힣])\s(?=[가-힣])", "", t)
norm = lambda s: re.sub(r"\s+", "", s).replace("･", "·")
clean = lambda n: re.sub(r"^.*?학부(?=.+(학과|전공)$)", "", n)          # '국제비즈니스학부경영학전공' → '경영학전공'
num = lambda x: int(x) if re.fullmatch(r"\d+", x) else None

# ---------------------------------------------------------------- 학점 표
COLS_OLD = ["교양", "전필(학부공통)", "전필(학과)", "전선", "다전공", "졸업"]           # 2017~2020
COLS_MID = ["교양", "전필", "전선", "전공 계", "다전공", "졸업"]                       # 2021~2024
COLS_NEW = ["교양", "전필", "전선", "전공 계", "다전공", "부전공", "졸업"]              # 2025~2026


def split_row(year, vals):
    cols = COLS_OLD if year <= 2020 else COLS_MID if year <= 2024 else COLS_NEW
    out = {c: "" for c in COLS_NEW + ["전필(학부공통)", "전필(학과)"]}
    if 2021 <= year and len(vals) == len(cols) - 1 and vals[1] == vals[2]:
        vals = [vals[0], "0"] + list(vals[1:])          # '식품학과 35 66 66 40 132' → 전필 칸이 빈 행 = 전필 0
    if len(vals) == len(cols):
        out.update(dict(zip(cols, vals)))
        ok = True
    else:                                   # 원문 표에 빈칸이 있어 열이 줄어든 행
        out["교양"], out["졸업"] = vals[0], vals[-1]
        ok = False
    return out, ok


def req_major_credits(year, vals):
    """요람 표의 전공필수 학점 → (전체, 학부공통 몫 또는 None). 2017~2020은 학부공통과 학과가 따로 적혀 있음"""
    row, ok = split_row(year, vals)
    if not ok:
        return None, None
    if year <= 2020:
        a, b = num(row["전필(학부공통)"]) or 0, num(row["전필(학과)"]) or 0
        return a + b, a
    return (num(row["전필"]) if row["전필"] not in ("-", "") else 0), None


# ---------------------------------------------------------------- 전필 과목 추출
ROW = re.compile(r"(\d-[\d,]+|\d-\d)?\s*(전필|전선)\s*([A-Z]{2}\s?[A-Z]{2}\s?\d{5})\s*([^\s(][^()\n]*?)\s*(\d)\s*\((\d+)\)")
NOTE = re.compile(r"^※.*(필수|전필)")


def extract(text):
    t = sq(text)
    seen, req, notes = set(), [], []
    for line in t.split("\n"):
        for m in ROW.finditer(line):
            when, kind, code, name, cr, _ = m.groups()
            code = code.replace(" ", "")
            if kind == "전필" and code not in seen:
                seen.add(code)
                req.append(dict(when=(when or "").strip(), code=code, name=name.strip(), credit=int(cr)))
        if NOTE.match(line.strip()) and len(line) < 300:
            notes.append(line.strip())
    return req, list(dict.fromkeys(notes))


def subset_matching(groups, target):
    """학수번호 앞자리 묶음 중 학점 합이 target과 같은 조합 (작은 조합부터)"""
    keys = list(groups)
    for k in range(1, len(keys) + 1):
        for combo in itertools.combinations(keys, k):
            if sum(c["credit"] for g in combo for c in groups[g]) == target:
                return set(combo)
    return None


credit_sum = lambda cs: sum(c["credit"] for c in cs)
major_rows, summary = [], []
for year in range(2017, 2027):
    table = {norm(clean(n)): (n, v) for n, v in credits.get(year, {}).items()}
    ydocs = sorted([d for d in docs if d["metadata"]["year"] == year and not d["id"].endswith("credits")
                    and "-row-" not in d["id"]],
                   key=lambda d: d["metadata"]["pages"][0])
    leftovers = []                                     # 다른 학과 문서에 섞여 있던 과목 묶음
    covered = set()
    parent = None                                      # 직전에 나온 '○○학부' 문서 = 학부 공통 과목
    college = []                                       # 직전에 나온 '대학공통과목' 전필 = 단과대학 공통
    for d in ydocs:
        dept = d["metadata"]["dept"]
        key = norm(dept)
        if key not in table and "대학공통" in sq(d["text"]) and extract(d["text"])[0]:
            college = extract(d["text"])[0]
            college_src = d
        if dept.endswith("학부") and key not in table:
            parent = d
            continue
        if key not in table:
            continue
        req, notes = extract(d["text"])
        common, _ = extract(parent["text"]) if parent else ([], [])
        common = [c for c in common if c["code"] not in {x["code"] for x in college}]
        total, common_part = req_major_credits(year, table[key][1])
        groups = defaultdict(list)
        for c in req:
            groups[c["code"][:4]].append(c)
        extra = []                                     # 학부 공통으로 함께 들어야 하는 과목
        status = "일치"
        if total is None:
            status = "확인 필요 (요람 표 빈칸)"
        elif credit_sum(req) == total:
            pass
        elif common and credit_sum(req) + credit_sum(common) == total:
            extra, status = common, "일치 (학부 공통 포함)"
        elif college and credit_sum(req) + credit_sum(college) == total:
            extra, status = college, "일치 (단과대학 공통 포함)"
        elif college and common and credit_sum(req) + credit_sum(common) + credit_sum(college) == total:
            extra, status = common + college, "일치 (학부·단과대학 공통 포함)"
        elif common_part is not None and credit_sum(req) == total - common_part:
            extra = common if credit_sum(common) == common_part else []
            status = "일치 (학부 공통 포함)" if extra else "일치 (학과 몫만, 학부 공통 과목은 요람 확인)"
        else:
            keep = subset_matching(groups, total) if req else None
            if keep and len(keep) < len(groups):
                for g in set(groups) - keep:
                    leftovers.append((dept, groups[g]))
                req = [c for g in keep for c in groups[g]]
                status = "일치 (섞인 다른 학과 과목 분리)"
            elif any("선택" in n for n in notes) and credit_sum(req) < total:
                status = "선택 필수 규칙 있음 (요람 주석 참고)"
            else:
                status = "확인 필요"
        covered.add(key)
        for c in req:
            major_rows.append([year, dept, c["when"], c["name"], c["code"], c["credit"], status,
                               d["metadata"]["pages"][0]])
        for c in extra:
            src = college_src if college and c in college else parent
            label = "단과대학 공통" if src is not parent else f"{parent['metadata']['dept']} 공통"
            major_rows.append([year, dept, c["when"], f"{c['name']} ({label})", c["code"],
                               c["credit"], status, src["metadata"]["pages"][0]])
        summary.append([year, dept, len(req) + len(extra), credit_sum(req) + credit_sum(extra),
                        total if total is not None else "", status, " / ".join(notes)[:500]])
    # 학과 문서가 없는(그림 페이지) 학과에 섞여 있던 과목을 학점 합계로 배정
    for key, (name, vals) in table.items():
        if key in covered:
            continue
        target, _ = req_major_credits(year, vals)
        hit = [(src, g) for src, g in leftovers if target and sum(c["credit"] for c in g) == target]
        if len(hit) == 1:
            src, g = hit[0]
            status = f"추정 ({src} 문서에 섞여 있던 과목을 학점 합계로 배정)"
            for c in g:
                major_rows.append([year, clean(name), c["when"], c["name"], c["code"], c["credit"], status, ""])
            summary.append([year, clean(name), len(g), sum(c["credit"] for c in g), target, status, ""])
        else:
            summary.append([year, clean(name), 0, 0, target if target is not None else "",
                            "자료 없음 (요람 해당 쪽이 그림)" if target else "전필 없음", ""])

# ---------------------------------------------------------------- 엑셀
wb = Workbook()
HEAD = PatternFill("solid", fgColor="1F4E78")
WARN = PatternFill("solid", fgColor="FCE4D6")
GUESS = PatternFill("solid", fgColor="FFF2CC")


def sheet(title, header, rows, widths, status_col=None):
    ws = wb.create_sheet(title)
    ws.append(header)
    for r in rows:
        ws.append(r)
    for c in ws[1]:
        c.font = Font(name="Arial", bold=True, color="FFFFFF")
        c.fill = HEAD
        c.alignment = Alignment(vertical="center", wrap_text=True)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = Font(name="Arial", size=10)
            c.alignment = Alignment(vertical="top", wrap_text=True)
        if status_col is not None:
            s = str(row[status_col].value or "")
            fill = WARN if s.startswith(("확인", "자료 없음")) else \
                GUESS if s.startswith(("추정", "선택", "일치 (학과 몫만")) else None
            if fill:
                for c in row:
                    c.fill = fill
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions
    return ws


# 졸업학점 (학과 × 연도)
years = list(range(2017, 2027))
grad = OrderedDict()
for y in years:
    for n, v in credits.get(y, {}).items():
        if num(v[-1]):
            grad.setdefault(clean(n), {})[y] = int(v[-1])
sheet("졸업학점", ["학과(전공)"] + [str(y) for y in years],
      [[k] + [grad[k].get(y, "") for y in years] for k in grad], [26] + [8] * len(years))

# 학점 세부
detail = []
for y in years:
    for n, v in credits.get(y, {}).items():
        row, ok = split_row(y, v)
        detail.append([y, clean(n), row["교양"], row["전필(학부공통)"], row["전필(학과)"] or row["전필"],
                       row["전선"], row["전공 계"], row["다전공"], row["부전공"], row["졸업"],
                       " ".join(v), "" if ok else "원문 표에 빈칸이 있어 열 구분 불가 — 원문 행 참고",
                       table_page.get(y, "")])
sheet("학점 세부", ["입학연도", "학과(전공)", "교양", "전필(학부공통, ~2020)", "전공필수", "전공선택", "전공 계",
                  "다전공", "부전공", "졸업", "요람 원문 행", "비고", "요람 PDF 쪽"],
      detail, [9, 24, 7, 11, 9, 9, 8, 8, 8, 7, 30, 30, 9])

# 교양 기준 / 필수 교양 (문서 정리본과 동일)
gy = [["교양 합계", "38~41", "36", "35", "35", "31"],
      ["KU인성", "3", "4", "3", "KU소양에 포함", "KU소양에 포함"],
      ["기초교양", "15", "18", "18", "18", "14"],
      ["  글쓰기·발표(의사소통)", "3", "6", "6", "3 + 3", "2 + 2"],
      ["  외국어(국제화)", "6", "6", "6", "6", "4"],
      ["  인문(사고·기초)", "4", "3", "3", "3", "2"],
      ["  과학(사고·기초)", "2", "3", "3", "3", "2"],
      ["  AI/데이터", "-", "-", "-", "-", "2"],
      ["심화교양", "8 (5개 영역 중 4개)", "8 (5개 중 4개)", "8 (5개 중 4개)", "8 (6개 중 4개, 영역당 1학점↑)", "8 (6개 중 4개)"],
      ["KU소양(실무소양)", "6 (IT활용 2 + 직업과창의 2)", "6 (실무 4 + 실기 2)", "6 (실무 4 + 실기 2)", "9 (인성 3 + 실무 4 + 실기 2)", "9 (인성 3 + 실무 4 + 실기 2)"],
      ["계열핵심", "6~9", "-", "-", "-", "-"],
      ["예외", "", "간호: KU소양 면제", "간호: KU소양 면제", "간호: 인성 3만 / 의예: 5", "간호: 인성 3만 / 의예: 5"]]
sheet("교양 기준", ["영역 (최저 학점)", "2017", "2018~2019", "2020~2021", "2022~2024", "2025~2026"], gy,
      [24, 22, 18, 18, 26, 26])

gp = [["성신의대학생활지도1·2", "BKSA58101·BKSA58102", "각 1", "각 1", "-", "-", "-"],
      ["성신의대학생활지도", "BZZA62440", "-", "-", "1", "1", "1"],
      ["글쓰기", "BKSA49491", "3", "3", "3", "-", "-"],
      ["글쓰기 영역 택1 (창의·실용·성찰·미디어글쓰기)", "BKSA64611/64612/64613/64623", "-", "-", "-", "3", "2"],
      ["발표와토론", "BKSA59471", "-", "3", "3", "-", "-"],
      ["발표와토론 영역 택1 (비판적사고와토론·공감적소통과발표·열린사고와실용적말하기·협력적사고와토의)",
       "BKSA39798/64608/64609/64610", "-", "-", "-", "3", "2"],
      ["KUGEP1", "BKSA53699", "3", "3", "3", "3", "2"],
      ["컴퓨팅적사고", "BKSA56558", "2", "-", "-", "-", "-"],
      ["취업전략수립및커리어개발", "BKSA58116", "2", "-", "-", "-", "-"],
      ["취업전략수립및역량개발1", "BKSA59472", "-", "2", "2", "2", "2"],
      ["대학기초생물학 + 대학기초화학", "BKSA59512 + BKSA58224", "-", "각 3 (바이오의약·바이오생명공학)",
       "각 3 (바이오의약 등)", "각 3 (바이오의약학과·의예과)", "각 2 (의예과만)"],
      ["AI/데이터 영역 택1 (컴퓨팅적사고·데이터리터러시·AI리터러시·빅데이터의기초·프로그래밍의기초(2026))",
       "BKSA56558/67912/67913/67914/67915", "-", "-", "-", "-", "2"]]
sheet("필수 교양", ["과목", "학수번호", "2017", "2018~2019", "2020~2021", "2022~2024", "2025~2026"], gp,
      [48, 26, 8, 22, 18, 22, 16])

sheet("전공필수 요약", ["입학연도", "학과(전공)", "추출 과목 수", "추출 학점 합", "요람 표 전공필수 학점", "상태", "요람 주석(※ 필수 관련)"],
      summary, [9, 24, 9, 9, 12, 30, 80], status_col=5)
sheet("전공필수 과목", ["입학연도", "학과(전공)", "학년-학기", "과목명", "학수번호", "학점", "상태", "요람 PDF 쪽"],
      major_rows, [9, 24, 9, 28, 12, 6, 30, 9], status_col=6)

# 설명
ws = wb["Sheet"]
ws.title = "설명"
guide = [["건국대 글로컬캠퍼스 졸업요건 정리 (학사요람 2017~2026학년도)"], [],
         ["시트", "내용"],
         ["졸업학점", "학과(전공)별 졸업이수학점, 입학연도별. 빈칸 = 그해 요람 표에 없는 학과"],
         ["학점 세부", "교양·전공필수·전공선택·다전공·부전공 학점. 2017~2020은 전공필수가 학부공통 + 학과로 나뉨"],
         ["교양 기준", "교양 영역별 최저 학점 (입학연도 구간별)"],
         ["필수 교양", "반드시 들어야 하는 교양 과목명·학수번호·학점"],
         ["전공필수 요약", "학과×연도별로 뽑은 전공필수 과목 수·학점 합과, 요람 표의 전공필수 학점 대조 결과"],
         ["전공필수 과목", "요람 교육과정표에서 '전필'로 표시된 과목 목록"],
         [],
         ["상태", "의미"],
         ["일치", "뽑은 전필 과목 학점 합 = 요람 표의 전공필수 학점 (신뢰도 높음)"],
         ["일치 (섞인 다른 학과 과목 분리)", "학과 문서에 다른 학과 과목이 섞여 있어 학수번호 앞자리로 분리 후 일치"],
         ["추정 (노란색)", "학과 제목 쪽이 그림이라 다른 학과 문서에 섞여 있던 과목을 학점 합계로 배정 — 원문 확인 권장"],
         ["확인 필요 (주황색)", "학점 합이 맞지 않음. '선택 필수'(예: 전선 7과목 중 4과목 → 전필 인정)처럼 주석에 규칙이 있거나 추출 누락"],
         ["자료 없음 (주황색)", "요람 해당 쪽이 그림이라 과목명을 뽑을 수 없음 — PDF 원문 확인 필요"],
         [],
         ["출처", "각 연도 학사요람 PDF (학교 홈페이지 정보광장 > 요람 게시판). 졸업학점 표 쪽: "
          + ", ".join(f"{y} p.{table_page[y]}" for y in sorted(table_page))],
         ["주의", "2017~2020 요람은 서울·글로컬 통합본에서 글로컬 구간만 사용. 최종 확인은 학과 사무실·학사지원팀(043-840-3253)"]]
for r in guide:
    ws.append(r)
ws["A1"].font = Font(name="Arial", bold=True, size=14)
for r in (3, 11):
    for c in ws[r]:
        c.font = Font(name="Arial", bold=True)
for row in ws.iter_rows(min_row=4):
    for c in row:
        if c.row not in (11,):
            c.font = Font(name="Arial", size=10)
        c.alignment = Alignment(wrap_text=True, vertical="top")
ws.column_dimensions["A"].width = 34
ws.column_dimensions["B"].width = 110

wb.save(OUT)
from collections import Counter
st = Counter(s[5].split(" (")[0] for s in summary)
print(f"저장: {OUT}")
print(f"전공필수 과목 {len(major_rows)}행, 학과×연도 {len(summary)}개 → {dict(st)}")
