"""Reproduce the domain-only static artifact from the preserved Pages deployment."""
import hashlib
import json
import subprocess
import argparse
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'artifact.json').read_text())
base = 'https://988d5b4a.slidemino.pages.dev'
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, help='Previously downloaded original assets; each file is still hash-checked')
args = parser.parse_args()
for entry in manifest['files']:
    if args.source:
        data = (args.source / entry['sourcePath'].lstrip('/')).read_bytes()
    else:
        data = subprocess.check_output(['curl', '-fsSL', '--max-time', '60', base + entry['sourcePath']])
    assert hashlib.sha256(data).hexdigest() == entry['beforeSha256'], entry['sourcePath']
    if Path(entry['sourcePath']).suffix in {'.html', '.js', '.css', '.json', '.txt', '.orig'}:
        data = data.replace(b'emozleep.space', b'cdjstudio.xyz')
        for old, new in manifest['renames'].items():
            data = data.replace(old.encode(), new.encode())
    assert hashlib.sha256(data).hexdigest() == entry['afterSha256'], entry['outputPath']
    target = root / 'dist' / entry['outputPath']
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
(root / 'dist' / '_headers').write_bytes((root.parent / 'public' / '_headers').read_bytes())
print(f"Verified and prepared {len(manifest['files'])} production assets.")
