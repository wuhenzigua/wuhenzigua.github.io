#!/usr/bin/python3
"""Root-installed forced SSH command; runs as blog-deploy, never as root."""
import fcntl
import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

BASE = Path('/var/www/main-site')
command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
if not re.fullmatch(r'deploy [0-9a-f]{40}', command):
    sys.exit('Only deploy <commit SHA> is permitted')
sha = command.split()[1]
with (BASE / '.deploy.lock').open('w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    release = Path(tempfile.mkdtemp(prefix=f'{sha[:12]}-', dir=BASE / 'releases'))
    previous = os.readlink(BASE / 'current')
    activated = False
    try:
        total = 0
        count = 0
        with tarfile.open(fileobj=sys.stdin.buffer, mode='r|gz') as archive:
            for member in archive:
                path = PurePosixPath(member.name)
                if path.is_absolute() or '..' in path.parts or any(p.startswith('.') for p in path.parts):
                    raise ValueError('Unsafe archive path')
                if not path.parts:
                    continue
                if not (member.isfile() or member.isdir()):
                    raise ValueError('Only regular files and directories allowed')
                total += member.size
                count += 1
                if total > 200 * 1024 * 1024 or count > 20000:
                    raise ValueError('Archive too large')
                target = release.joinpath(*path.parts)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(member) as source, target.open('xb') as output:
                        shutil.copyfileobj(source, output)
                    target.chmod(0o644)
        home = release / 'index.html'
        if not home.is_file() or home.stat().st_size < 100:
            raise ValueError('Missing or empty homepage')
        # mkdtemp defaults to 0700; nginx must be able to read the release.
        release.chmod(0o755)
        (release / 'deployment-version.txt').write_text(sha + '\n')
        next_link = BASE / '.current-next'
        next_link.unlink(missing_ok=True)
        next_link.symlink_to(release)
        next_link.replace(BASE / 'current')
        activated = True
        response = subprocess.check_output([
            'curl', '--fail', '--silent', '--show-error', '--max-time', '20',
            '--resolve', 'www.dongnanzhi.top:8443:127.0.0.1',
            'https://www.dongnanzhi.top:8443/'
        ])
        if hashlib.sha256(response).digest() != hashlib.sha256(home.read_bytes()).digest():
            raise ValueError('Origin homepage verification failed')
        print(f'Deployed {sha}; previous release: {previous}', flush=True)
    except Exception:
        if activated:
            rollback = BASE / '.current-rollback'
            rollback.unlink(missing_ok=True)
            rollback.symlink_to(previous)
            rollback.replace(BASE / 'current')
        shutil.rmtree(release)
        raise
