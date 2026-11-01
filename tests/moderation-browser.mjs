// Browser -> real local PostgreSQL RPC -> persisted report -> refreshed UI.
// All non-local requests are intercepted. No Supabase account or production row.
import {PGlite} from '@electric-sql/pglite';
import {chromium} from 'playwright-core';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),actor='33333333-3333-4333-8333-333333333333',resident='11111111-1111-4111-8111-111111111111';
const base='http://127.0.0.1:5186',provider=process.env.VITE_SUPABASE_URL||'https://qa-fixtures.supabase.co';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5186','--strictPort'],{windowsHide:true,stdio:'ignore'});
let browser,queue=Promise.resolve(),schemaError=false;
function serial(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p;}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public,storage to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;
 create function storage.foldername(text)returns text[] language sql as $$select string_to_array($1,'/')$$;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202609290001_initial_platform.sql',import.meta.url),'utf8'));
 const dir=new URL('../supabase/migrations/',import.meta.url),repair=(await readdir(dir)).find(n=>n.endsWith('_moderate_report_contract_repair.sql'));
 await db.exec(await readFile(new URL(repair,dir),'utf8'));
 await db.exec(`insert into auth.users(id)values('${resident}'),('${actor}');update profiles set role='moderator' where id='${actor}';select set_config('request.jwt.claim.sub','${resident}',false);set role authenticated`);
 const id=(await db.query(`insert into reports(title,description,category_slug,municipality)values('ISOLATED browser concern','Fictional database-backed browser test only.','environment','Guiuan')returning id`)).rows[0].id;
 await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)");
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await setTimeout(200)}if(!ready)throw Error('Preview unavailable');
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const user={id:actor,email:'moderator@example.invalid',role:'authenticated',aud:'authenticated',user_metadata:{},app_metadata:{provider:'email'}},exp=Math.floor(Date.now()/1000)+3600;
 const session={user,access_token:`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp})).toString('base64url')}.local-fixture`,refresh_token:'local-only',expires_at:exp,expires_in:3600,token_type:'bearer'};
 await context.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${new URL(provider).hostname.split('.')[0]}-auth-token`,session});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin===base)return route.continue();
  if(url.hostname.endsWith('.supabase.co')){
   let data=[];
   if(url.pathname.endsWith('/moderate_report')){
    if(schemaError)return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'PGRST202',message:'Could not find function'})});
    const args=req.postDataJSON();try{await serial(async()=>{await db.exec(`select set_config('request.jwt.claim.sub','${actor}',false);set role authenticated`);try{await db.query('select public.moderate_report($1,$2::public.report_status,$3::public.report_priority,$4,$5)',[args.target_report_id,args.next_status,args.next_priority,args.internal_note,args.resident_note]);}finally{await db.exec("reset role;select set_config('request.jwt.claim.sub','',false)");}});data=null;}catch(error){return route.fulfill({status:error.code==='42501'?403:400,contentType:'application/json',body:JSON.stringify({code:error.code,message:error.message})});}
   }else if(url.pathname.endsWith('/reports'))data=await serial(async()=>{const rows=(await db.query('select * from reports')).rows;return url.searchParams.has('is_public')?rows.filter(r=>r.is_public):rows;});
   else if(url.pathname.endsWith('/profiles')){const profiles=await serial(async()=>(await db.query('select * from profiles')).rows);data=url.searchParams.has('id')?profiles.find(p=>p.id===actor):profiles;}
   else if(url.pathname.endsWith('/report_categories'))data=await serial(async()=>(await db.query('select * from report_categories')).rows);
   else if(url.pathname.endsWith('/user'))data=user;
   else if(url.pathname.endsWith('/token'))data=session;
   else if(url.pathname.endsWith('/my_reports'))data=[];
   else if(url.pathname.endsWith('/platform_statistics'))data=[{total_reports:1}];
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  if(url.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  return route.abort();
 });
 await page.goto(base+'/operations/');await page.locator('.ops-nav').waitFor();await page.locator('.ops-nav nav button').nth(2).click();await page.locator('.review-table').waitFor();await page.locator('.review-report-title').click();
 const dialog=page.locator('.review-modal');await dialog.locator('form select').first().selectOption('verified');await dialog.locator('form select').nth(1).selectOption('urgent');await dialog.locator('textarea').first().fill('Resident-facing fixture update');await dialog.locator('textarea').last().fill('Private fixture investigation');
 schemaError=true;await dialog.locator('button[type=submit]').click();await page.getByText('Moderation needs a database update. No changes were saved. Contact the platform administrator.',{exact:true}).waitFor();assert.ok(await dialog.isVisible());
 schemaError=false;await serial(()=>db.exec(`update profiles set role='resident' where id='${actor}'`));await dialog.locator('button[type=submit]').click();await page.getByText('Moderator access is required',{exact:true}).waitFor();assert.ok(await dialog.isVisible());
 assert.equal((await serial(()=>db.query('select status from reports where id=$1',[id]))).rows[0].status,'pending_review');
 await serial(()=>db.exec(`update profiles set role='moderator' where id='${actor}'`));await dialog.locator('button[type=submit]').click();await dialog.waitFor({state:'detached'});await page.locator('.review-table').getByText('Verified',{exact:true}).waitFor();
 const row=(await serial(()=>db.query('select * from reports where id=$1',[id]))).rows[0];assert.equal(row.status,'verified');assert.equal(row.priority,'urgent');assert.equal(row.is_public,true);assert.equal(row.decision_note,'Resident-facing fixture update');assert.equal((await serial(()=>db.query('select note from moderator_notes where report_id=$1',[id]))).rows[0].note,'Private fixture investigation');assert.equal((await serial(()=>db.query('select count(*)::int n from platform_audit where record_id=$1',[id]))).rows[0].n,1);
 await page.reload();await page.locator('.ops-nav').waitFor();await page.locator('.ops-nav nav button').nth(2).click();await page.locator('.review-table').getByText('Verified',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 await mkdir('test-results.local/moderation',{recursive:true});await page.screenshot({path:'test-results.local/moderation/persisted-review.png',fullPage:true});await writeFile('test-results.local/moderation/browser.json',JSON.stringify({schemaErrorVisible:true,revokedModeratorDenied:true,successPersisted:true,priority:'urgent',notesSeparated:true,publication:true,auditCount:1,afterReload:true,pageErrors:errors},null,2));console.log('PASS database-backed moderation UI: missing schema error, revoked authorization, persisted verification/priority/notes/audit and reload.');
}finally{await browser?.close();server.kill();await db.close();}
