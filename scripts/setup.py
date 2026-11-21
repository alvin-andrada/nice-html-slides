"""One-time setup: Node packages for the build, Python packages and a headless browser for checks and exports."""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def run(cmd, **kw):
    print('>', ' '.join(str(c) for c in cmd))
    return subprocess.run(cmd, **kw).returncode == 0


npm = shutil.which('npm')
if not npm:
    sys.exit('Node.js is required (https://nodejs.org), then run this again.')
run([npm, 'install'], cwd=ROOT, check=True)
pip = [sys.executable, '-m', 'pip', 'install', 'playwright', 'pillow', 'python-pptx']
if not run(pip):
    run(pip + ['--user'], check=True)
run([sys.executable, '-m', 'playwright', 'install', 'chromium'], check=True)
print('setup complete')
