"""Original, stdlib-only lab budget checker. Not the unavailable external script."""
import json,sys,statistics,math
from pathlib import Path
BUDGETS={"lcp_ms":2500,"cls":0.1,"inp_sample_ms":200,"feedback_max_ms":100,
         "script_bytes":300000,"css_bytes":100000,"image_bytes":500000,"total_bytes":1500000,"third_party":0}
def check(report):
 samples=report.get("samples",[])
 if len(samples)<3:raise ValueError("Need at least three actual samples")
 result={};failures=[]
 for key,limit in BUDGETS.items():
  values=[s.get(key) for s in samples]
  if any(not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) or v<0 for v in values):raise ValueError(f"Missing/invalid {key}")
  value=max(values) if key=="feedback_max_ms" else statistics.median(values)
  result[key]={"measured":round(value,3),"limit":limit,"pass":value<=limit}
  if value>limit:failures.append(key)
 return {"kind":"local controlled lab; not field p75", "samples":len(samples),"metrics":result,"pass":not failures}
if __name__=="__main__":
 try:
  result=check(json.loads(Path(sys.argv[1]).read_text()))
  print(json.dumps(result,indent=2));sys.exit(0 if result["pass"] else 1)
 except (ValueError,IndexError,KeyError,TypeError) as exc:
  print(json.dumps({"pass":False,"error":str(exc)}));sys.exit(1)
