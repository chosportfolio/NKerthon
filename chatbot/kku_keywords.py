#!/usr/bin/env python3
"""
키워드 기반 검색 (RAG/임베딩 없이) — 청크 만들기 + 검색

  python kku_keywords.py build  --data kku_data                    # documents.jsonl → chunks.jsonl
  python kku_keywords.py search --data kku_data "기숙사 신청 기간"   # 한 번 검색
  python kku_keywords.py search --data kku_data                    # 대화형

kku_crawler.py도 수집이 끝나면 이 모듈로 chunks.jsonl을 자동으로 만든다.
주제 사전(keywords.json)을 고친 뒤에는 다시 크롤링할 필요 없이 build만 다시 돌리면 된다.

검색 방식
  - 본문을 2글자 단위(bigram)로 쪼개 BM25 점수를 매긴다. 형태소 분석기 없이도
    "기숙사는/기숙사를", "수강 신청/수강신청" 같은 차이를 흡수한다.
  - 질문에 주제 사전의 단어가 있으면 같은 주제의 다른 표현(기숙사 → 생활관, 해오름학사…)도
    함께 찾고, 그 주제로 태깅된 청크에 가산점을 준다.
  - 게시글은 오래될수록 점수를 낮춘다(--no-recency로 끔).
"""
from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

DEFAULT_TOPICS_FILE = Path(__file__).with_name("keywords.json")


# ---------------------------------------------------------------------------
# 주제 사전
# ---------------------------------------------------------------------------
def load_topics(path: Optional[Path] = None) -> dict:
    path = Path(path) if path else DEFAULT_TOPICS_FILE
    if not path.exists():
        return {}
    return json.loads(path.read_text("utf-8"))


def _compact(s: str) -> str:
    return re.sub(r"\s+", "", (s or "").lower())


def _aliases(name: str, aliases: list) -> list:
    return list(dict.fromkeys(_compact(a) for a in [name, *aliases] if a.strip()))


def tag_topics(head: str, body: str, topics: dict) -> list:
    """제목/머리말에 나오거나 본문에 2번 이상 나온 주제만 태깅 (한 번 스친 언급은 무시)."""
    h, b = _compact(head), _compact(body)
    found = []
    for name, aliases in topics.items():
        al = _aliases(name, aliases)
        in_head = any(a in h for a in al)
        cnt = sum(b.count(a) for a in al)
        if in_head or cnt >= 2:
            found.append((in_head, cnt, name))
    found.sort(reverse=True)
    return [name for _, _, name in found]


def query_topics(query: str, topics: dict) -> list:
    q = _compact(query)
    return [name for name, aliases in topics.items() if any(a in q for a in _aliases(name, aliases))]


# ---------------------------------------------------------------------------
# 키워드 추출 (kiwipiepy가 있으면 명사 추출, 없으면 간단한 조사 제거)
# ---------------------------------------------------------------------------
_STOP = {"안내", "관련", "경우", "대한", "해당", "사항", "참고", "다음", "통해", "위해", "따라", "기타",
         "내용", "이상", "이하", "작성일", "작성", "관리자", "첨부", "게시기간", "링크", "이미지", "바로가기",
         "학년", "학년도", "학기", "소개", "기관소개", "부속기관", "있도록", "자세한", "아래", "각종"}
_JOSA = sorted(["으로써", "으로서", "에서는", "에게서", "으로는", "이라고", "까지", "부터", "에서", "에게",
                "으로", "이나", "이며", "이고", "하고", "에는", "와", "과", "은", "는", "이", "가", "을",
                "를", "의", "에", "도", "로", "만"], key=len, reverse=True)
_VERBISH = ("합니다", "됩니다", "습니다", "바랍니다", "하시기", "하여", "하는", "하며", "하고", "되는",
            "되며", "입니다", "있는", "없는", "했다", "한다", "된다")
_kiwi = None


