#!/usr/bin/env python3
"""InariCode Phase 3 sidecar: JSON line in/out (one request per process).

Request:  {"id": "…", "method": "ping"|"codebase_search", "params": {...}}
Response: {"id": "…", "ok": true, "result": …}  or  {"id": "…", "ok": false, "error": "…"}

codebase_search: BM25 over UTF-8 text files; respects .inariignore (gitwildmatch) when pathspec is installed.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
from pathlib import Path
from typing import Any

try:
    import pathspec  # type: ignore
except ImportError:
    pathspec = None

SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    "target",
    "dist",
    ".yarn",
    "__pycache__",
    ".venv",
    "venv",
    "build",
    ".next",
    ".turbo",
}

MAX_FILE_BYTES = 512 * 1024
DEFAULT_MAX_FILES = 1500
DEFAULT_MAX_RESULTS = 12


def _reply(out: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _load_inari_spec(root: Path):
    p = root / ".inariignore"
    if not p.is_file() or pathspec is None:
        return None
    try:
        lines = p.read_text(encoding="utf-8", errors="ignore").splitlines()
        return pathspec.PathSpec.from_lines("gitwildmatch", lines)
    except Exception:
        return None


def _rel_posix(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _is_probably_text(data: bytes) -> bool:
    if b"\x00" in data[:8192]:
        return False
    return True


def _tokenize(s: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9_]+", s.lower())


def _iter_doc_paths(root: Path, spec, max_files: int):
    count = 0
    root = root.resolve()
    for dirpath, dirnames, filenames in os.walk(root, topdown=True, followlinks=False):
        dp = Path(dirpath)
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIR_NAMES and not d.endswith(".egg-info"))
        for name in filenames:
            if count >= max_files:
                return
            path = dp / name
            try:
                rel = _rel_posix(root, path)
            except ValueError:
                continue
            if spec is not None and spec.match_file(rel):
                continue
            try:
                st = path.stat()
            except OSError:
                continue
            if not path.is_file() or st.st_size > MAX_FILE_BYTES:
                continue
            count += 1
            yield path, rel


def _bm25_score(docs: list[list[str]], query_terms: list[str]) -> list[float]:
    n = len(docs)
    if n == 0:
        return []
    df: dict[str, int] = {}
    for doc in docs:
        for t in set(doc):
            df[t] = df.get(t, 0) + 1
    avgdl = sum(len(d) for d in docs) / n
    k1, b = 1.5, 0.75
    scores = [0.0] * n
    for i, doc in enumerate(docs):
        dl = len(doc) or 1
        for t in query_terms:
            if t not in df:
                continue
            n_t = df[t]
            idf = math.log((n - n_t + 0.5) / (n_t + 0.5) + 1.0)
            f = doc.count(t)
            denom = f + k1 * (1 - b + b * dl / avgdl)
            scores[i] += idf * (f * (k1 + 1)) / denom
    return scores


def _snippet_for_query(text: str, terms: list[str], width: int = 220) -> str:
    low = text.lower()
    best_i = 0
    for t in terms:
        if not t:
            continue
        j = low.find(t)
        if j >= 0:
            best_i = max(0, j - width // 2)
            break
    chunk = text[best_i : best_i + width]
    chunk = chunk.replace("\n", " ").strip()
    if len(text) > width:
        chunk += " …"
    return chunk


def handle_codebase_search(params: dict[str, Any]) -> dict[str, Any]:
    workspace = params.get("workspace")
    query = params.get("query")
    if not isinstance(workspace, str) or not workspace:
        raise ValueError("missing workspace")
    if not isinstance(query, str) or not query.strip():
        raise ValueError("missing query")
    max_results = int(params.get("max_results") or DEFAULT_MAX_RESULTS)
    max_files = int(params.get("max_files") or DEFAULT_MAX_FILES)
    root = Path(workspace).resolve()
    if not root.is_dir():
        raise ValueError("workspace is not a directory")

    spec = _load_inari_spec(root)
    q_terms = _tokenize(query)
    if not q_terms:
        return {"query": query, "chunks": [], "note": "empty query after tokenization"}

    paths: list[Path] = []
    rels: list[str] = []
    docs: list[list[str]] = []

    for path, rel in _iter_doc_paths(root, spec, max_files):
        try:
            raw = path.read_bytes()
        except OSError:
            continue
        if not _is_probably_text(raw):
            continue
        try:
            text = raw.decode("utf-8", errors="ignore")
        except Exception:
            continue
        toks = _tokenize(text)
        if not toks:
            continue
        paths.append(path)
        rels.append(rel)
        docs.append(toks)

    if not docs:
        return {
            "query": query,
            "chunks": [],
            "indexed_files": 0,
            "note": "no indexable text files (check .inariignore / size limits)",
        }

    scores = _bm25_score(docs, q_terms)
    ranked = sorted(range(len(docs)), key=lambda i: scores[i], reverse=True)[:max_results]
    chunks = []
    for i in ranked:
        if scores[i] <= 0:
            continue
        path = paths[i]
        rel = rels[i]
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        chunks.append(
            {
                "path": rel,
                "score": round(scores[i], 4),
                "snippet": _snippet_for_query(text, q_terms),
            }
        )

    return {
        "query": query,
        "indexed_files": len(docs),
        "chunks": chunks,
        "pathspec": pathspec is not None,
    }


def main() -> None:
    line = sys.stdin.readline()
    if not line.strip():
        _reply({"id": "", "ok": False, "error": "empty stdin"})
        return
    try:
        req = json.loads(line)
    except json.JSONDecodeError as e:
        _reply({"id": "", "ok": False, "error": f"invalid json: {e}"})
        return
    rid = req.get("id", "")
    method = req.get("method")
    params = req.get("params") or {}
    if not isinstance(params, dict):
        params = {}

    try:
        if method == "ping":
            _reply({"id": rid, "ok": True, "result": {"ok": True, "pathspec": pathspec is not None}})
        elif method == "codebase_search":
            result = handle_codebase_search(params)
            _reply({"id": rid, "ok": True, "result": result})
        else:
            _reply({"id": rid, "ok": False, "error": f"unknown method {method!r}"})
    except Exception as e:
        _reply({"id": rid, "ok": False, "error": str(e)})


if __name__ == "__main__":
    main()
