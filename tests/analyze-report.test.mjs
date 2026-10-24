// Isolated unit tests execute the actual Edge handler; no external calls or credentials.
import { test,after } from 'node:test';
import assert from 'node:assert/strict';
let handler;
const originalDeno=globalThis.Deno,originalFetch=globalThis.fetch;
const reportId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env={SUPABASE_URL:'https://screening-unit.invalid',SUPABASE_ANON_KEY:'unit-public',SUPABASE_SERVICE_ROLE_KEY:'unit-server'};
globalThis.Deno={env:{get:name=>env[name]},serve:callback=>{handler=callback;}};
await import('../supabase/functions/analyze-report/index.ts');
after(()=>{globalThis.Deno=originalDeno;globalThis.fetch=originalFetch;});
function transport({owner='resident',flags=[]}={}) {
  const writes=[];
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(input),method=options.method || 'GET';
    if(url.hostname==='provider-unit.invalid')return Response.json({choices:[{message:{content:JSON.stringify({flags})}}]});
    if(url.pathname==='/auth/v1/user')return Response.json({id:'resident'});
    if(url.pathname==='/rest/v1/reports')return Response.json([{id:reportId,reporter_id:owner,title:'Coastal concern',description:'Debris needs review.',status:'pending_review',is_public:false}]);
    if(method==='GET')return Response.json([]);
    writes.push({path:url.pathname,body:JSON.parse(options.body)});
    return method==='POST' && options.headers.Prefer==='return=representation' ? Response.json([{report_id:reportId,status:'pending'}]) : new Response(null,{status:204});
  };
  return writes;
}
const request=(auth=true)=>new Request('https://edge-unit.invalid/',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer unit-session'}:{})},body:JSON.stringify({reportId})});
test('screening requires a signed-in request and refuses another resident report',async()=>{
  transport();assert.equal((await handler(request(false))).status,401);
  transport({owner:'another-resident'});assert.equal((await handler(request())).status,404);
});
test('unconfigured screening records unavailable, never a successful finding',async()=>{
  const writes=transport();
  assert.deepEqual(await (await handler(request())).json(),{status:'unavailable'});
  assert.equal(writes[0].body.status,'unavailable');
});
test('configured screening stores advisory flags and invalid provider results fail',async()=>{
  Object.assign(env,{AI_API_URL:'https://provider-unit.invalid/',AI_API_KEY:'unit-provider',AI_MODEL:'unit-model'});
  const writes=transport({flags:[{type:'spam',confidence:.8,explanation:'Repeated promotional text.'}]});
  assert.deepEqual(await (await handler(request())).json(),{status:'completed',flagCount:1});
  assert.equal(writes.find(write=>write.path.endsWith('/ai_review_flags')).body[0].flag_type,'spam');
  transport({flags:[{type:'spam',confidence:2,explanation:'Invalid result'}]});
  assert.deepEqual(await (await handler(request())).json(),{status:'failed'});
  delete env.AI_API_URL;delete env.AI_API_KEY;delete env.AI_MODEL;
});
