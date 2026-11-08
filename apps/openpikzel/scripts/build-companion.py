from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
import hashlib,json
root=Path(__file__).resolve().parents[1]
base=root/'local-companion'
names=sorted(p.name for p in base.iterdir() if p.is_file() and p.name not in ['visual-check.mjs','hardening-browser.mjs','native-check.mjs','source-manifest.json'] and not p.name.endswith('.test.mjs') and (p.suffix in ['.mjs','.js','.html','.md','.command','.sh','.json','.txt']))
destination=root/'public/downloads/openpikzels-local-companion.zip'
destination.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(destination,'w',ZIP_DEFLATED) as archive:
 for name in names:
  info=ZipInfo('openpikzels-local-companion/'+name,(2026,11,8,0,0,0))
  info.compress_type=ZIP_DEFLATED
  info.external_attr=((0o100755 if name.endswith(('.command','.sh')) else 0o100644)<<16)
  archive.writestr(info,(base/name).read_bytes())
print(json.dumps({'archive':str(destination.relative_to(root)),'files':len(names),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}))
