#!/usr/bin/env python3
"""Package public files only; refuse symlinks and keep deployment metadata private."""
from pathlib import Path
import tarfile
import sys
root = Path(__file__).resolve().parents[1]
excluded = {'deploy', 'CNAME', 'CLAUDE.md', 'AGENTS.md', 'README.md'}
with tarfile.open(sys.argv[1], 'w:gz') as archive:
    for path in sorted(root.rglob('*')):
        rel = path.relative_to(root)
        if rel.parts[0] in excluded or any(p.startswith('.') for p in rel.parts):
            continue
        if path.is_symlink():
            raise ValueError(f'Symlinks are not publishable: {rel}')
        if path.is_file():
            archive.add(path, arcname=rel.as_posix(), recursive=False)