def _get_kiwi():
    global _kiwi
    if _kiwi is None:
        try:
            from kiwipiepy import Kiwi
            _kiwi = Kiwi()
        except Exception:
            _kiwi = False
    return _kiwi or None


def _strip_josa(w: str) -> str:
    for j in _JOSA:
        if w.endswith(j) and len(w) - len(j) >= 2:
            return w[:-len(j)]
    return w


def nouns(text: str) -> list:
    kiwi = _get_kiwi()
    if kiwi:
        return [t.form for t in kiwi.tokenize(text)
                if t.tag in ("NNG", "NNP", "SL") and len(t.form) >= 2]
    out = []
    for w in re.findall(r"[가-힣]{2,}|[A-Za-z]{2,}", text):
        if w.endswith(_VERBISH):
            continue
        w = _strip_josa(w)
        if len(w) >= 2:
            out.append(w)
    return out


def extract_keywords(title: str, body: str, n: int = 8) -> list:
    c = Counter(w for w in nouns(body) if w not in _STOP)
    for w in nouns(title):
        if w not in _STOP:
            c[w] += 3
    return [w for w, _ in c.most_common(n)]


# ---------------------------------------------------------------------------
# 청크 분할 — 머리말(제목·게시판·날짜)은 모든 청크 앞에 반복
# ---------------------------------------------------------------------------
def _hard_split(s: str, size: int) -> list:
    return [s[i:i + size] for i in range(0, len(s), size)]


def _blocks(body: str, budget: int) -> list:
    blocks = []
    for para in re.split(r"\n{2,}", body):
        para = para.strip()
        if not para:
            continue
        if len(para) <= budget:
            blocks.append(para)
            continue
        lines = para.split("\n")
        # 마크다운 표는 잘린 조각마다 헤더 2줄을 다시 붙임
        table_head = lines[:2] if len(lines) > 2 and lines[1].startswith("|---") else []
        rest = lines[2:] if table_head else lines
        head_txt = "\n".join(table_head)
        cur = head_txt
        room = budget - len(head_txt)
        for ln in rest:
            for piece in (_hard_split(ln, max(room, 100)) if len(ln) > room else [ln]):
                if cur and cur != head_txt and len(cur) + 1 + len(piece) > budget:
                    blocks.append(cur)
                    cur = head_txt
                cur = f"{cur}\n{piece}" if cur else piece
        if cur and cur != head_txt:
            blocks.append(cur)
    return blocks


def split_document(doc: dict, max_chars: int = 800) -> list:
    """doc['text'] → [(머리말, 본문조각), ...]"""
    text = doc.get("text") or ""
    head, sep, body = text.partition("\n\n")
    if not sep:
        head, body = doc.get("title", ""), text
    head = head[:300]
    budget = max(200, max_chars - len(head))
    pieces, cur = [], ""
    for blk in _blocks(body, budget):
        if cur and len(cur) + 2 + len(blk) > budget:
            pieces.append(cur)
            cur = ""
        cur = f"{cur}\n\n{blk}" if cur else blk
    if cur:
        pieces.append(cur)
    return [(head, p) for p in pieces] or [(head, "")]


def make_chunks(docs, topics: dict, max_chars: int = 800):
    for doc in docs:
        parts = split_document(doc, max_chars)
        for i, (head, body) in enumerate(parts):
            yield {
                "id": f"{doc['id']}#{i}",
                "doc_id": doc["id"],
                "chunk_no": i,
                "n_chunks": len(parts),
                "source": doc.get("source"),
                "title": doc.get("title", ""),
                "url": doc.get("url"),
                "topics": tag_topics(head, body, topics),
                "keywords": extract_keywords(doc.get("title", ""), body),
                "text": f"{head}\n\n{body}".strip(),
                "metadata": doc.get("metadata") or {},
            }


