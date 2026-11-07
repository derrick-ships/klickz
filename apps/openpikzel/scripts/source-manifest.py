from pathlib import Path
import json,sys,base64
root=Path(__file__).resolve().parents[1]
roots=['src','tests','supabase/migrations','scripts','public']
paths=[p for d in roots for p in (root/d).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc']
paths += [root/n for n in ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','playwright.config.ts','vitest.config.ts','.gitignore','.env.example','README.md','VALIDATION.md','PRODUCT.md','DESIGN.md','INSTALLATIONS.md','skills-lock.json','MCP.md','RELEASE.md','ASSETS.md','STUDY.md','UI_POLISH.md','PERFORMANCE.md','lighthouserc.cjs','evidence/performance-lab.json','evidence/performance-lighthouse-summary.json','assets/brand/manifest.json'] if (root/n).exists()]
files=[{'file':str(p.relative_to(root)),'data':base64.b64encode(p.read_bytes()).decode() if p.suffix in ['.webp','.webm','.mp4','.png','.jpg','.avif'] else p.read_text(),'encoding':'base64' if p.suffix in ['.webp','.webm','.mp4','.png','.jpg','.avif'] else 'utf-8'} for p in sorted(paths)]
if len(sys.argv)>1:
 files=[f for i,f in enumerate(files) if i%4==int(sys.argv[1])]
print(json.dumps(files))
