"""
개설강좌(강의시간표) 검색 — 앱 시간표 기능이 쓰는 public/course-catalog/*.json 을 그대로 읽는다.

"자료구조 누가 가르쳐?", "김정환 교수님 수업 뭐 있어?", "이번 학기 이러닝 교양 뭐 있어?" 처럼
과목·교수·영역을 묻는 질문은 공지·요람 검색으로는 답이 없으므로, 여기서 찾은 강좌를
'강의시간표' 자료 한 건으로 만들어 답변 자료 맨 앞에 넣는다.

또 앱에 등록한 '내 시간표'(화면에서 같이 보내 줌)를 자료로 만드는 함수도 여기 둔다.
"""
from __future__ import annotations

import difflib
import json
import os
import re
from collections import defaultdict
from datetime import date
from pathlib import Path

import kku_keywords as kw

HERE = Path(__file__).resolve().parent
CATALOG_DIR = Path(os.environ.get("COURSE_CATALOG_DIR") or HERE.parent / "public" / "course-catalog")

MAX_LINES = 40                    # 자료 한 건에 넣는 최대 줄 수 (프롬프트가 너무 길어지지 않게)

# 과목·교수 이름이 나와도, 수업 자체를 묻는 질문일 때만 시간표를 붙인다
COURSE_INTENT = ["학점", "교수", "누가", "강의실", "어디서", "어디야", "어디에서", "시간", "언제", "몇시", "분반", "요일",
                 "수업", "강의", "과목", "학수번호", "이수구분", "전필", "전선", "열려", "열리", "개설", "들어", "듣",
                 "가르", "담당", "이러닝", "온라인"]
LIST_INTENT = ["뭐있", "무엇이있", "뭐가있", "어떤과목", "어떤수업", "어떤강의", "목록", "추천", "들을만", "들을수있",
               "뭐들", "뭘들", "알려", "종류", "개설", "있어", "있나", "있을까", "뭐야", "뭐예요", "뭐에요", "무엇", "열려", "열리",
               "잇어", "잇나", "머있", "머가있", "머야"]                  # 구어체·오타 ("전선 뭐 잇어", "교양 머 있어")
# 학생들이 흔히 쓰는 학과 줄임말 ('사복'·'유교'처럼 일반 단어와 겹치는 것은 넣지 않음)
DEPT_ALIASES = {"컴공": "컴퓨터공학과", "신방": "신문방송학과", "메카": "메카트로닉스공학과", "경통": "경제통상학과",
                "식영": "식품영양학과"}
REQUIRED_MAJOR = r"전필|전공필수|필수전공|전공.{0,2}필수|필수.{0,2}전공"   # '필수 전공 과목'처럼 순서를 바꿔 물어도
COURSE_NOUNS = ["과목", "수업", "강의", "강좌"]
GUESS_BLOCK = ["졸업", "이수", "들어야", "채워야", "다전공", "전과"]
REQUIREMENT_WORDS = ["졸업", "이수학점", "들어야", "최대", "전과", "조기졸업", "수료", "필수교양", "교양필수", "몇학점"]
ELEARNING_WORDS = ["이러닝", "e러닝", "e-러닝", "온라인", "비대면", "사이버", "인강", "mooc", "f러닝", "b러닝"]
CLASS_WORDS = {                 # 질문 표현 → 시간표의 이수구분 값
    "전필": ["전필", "전공필수", "필수전공"],
    "전선": ["전선", "전공선택"],
    "기초": ["기초교양", "교양기초"],
    "심화": ["심화교양", "교양심화"],
    "소양": ["소양", "ku소양"],
    "교직": ["교직"],
}
LIBERAL = {"기초", "심화", "소양"}
PERSONAL_WORDS = ["내수업", "내시간표", "내강의", "나수업", "오늘수업", "내일수업", "모레수업", "첫수업", "마지막수업",
                  "다음수업", "공강", "수업몇개", "몇학점듣", "듣고있", "수강중", "내가듣", "우리수업", "오늘몇시",
                  "내일몇시", "몇시에끝", "몇시에시작"]
