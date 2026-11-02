// Browser -> HTTP endpoint -> real isolated Postgres, with a local Storage adapter.
// No production/provider traffic. This is not a hosted Supabase certification.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer as createViteServer} from 'vite';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
import {visitorDatabase} from './support/visitor-database.mjs';
import {createVisitorHandler} from '../server/visitor-handler.mjs';

const ctx=await visitorDatabase();const {db,as,database,storage}=ctx;
const base='http://127.0.0.1:5195';
const handler=createVisitorHandler({env:{ANON_REPORTING_ENABLED:'true',ANON_ENVIRONMENT:'isolated',SUPABASE_URL:'http://127.0.0.1:54321',ANON_ALLOWED_ORIGIN:base,ANON_SOURCE_HMAC_KEY:'fictional-browser-test-hmac-secret-12345'},database,storage});
const api=createServer(handler);await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
Object.assign(process.env,{VITE_APP_ENVIRONMENT:'staging',VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_isolated_local_test',VITE_ENABLE_PERSONAL_DATA_COLLECTION:'true',VITE_ENABLE_ANONYMOUS_REPORTING:'true',VITE_ENABLE_AI_SCREENING:'false',VITE_ENABLE_EMAIL_NOTIFICATIONS:'false'});
const vite=await createViteServer({server:{host:'127.0.0.1',port:5195,strictPort:true,proxy:{'/api/anonymous':`http://127.0.0.1:${api.address().port}`}}});
await vite.listen();let browser;const results=[];
try{
  await mkdir('test-results.local/anonymous',{recursive:true});
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
  for(const [index,{width,language}] of [320,390,768,1440].flatMap(width=>['en','war'].map(language=>({width,language}))).entries()){
    // Reset attempt counters only in this isolated DB so viewport tests do not
    // consume each other's deliberate conservative source allowance.
    await db.exec('truncate private.visitor_attempts');
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    await context.addInitScript(language=>localStorage.setItem('escam.language',language),language);
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===base)return route.continue();
      if(url.origin==='http://127.0.0.1:54321'){
        // SDK reads query the same actual DB; no simulated submission transport.
        let data=[];
        if(url.pathname==='/rest/v1/report_categories')data=(await as('anon',null,'select * from report_categories where active order by sort_order')).rows;
        else if(url.pathname==='/rest/v1/public_report_feed')data=(await as('anon',null,'select * from public_report_feed order by created_at desc')).rows;
        else if(url.pathname==='/rest/v1/volunteer_opportunities')data=(await as('anon',null,'select id,title,status,municipality,starts_at from volunteer_opportunities')).rows;
        else if(url.pathname==='/rest/v1/rpc/platform_statistics')data=(await as('anon',null,'select * from platform_statistics()')).rows;
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      }
      return route.abort();
    });
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.locator('.topbar .language-selector select').selectOption(language);
    await page.waitForFunction(language=>document.documentElement.lang===language,language);
    await page.locator('.hero-actions .primary-button').click();
    const form=page.locator('.report-modal').filter({has:page.locator('#report-form-title')});await form.waitFor();
    const identity=form.locator('.report-identity select');assert.equal(await identity.inputValue(),'anonymous');
    assert.match(await identity.locator('option[value=anonymous]').innerText(),language==='war'?/Waray ngaran/:/Anonymous/);
    assert.equal(await form.locator('input[type=email],input[type=tel]').count(),0);
    // Confidential contact is optional; switching back erases it from the UI.
    await identity.selectOption('confidential');await form.locator('input[type=email]').fill('fictional@example.invalid');
    await identity.selectOption('anonymous');await identity.selectOption('confidential');assert.equal(await form.locator('input[type=email]').inputValue(),'');
    if(index%2===0)await identity.selectOption('anonymous');else await form.locator('input[type=email]').fill('fictional@example.invalid');
    await form.locator('input[name=title]').fill(`Fictional visitor concern ${index}`);
    await form.locator('textarea[name=description]').fill('Non-personal isolated browser concern, with a real persisted review lifecycle.');
    const photo=await sharp({create:{width:16,height:16,channels:3,background:'blue'}}).png().toBuffer();
    await form.locator('input[type=file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:photo});
    await form.locator('.modal-foot-actions .primary-button').click();
    await form.locator('select[name=municipality]').selectOption('Guiuan');
    if(index===0){
      await form.locator('.location-select-row button').click();
      const map=page.locator('.map-stage'),size=await map.boundingBox();
      await map.click({position:{x:Math.round(size.width/2),y:Math.round(size.height/2)}});
      await form.waitFor();
      assert.equal(await form.locator('input[type=file]').evaluate(el=>el.files[0].name),'sample.png');
      assert.equal(await identity.inputValue(),'anonymous');
    }
    await form.locator('.modal-foot-actions .primary-button').click();
    assert.ok(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
    await form.evaluate(el=>{el.scrollTop=0;});
    await page.screenshot({path:`test-results.local/anonymous/review-${width}-${language}.png`});
    await form.locator('.modal-foot-actions .primary-button').click();
    const receipt=page.locator('.receipt-dialog');
    try{await receipt.waitFor({timeout:10000});}catch(error){console.log({width,language,submissionError:await form.locator('.form-error').allTextContents()});throw error;}
    const credential=await receipt.locator('textarea').inputValue();assert.match(credential,/^[A-Za-z0-9_-]{43}$/);
    const id=(await receipt.locator('.receipt-reference').textContent()).trim();
    assert.equal((await db.query('select status from reports where id=$1',[id])).rows[0].status,'pending_review');
    assert.equal((await as('anon',null,'select id from reports where id=$1',[id])).rows.length,0);
    assert.equal((await db.query('select count(*)::int n from report_evidence where report_id=$1',[id])).rows[0].n,1);
    if(index===0)assert.equal((await db.query('select count(*)::int n from report_private_locations where report_id=$1',[id])).rows[0].n,1);
    const contact=(await db.query('select contact from private.visitor_reports where report_id=$1',[id])).rows[0].contact;
    assert.deepEqual(contact,index%2===0?{}:{email:'fictional@example.invalid'});
    // No account, private token or optional contact is persisted by the UI.
    const stored=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));assert.ok(!stored.includes(credential));assert.ok(!stored.includes('fictional@example.invalid'));
    await receipt.locator('.primary-button').click();
    const tracking=page.getByRole('dialog').filter({has:page.locator('#tracking-title')});await tracking.waitFor();
    await tracking.locator('input[type=password]').fill(credential);await tracking.locator('button.primary-button').click();
    await tracking.locator('section[aria-live=polite] h3').waitFor();
    if(index===0){
      await tracking.locator('input[type=password]').fill('A'.repeat(43));await tracking.locator('button.primary-button').click();
      await tracking.locator('[role=alert]').waitFor();assert.match(await tracking.locator('[role=alert]').innerText(),/No report matches/);
      const moderator='99999999-9999-4999-8999-999999999999';
      await db.exec(`insert into auth.users(id)values('${moderator}');update profiles set role='moderator' where id='${moderator}'`);
      await as('authenticated',moderator,"select moderate_report($1,'approved','normal','Private test note','Approved for this isolated test.')",[id]);
      await tracking.locator('.modal-head button').click();await page.reload();
      await page.locator('.report-title').filter({hasText:'Fictional visitor concern 0'}).first().waitFor({state:'attached'});
      assert.equal((await as('anon',null,'select id from public_report_feed where id=$1',[id])).rows.length,1);
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.deepEqual(errors,[]);
    results.push({width,language,anonymousDefault:true,databaseWrite:true,privatePhoto:true,contactIsOptional:true,statusRead:true,pageErrors:errors});
    await context.close();
  }
  assert.equal((await db.query("select count(*)::int n from auth.users where id<>'99999999-9999-4999-8999-999999999999'")).rows[0].n,0);
  await mkdir('test-results.local/anonymous',{recursive:true});await writeFile('test-results.local/anonymous/browser.json',JSON.stringify(results,null,2));
  console.log(`PASS anonymous database-backed browser workflows: ${results.length} viewport/language cases; no resident Auth accounts created; map publication checked with an isolated moderator fixture.`);
}finally{await browser?.close();await vite.close();await new Promise(resolve=>api.close(resolve));await db.close();}
