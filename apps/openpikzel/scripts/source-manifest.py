from pathlib import Path
import json,sys
root=Path(__file__).resolve().parents[1]
roots=['src','tests','supabase/migrations','scripts']
paths=[p for d in roots for p in (root/d).rglob('*') if p.is_file()]
paths += [root/n for n in ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','playwright.config.ts','vitest.config.ts','.gitignore','.env.example','README.md','VALIDATION.md','PRODUCT.md','DESIGN.md','INSTALLATIONS.md','skills-lock.json','MCP.md','RELEASE.md'] if (root/n).exists()]
files=[{'file':str(p.relative_to(root)),'data':p.read_text(),'encoding':'utf-8'} for p in sorted(paths)]
if len(sys.argv)>1:
 files=[f for i,f in enumerate(files) if i%4==int(sys.argv[1])]
print(json.dumps(files))