DAYS = "월화수목금토일"


def _c(text: str) -> str:
    return kw._compact(text).lower()


def _time(hhmm: str) -> str:
    return f"{hhmm[:2]}:{hhmm[2:]}" if len(hhmm) == 4 else hhmm


def pretty_schedule(raw: str) -> str:
    """'월1030-1200(상허연구동 409)' → '월 10:30~12:00 (상허연구동 409)'"""
    def one(m):
        room = f" ({m.group(4)})" if m.group(4) else ""
        return f"{m.group(1)} {_time(m.group(2))}~{_time(m.group(3))}{room}"
    return re.sub(r"([월화수목금토일])(\d{4})-(\d{4})(?:\(([^)]*)\))?", one, raw or "") or "시간 미정"


def current_semester(today: date | None = None) -> str:
    today = today or date.today()
    if today.month >= 9:
        return f"{today.year}-2"
    if today.month >= 3:
        return f"{today.year}-1"
    return f"{today.year - 1}-2"


class CourseCatalog:
    def __init__(self, folder: Path = CATALOG_DIR):
        self.folder = Path(folder)
        self.semesters = sorted(p.stem for p in self.folder.glob("20*-[12].json")) if self.folder.exists() else []
        self._cache: dict[str, list] = {}
        self._all_depts: list | None = None

    @property
    def available(self) -> bool:
        return bool(self.semesters)

    def courses(self, semester: str) -> list:
        if semester not in self._cache:
            data = json.loads((self.folder / f"{semester}.json").read_text("utf-8"))
            for c in data["courses"]:
                c["_name"] = _c(c["name"])
            self._cache[semester] = data["courses"]
        return self._cache[semester]

    def pick_semester(self, question: str, today: date | None = None) -> str:
        cur = current_semester(today)
        if cur not in self.semesters:
            cur = self.semesters[-1]
        q = _c(question)
        year, term = int(cur[:4]), int(cur[-1])
        m = re.search(r"(20\d{2})(?:학년도|년)?(?:-|\.|도)?([12])학기", q) or re.search(r"(20\d{2})-([12])", q)
        if m:
            year, term = int(m.group(1)), int(m.group(2))
        else:
            m = re.search(r"([12])학기", q)
            if "지난학기" in q or "저번학기" in q:
                year, term = (year, 1) if term == 2 else (year - 1, 2)
            elif "다음학기" in q:
                year, term = (year, 2) if term == 1 else (year + 1, 1)
            elif m:
                term = int(m.group(1))
        key = f"{year}-{term}"
        return key if key in self.semesters else cur

    # ------------------------------------------------------------------
    def lookup(self, question: str, slots: dict | None = None, today: date | None = None) -> dict | None:
        """질문에 맞는 강좌를 찾아 자료(hit) 한 건으로 돌려준다. 해당 없으면 None."""
        if not self.available:
            return None
        slots = slots or {}
        q = _c(question)
        semester = self.pick_semester(question, today)
        rows = self.courses(semester)

        # 교양 '영역' 이름("발표와토론 영역")은 같은 이름의 옛 과목으로 보지 않음
        names = self._match_names(q, rows) if "영역" not in q else set()
        # 오타 허용·지난 학기 검색은 과목을 묻는 질문에서만 (졸업·이수 요건 질문에 엉뚱한 과목이 붙지 않게)
        guess_ok = ("영역" not in q and any(w in q for w in COURSE_INTENT)
                    and not any(w in q for w in GUESS_BLOCK) and not re.search(r"\d{2}학번|20\d{2}년?에?입학", q))
        if not names and guess_ok:
            names = self._fuzzy_names(self._strip_depts(q), sorted({c["_name"] for c in rows}, key=len, reverse=True))
        if not names and guess_ok:
            # 이번 학기에 안 열리는 과목이면 가장 최근에 열린 학기 기준으로 알려줌 ("운영체제 누가 가르쳐?")
            for past in reversed([x for x in self.semesters if x < semester]):
                old = self._match_names(q, self.courses(past))
                if old:
                    picked = [c for c in self.courses(past) if c["_name"] in old]
                    label = "·".join(sorted({c["name"] for c in picked}))
                    hit = self._hit(past, f"{label} 개설 강좌 (가장 최근 개설 학기)", picked, detail=True)
                    y, t = semester.split("-")
                    hit["text"] = (f"(주의: {label}은(는) {y}학년도 {t}학기 강의시간표에는 없음. "
                                   f"아래는 가장 최근에 개설된 학기 기준이며, 이번 학기 담당·시간은 다를 수 있음)\n") + hit["text"]
                    return hit
        profs = self._match_professors(q, rows)
        wants_course = any(w in q for w in COURSE_INTENT)

        if names and (wants_course or len(q) <= len(max(names, key=len)) + 6):
            picked = [c for c in rows if c["_name"] in names]
            if profs:                                           # "김정환 교수님 자료구조" → 그 교수 분반만
                picked = [c for c in picked if c["professor"] in profs] or picked
            label = "·".join(sorted({c["name"] for c in picked}))
            return self._hit(semester, f"{label} 개설 강좌", picked, detail=True)

        if profs and ("교수" in q or "선생" in q or wants_course):
            picked = [c for c in rows if c["professor"] in profs]
            hit = self._hit(semester, f"{'·'.join(sorted(profs))} 교수 담당 강좌", picked, detail=True)
            depts = sorted({c["department"] for c in picked})
            if len(depts) > 1:
                hit["text"] += (f"\n(주의: 같은 이름의 교수가 여러 학과({', '.join(depts)})에 있어 동명이인일 수 있음."
                                " 학생 학과와 같은 학과의 강좌를 먼저 안내)")
            return hit

        required = self._required_query(q, slots)
        if required:
            return required
        return self._list_query(q, rows, semester, slots)

    # ------------------------------------------------------------------
    def required_major(self, department: str, admission_year: int) -> tuple[int, list]:
        """앱 '졸업 진행률'의 전공필수 목록과 같은 기준
        (src/features/schedule/services/requiredMajorCourses.ts):
        입학연도에 가장 가까운 해의 1·2학기 강의시간표에서 그 학과 '전필' 과목을 학수번호별로 하나씩 모음."""
        norm = lambda v: re.sub(r"[\s·()]", "", v).lower()
        dept = re.sub(r"(학과|전공)$", "", norm(department))
        years = sorted({int(s[:4]) for s in self.semesters}, key=lambda y: (abs(y - admission_year), -y))
        for year in years:
            found: dict[str, dict] = {}
            for sem in (s for s in self.semesters if int(s[:4]) == year):
                for c in self.courses(sem):
                    if norm(c["classification"]) != "전필":
                        continue
                    if re.sub(r"(학과|전공)$", "", norm(c["department"])) != dept:
                        continue
                    key = c["subjectCode"].strip() or norm(c["name"])
                    item = found.setdefault(key, {**c, "terms": []})
                    if sem not in item["terms"]:
                        item["terms"].append(sem)
            if found:
                grade = lambda c: int(m.group()) if (m := re.search(r"[1-4]", c["gradeYear"])) else 0
                return year, sorted(found.values(), key=lambda c: (grade(c), c["terms"][0], c["name"]))
        return 0, []

    def _required_query(self, q: str, slots: dict) -> dict | None:
        """'22학번 컴퓨터공학과 전공필수 과목 뭐야?' — 이번 학기 개설이 아니라 입학연도 기준 전공필수 목록"""
        if not re.search(REQUIRED_MAJOR, q) or "몇학점" in q:
            return None
        if not (any(w in q for w in LIST_INTENT) or any(w in q for w in COURSE_NOUNS) or "들어야" in q):
            return None
        if re.search(r"이번학기|지난학기|저번학기|다음학기|[12]학기|열려|열리|개설", q):
            return None                                     # 특정 학기 개설 여부는 일반 목록 검색으로
        dept = next((d for d in sorted({c["department"] for s in self.semesters[-2:] for c in self.courses(s)},
                                       key=len, reverse=True) if self._dept_in(d, q)), None) or slots.get("학과")
        if not dept:
            return None
        year = int(slots["입학연도"]) if str(slots.get("입학연도", "")).isdigit() else int(self.semesters[-1][:4])
        used, picked = self.required_major(dept, year)
        lines = [f"[{dept} 전공필수 과목 — {year}학년도 입학생 기준]",
                 f"기준: {used}학년도 1·2학기 강의시간표에서 {dept} '전필'로 개설된 과목 (앱 시간표 탭 '졸업 진행률'의 전공필수 목록과 같은 기준)."
                 + (f" {year}학년도 시간표가 없어 가장 가까운 {used}학년도로 대신함." if used and used != year else ""),
                 "정확한 이수 요건은 학사요람·학과 사무실 확인이 필요함.",
                 "표기: 학년 · 과목명 (학점, 학수번호) · 개설 학기",
                 "개설 학기는 그 과목이 보통 몇 학기에 열리는지 보여주는 참고 정보 (이미 지났다고 안내할 필요 없음)"]
        if not picked:
            lines.append("해당 학과의 전필 개설 기록이 시간표 자료에 없음")
        for c in picked[:MAX_LINES]:
            g = re.search(r"[1-4]", c["gradeYear"])
            terms = ", ".join(f"{t[:4]}-{t[-1]}학기" for t in c["terms"])
            lines.append(f"- {g.group() + '학년' if g else '학년 미정'} · {c['name']} ({c['credits']}학점, {c['subjectCode']}) · {terms}")
        return {"doc_id": f"catalog:required:{dept}:{year}", "title": f"{dept} 전공필수 과목 ({year}학번 기준, 강의시간표)",
                "url": "", "source": "catalog", "text": "\n".join(lines), "metadata": {}}

    def _strip_depts(self, q: str) -> str:
        """'패션디자인학과'의 '패션디자인'처럼 학과명(옛 이름 포함) 속 과목명은 과목으로 보지 않도록 학과명을 지움"""
        if self._all_depts is None:
            depts = {_c(c["department"]) for sem in self.semesters for c in self.courses(sem) if c["department"]}
            self._all_depts = sorted((d for d in depts if len(d) >= 3), key=len, reverse=True)
        for dept in self._all_depts:
            q = q.replace(dept, " ")
        return q

    def _match_names(self, q: str, rows: list) -> set:
        q = self._strip_depts(q)
        found = set()
        for name in sorted({c["_name"] for c in rows}, key=len, reverse=True):
            if len(name) >= 3 and name in q and not any(name in f for f in found):
                found.add(name)
        return found

    @staticmethod
    def _fuzzy_names(q: str, names: list) -> set:
        """오타 허용: '영미문하의이해' → '영미문화의이해'. 4글자 이상 과목명이 질문의 한 구간과 한두 글자만 다를 때"""
        grams = lambda t: {t[i:i + 2] for i in range(len(t) - 1)}
        qg = grams(q)
        best, best_score = None, 0.0
        for name in names:
            if len(name) < 5:                                 # 짧은 이름은 다른 단어와 헷갈리기 쉬워 제외
                continue
            ng = grams(name)
            if len(ng & qg) < len(ng) / 2:                    # 빠른 거르기: 두 글자 조각이 절반은 겹쳐야
                continue
            for size in (len(name) - 1, len(name), len(name) + 1):
                for i in range(0, max(1, len(q) - size + 1)):
                    score = difflib.SequenceMatcher(None, name, q[i:i + size]).ratio()
                    if score > best_score:
                        best, best_score = name, score
        return {best} if best and best_score >= 0.8 else set()

    def _match_professors(self, q: str, rows: list) -> set:
        profs = set()
        for c in rows:
            for p in re.split(r"[,\s]+", c["professor"]):
                if len(p) >= 2 and _c(p) in q and re.search(re.escape(_c(p)) + r"(교수|선생|쌤)", q):
                    profs.add(p)
        return profs

    @staticmethod
    def _dept_in(dept: str, q: str) -> bool:
        """'컴퓨터공학과' 또는 '컴퓨터공학'처럼 학과명이 질문에 있는지. '교양'처럼 짧은 줄임말은 제외"""
        if not dept or len(dept) < 3:
            return False
        short = _c(re.sub(r"(학과|학부|전공|과)$", "", dept))
        return (_c(dept) in q or (len(short) >= 3 and short in q)
                or any(alias in q for alias, full in DEPT_ALIASES.items() if full == dept))

    def _list_query(self, q: str, rows: list, semester: str, slots: dict) -> dict | None:
        """'이러닝 교양 뭐 있어?', '인간과문화 영역 과목', '컴퓨터공학과 2학년 전필' 같은 목록 질문"""
        if not any(w in q for w in LIST_INTENT):
            return None
        # 입학연도별 이수 요건·학사 제도 질문은 요람·공지가 답 — 이번 학기 개설 목록을 섞지 않음
        if any(w in q for w in REQUIREMENT_WORDS) or re.search(r"\d{2}학번|20\d{2}년?에?입학", q):
            return None
        elearning = any(w in q for w in ELEARNING_WORDS)
        filters, desc = [], []

        if elearning:
            filters.append(lambda c: c["isElearning"])
            desc.append("이러닝")
        classes = {k for k, words in CLASS_WORDS.items() if any(w in q for w in words)}
        if not classes and "교양" in q:
            classes = set(LIBERAL)
        if classes:
            filters.append(lambda c, s=classes: c["classification"] in s)
            desc.append("/".join(sorted(classes)) if classes != LIBERAL else "교양")
        areas = {c["area"] for c in rows if c["area"] and _c(c["area"]) in q}
        if areas:
            filters.append(lambda c, a=areas: c["area"] in a)
            desc.append("·".join(sorted(areas)) + " 영역")
        depts = {c["department"] for c in rows if self._dept_in(c["department"], q)}
        if not depts and slots.get("학과") and re.search(r"우리과|우리학과|내전공|우리전공|내학과|(?<!다)전공(필수|선택)", q):
            mine = _c(slots["학과"])
            depts = {c["department"] for c in rows if _c(c["department"]) == mine}
        if depts:
            filters.append(lambda c, d=depts: c["department"] in d)
            desc.append("·".join(sorted(depts)))
        m = re.search(r"(?<!\d)([1-4])학년(?!도)", q)          # '22학년도'의 '2학년'은 학년이 아님
        if m and depts:
            filters.append(lambda c, g=m.group(1): c["gradeYear"] == g)
            desc.append(f"{m.group(1)}학년")

        # 조건이 하나도 없거나 '교양'만으로는 너무 넓다 → 영역·이러닝·학과 같은 조건이 하나는 있어야 함.
        # 학과 이름만 있으면("경영학과 … 알려줘") 과목·수업을 묻는 말이 있을 때만
        if not filters or (len(filters) == 1 and classes and not areas and not depts and not elearning):
            return None
        if not (elearning or areas or classes or any(w in q for w in COURSE_NOUNS)):
            return None
        picked = [c for c in rows if all(f(c) for f in filters)]
        return self._hit(semester, " ".join(desc) + " 개설 강좌", picked, detail=False)

    # ------------------------------------------------------------------
    def _hit(self, semester: str, label: str, picked: list, detail: bool) -> dict:
        year, term = semester.split("-")
        title = f"{year}학년도 {term}학기 강의시간표 — {label}"
        lines = [f"[{year}학년도 {term}학기 개설 강좌 (학교 강의시간표 자료, 앱 시간표 기능과 같은 데이터)]",
                 "표기: 과목명 | 이수구분 학점 | 개설학과 학년 | 학수번호 / 분반: 교수 · 요일 시간 (강의실)"]
        if not picked:
            lines.append("조건에 맞는 개설 강좌가 없음")
        groups = defaultdict(list)
        for c in picked:
            groups[(c["name"], c["subjectCode"])].append(c)
        shown = 0
        for (name, code), secs in sorted(groups.items(), key=lambda kv: (kv[1][0]["classification"], kv[0][0])):
            if shown >= MAX_LINES:
                break
            c = secs[0]
            grade = f" {c['gradeYear']}학년" if c["gradeYear"] and c["gradeYear"] not in ("0", "9") else ""
            area = f" · 영역 {c['area']}" if c["area"] else ""
            online = " · 이러닝" if c["isElearning"] else ""
            lines.append(f"- {name} | {c['classification']} {c['credits']}학점 | {c['department']}{grade} | {code}{area}{online}")
            shown += 1
            if detail:
                for s in secs[:8]:
                    lines.append(f"    {s['section']}분반: {s['professor'] or '교수 미정'} · {pretty_schedule(s['sourceSchedule'])}")
                    shown += 1
                if len(secs) > 8:
                    lines.append(f"    외 {len(secs) - 8}개 분반")
        if len(groups) and shown >= MAX_LINES:
            lines.append(f"(전체 {len(groups)}개 과목 중 일부만 표시 — 전체 목록은 앱 시간표 탭의 강의 검색에서 확인)")
        return {"doc_id": f"catalog:{semester}:{label}", "title": title, "url": "", "source": "catalog",
                "text": "\n".join(lines), "metadata": {"semester": semester}}


