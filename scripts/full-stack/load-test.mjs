// Bounded protocol-level load test. Accepts only the owned loopback Docker stack.
// No hosted target option, production credentials, external map tiles or paid API.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import os from 'node:os';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {createClient} from '@supabase/supabase-js';
import {build} from 'vite';
import {credentials,sql,command,root} from './local-stack.mjs';
import anonymous from '../../api/anonymous.js';

const config=credentials();assert.equal(config.url,'http://127.0.0.1:54321');
assert.equal(process.env.GITHUB_REPOSITORY,'juliuslorenzana1-star/eastern-samar-test');
const base='http://127.0.0.1:5197';
Object.assign(process.env,{ANON_ENVIRONMENT:'isolated',ANON_REPORTING_ENABLED:'true',ANON_ALLOWED_ORIGIN:base,ANON_SOURCE_HMAC_KEY:randomBytes(32).toString('hex'),SUPABASE_URL:config.url,SUPABASE_SERVICE_ROLE_KEY:config.service,VITE_APP_ENVIRONMENT:'staging',VITE_STAGING_PROJECT_REF:'local-docker-proof',VITE_SUPABASE_URL:config.url,VITE_SUPABASE_PUBLISHABLE_KEY:config.anon,VITE_ENABLE_ANONYMOUS_REPORTING:'true',VITE_ENABLE_PERSONAL_DATA_COLLECTION:'true',VITE_ENABLE_AI_SCREENING:'false',VITE_ENABLE_EMAIL_NOTIFICATIONS:'false'});
const admin=createClient(config.url,config.service,{auth:{persistSession:false,autoRefreshToken:false}});
const result={kind:'isolated protocol-level concurrency test',date:new Date().toISOString(),commit:process.env.GITHUB_SHA,productionTouched:false,hostedSupabase:false,externalTilesRequested:false,fullBrowsers:false,limitations:['Load generator and target share one runner','Not a Vercel/CDN or hosted-plan capacity test','No external raster tiles or 1000 browser renderers','A bounded burst is not a sustained soak test'],machine:{cpus:os.cpus().length,totalMemoryGiB:Math.round(os.totalmem()/1073741824)},stages:[]};
const hash=x=>createHash('sha256').update(x).digest('hex');
const checked=async(p,label)=>{const r=await p;if(r.error)throw Error(label+' failed ('+(r.error.code||'provider_error')+')');return r.data;};
let server;const delay=monitorEventLoopDelay({resolution:20});delay.enable();
async function request(url,options={}){
  const u=new URL(url);if(!['127.0.0.1','localhost'].includes(u.hostname)||!['5197','54321'].includes(u.port))throw Error('Non-loopback load refused');
  const start=performance.now();try{const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});const bytes=await r.arrayBuffer();return {status:r.status,ms:performance.now()-start,bytes:bytes.byteLength};}catch{return {status:0,ms:performance.now()-start,bytes:0};}
}
const percentile=(a,p)=>a.length?Math.round([...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.ceil(a.length*p)-1)]):null;
const summarize=rows=>({requests:rows.length,statuses:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),p50ms:percentile(rows.map(r=>r.ms),.5),p95ms:percentile(rows.map(r=>r.ms),.95),p99ms:percentile(rows.map(r=>r.ms),.99),maxMs:Math.round(Math.max(...rows.map(r=>r.ms))),bytes:rows.reduce((a,r)=>a+r.bytes,0)});
async function browse(n,asset){
  const groups={html:[],asset:[],feed:[],categories:[],statistics:[]};let active=0,peak=0;const start=performance.now();let release;const barrier=new Promise(r=>release=r);
  const headers={apikey:config.anon,Authorization:'Bearer '+config.anon};
  const jobs=Array.from({length:n},async()=>{await barrier;active++;peak=Math.max(peak,active);try{const work=[['html',base+'/'],['asset',base+asset],['feed',config.url+'/rest/v1/public_report_feed?select=id,title,description,category_slug,municipality,barangay,latitude,longitude,priority,status,is_public,created_at&limit=100'],['categories',config.url+'/rest/v1/report_categories?select=slug,name,sort_order&active=eq.true'],['statistics',config.url+'/rest/v1/rpc/platform_statistics']];await Promise.all(work.map(async([name,url])=>{groups[name].push(await request(url,url.startsWith(config.url)?{headers}:{}));}));}finally{active--;}});
  release();await Promise.all(jobs);const elapsed=performance.now()-start;const all=Object.values(groups).flat();const failures=all.filter(r=>r.status!==200).length;
  const stage={users:n,peakActiveVirtualUsers:peak,seconds:Number((elapsed/1000).toFixed(2)),requestsPerSecond:Number((all.length/(elapsed/1000)).toFixed(1)),unexpectedFailures:failures,metrics:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,summarize(v)])),nodeRssMiB:Math.round(process.memoryUsage().rss/1048576),eventLoopP99ms:Math.round(delay.percentile(99)/1000000)};
  stage.stop=failures/all.length>.1||stage.nodeRssMiB>2000;return stage;
}
try{
  assert.equal(Number(sql('select count(*) from public.reports')),0,'Load test requires a fresh owned stack');
  const password=randomBytes(32).toString('base64url');const identity=await checked(admin.auth.admin.createUser({email:'isolated-load-moderator@example.invalid',password,email_confirm:true}),'Create fictional moderator');
  const uid=identity.user.id;assert.match(uid,/^[a-f0-9-]{36}$/);sql(`update public.profiles set role='moderator' where id='${uid}'`);
  const mod=createClient(config.url,config.anon,{auth:{persistSession:false,autoRefreshToken:false}});await checked(mod.auth.signInWithPassword({email:'isolated-load-moderator@example.invalid',password}),'Fictional login');
  for(let i=0;i<100;i++){
    const r=await checked(admin.rpc('submit_visitor_report',{payload:{title:'Fictional load concern '+i,description:'Non-personal isolated concern used only to measure browse performance.',category:'environment',municipality:'Guiuan',barangay:'',priority:'normal'},tracking_hash:hash('tracking'+i),source_hash:hash('source'+i),payload_hash:hash('payload'+i),has_photo:false}),'Seed isolated concern');
    await checked(mod.rpc('moderate_report',{target_report_id:r.id,next_status:'verified',next_priority:'normal',internal_note:'Isolated load fixture only',resident_note:'Fictional load fixture'}),'Publish isolated fixture');
  }
  result.fixtureReports=Number(sql('select count(*) from public.public_report_feed'));assert.equal(result.fixtureReports,100);
  await build({logLevel:'error'});const html=await readFile(resolve(root,'dist/index.html'),'utf8');const asset=/src="([^\"]+\.js)"/.exec(html)?.[1];assert.ok(asset);
  server=createServer(async(req,res)=>{if(new URL(req.url,base).pathname==='/api/anonymous')return anonymous(req,res);try{const pathname=new URL(req.url,base).pathname;const file=pathname==='/'?resolve(root,'dist/index.html'):resolve(root,'dist','.'+pathname);if(!file.startsWith(resolve(root,'dist')+'/')){res.writeHead(403);res.end();return;}const data=await readFile(file);res.setHeader('Content-Type',extname(file)==='.js'?'application/javascript':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(5197,'127.0.0.1',r));
  for(const n of [50,100,250,500,1000]){delay.reset();const stage=await browse(n,asset);result.stages.push(stage);console.log('LOAD_STAGE '+JSON.stringify(stage));if(stage.stop){result.stoppedForSafety=true;break;}await new Promise(r=>setTimeout(r,1000));}
  if(!result.stoppedForSafety){
    // All 1000 clients share loopback IP: this tests per-source abuse protection,
    // not throughput for 1000 independent real-world IP addresses.
    const before=Number(sql('select count(*) from public.reports'));const start=performance.now();
    const rows=await Promise.all(Array.from({length:1000},(_,i)=>request(base+'/api/anonymous',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Report-Operation':'submit'},body:JSON.stringify({trackingCredential:randomBytes(32).toString('base64url'),report:{title:'Fictional burst concern '+i,description:'Non-personal isolated rate-limit verification concern.',category:'environment',municipality:'Guiuan',barangay:'',priority:'normal'}})})));
    const created=Number(sql('select count(*) from public.reports'))-before;result.submissionBurst={users:1000,sharedSource:true,seconds:Number(((performance.now()-start)/1000).toFixed(2)),...summarize(rows),created,quotaEnforced:created<=5,unexpectedFailures:rows.filter(r=>![200,429].includes(r.status)).length};console.log('LOAD_SUBMISSION '+JSON.stringify(result.submissionBurst));
    assert.ok(result.submissionBurst.quotaEnforced);assert.equal(result.submissionBurst.unexpectedFailures,0);
  }
  const healthy=await request(config.url+'/rest/v1/public_report_feed?select=id&limit=1',{headers:{apikey:config.anon}});result.recovered=healthy.status===200;
  result.containers=command('docker',['stats','--no-stream','--format','{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}']).split('\n').filter(l=>l.includes('escam-local-proof'));
  result.reached1000=result.stages.some(s=>s.users===1000);result.cleanBrowseAt1000=result.stages.find(s=>s.users===1000)?.unexpectedFailures===0;
}catch(e){result.failure=String(e.message).replace(/[A-Za-z0-9_-]{32,}(?:\.[A-Za-z0-9_-]+)*/g,'[redacted]');process.exitCode=1;}
finally{delay.disable();if(server)await new Promise(r=>server.close(r));await mkdir('test-results.local/load',{recursive:true});await writeFile('test-results.local/load/results.json',JSON.stringify(result,null,2));console.log('LOAD_RESULT '+JSON.stringify(result));}
