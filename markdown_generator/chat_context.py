"""Generate assets/chat-context.json for the website chatbot.

Reads:
  _data/chatbot-content.yml      — structured grounding (papers, narrative, etc.)
  _pages/about.md                — raw bio markdown (for any extra context)

Writes:
  assets/chat-context.json       — consumed by the Cloudflare Worker

Run with:
  uv run python markdown_generator/chat_context.py
"""
# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml>=6.0"]
# ///

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT_PATH = REPO_ROOT / "_data" / "chatbot-content.yml"
ABOUT_PATH = REPO_ROOT / "_pages" / "about.md"
OUTPUT_PATH = REPO_ROOT / "assets" / "chat-context.json"


def strip_jekyll_frontmatter(text: str) -> str:
    if not text.startswith("---"):
        return text
    parts = text.split("---", 2)
    return parts[2].lstrip("\n") if len(parts) >= 3 else text


def main() -> int:
    if not CONTENT_PATH.exists():
        print(f"ERROR: missing {CONTENT_PATH}", file=sys.stderr)
        return 1

    content = yaml.safe_load(CONTENT_PATH.read_text(encoding="utf-8"))
    about_md = strip_jekyll_frontmatter(ABOUT_PATH.read_text(encoding="utf-8"))

    output = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "site_url": "https://iamsikun.github.io",
        "bio": content.get("bio", {}),
        "research_narrative": (content.get("research_narrative") or "").strip(),
        "research_interests": content.get("research_interests", {}),
        "papers": content.get("papers", []),
        "education": content.get("education", []),
        "industry_experience": content.get("industry_experience", []),
        "teaching": content.get("teaching", {}),
        "conference_presentations": content.get("conference_presentations", []),
        "academic_services": content.get("academic_services", []),
        "job_market": _drop_empty(content.get("job_market", {})),
        "fun_facts": content.get("fun_facts", []) or [],
        "guardrails": content.get("guardrails", {}),
        "about_md": about_md.strip(),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    n_papers = len(output["papers"])
    n_papers_with_abstracts = sum(1 for p in output["papers"] if (p.get("abstract") or "").strip())
    print(f"Wrote {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    print(f"  Papers: {n_papers} ({n_papers_with_abstracts} with abstracts)")
    if n_papers_with_abstracts < n_papers:
        print(
            "  Tip: fill in `abstract:` fields in _data/chatbot-content.yml "
            "to improve bot answers."
        )
    return 0


def _drop_empty(d: dict) -> dict:
    """Strip blank strings from optional dict fields so the bot ignores them."""
    return {k: v for k, v in (d or {}).items() if v not in ("", None, [])}


if __name__ == "__main__":
    raise SystemExit(main())
