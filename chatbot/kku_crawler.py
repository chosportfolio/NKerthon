#!/usr/bin/env python3
"""
건국대학교 글로컬캠퍼스(www.kku.ac.kr) 홈페이지 크롤러 — 챗봇(RAG)용 데이터 수집

수집 대상
  1) 메뉴 안내 페이지(일반 콘텐츠) + 탭/하위탭 + 페이지에 박힌 PDF(장학안내 등)
  2) 게시판(학사·장학·일반공지, 투데이뉴스, 자료실 등)
     → 내부 목록 API(BBSViewList2.do)가 본문 HTML까지 반환하므로 상세 페이지를 열지 않음
  3) 학사일정(ScheduleListData.do, 연도별)
  4) (선택 --attachments) 게시글 첨부파일 다운로드 + 텍스트 추출(pdf / hwpx / hwp / docx)

출력 (--out 폴더)
  documents.jsonl   RAG 인덱싱용 통합 문서. 한 줄 = {id, source, title, url, text, metadata}
  chunks.jsonl      키워드 검색용 청크 (topics/keywords 태깅, kku_keywords.py로 검색)
  pages.jsonl       안내 페이지 원자료
  posts.jsonl       게시글 원자료
  schedule.jsonl    학사일정 원자료
  files/            첨부/페이지 PDF 원본
  summary.json      수집 통계

사용 예
  pip install requests beautifulsoup4 lxml pypdf
  python kku_crawler.py --out kku_data                       # 전체 수집
  python kku_crawler.py --only-menus 1740,1610 --max-posts-per-board 5   # 빠른 시험
  python kku_crawler.py --since 2026-09-01 --skip-pages      # 최근 게시글만 갱신
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import shutil
import subprocess
import sys
import time
import zipfile
from collections import OrderedDict, deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlencode, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Comment, NavigableString, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import kku_keywords

log = logging.getLogger("kku")

# ---------------------------------------------------------------------------
# 사이트 상수 (2026-10 기준 구조)
# ---------------------------------------------------------------------------
DEFAULT_BASE = "https://www.kku.ac.kr"
PAGE_PATH = "/cms/FR_CON/index.do"
VIEW_PATH = "/cms/FR_CON/BoardView.do"
LIST_API = "/ajax/FR_SVC/BBSViewList2.do"
SUBTAB_API = "/ajax/FR_SVC/selectSubTabList.do"
SCHEDULE_API = "/ajax/FR_SCH_SVC/ScheduleListData.do"
FILE_DOWN = "/ajaxFile/FR_SVC/FileDown.do"
DISCOVERY_SEEDS = ("/index.do", "/siteMap.do")
TITLE_SUFFIX_RE = re.compile(r"\s*-\s*건국대학교 글로컬캠퍼스\s*$")
LINK_CONT_TYPES = {"C0203", "C0205"}          # 외부 링크형 탭
DEFAULT_SKIP_MENUS = {2320}                     # 로그인
KNOWN_AJAX = {
    LIST_API, SUBTAB_API, SCHEDULE_API,
    "/ajax/FR_SCH_SVC/ScheduleData.do", "/ajax/FR_SVC/BBSPwdCheck.do",
    "/ajax/FR_SVC/setCategory.do", "/ajax/FR_SVC/BBSgetRepy.do",
    "/ajaxSearch/FR_SVC/getPopularApiResultAjax.do", "/ajax/FR_PRO_SVC/PdfView.do",
}
GENERIC_ALTS = {"logo", "line", "image", "img", "사진", "이미지", "등록 된 이미지가 없습니다."}


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
class Client:
    """요청 간 최소 간격(delay)을 지키는 얇은 requests 래퍼."""

    def __init__(self, base: str, delay: float, user_agent: str,
                 session: Optional[requests.Session] = None, timeout: float = 40):
        self.base = base.rstrip("/")
        self.host = urlparse(self.base).netloc
        self.delay = delay
        self.timeout = timeout
        self.n_requests = 0
        self._last = 0.0
        if session is None:
            session = requests.Session()
            retry = Retry(total=4, backoff_factor=2, status_forcelist=(429, 500, 502, 503, 504),
                          allowed_methods=frozenset({"GET", "POST"}))
            session.mount("https://", HTTPAdapter(max_retries=retry))
            session.mount("http://", HTTPAdapter(max_retries=retry))
        session.headers.update({"User-Agent": user_agent,
                                "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5"})
        self.s = session

    def abs(self, path_or_url: str) -> str:
        return urljoin(self.base + "/", path_or_url)

    def _throttle(self):
        wait = self.delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()
        self.n_requests += 1

    def get_text(self, path: str, params: Optional[dict] = None) -> str:
        self._throttle()
        r = self.s.get(self.abs(path), params=params, timeout=self.timeout)
        r.raise_for_status()
        if not r.encoding or r.encoding.lower() == "iso-8859-1":
            r.encoding = "utf-8"
        return r.text

    def post_json(self, path: str, data: dict):
        self._throttle()
        r = self.s.post(self.abs(path), data=data, timeout=self.timeout,
                        headers={"X-Requested-With": "XMLHttpRequest",
                                 "Referer": self.base + PAGE_PATH})
        r.raise_for_status()
        return r.json()

    def download(self, path: str, dest: Path, params: Optional[dict] = None,
                 max_bytes: int = 30 * 2**20) -> Optional[Path]:
        self._throttle()
        with self.s.get(self.abs(path), params=params, timeout=self.timeout, stream=True) as r:
            r.raise_for_status()
            dest.parent.mkdir(parents=True, exist_ok=True)
            size = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(64 * 1024):
                    size += len(chunk)
                    if size > max_bytes:
                        f.close()
                        dest.unlink(missing_ok=True)
                        log.warning("  파일이 너무 커서 건너뜀(>%d MB): %s", max_bytes // 2**20, dest.name)
                        return None
                    f.write(chunk)
        return dest


# ---------------------------------------------------------------------------
# HTML → 텍스트 (표는 rowspan/colspan을 펼쳐 마크다운으로)
# ---------------------------------------------------------------------------
_BLOCK = {"p", "div", "section", "article", "header", "footer", "main", "aside", "nav",
          "ul", "ol", "dl", "dt", "dd", "blockquote", "pre", "form", "fieldset",
          "figure", "figcaption", "address", "center", "hr"}
_SKIP = {"script", "style", "noscript", "iframe", "button", "select", "option",
         "input", "textarea", "svg", "canvas", "legend", "colgroup", "col"}
_WS = re.compile(r"\s+")


def _img_text(img: Tag) -> str:
    alt = (img.get("alt") or "").strip()
    if len(alt) < 8 or alt.lower() in GENERIC_ALTS:
        return ""
    return f" [이미지: {alt}] "


def _render(node: Tag, out: list, base: str):
    for ch in node.children:
        if isinstance(ch, Comment):
            continue
        if isinstance(ch, NavigableString):
            out.append(_WS.sub(" ", str(ch)))
            continue
        if not isinstance(ch, Tag):
            continue
        name = ch.name
        if name in _SKIP:
            continue
        if name == "br":
            out.append("\n")
        elif name == "img":
            out.append(_img_text(ch))
        elif name == "table":
            out.append("\n" + _table(ch, base) + "\n")
        elif name == "li":
            out.append("\n- ")
            _render(ch, out, base)
            out.append("\n")
        elif re.fullmatch(r"h[1-6]", name):
            inner = _inline_text(ch, base)
            if inner:
                out.append("\n\n" + ("## " if int(name[1]) <= 3 else "### ") + inner + "\n")
        elif name == "a":
            start = len(out)
            _render(ch, out, base)
            href = (ch.get("href") or "").strip()
            if href.startswith(("http://", "https://")):
                shown = "".join(out[start:])
                if href not in shown:
                    out.append(f" ({href})")
        elif name == "caption":
            cap = _inline_text(ch, base)
            if cap:
                out.append(f"\n[표] {cap}\n")
        elif name in _BLOCK:
            out.append("\n")
            _render(ch, out, base)
            out.append("\n")
        else:
            _render(ch, out, base)


def _tidy(text: str) -> str:
    text = text.replace("\xa0", " ").replace("​", "")
    lines = [re.sub(r"[ \t\f\v]+", " ", ln).strip() for ln in text.split("\n")]
    text = "\n".join(ln for ln in lines if ln not in ("-", "/"))
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _inline_text(node: Tag, base: str) -> str:
    out: list = []
    _render(node, out, base)
    return re.sub(r"\s*\n\s*", " / ", _tidy("".join(out))).strip(" /")


def _rows_in_order(table: Tag) -> list:
    def own(trs):
        return [tr for tr in trs if tr.find_parent("table") is table]
    head, body, foot = [], [], []
    for tr in own(table.find_all("tr")):
        sec = tr.parent.name if tr.parent else ""
        (head if sec == "thead" else foot if sec == "tfoot" else body).append(tr)
    return head + body + foot


def _span(cell: Tag, attr: str) -> int:
    try:
        return max(1, min(int(str(cell.get(attr, "1")).strip() or 1), 50))
    except ValueError:
        return 1


def _table(table: Tag, base: str) -> str:
    rows = _rows_in_order(table)
    if not rows:
        return ""
    cap_tag = table.find("caption")
    caption = _inline_text(cap_tag, base) if cap_tag and cap_tag.find_parent("table") is table else ""

    # 1칸짜리 레이아웃용 표는 표가 아니라 본문으로 취급
    if all(len(tr.find_all(["td", "th"], recursive=False)) <= 1 for tr in rows):
        out: list = []
        for tr in rows:
            for c in tr.find_all(["td", "th"], recursive=False):
                out.append("\n")
                _render(c, out, base)
                out.append("\n")
        return _tidy("".join(out))

    grid, header_flags, pending = [], [], {}
    for tr in rows:
        cells = tr.find_all(["td", "th"], recursive=False)
        row, col, i = [], 0, 0
        while i < len(cells) or col in pending:
            if col in pending:
                left, txt = pending[col]
                row.append(txt)
                if left > 1:
                    pending[col] = (left - 1, txt)
                else:
                    del pending[col]
                col += 1
                continue
            c = cells[i]
            i += 1
            txt = _inline_text(c, base).replace("|", "\\|")
            rs, cs = _span(c, "rowspan"), _span(c, "colspan")
            # rowspan: 아래 행에도 값을 채움(긴 값은 〃), colspan: 첫 칸에만
            carry = txt if len(txt) <= 60 else "〃"
            for k in range(cs):
                row.append(txt if k == 0 else "")
                if rs > 1:
                    pending[col] = (rs - 1, carry if k == 0 else "")
                col += 1
        grid.append(row)
        header_flags.append(bool(cells) and all(c.name == "th" for c in cells)
                            or (tr.parent is not None and tr.parent.name == "thead"))

    width = max(len(r) for r in grid)
    grid = [r + [""] * (width - len(r)) for r in grid]
    keep = [j for j in range(width) if any(r[j] for r in grid)]       # 완전히 빈 열 제거
    grid = [[r[j] for j in keep] for r in grid]
    width = len(keep)
    if width == 0:
        return ""
    lines = [f"[표] {caption}"] if caption else []

    if header_flags[0] and len(grid) > 1:
        lines.append("| " + " | ".join(grid[0]) + " |")
        lines.append("|" + "---|" * width)
        lines += ["| " + " | ".join(r) + " |" for r in grid[1:]]
    elif width == 2:                                   # 항목 | 값 형태
        lines += [f"- {k}: {v}" if k else f"- {v}" for k, v in grid]
    else:
        lines += [" | ".join(c for c in r if c) for r in grid]
    return "\n".join(ln for ln in lines if ln.strip())


def html_to_text(html_or_node, base: str = DEFAULT_BASE) -> str:
    if html_or_node is None:
        return ""
    if isinstance(html_or_node, str):
        if not html_or_node.strip():
            return ""
        # 게시글 본문은 span이 수십~수백 겹 중첩된 경우가 있어 깊이 제한이 없는 html.parser 사용
        node = BeautifulSoup(html_or_node, "html.parser")
    else:
        node = html_or_node
    out: list = []
    _render(node, out, base)
    return _tidy("".join(out))


# ---------------------------------------------------------------------------
# 첨부파일 텍스트 추출 (설치된 도구만 사용, 없으면 조용히 건너뜀)
# ---------------------------------------------------------------------------
def extract_file_text(path: Path) -> str:
    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            try:
                from pypdf import PdfReader
            except ImportError:
                log.info("  pypdf 미설치 → PDF 본문 추출 생략 (pip install pypdf)")
                return ""
            reader = PdfReader(str(path))
            return _tidy("\n".join((p.extract_text() or "") for p in reader.pages))
        if ext == ".hwpx":
            with zipfile.ZipFile(path) as z:
                names = sorted(n for n in z.namelist() if re.match(r"Contents/section\d+\.xml", n))
                parts = []
                for n in names:
                    xml = z.read(n).decode("utf-8", "ignore")
                    paras = re.findall(r"<hp:p\b.*?</hp:p>", xml, flags=re.S)
                    for p in paras:
                        t = "".join(re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", p, flags=re.S))
                        parts.append(re.sub(r"<[^>]+>", "", t))
                return _tidy("\n".join(parts))
        if ext == ".hwp":
            exe = shutil.which("hwp5txt")   # pip install pyhwp
            if not exe:
                log.info("  hwp5txt 미설치 → HWP 본문 추출 생략 (pip install pyhwp)")
                return ""
            res = subprocess.run([exe, str(path)], capture_output=True, timeout=120)
            return _tidy(res.stdout.decode("utf-8", "ignore"))
        if ext == ".docx":
            with zipfile.ZipFile(path) as z:
                xml = z.read("word/document.xml").decode("utf-8", "ignore")
            xml = re.sub(r"</w:p>", "\n", xml)
            return _tidy(re.sub(r"<[^>]+>", "", xml))
        if ext in (".txt", ".csv", ".md"):
            return _tidy(path.read_text("utf-8", errors="ignore"))
    except Exception as e:  # 깨진 파일 등
        log.warning("  텍스트 추출 실패 %s: %s", path.name, e)
    return ""


# ---------------------------------------------------------------------------
# 자료 구조
# ---------------------------------------------------------------------------
@dataclass
class PageTask:
    params: dict
    tab_title: str = ""

    @property
    def key(self):
        return (str(self.params.get("MENU_ID")), str(self.params.get("CONTENTS_NO") or ""))


@dataclass
class BoardCfg:
    form: dict
    path: list
    tab_title: str
    page_url: str

    @property
    def key(self):
        return (self.form.get("SITE_NO", ""), self.form.get("BOARD_SEQ", ""))

    @property
    def is_full_view(self):
        return not self.form.get("BOARD_CATEGORY_NO") and not self.form.get("S_CATE_SEQ")

    @property
    def name(self):
        base = self.path[-1] if self.path else f"게시판{self.form.get('BOARD_SEQ')}"
        if self.tab_title and self.tab_title not in ("전체",):
            return f"{base} > {self.tab_title}"
        return base


@dataclass
class Stats:
    pages: int = 0
    pages_dup: int = 0
    boards: int = 0
    posts: int = 0
    posts_skipped_secret: int = 0
    schedule_items: int = 0
    files: int = 0
    files_with_text: int = 0
    errors: list = field(default_factory=list)
    unhandled_ajax: dict = field(default_factory=dict)


class Jsonl:
    def __init__(self, path: Path):
        self.f = open(path, "w", encoding="utf-8")

    def write(self, obj: dict):
        self.f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    def close(self):
        self.f.close()


def norm_dt(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.strip()
    m = re.match(r"(\d{4})[-.](\d{2})[-.](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?", s)
    if not m:
        return s
    y, mo, d, hh, mm, ss = m.groups()
    return f"{y}-{mo}-{d}" + (f"T{hh}:{mm}:{ss or '00'}" if hh else "")


def parse_breadcrumb(title: str) -> list:
    t = TITLE_SUFFIX_RE.sub("", title or "").strip()
    parts = [p.strip() for p in t.split("|") if p.strip()]
    return list(reversed(parts))


def safe_name(name: str, limit: int = 120) -> str:
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', "_", name).strip(" .")
    return name[:limit] or "file"


# ---------------------------------------------------------------------------
# 크롤러
# ---------------------------------------------------------------------------
class Crawler:
    def __init__(self, client: Client, out: Path, args: argparse.Namespace):
        self.c = client
        self.out = out
        self.a = args
        self.stats = Stats()
        self.queue: deque = deque()
        self.seen_pages: set = set()
        self.page_hashes: set = set()
        self.boards: list = []
        self.subtab_cache: dict = {}
        self.schedule_site_nos: set = set()
        self.content_pdfs: dict = {}      # pdf path -> page doc meta
        self.docs: list = []
        self._pending_attach: list = []
        self.emit_pages = not args.skip_pages
        self.only = set(args.only_menus or [])
        self.exclude = set(args.exclude_menus or []) | DEFAULT_SKIP_MENUS
        out.mkdir(parents=True, exist_ok=True)
        self.w_pages = Jsonl(out / "pages.jsonl")
        self.w_posts = Jsonl(out / "posts.jsonl")
        self.w_sched = Jsonl(out / "schedule.jsonl")

    # ---------------- 링크/큐 ----------------
    def _page_params_from_url(self, href: str) -> Optional[dict]:
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            return None
        u = urlparse(self.c.abs(href))
        if u.netloc != self.c.host or not u.path.endswith(PAGE_PATH):
            return None
        q = parse_qs(u.query)
        mid = (q.get("MENU_ID") or [""])[0]
        if not mid.isdigit():
            return None
        params = {"MENU_ID": mid}
        for k in ("CONTENTS_NO", "P_TAB_NO", "TAB_NO"):
            v = (q.get(k) or [""])[0]
            if v:
                params[k] = v
        return params

    def enqueue(self, params: dict, tab_title: str = ""):
        task = PageTask(params, tab_title)
        mid = int(task.key[0])
        if mid in self.exclude or task.key in self.seen_pages:
            return
        if self.only and mid not in self.only:
            return
        self.seen_pages.add(task.key)
        self.queue.append(task)

    def discover(self):
        if self.only:
            for m in sorted(self.only):
                self.enqueue({"MENU_ID": str(m)})
            return
        for seed in DISCOVERY_SEEDS:
            try:
                html = self.c.get_text(seed)
            except Exception as e:
                log.warning("시드 페이지 실패 %s: %s", seed, e)
                continue
            soup = BeautifulSoup(html, "lxml")
            for a in soup.select("a[href]"):
                p = self._page_params_from_url(a["href"])
                if p:
                    self.enqueue(p)
        log.info("메뉴 탐색: 초기 큐 %d개", len(self.queue))

    # ---------------- 페이지 ----------------
    def run_pages(self):
        while self.queue:
            task = self.queue.popleft()
            try:
                self._process_page(task)
            except Exception as e:
                log.error("페이지 실패 %s: %s", task.params, e)
                self.stats.errors.append({"page": task.params, "error": str(e)})

    def _subtabs(self, site_no: str, menu_id: str, contno: str) -> list:
        k = (menu_id, contno)
        if k not in self.subtab_cache:
            try:
                data = self.c.post_json(SUBTAB_API, {"SITE_NO": site_no, "MENU_ID": menu_id,
                                                     "P_CONTENTS_NO": contno})
                self.subtab_cache[k] = (data or {}).get("data") or []
            except Exception as e:
                log.warning("하위탭 조회 실패 %s: %s", k, e)
                self.subtab_cache[k] = []
        return self.subtab_cache[k]

    def _process_page(self, task: PageTask):
        menu_id = task.params["MENU_ID"]
        url = self.c.abs(PAGE_PATH) + "?" + urlencode(task.params)
        html = self.c.get_text(PAGE_PATH, task.params)
        soup = BeautifulSoup(html, "lxml")
        title = soup.title.get_text(strip=True) if soup.title else ""
        path = parse_breadcrumb(title)
        sn_inp = soup.select_one("#commonSearchForm input[name=SITE_NO]")
        site_no = (sn_inp.get("value") if sn_inp else "") or "2"
        log.info("[page] %s %s %s", menu_id, " > ".join(path), task.tab_title)

        # 1) 링크 따라가기 (전체 메뉴가 매 페이지 GNB에 있음). 탭 링크는 아래 2)에서 따로 처리
        if not self.only:
            for a in soup.select("a[href]"):
                if a.find_parent(class_="tabsNav") is not None:
                    continue
                p = self._page_params_from_url(a["href"])
                if p:
                    self.enqueue(p)

        # 2) 탭 / 하위탭
        tab_enqueued = 0
        active_tab = ""
        contno_titles: dict = {}
        for i, a in enumerate(soup.select(".tabsNav .tabList li a"), 1):
            ttitle = a.get_text(" ", strip=True)
            li = a.find_parent("li")
            if li is not None and "on" in (li.get("class") or []):
                active_tab = ttitle
            href = a.get("href") or ""
            contno = a.get("data-contno")
            if href.startswith("http") and urlparse(href).netloc != self.c.host:
                continue                     # 외부 사이트 링크 탭
            if not contno:
                continue
            if int(a.get("data-subcnt") or 0) > 0:
                for j, ch in enumerate(self._subtabs(site_no, menu_id, contno), 1):
                    if ch.get("CONT_TYPE") in LINK_CONT_TYPES:
                        continue
                    cno, sub_title = str(ch["CONTENTS_NO"]), f"{ttitle} > {ch.get('CONTENTS_TITLE', '')}"
                    contno_titles[cno] = sub_title
                    self.enqueue({"MENU_ID": menu_id, "CONTENTS_NO": cno,
                                  "P_TAB_NO": str(i), "TAB_NO": str(j)}, sub_title)
                    tab_enqueued += 1
            else:
                contno_titles[contno] = ttitle
                self.enqueue({"MENU_ID": menu_id, "CONTENTS_NO": contno, "P_TAB_NO": str(i)}, ttitle)
                tab_enqueued += 1
        tab_title = (task.tab_title or contno_titles.get(str(task.params.get("CONTENTS_NO", "")))
                     or active_tab)

        # 3) 처리되지 않은 내부 API 기록 (확장 포인트)
        for api in set(re.findall(r"url\s*:\s*[\"'](/ajax[^\"']+)[\"']", html)) - KNOWN_AJAX:
            self.stats.unhandled_ajax.setdefault(api, set()).add(int(menu_id))

        # 4) 학사일정 API
        if SCHEDULE_API in html:
            m = re.search(r"SCH_SITE_NO\s*:\s*[\"'](\d+)[\"']", html)
            self.schedule_site_nos.add(m.group(1) if m else site_no)

        # 5) 게시판이면 설정만 저장 (본문은 목록 API로)
        form = soup.select_one("form#sendForm")
        if form and form.select_one("input[name=BOARD_SEQ]"):
            cfg = {i["name"]: i.get("value", "") for i in form.select("input[type=hidden][name]")}
            cfg.setdefault("SEARCH_FLD", "SUBJECT")
            cfg["SEARCH"] = ""
            self.boards.append(BoardCfg(cfg, path, tab_title, url))
            return

        # 6) 탭이 있는 기본 페이지는 첫 탭과 내용이 같으므로 탭 페이지에서 수집
        if not self.emit_pages or ("CONTENTS_NO" not in task.params and tab_enqueued):
            return

        article = soup.select_one("article") or soup.select_one("#contents")
        if article is None:
            return
        pdf_srcs = []
        for fr in article.select("iframe[src]"):
            m = re.search(r"fileSeq=([^&]+\.pdf)", fr["src"], flags=re.I)
            if m:
                pdf_srcs.append(m.group(1))
        text = html_to_text(article, self.c.base)
        page_id = f"page-{site_no}-{menu_id}-{task.params.get('CONTENTS_NO') or 0}"
        full_title = " > ".join(path + ([tab_title] if tab_title else []))
        meta = {"menu_id": int(menu_id), "contents_no": task.params.get("CONTENTS_NO") or None,
                "path": path, "tab": tab_title or None}

        for src in pdf_srcs:
            self.content_pdfs[src] = {"page_id": page_id, "title": full_title, "url": url, "meta": meta}

        if len(text) < self.a.min_chars:
            return
        h = hashlib.sha1(text.encode("utf-8")).hexdigest()
        if h in self.page_hashes:
            self.stats.pages_dup += 1
            return
        self.page_hashes.add(h)
        rec = {"id": page_id, "type": "page", "title": full_title, "url": url,
               **meta, "text": text, "fetched_at": datetime.now().isoformat(timespec="seconds")}
        self.w_pages.write(rec)
        self.stats.pages += 1
        self.docs.append({"id": page_id, "source": "page", "title": full_title, "url": url,
                          "text": f"{full_title}\n\n{text}", "metadata": meta})

    # ---------------- 게시판 ----------------
    def _select_boards(self) -> list:
        groups: "OrderedDict[tuple, list]" = OrderedDict()
        for b in self.boards:
            groups.setdefault(b.key, []).append(b)
        chosen = []
        for key, cfgs in groups.items():
            full = [b for b in cfgs if b.is_full_view]
            if full:
                chosen.append(full[0])
            else:   # '전체' 보기가 없으면 카테고리별로 모두
                seen = set()
                for b in cfgs:
                    k2 = (b.form.get("BOARD_CATEGORY_NO"), b.form.get("S_CATE_SEQ"))
                    if k2 not in seen:
                        seen.add(k2)
                        chosen.append(b)
        return chosen

    def run_boards(self):
        since = datetime.strptime(self.a.since, "%Y-%m-%d") if self.a.since else None
        seen_posts: set = set()
        boards = self._select_boards()
        log.info("게시판 %d개 수집 시작", len(boards))
        for b in boards:
            self.stats.boards += 1
            try:
                self._crawl_board(b, since, seen_posts)
            except Exception as e:
                log.error("게시판 실패 %s: %s", b.name, e)
                self.stats.errors.append({"board": b.name, "error": str(e)})

    def _crawl_board(self, b: BoardCfg, since: Optional[datetime], seen_posts: set):
        form = dict(b.form)
        size = self.a.page_size
        form["pagePerCnt"] = str(size)
        page, taken = 1, 0
        while True:
            form["pageNo"] = str(page)
            data = (self.c.post_json(LIST_API, form) or {}).get("data") or {}
            rows = data.get("list") or []
            total = int(data.get("totalRecordCount") or 0)
            if page == 1:
                log.info("[board] %s (BOARD_SEQ=%s) 총 %d건", b.name, b.form.get("BOARD_SEQ"), total)
            if not rows:
                break
            regular, regular_old = 0, 0
            for row in rows:
                pk = (b.key[0], row.get("BOARD_SEQ"), row.get("BBS_SEQ"))
                if pk in seen_posts:
                    continue
                seen_posts.add(pk)
                pinned = row.get("TOP_NOTICE_YN") == "Y" or row.get("NOTICE_YN") == "Y"
                if not pinned:
                    regular += 1
                if row.get("SECRET_YN") == "Y" or row.get("OPEN_YN") == "N":
                    self.stats.posts_skipped_secret += 1
                    continue
                if since:
                    wd = norm_dt(row.get("WRITE_DT"))[:10]
                    if wd and wd < since.strftime("%Y-%m-%d"):
                        if not pinned:
                            regular_old += 1
                        continue
                self._emit_post(row, b)
                taken += 1
                if self.a.max_posts_per_board and taken >= self.a.max_posts_per_board:
                    return
            if since and regular and regular_old == regular:
                break                      # 이 페이지의 일반글이 모두 기준일 이전 → 중단
            if page * size >= total:
                break
            page += 1

    def _emit_post(self, row: dict, b: BoardCfg):
        site_no, bseq, bbs = b.key[0], row.get("BOARD_SEQ"), row.get("BBS_SEQ")
        menu_id = b.form.get("MENU_ID")
        url = self.c.abs(VIEW_PATH) + "?" + urlencode(
            {"MENU_ID": menu_id, "SITE_NO": site_no, "BOARD_SEQ": bseq, "BBS_SEQ": bbs})
        text = html_to_text(row.get("CONTENTS") or "", self.c.base)
        if not text:
            text = _tidy(BeautifulSoup(row.get("SUB_CONTENTS") or "", "lxml").get_text(" "))
        link = row.get("LINK_URL") if row.get("LINK_URL_YN") == "Y" else None
        period = None
        if row.get("FROM_DATE") not in (None, "", "-") or row.get("TO_DATE") not in (None, "", "-"):
            period = {"from": row.get("FROM_DATE"), "to": row.get("TO_DATE")}
        post_id = f"post-{site_no}-{bseq}-{bbs}"
        rec = {
            "id": post_id, "type": "post", "board": b.name, "board_path": b.path, "site_no": site_no,
            "menu_id": int(menu_id) if str(menu_id).isdigit() else menu_id,
            "board_seq": bseq, "bbs_seq": bbs,
            "title": (row.get("SUBJECT") or "").strip(),
            "date": norm_dt(row.get("WRITE_DT")) or norm_dt(row.get("WRITE_DATE")),
            "writer": row.get("WRITER_NM"), "dept": row.get("DEPT_NM"),
            "category": row.get("CATEGORY_NM") or None,
            "is_notice": row.get("NOTICE_YN") == "Y", "period": period,
            "hits": row.get("HITS"), "url": url, "link_url": link,
            "file_count": row.get("FILE_CNT") or 0,
            "file_names": [row["FILE_ORG_NM"]] if row.get("FILE_ORG_NM") else [],
            "text": text,
        }
        if self.a.keep_html:
            rec["html"] = row.get("CONTENTS")
        self.w_posts.write(rec)
        self.stats.posts += 1

        head = [f"[{b.name}] {rec['title']}", f"작성일: {rec['date'][:10]}"]
        if rec["writer"]:
            head[-1] += f" | 작성: {rec['writer']}"
        if period:
            head.append(f"게시기간: {period['from']} ~ {period['to']}")
        if link:
            head.append(f"링크: {link}")
        if rec["file_names"]:
            head.append("첨부: " + ", ".join(rec["file_names"]) +
                        (f" 외 {rec['file_count'] - 1}개" if rec["file_count"] > 1 else ""))
        meta = {k: rec[k] for k in ("board", "board_path", "menu_id", "board_seq", "bbs_seq",
                                    "date", "writer", "category", "is_notice", "file_count")}
        self.docs.append({"id": post_id, "source": "post", "title": rec["title"], "url": url,
                          "text": "\n".join(head) + ("\n\n" + text if text else ""), "metadata": meta})
        if self.a.attachments and rec["file_count"]:
            self._pending_attach.append(rec)

    # ---------------- 첨부파일 ----------------
    def run_attachments(self):
        files_dir = self.out / "files"
        max_bytes = int(self.a.max_file_mb * 2**20)
        log.info("첨부파일: 게시글 %d개 확인", len(self._pending_attach))
        for rec in self._pending_attach:
            try:
                html = self.c.get_text(VIEW_PATH, {"MENU_ID": rec["menu_id"], "SITE_NO": rec["site_no"],
                                                   "BOARD_SEQ": rec["board_seq"], "BBS_SEQ": rec["bbs_seq"]})
            except Exception as e:
                self.stats.errors.append({"view": rec["url"], "error": str(e)})
                continue
            soup = BeautifulSoup(html, "lxml")
            for a in soup.select("a.filename[data-fileseq]"):
                name = re.sub(r"\s*\(\s*[\d.,]+\s*[KMG]?B\s*\)\s*$", "", a.get_text(" ", strip=True), flags=re.I)
                params = {"BOARD_SEQ": a.get("data-boardseq"), "SITE_NO": a.get("data-siteno"),
                          "BBS_SEQ": a.get("data-bbsseq"), "FILE_SEQ": a.get("data-fileseq")}
                dest = files_dir / f"{rec['board_seq']}_{rec['bbs_seq']}_{params['FILE_SEQ']}_{safe_name(name)}"
                try:
                    if not dest.exists():
                        if not self.c.download(FILE_DOWN, dest, params, max_bytes):
                            continue
                except Exception as e:
                    self.stats.errors.append({"file": name, "post": rec["url"], "error": str(e)})
                    continue
                self.stats.files += 1
                self._attach_doc(dest, name, rec["id"], rec["title"], rec["url"],
                                 {"parent_id": rec["id"], "board": rec["board"], "date": rec["date"]})

    def run_content_pdfs(self):
        files_dir = self.out / "files" / "pages"
        for src, info in self.content_pdfs.items():
            dest = files_dir / safe_name(src.strip("/").replace("/", "_"))
            try:
                if not dest.exists() and not self.c.download(src, dest, None, int(self.a.max_file_mb * 2**20)):
                    continue
            except Exception as e:
                self.stats.errors.append({"pdf": src, "error": str(e)})
                continue
            self.stats.files += 1
            self._attach_doc(dest, Path(src).name, info["page_id"], info["title"], info["url"],
                             {**info["meta"], "parent_id": info["page_id"], "file_url": self.c.abs(src)})

    def _attach_doc(self, path: Path, name: str, parent_id: str, parent_title: str, url: str, meta: dict):
        text = extract_file_text(path)
        if not text or len(text) < self.a.min_chars:
            return
        self.stats.files_with_text += 1
        doc_id = f"{parent_id}-file-{hashlib.sha1(name.encode()).hexdigest()[:8]}"
        title = f"{parent_title} - 첨부: {name}"
        self.docs.append({"id": doc_id, "source": "attachment", "title": title, "url": url,
                          "text": f"{title}\n\n{text}", "metadata": {**meta, "file_name": name,
                                                                      "local_path": str(path)}})

    # ---------------- 학사일정 ----------------
    def run_schedule(self):
        site_nos = self.schedule_site_nos or ({"2"} if not self.only else set())
        years = self.a.schedule_years or [datetime.now().year + d for d in (-1, 0, 1)]
        items: dict = {}
        for sn in sorted(site_nos):
            for y in years:
                try:
                    data = self.c.post_json(SCHEDULE_API, {"SCH_YEAR": str(y), "SCH_SITE_NO": sn})
                except Exception as e:
                    log.warning("학사일정 %s 실패: %s", y, e)
                    continue
                for it in (data or {}).get("data") or []:
                    k = (it.get("START_DAY"), it.get("END_DAY"), (it.get("SUBJECT") or "").strip())
                    items.setdefault(k, {"start": k[0], "end": k[1], "title": k[2], "site_no": sn})
        by_year: dict = {}
        for it in sorted(items.values(), key=lambda x: (x["start"] or "", x["end"] or "")):
            self.w_sched.write(it)
            self.stats.schedule_items += 1
            by_year.setdefault((it["start"] or "")[:4], []).append(it)
        url = self.c.abs(PAGE_PATH) + "?MENU_ID=1350"
        for y, its in by_year.items():
            lines = [f"- {i['start']}" + (f" ~ {i['end']}" if i["end"] != i["start"] else "") + f": {i['title']}"
                     for i in its]
            title = f"{y}년 학사일정 (연간주요일정)"
            self.docs.append({"id": f"schedule-{y}", "source": "schedule", "title": title, "url": url,
                              "text": title + "\n\n" + "\n".join(lines),
                              "metadata": {"year": int(y) if y.isdigit() else y, "path": ["학사안내", "학사안내", "연간주요일정안내"]}})

    # ---------------- 마무리 ----------------
    def finish(self, started: float):
        for w in (self.w_pages, self.w_posts, self.w_sched):
            w.close()
        with open(self.out / "documents.jsonl", "w", encoding="utf-8") as f:
            for d in self.docs:
                d["metadata"]["source_url"] = d["url"]
                f.write(json.dumps(d, ensure_ascii=False) + "\n")
        n_chunks = 0
        if not self.a.no_chunks:   # 키워드 검색용 청크 (keywords.json 주제 태깅 + 키워드 추출)
            n_chunks = kku_keywords.write_chunks(self.docs + kku_keywords.load_extra_docs(self.out),
                                                 self.out / "chunks.jsonl",
                                                 kku_keywords.load_topics(self.a.keywords),
                                                 self.a.chunk_size,
                                                 kku_keywords.load_exclude(self.a.exclude_rules))
        stats = dict(self.stats.__dict__)
        stats["unhandled_ajax"] = {k: sorted(v) for k, v in stats["unhandled_ajax"].items()}
        summary = {
            "base": self.c.base, "finished_at": datetime.now().isoformat(timespec="seconds"),
            "elapsed_sec": round(time.monotonic() - started, 1), "requests": self.c.n_requests,
            "documents": len(self.docs), "chunks": n_chunks, **stats,
            "boards_crawled": [{"name": b.name, "board_seq": b.form.get("BOARD_SEQ"),
                                "menu_id": b.form.get("MENU_ID")} for b in self._select_boards()],
        }
        (self.out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), "utf-8")
        return summary


# ---------------------------------------------------------------------------
def _int_list(s: str) -> list:
    return [int(x) for x in re.split(r"[,\s]+", s.strip()) if x]


def build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="건국대 글로컬캠퍼스 홈페이지 → 챗봇용 데이터 수집")
    p.add_argument("--out", default="kku_data", help="출력 폴더 (기본: kku_data)")
    p.add_argument("--base", default=DEFAULT_BASE, help="사이트 주소 (같은 CMS의 하위 사이트도 가능)")
    p.add_argument("--delay", type=float, default=1.0, help="요청 간 최소 간격(초), 기본 1.0")
    p.add_argument("--page-size", type=int, default=100, help="게시판 목록 API 1회당 건수 (기본 100)")
    p.add_argument("--since", help="이 날짜(YYYY-MM-DD) 이후 게시글만 수집 (증분 갱신용)")
    p.add_argument("--max-posts-per-board", type=int, default=0, help="게시판별 최대 글 수 (0=제한 없음)")
    p.add_argument("--only-menus", type=_int_list, help="이 MENU_ID들만 수집 (예: 1740,1610)")
    p.add_argument("--exclude-menus", type=_int_list, default=[], help="제외할 MENU_ID들 (예: 1780,1800)")
    p.add_argument("--skip-pages", action="store_true", help="안내 페이지 본문 수집 생략(게시판 설정 탐색은 수행)")
    p.add_argument("--skip-boards", action="store_true", help="게시판 수집 생략")
    p.add_argument("--skip-schedule", action="store_true", help="학사일정 수집 생략")
    p.add_argument("--schedule-years", type=_int_list, help="학사일정 연도 (기본: 작년,올해,내년)")
    p.add_argument("--attachments", action="store_true", help="게시글 첨부파일 다운로드 + 텍스트 추출")
    p.add_argument("--no-page-pdf", action="store_true", help="안내 페이지에 박힌 PDF 수집 생략")
    p.add_argument("--max-file-mb", type=float, default=30, help="첨부파일 최대 크기(MB)")
    p.add_argument("--min-chars", type=int, default=20, help="이보다 짧은 본문은 버림")
    p.add_argument("--keep-html", action="store_true", help="posts.jsonl에 원본 HTML도 저장")
    p.add_argument("--chunk-size", type=int, default=800, help="키워드 검색용 청크 최대 글자 수 (기본 800)")
    p.add_argument("--keywords", type=Path, default=kku_keywords.DEFAULT_TOPICS_FILE,
                   help="주제 사전 JSON (기본: keywords.json)")
    p.add_argument("--no-chunks", action="store_true", help="chunks.jsonl 생성 생략")
    p.add_argument("--exclude-rules", type=Path, default=kku_keywords.DEFAULT_EXCLUDE_FILE,
                   help="chunks.jsonl에서 뺄 게시판/메뉴 규칙 (기본: exclude.json, documents.jsonl은 전부 유지)")
    p.add_argument("--user-agent", default="Mozilla/5.0 (compatible; KKU-Chatbot-DataCollector/1.0)")
    p.add_argument("-v", "--verbose", action="store_true")
    return p


def main(argv=None, session=None):
    args = build_argparser().parse_args(argv)
    sys.setrecursionlimit(max(sys.getrecursionlimit(), 20000))   # 깊게 중첩된 HTML 대비
    try:   # 설치돼 있으면 OS 인증서 저장소 사용 (중간 인증서 누락 사이트의 SSLError 방지)
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    client = Client(args.base, args.delay, args.user_agent, session=session)
    crawler = Crawler(client, Path(args.out), args)
    started = time.monotonic()

    crawler.discover()
    crawler.run_pages()          # --skip-pages여도 게시판 설정을 찾기 위해 페이지는 방문
    if not args.skip_boards:
        crawler.run_boards()
    if not args.skip_schedule:
        crawler.run_schedule()
    if not args.skip_pages and not args.no_page_pdf:
        crawler.run_content_pdfs()
    if args.attachments:
        crawler.run_attachments()
    s = crawler.finish(started)
    log.info("완료: 문서 %d개, 청크 %d개 (페이지 %d, 게시글 %d, 일정 %d, 파일 %d) / 요청 %d회 / %.0f초 → %s",
             s["documents"], s["chunks"], s["pages"], s["posts"], s["schedule_items"], s["files"],
             s["requests"], s["elapsed_sec"], Path(args.out).resolve())
    if s["errors"]:
        log.warning("오류 %d건 — summary.json 참고", len(s["errors"]))
    return s


if __name__ == "__main__":
    main()