# ---------------------------------------------------------------------------
# 직접 작성한 자료 (manual/*.md, *.txt) — 사이트에 없거나 틀린 정보를 사람이 보충
#   첫 줄 "# 제목", (선택) "출처: URL" 줄, 그 아래 본문. 파일명이 _로 시작하면 무시(양식용)
# ---------------------------------------------------------------------------
DEFAULT_MANUAL_DIR = Path(__file__).with_name("manual")


def load_manual_docs(folder: Optional[Path] = None) -> list:
    folder = Path(folder) if folder else DEFAULT_MANUAL_DIR
    if not folder.is_dir():
        return []
    docs = []
    for f in sorted(list(folder.glob("*.md")) + list(folder.glob("*.txt"))):
        if f.name.startswith("_"):
            continue
        lines = f.read_text("utf-8-sig").strip().splitlines()
        if not lines:
            continue
        title = lines[0].lstrip("#").strip() if lines[0].startswith("#") else f.stem
        body_lines = lines[1:] if lines[0].startswith("#") else lines
        url = ""
        if body_lines and re.match(r"\s*출처\s*:", body_lines[0]):
            url = body_lines[0].split(":", 1)[1].strip()
            body_lines = body_lines[1:]
        updated = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d")
        # '## 소제목'이 있으면 섹션마다 따로 검색되도록 문서를 나눔 (긴 자료가 잘게 잘려 일부만 찾히는 문제 방지)
        sections, intro, cur = [], [], None
        for ln in body_lines:
            if ln.startswith("## "):
                cur = [ln[3:].strip(), []]
                sections.append(cur)
            elif cur:
                cur[1].append(ln)
            else:
                intro.append(ln)
        meta = {"file": f.name, "updated": updated}
        if not sections:
            docs.append({"id": f"manual-{f.stem}", "source": "manual", "title": title, "url": url,
                         "text": f"[직접 작성 자료] {title}\n수정일: {updated}\n\n" + "\n".join(body_lines).strip(),
                         "metadata": meta})
            continue
        lead = "\n".join(intro).strip()
        for i, (sub, lines) in enumerate(sections):
            docs.append({"id": f"manual-{f.stem}" + (f"#{i}" if i else ""), "source": "manual",
                         "title": f"{title} - {sub}", "url": url,
                         "text": f"[직접 작성 자료] {title} - {sub}\n수정일: {updated}\n{lead}\n\n" + "\n".join(lines).strip(),
                         "metadata": meta})
    return docs


# ---------------------------------------------------------------------------
# 제외 규칙 (exclude.json) — 학생 정보 검색과 무관한 게시판/메뉴, 오래된 공지
# ---------------------------------------------------------------------------
DEFAULT_EXCLUDE_FILE = Path(__file__).with_name("exclude.json")


def load_exclude(path: Optional[Path] = None) -> dict:
    path = Path(path) if path else DEFAULT_EXCLUDE_FILE
    if not path.exists():
        return {}
    return json.loads(path.read_text("utf-8"))


def is_excluded(doc: dict, rules: dict, today: Optional[datetime] = None) -> bool:
    if not rules:
        return False
    meta = doc.get("metadata") or {}
    board = meta.get("board")
    if board and board in rules.get("boards", []):
        return True
    if meta.get("menu_id") in rules.get("menu_ids", []) and doc.get("source") != "post":
        return True
    title = doc.get("title", "")
    if any(re.search(p, title) for p in rules.get("title_patterns", [])):
        return True
    max_age = rules.get("max_age_days")
    if max_age and board in rules.get("max_age_boards", []):
        try:
            d = datetime.strptime((meta.get("date") or "")[:10], "%Y-%m-%d")
            if ((today or datetime.now()) - d).days > max_age:
                return True
        except ValueError:
            pass
    return False


