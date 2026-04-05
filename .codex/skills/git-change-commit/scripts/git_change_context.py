#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def run_git(repo: str, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", repo, *args],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "unknown git error"
        raise RuntimeError(f"git {' '.join(args)} failed: {message}")
    return result.stdout.strip()


def section(title: str, content: str) -> None:
    print(f"## {title}")
    print(content if content else "(none)")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print a compact git change summary for commit drafting."
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Path to the target repository. Defaults to the current directory.",
    )
    args = parser.parse_args()

    repo = str(Path(args.repo).resolve())

    try:
        root = run_git(repo, "rev-parse", "--show-toplevel")
        branch = run_git(repo, "rev-parse", "--abbrev-ref", "HEAD")
        staged_names = run_git(repo, "diff", "--cached", "--name-status")
        unstaged_names = run_git(repo, "diff", "--name-status")
        untracked = run_git(repo, "ls-files", "--others", "--exclude-standard")
        staged_stat = run_git(repo, "diff", "--cached", "--stat")
        unstaged_stat = run_git(repo, "diff", "--stat")
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(f"Repository: {root}")
    print(f"Branch: {branch}")
    print()

    section("Staged files", staged_names)
    section("Staged diffstat", staged_stat)
    section("Unstaged files", unstaged_names)
    section("Unstaged diffstat", unstaged_stat)
    section("Untracked files", untracked)

    print("## Suggested next commands")
    print("git diff --cached -- <file>")
    print("git diff -- <file>")
    print("git status --short")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

