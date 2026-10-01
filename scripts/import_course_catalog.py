"""Convert Konkuk GLOCAL timetable workbooks into browser-friendly JSON files."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook


SOURCE_DIR = Path(sys.argv[1])
OUTPUT_DIR = Path(sys.argv[2])
SEMESTER_RE = re.compile(r"^(20\d{2})-([12])\.xlsx$")


def text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def number(value: object) -> float:
    try:
        parsed = float(value or 0)
    except (TypeError, ValueError):
        return 0
    return int(parsed) if parsed.is_integer() else parsed


def convert(path: Path) -> tuple[str, int]:
    semester = path.stem
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook.active
    # The supplied exports declare A1 as their dimension even though data extends
    # through AD. Resetting makes openpyxl scan the actual worksheet cells.
    sheet.reset_dimensions()
    rows = sheet.iter_rows(values_only=True)
    next(rows, None)

    courses: list[dict[str, object]] = []
    for row_number, row in enumerate(rows, start=2):
        cells = list(row) + [None] * (30 - len(row))
        name = text(cells[5])
        if not name:
            continue

        lecture_type = text(cells[24])
        lecture_kind = text(cells[25])
        classification = text(cells[3])
        is_elearning = (
            "E-러닝" in lecture_type
            or lecture_kind in {"f-러닝", "b-러닝", "MOOC"}
        )
        courses.append({
            "id": f"{semester}-{row_number}",
            "gradeYear": text(cells[1]),
            "subjectCode": text(cells[2]),
            "classification": classification,
            "section": text(cells[4]),
            "name": name,
            "credits": number(cells[8]),
            "target": text(cells[10]),
            "college": text(cells[11]),
            "department": text(cells[12]),
            "sourceSchedule": text(cells[13]),
            "professor": text(cells[15]),
            "area": text(cells[27]),
            "isElearning": is_elearning,
        })

    payload = {"semester": semester, "count": len(courses), "courses": courses}
    target = OUTPUT_DIR / f"{semester}.json"
    target.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return semester, len(courses)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(
        path for path in SOURCE_DIR.glob("*.xlsx") if SEMESTER_RE.match(path.name)
    )
    if not sources:
        raise SystemExit(f"No semester workbooks found in {SOURCE_DIR}")

    semesters = []
    for source in sources:
        semester, count = convert(source)
        semesters.append({"key": semester, "count": count})
        print(f"{semester}: {count}")

    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps({"semesters": semesters}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
