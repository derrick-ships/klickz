from pathlib import Path
from zipfile import ZipFile,ZipInfo,ZIP_DEFLATED
import hashlib,json
root=Path(__file__).resolve().parents[1]
names=['core.mjs','server.mjs','login.mjs','index.html','ui.js','README.md','Start OpenPikzels.command','start-linux.sh','login-claude.command','login-codex.command']
destination=root/'public/downloads/openpikzels-local-companion.zip'
destination.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(destination,'w',ZIP_DEFLATED) as archive:
 for name in names:
  source=root/'local-companion'/name
  info=ZipInfo('openpikzels-local-companion/'+name,(2026,11,7,0,0,0))
  info.compress_type=ZIP_DEFLATED
  info.external_attr=((0o100755 if name.endswith(('.command','.sh')) else 0o100644)<<16)
  archive.writestr(info,source.read_bytes())
print(json.dumps({'archive':str(destination.relative_to(root)),'files':len(names),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}))