# ----------------------------------------------------------------------
# 내 시간표 (앱에 등록한 수업)
# ----------------------------------------------------------------------
def asks_about_course(question: str) -> bool:
    """이어지는 짧은 질문이 수업에 관한 것인지 ("그거 누가 가르쳐?", "몇 학점이야?")"""
    q = _c(question)
    return any(w in q for w in COURSE_INTENT)


def wants_personal(question: str) -> bool:
    q = _c(question)
    return any(w in q for w in PERSONAL_WORDS)


def personal_hit(timetable: list, today: date | None = None) -> dict:
    today = today or date.today()
    if not timetable:
        return {"doc_id": "timetable:me", "title": "내 시간표 (앱에 등록한 수업)", "url": "", "source": "timetable",
                "text": (f"[학생이 앱 시간표에 등록한 이번 학기 수업] (오늘은 {DAYS[today.weekday()]}요일)\n"
                         "등록된 수업이 없음. 앱 '시간표' 탭에서 이번 학기 수업을 추가하면 오늘 수업·학점 등을 알려줄 수 있음."),
                "metadata": {"empty": True}}
    lines = [f"[학생이 앱 시간표에 등록한 이번 학기 수업] (오늘은 {DAYS[today.weekday()]}요일)"]
    total = 0
    by_day = defaultdict(list)
    for c in timetable:
        total += c.get("credits") or 0
        meetings = c.get("meetings") or []
        when = ", ".join(f"{m['day']} {m['startTime']}~{m['endTime']}" + (f" ({m['room']})" if m.get("room") else "")
                         for m in meetings) or "시간 미정"
        prof = f" · {c['professor']}" if c.get("professor") else ""
        lines.append(f"- {c['name']} ({c.get('credits', 0)}학점{prof}): {when}")
        for m in meetings:
            by_day[m["day"]].append((m["startTime"], m["endTime"], c["name"], m.get("room", "")))
    lines.append(f"총 {len(timetable)}과목 {total:g}학점")
    lines.append("요일별:")
    for d in DAYS:
        if by_day[d]:
            lines.append(f"  {d}: " + " / ".join(f"{s}~{e} {n}" + (f"({r})" if r else "") for s, e, n, r in sorted(by_day[d])))
        elif d in "월화수목금":
            lines.append(f"  {d}: 수업 없음")
    return {"doc_id": "timetable:me", "title": "내 시간표 (앱에 등록한 수업)", "url": "", "source": "timetable",
            "text": "\n".join(lines), "metadata": {}}
