#!/usr/bin/env python3
"""
학사 요람 PDF 수집 → 페이지별 텍스트 → 학과별 문서 (졸업요건·교육과정 질문용)

  python kku_yoram.py --data kku_data                 # 2017학년도 이후 요람
  python kku_yoram.py --data kku_data --from-year 2022

2017~2020학년도는 서울·글로컬 통합본이라 yoram_pages.json에 지정한 글로컬 쪽 범위만 사용한다.
큰 PDF는 추출한 글자를 .pages.json으로 캐시하므로 두 번째 실행부터 빠르다.

결과: kku_data/extra/yoram.jsonl  (kku_keywords build / kku_rag refresh 때 자동 포함)
      kku_data/files/yoram/*.pdf  (원본)
요람 게시판 글 목록은 이미 수집된 posts.jsonl에서 읽는다(먼저 kku_crawler.py 실행 필요).
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

import kku_crawler as kc

YORAM_BOARD = "요람"


def find_posts(data: Path, from_year: int) -> list:
    out = []
    for line in open(data / "posts.jsonl", encoding="utf-8"):
        p = json.loads(line)
        if p["board"] != YORAM_BOARD or not p["file_count"]:
            continue
        m = re.match(r"(\d{4})학년도", p["title"])
        if m and int(m.group(1)) >= from_year:
            out.append({**p, "year": int(m.group(1))})
    return sorted(out, key=lambda p: p["year"])


def download(client: kc.Client, post: dict, dest_dir: Path, max_mb: int) -> list:
    html = client.get_text(kc.VIEW_PATH, {"MENU_ID": post["menu_id"], "SITE_NO": post["site_no"],
                                          "BOARD_SEQ": post["board_seq"], "BBS_SEQ": post["bbs_seq"]})
    files = []
    for a in BeautifulSoup(html, "lxml").select("a.filename[data-fileseq]"):
        name = re.sub(r"\s*\(\s*[\d.,]+\s*[KMG]?B\s*\)\s*$", "", a.get_text(" ", strip=True), flags=re.I)
        if not name.lower().endswith(".pdf"):
            continue
        dest = dest_dir / f"{post['year']}_{kc.safe_name(name)}"
        if not dest.exists():
            params = {"BOARD_SEQ": a.get("data-boardseq"), "SITE_NO": a.get("data-siteno"),
                      "BBS_SEQ": a.get("data-bbsseq"), "FILE_SEQ": a.get("data-fileseq")}
            print(f"  다운로드: {name}")
            if not client.download(kc.FILE_DOWN, dest, params, max_mb * 2**20):
                continue
        files.append(dest)
    return files


def pdf_pages(path: Path) -> list:
    """쪽별 텍스트. 큰 통합본은 추출이 수 분 걸려서 .pages.json으로 캐시."""
    cache = path.with_suffix(".pages.json")
    if cache.exists() and cache.stat().st_mtime >= path.stat().st_mtime:
        return json.loads(cache.read_text("utf-8"))
    import logging
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    from pypdf import PdfReader
    pages = [kc._tidy(p.extract_text() or "") for p in PdfReader(str(path)).pages]
    cache.write_text(json.dumps(pages, ensure_ascii=False), "utf-8")
    return pages


PAGE_RANGES_FILE = Path(__file__).with_name("yoram_pages.json")


def load_page_ranges() -> dict:
    """yoram_pages.json: {"2018": [[315, 340], [520, 610]]} — 연도별로 쓸 PDF 쪽 범위(양 끝 포함).
    서울·글로컬 통합본처럼 자동 구분이 안 되는 해에 사람이 지정한다. 지정한 해는 이 범위만 사용."""
    if not PAGE_RANGES_FILE.exists():
        return {}
    raw = json.loads(PAGE_RANGES_FILE.read_text("utf-8"))
    return {int(k): v for k, v in raw.items() if not k.startswith("_")}


_RUNNING_HEAD = re.compile(r"^(건국대학교|GLOCAL캠퍼스|학사 요람|학 사|교육과정|대학별 교육과정|\d{4}(학년)?도? ?건국대학교 요람"
                           r"|GLOCAL\(글로컬\)캠퍼.*|스|정|-?\s*\d+\s*-?)$")
_DEPT_HEAD = re.compile(r"⊶\s*(전공|학과|학부)\s*목표\s*⊷")


def _clean(page: str) -> str:
    lines = page.split("\n")
    while lines and _RUNNING_HEAD.match(lines[0].strip()):
        lines.pop(0)
    return "\n".join(lines).strip()


def select_pages(pages: list, ranges: list | None = None) -> list:
    """[(쪽번호, 라벨, 본문)] — 학사 안내 + 글로컬 교육과정만, 학과 라벨을 붙여서.
    ranges가 있으면(yoram_pages.json) 자동 구간 탐지 대신 그 쪽들만 사용."""
    if ranges:
        keep = {p - 1 for a, b in ranges for p in range(a, b + 1) if 0 < p <= len(pages)}
        start, end = min(keep), max(keep) + 1
        skip = set(range(start, end)) - keep
    else:
        start = next((i for i, t in enumerate(pages) if "학사에 관한 안내" in t and "학기등록" in t and "(1)" in t), 0)
        heads = [i for i, t in enumerate(pages) if _DEPT_HEAD.search(t)]
        end = min(len(pages), (heads[-1] + 8) if heads else len(pages))
        skip = set()
        glocal = next((i for i, t in enumerate(pages) if "GLOCAL(글로컬)캠퍼스 인재상" in t), None)
        if glocal:                               # 2020: 서울·글로컬 통합본 → 서울 교육과정 구간 제외
            seoul = next((i for i in range(start, glocal) if "교육과정의 구성" in pages[i]), glocal)
            skip = set(range(seoul, glocal))
    out, label = [], "학사 안내"
    for i in range(start, end):
        if i in skip:
            continue
        text = _clean(pages[i])
        if "대학별 교육과정" in pages[i][:200] and label == "학사 안내":
            label = "대학별 교육과정 개요"
        # 한 쪽에 학과가 여러 개면 "학과명 / ⊶ 학과목표 ⊷" 줄 앞에서 잘라 각각 라벨을 붙임
        lines, seg = text.split("\n"), []
        for j, ln in enumerate(lines):
            if j + 1 < len(lines) and _DEPT_HEAD.search(lines[j + 1]) and ln.strip():
                if "\n".join(seg).strip():
                    out.append((i + 1, label, "\n".join(seg).strip()))
                seg, label = [], ln.strip().lstrip("•").strip()
            seg.append(ln)
        if len("\n".join(seg).strip()) >= 50:
            out.append((i + 1, label, "\n".join(seg).strip()))
    return out


def _norm(name: str) -> str:
    return re.sub(r"\s+", "", name).replace("･", "·")


def credit_table(selected: list):
    """'졸업에 필요한 최저 이수 학점 수' 표 → (쪽, 표 원문, 열 설명, {학과: 행}, [각주])"""
    for pno, _, text in selected:
        if "졸업에 필요한 최저 이수 학점" not in text:
            continue
        # 옛 요람은 "산 업 디 자 인 전 공36 2 12" 처럼 글자가 띄워지고 숫자가 붙어 있어 정리
        lines = [re.sub(r"(?<=[가-힣])\s(?=[가-힣])", "", ln.strip()) for ln in text.split("\n")]
        lines = [re.sub(r"(?<=[가-힣])(?=\d)", " ", ln) for ln in lines]
        i0 = next(i for i, ln in enumerate(lines) if "졸업에필요한최저이수학점" in ln.replace(" ", ""))
        seg = []
        for ln in lines[i0:]:
            if seg and re.match(r"^2\.\s", ln):
                break
            seg.append(ln)
        first_row = next((i for i, ln in enumerate(seg) if re.search(r"(학과|전공|학부|과)\s+\d", ln)), len(seg))
        header = " ".join(seg[1:first_row])
        if all(w in header for w in ("전필", "전선", "계")):
            minor = "부전공" in header
            cols = ("교양 / 전공필수 / 전공선택 / 전공 계 / 다전공(타 학과생이 다전공할 때) / "
                    + ("부전공(타 학과생이 부전공할 때) / " if minor else "") + "졸업이수학점(맨 끝 숫자)")
        else:
            cols = f"표 머리글 원문 「{header[:200]}」 — 맨 끝 숫자가 졸업이수학점"
        rows = {}
        for ln in seg:
            m = re.match(r"^([가-힣·･&A-Za-z]+(?:학과|전공|학부|과))\s+([\d\-()*\s]+)$", ln)
            if m:
                rows[_norm(m.group(1))] = ln
                short = re.sub(r"^.*?학부(?=.+(학과|전공)$)", "", m.group(1))   # '미디어학부시각영상디자인전공' → '시각영상디자인전공'
                rows.setdefault(_norm(short), ln)
        notes = [ln for ln in seg if ln.startswith(("*", "※"))]
        return pno, "\n".join(seg), cols, rows, notes
    return None


def build_docs(post: dict, pdf: Path, ranges: list | None = None) -> list:
    selected = select_pages(pdf_pages(pdf), ranges)
    table = credit_table(selected)
    groups = []
    for pno, label, text in selected:
        if len(text) < 30:
            continue
        if groups and groups[-1]["label"] == label:
            groups[-1]["pages"].append((pno, text))
        else:
            groups.append({"label": label, "pages": [(pno, text)]})
    docs = []
    for n, g in enumerate(groups):
        first, last = g["pages"][0][0], g["pages"][-1][0]
        title = f"{post['year']}학년도 학사요람 - {g['label']}"
        body = "\n\n".join(f"[요람 {pno}쪽]\n{t}" for pno, t in g["pages"])
        # 학과 문서 맨 앞에 졸업이수학점 표의 해당 행을 붙여 둔다 (표가 학사 안내 한가운데 있어 검색이 잘 안 됨)
        if table and _norm(g["label"]) in table[3]:
            tp, _, cols, rows, notes = table
            body = (f"[졸업에 필요한 최저 이수 학점 — {post['year']}학년도 요람 {tp}쪽 표]\n"
                    f"열 순서: {cols}\n{rows[_norm(g['label'])]}\n" + "\n".join(notes[:3]) + "\n\n" + body)
        docs.append({"id": f"yoram-{post['year']}-{n:03d}", "source": "yoram", "title": title, "url": post["url"],
                     "text": f"{title} ({post['year']}학년도 입학생 기준, PDF {first}~{last}쪽)\n\n{body}",
                     "metadata": {"board": "요람", "year": post["year"], "dept": g["label"],
                                  "pages": [first, last], "file": pdf.name}})
    if table:
        # 표에는 있는데 학과 문서가 없는 학과(제목 쪽이 그림인 경우) → 표의 행만 담은 학과 문서를 따로 만듦
        tp, _, cols, rows, notes = table
        have = {_norm(g["label"]) for g in groups}
        for key, line in rows.items():
            name = line.split()[0]
            short = re.sub(r"^.*?학부(?=.+(학과|전공)$)", "", name)
            if key != _norm(short) or key in have:
                continue
            title = f"{post['year']}학년도 학사요람 - {short}"
            docs.append({"id": f"yoram-{post['year']}-row-{key}", "source": "yoram", "title": title, "url": post["url"],
                         "text": f"{title} ({post['year']}학년도 입학생 기준, 졸업학점 표 {tp}쪽)\n\n"
                                 f"[졸업에 필요한 최저 이수 학점 — {post['year']}학년도 요람 {tp}쪽 표]\n"
                                 f"열 순서: {cols}\n{line}\n" + "\n".join(notes[:3]) +
                                 "\n\n※ 이 학과의 교육과정표는 요람에서 그림으로 되어 있어 과목 목록은 포함되지 않음",
                         "metadata": {"board": "요람", "year": post["year"], "dept": short,
                                      "pages": [tp, tp], "file": pdf.name}})
        tp, raw, cols, rows, _ = table
        title = f"{post['year']}학년도 학사요람 - 학과별 졸업 최저 이수학점 표"
        docs.append({"id": f"yoram-{post['year']}-credits", "source": "yoram", "title": title, "url": post["url"],
                     "text": f"{title} ({post['year']}학년도 입학생 기준, PDF {tp}쪽)\n\n"
                             f"각 행의 열 순서: 학과 / {cols}\n졸업학점·졸업요건·졸업이수학점·최저이수학점\n\n{raw}",
                     "metadata": {"board": "요람", "year": post["year"], "dept": "졸업이수학점 표",
                                  "pages": [tp, tp], "file": pdf.name}})
    return docs


def main(argv=None):
    ap = argparse.ArgumentParser(description="학사 요람 PDF 수집")
    ap.add_argument("--data", type=Path, default=Path("kku_data"))
    ap.add_argument("--from-year", type=int, default=2017)
    ap.add_argument("--max-mb", type=int, default=300)
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--inspect", action="store_true", help="다운로드 + 페이지 수/샘플만 출력")
    a = ap.parse_args(argv)

    client = kc.Client(kc.DEFAULT_BASE, a.delay, "Mozilla/5.0 (compatible; KKU-Chatbot-DataCollector/1.0)")
    dest_dir = a.data / "files" / "yoram"
    posts = find_posts(a.data, a.from_year)
    print(f"요람 {len(posts)}개: {[p['year'] for p in posts]}")
    all_docs = []
    page_ranges = load_page_ranges()
    for p in posts:
        for f in download(client, p, dest_dir, a.max_mb):
            if a.inspect:
                pages = pdf_pages(f)
                print(f"{p['year']} {f.name}: {len(pages)}쪽, {sum(len(t) for t in pages):,}자")
                (dest_dir / f"{f.stem}.pages.json").write_text(json.dumps(pages, ensure_ascii=False), "utf-8")
                continue
            ranges = page_ranges.get(p["year"])
            if p["year"] <= 2020 and not ranges:
                print(f"{p['year']}: 서울·글로컬 통합본이라 자동 구분 불가 → yoram_pages.json에 쪽 범위를 지정해야 포함됨 (건너뜀)")
                continue
            docs = build_docs(p, f, ranges)
            all_docs += docs
            print(f"{p['year']}: 문서 {len(docs)}개, {sum(len(d['text']) for d in docs):,}자 "
                  f"(학과 {len({d['metadata']['dept'] for d in docs})}개)")
    if a.inspect:
        return
    out = a.data / "extra" / "yoram.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fp:
        for d in all_docs:
            fp.write(json.dumps(d, ensure_ascii=False) + "\n")
    print(f"완료: {out} ({len(all_docs)}개) → `python kku_rag.py refresh`로 챗봇에 반영")


if __name__ == "__main__":
    main()
