const byId=id=>document.getElementById(id);
const fragment=location.hash.slice(1);
if(/^[a-f0-9]{64}$/.test(fragment)){sessionStorage.setItem('openpikzels.localSession',fragment);history.replaceState(null,'','/');}
const token=sessionStorage.getItem('openpikzels.localSession')||'';
const status=message=>{byId('status').textContent=message;};
async function api(path,body={}){if(!token)throw new Error('Open the companion with its Start OpenPikzels launcher to authorize this browser tab.');const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json','x-openpikzels-client':token},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not complete this action.');return data;}
let busy=false;
async function refresh(){try{const states=await api('/api/status');for(const provider of ['claude','codex']){const value=states[provider];byId(provider+'-state').textContent=value.installed?value.method:'Install the official CLI first';}}catch(error){status(error.message);}}
byId('refresh').onclick=refresh;
for(const button of document.querySelectorAll('[data-login]'))button.onclick=async()=>{try{status((await api('/api/login',{provider:button.dataset.login})).message);}catch(error){status(error.message);}};
byId('task-form').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;byId('run').disabled=true;byId('cancel').disabled=false;byId('result').hidden=true;status('Working in your official local CLI. You can cancel this task.');try{const result=await api('/api/run',{provider:byId('provider').value,task:byId('task').value,brief:byId('brief').value});byId('output').textContent=result.text;byId('result').hidden=false;byId('output').focus();status('Text task complete. No image API was called.');}catch(error){status(error.message);}finally{busy=false;byId('run').disabled=false;byId('cancel').disabled=true;}};
byId('cancel').onclick=async()=>{try{await api('/api/cancel');status('Cancellation requested. Check the official app before retrying an uncertain request.');}catch(error){status(error.message);}};
byId('copy').onclick=async()=>{try{await navigator.clipboard.writeText(byId('output').textContent);status('Result copied.');}catch{status('Select the result to copy it.');}};
refresh();