def write_chunks(docs, path: Path, topics: dict, max_chars: int = 800, exclude: Optional[dict] = None,
                 manual_dir: Optional[Path] = None) -> int:
    if exclude:
        docs = [d for d in docs if not is_excluded(d, exclude)]
    docs = list(docs) + load_manual_docs(manual_dir)
    n = 0
    with open(path, "w", encoding="utf-8") as f:
        for ch in make_chunks(docs, topics, max_chars):
            f.write(json.dumps(ch, ensure_ascii=False) + "\n")
            n += 1
    return n


def load_extra_docs(data_dir: Path) -> list:
    """data/extra/*.jsonl — 크롤러 밖에서 만든 문서(요람 등). 크롤러를 다시 돌려도 유지된다."""
    folder = Path(data_dir) / "extra"
    docs = []
    for f in sorted(folder.glob("*.jsonl")) if folder.is_dir() else []:
        docs += read_jsonl(f)
    return docs


def read_jsonl(path: Path) -> list:
    with open(path, encoding="utf-8") as f:
        return [json.loads(ln) for ln in f if ln.strip()]


# ---------------------------------------------------------------------------
# 검색 (bigram BM25 + 주제 확장 + 최신 가중치)
# ---------------------------------------------------------------------------
_TOKEN = re.compile(r"[가-힣]+|[a-z]+|\d+")


def tokenize(text: str) -> list:
    out = []
    for w in _TOKEN.findall((text or "").lower()):
        if len(w) >= 2 and "가" <= w[0] <= "힣":
            out.extend(w[i:i + 2] for i in range(len(w) - 1))
        else:
            out.append(w)
    return out


class Searcher:
    def __init__(self, chunks: list, topics: dict, k1: float = 1.2, b: float = 0.75):
        self.chunks, self.topics, self.k1, self.b = chunks, topics, k1, b
        self.postings = defaultdict(list)
        self.lens = []
        df = Counter()
        for i, c in enumerate(chunks):
            toks = tokenize(c["title"]) * 2 + tokenize(" ".join(c.get("keywords", []))) + tokenize(c["text"])
            tf = Counter(toks)
            self.lens.append(len(toks))
            df.update(tf.keys())
            for t, f in tf.items():
                self.postings[t].append((i, f))
        n = max(len(chunks), 1)
        self.avg = sum(self.lens) / n
        self.idf = {t: math.log(1 + (n - d + 0.5) / (d + 0.5)) for t, d in df.items()}

    @classmethod
    def from_dir(cls, data_dir, topics_file=None):
        return cls(read_jsonl(Path(data_dir) / "chunks.jsonl"), load_topics(topics_file))

    def search(self, query: str, k: int = 5, recency: bool = True, per_doc: int = 1) -> list:
        q_topics = query_topics(query, self.topics)
        weights = Counter()
        for t in tokenize(query):
            weights[t] += 1.0
        for name in q_topics:                    # 같은 주제의 다른 표현으로 확장
            for a in [name, *self.topics[name]]:
                for t in tokenize(a):
                    weights[t] = max(weights[t], 0.3)

        scores = defaultdict(float)
        for t, w in weights.items():
            idf = self.idf.get(t)
            if idf is None:
                continue
            for i, f in self.postings[t]:
                norm = f + self.k1 * (1 - self.b + self.b * self.lens[i] / self.avg)
                scores[i] += w * idf * f * (self.k1 + 1) / norm

        today = datetime.now()
        for i in scores:
            c = self.chunks[i]
            if q_topics and set(q_topics) & set(c.get("topics", [])):
                scores[i] *= 1.5
            if recency and c.get("source") == "post":
                d = (c["metadata"].get("date") or "")[:10]
                try:
                    age = (today - datetime.strptime(d, "%Y-%m-%d")).days
                    scores[i] *= 1 / (1 + max(age, 0) / 730)     # 2년 지나면 절반
                except ValueError:
                    pass

        results, per = [], Counter()
        for i in sorted(scores, key=scores.get, reverse=True):
            c = self.chunks[i]
            if per[c["doc_id"]] >= per_doc:
                continue
            per[c["doc_id"]] += 1
            results.append({**c, "score": round(scores[i], 3), "query_topics": q_topics})
            if len(results) >= k:
                break
        return results


