import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const base = process.env.POST_TEST_BASE || 'http://127.0.0.1:8788';
const origin = 'https://emanon4.github.io';
const dir = 'output/post-online-2026-09-22';
await mkdir(dir, {recursive:true});
const prefix = base.startsWith('https:') ? 'remote' : 'local';
const checks = [];
async function request(path, {method='GET', body, token, requestOrigin=origin}={}) {
  const response=await fetch(base+'/api'+path, {method,headers:{Origin:requestOrigin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body!==undefined?JSON.stringify(body):undefined});
  const data=await response.json();
  return {status:response.status,data,headers:response.headers};
}
function check(name, actual, expected) { assert.deepEqual(actual,expected,name); checks.push(name); }
if (process.argv.includes('--resume')) {
  const accounts=JSON.parse(await readFile(`${dir}/${prefix}-accounts.private.json`,'utf8'));
  for(const person of accounts.slice(0,2)) {
    const login=await request('/login',{method:'POST',body:{handle:person.handle,password:person.password}});
    check(`${person.handle} persisted login`,login.status,200);
    const inbox=await request('/letters',{token:login.data.session.token});
    check(`${person.handle} persisted inbox`,inbox.data.letters.length,1);
  }
} else {
  check('database health',(await request('/health')).data.storage,'cloudflare-d1');
  const preflight=await fetch(base+'/api/register',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
  check('Pages CORS',preflight.headers.get('access-control-allow-origin'),origin);
  check('untrusted origin blocked',(await request('/me',{requestOrigin:'https://untrusted.test'})).status,403);
  check('anonymous inbox blocked',(await request('/letters')).status,401);
  const suffix=Date.now().toString(36);
  const accounts=[];
  for(const role of ['writer','reader','third']) {
    const person={handle:`qa_${role}_${suffix}`,name:`验收${role}`,password:randomBytes(18).toString('base64url'),timezone:'Asia/Taipei'};
    const result=await request('/register',{method:'POST',body:person});
    check(`${role} registration`,result.status,200);
    check(`${role} bearer session`,Boolean(result.data.session?.token),true);
    accounts.push({...person,token:result.data.session.token,id:result.data.user.id});
  }
  const [writer,reader,third]=accounts;
  const settings=(account,dailyLimit,minHours)=>request('/settings',{method:'PATCH',token:account.token,body:{dailyLimit,minHours,acceptMail:true}});
  const payload=(nonce=randomUUID())=>({nonce,to:reader.handle,title:'远方的问候',hours:0,paperId:'postcard-kyoto',stampId:'dunhuang',model:{kind:'letter',paperFormat:'postcard',layoutId:'compact',lines:[{cursor:2,glyphs:[{id:'a',character:'见',x:0,units:1,seed:483},{id:'b',character:'信',x:1,units:1,seed:749}]}]}});
  const same=payload();
  const retries=await Promise.all(Array.from({length:4},()=>request('/letters',{method:'POST',token:writer.token,body:same})));
  check('one insert across concurrent retries',retries.filter(r=>r.status===201).length,1);
  check('retries return same letter',new Set(retries.map(r=>r.data.letter?.id)).size,1);
  const delayed=retries[0].data.letter;
  check('recipient minimum 24 hours',delayed.deliverAt-delayed.createdAt,86400000);
  check('delayed letter hidden',(await request(`/letters/${delayed.id}`,{token:reader.token})).status,404);
  check('third account isolated',(await request(`/letters/${delayed.id}`,{token:third.token})).status,404);
  check('changed retry rejected',(await request('/letters',{method:'POST',token:writer.token,body:{...same,title:'altered'}})).status,409);
  await settings(reader,3,0); await settings(writer,2,0);
  const burst=await Promise.all(Array.from({length:5},()=>request('/letters',{method:'POST',token:writer.token,body:payload()})));
  check('parallel quota inserts exactly one',burst.filter(r=>r.status===201).length,1);
  check('parallel quota rejects the rest',burst.filter(r=>r.status===429).length,4);
  const incoming=(await request('/letters',{token:reader.token})).data.letters;
  check('reader receives one immediate letter',incoming.length,1);
  const opened=await request(`/letters/${incoming[0].id}/open`,{method:'POST',body:{},token:reader.token});
  check('saved ink survives delivery',opened.data.letter.model.lines[0].glyphs[0].seed,483);
  check('postcard format survives delivery',opened.data.letter.model.paperFormat,'postcard');
  check('postcard art survives delivery',opened.data.letter.paperId,'postcard-kyoto');
  check('collectible stamp survives delivery',opened.data.letter.stampId,'dunhuang');
  check('recipient can open',opened.data.letter.opened,true);
  check('sender has no read receipt',(await request(`/letters/${incoming[0].id}`,{token:writer.token})).data.letter.opened,undefined);
  const reply=await request('/letters',{method:'POST',token:reader.token,body:{...payload(),to:writer.handle,title:'回信'}});
  check('reply delivered',reply.status,201);
  check('writer inbox',(await request('/letters',{token:writer.token})).data.letters.length,1);
  await request('/blocks',{method:'POST',token:reader.token,body:{address:writer.handle}});
  check('blocked sender cannot send',(await request('/letters',{method:'POST',token:writer.token,body:payload()})).status,404);
  await request('/blocks',{method:'DELETE',token:reader.token,body:{address:writer.handle}});
  await request('/logout',{method:'POST',body:{},token:writer.token});
  check('logout revokes bearer',(await request('/letters',{token:writer.token})).status,401);
  const login=await request('/login',{method:'POST',body:{handle:writer.handle,password:writer.password}});
  check('re-login works',login.status,200); writer.token=login.data.session.token;
  await writeFile(`${dir}/${prefix}-accounts.private.json`,JSON.stringify(accounts,null,2),{mode:0o600});
}
const report={base,at:new Date().toISOString(),checks};
await writeFile(`${dir}/${prefix}${process.argv.includes('--resume')?'-persistence':''}-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