def snippet(text: str, query: str, width: int = 160) -> str:
    body = text.partition("\n\n")[2] or text
    pos = -1
    for w in sorted(re.findall(r"[가-힣A-Za-z0-9]{2,}", query), key=len, reverse=True):
        for cand in (w, w[:2]):
            pos = body.find(cand)
            if pos >= 0:
                break
        if pos >= 0:
            break
    start = max(0, pos - width // 3) if pos >= 0 else 0
    s = body[start:start + width].replace("\n", " ")
    return ("…" if start else "") + s + ("…" if start + width < len(body) else "")


def _print_results(results: list, query: str):
    if not results:
        print("  결과 없음")
        return
    if results[0]["query_topics"]:
        print("  [주제] " + ", ".join(results[0]["query_topics"]))
    for n, r in enumerate(results, 1):
        date = (r["metadata"].get("date") or "")[:10]
        print(f"\n  {n}. {r['title']}  ({r['source']}{', ' + date if date else ''}, 점수 {r['score']})")
        print(f"     {snippet(r['text'], query)}")
        print(f"     키워드: {', '.join(r.get('keywords', [])[:6])}")
        print(f"     {r['url']}")


# ---------------------------------------------------------------------------
def main(argv=None):
    p = argparse.ArgumentParser(description="키워드 기반 청크 생성 / 검색")
    sub = p.add_subparsers(dest="cmd", required=True)
    pb = sub.add_parser("build", help="documents.jsonl → chunks.jsonl")
    pb.add_argument("--data", default="kku_data")
    pb.add_argument("--chunk-size", type=int, default=800)
    pb.add_argument("--keywords", type=Path, default=DEFAULT_TOPICS_FILE)
    pb.add_argument("--exclude", type=Path, default=DEFAULT_EXCLUDE_FILE, help="제외 규칙 JSON")
    pb.add_argument("--no-exclude", action="store_true", help="제외 규칙 적용 안 함")
    ps = sub.add_parser("search", help="chunks.jsonl에서 검색")
    ps.add_argument("query", nargs="?")
    ps.add_argument("--data", default="kku_data")
    ps.add_argument("--keywords", type=Path, default=DEFAULT_TOPICS_FILE)
    ps.add_argument("-k", type=int, default=5)
    ps.add_argument("--no-recency", action="store_true")
    a = p.parse_args(argv)

    data = Path(a.data)
    if a.cmd == "build":
        docs = read_jsonl(data / "documents.jsonl") + load_extra_docs(data)
        rules = {} if a.no_exclude else load_exclude(a.exclude)
        kept = [d for d in docs if not is_excluded(d, rules)]
        n_manual = len(load_manual_docs())
        n = write_chunks(kept, data / "chunks.jsonl", load_topics(a.keywords), a.chunk_size)
        how = "kiwipiepy 명사 추출" if _get_kiwi() else "간이 키워드 추출(kiwipiepy 없음/차단)"
        print(f"문서 {len(docs)}개 중 {len(docs) - len(kept)}개 제외 → {len(kept)}개 + 직접 작성 {n_manual}개"
              f" → 청크 {n}개 ({how}) → {data / 'chunks.jsonl'}")
        return

    s = Searcher.from_dir(data, a.keywords)
    print(f"청크 {len(s.chunks)}개 로드")
    if a.query:
        _print_results(s.search(a.query, a.k, recency=not a.no_recency), a.query)
        return
    while True:
        try:
            q = input("\n질문> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if q in ("", "q", "quit", "exit"):
            break
        _print_results(s.search(q, a.k, recency=not a.no_recency), q)


if __name__ == "__main__":
    main()
