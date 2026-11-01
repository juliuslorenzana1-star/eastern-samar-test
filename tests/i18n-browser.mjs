// Every non-local request is fulfilled/blocked; no production or provider writes.
import { chromium } from 'playwright-core';
import { loadEnv } from 'vite';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.UI_TEST_URL||'http://127.0.0.1:5183/';
const env=loadEnv('development',process.cwd(),'VITE_');
const storageKey=`sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const id='aa111111-1111-4111-8111-111111111111';
const report={id:'bb111111-1111-4111-8111-111111111111',title:'Report a Concern',description:'Location — original resident content',category_slug:'environment',municipality:'Borongan City',barangay:'Home',latitude:11.608,longitude:125.43,priority:'normal',status:'verified',is_public:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
const categories=[{slug:'environment',name:'Environment'},{slug:'infrastructure',name:'Infrastructure'}];
const opportunity={id:'cc111111-1111-4111-8111-111111111111',title:'Map',description:'Original organizer description',municipality:'Borongan City',barangay:'Home',category:'environment',status:'published',registration_open:true,capacity:5,skills:['First Aid','Map'],tasks:['Location'],what_to_bring:['Home'],starts_at:new Date(Date.now()+7*86400000).toISOString()};
const user={id,email:'local@example.invalid',role:'authenticated',aud:'authenticated',user_metadata:{},app_metadata:{provider:'email'}};
const exp=Math.floor(Date.now()/1000)+3600;
const session={user,access_token:`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.local-fixture`,refresh_token:'local-only',expires_at:exp,expires_in:3600,token_type:'bearer'};
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
await mkdir('test-results.local/i18n',{recursive:true});
const results=[];
async function pageFor(width,{signedIn=false,staff=false}={}){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
  const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({storageKey,session,signedIn})=>{localStorage.setItem('escam.theme-mode','light');if(signedIn)localStorage.setItem(storageKey,JSON.stringify(session));},{storageKey,session,signedIn});
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===new URL(base).origin)return route.continue();
    if(url.hostname.endsWith('.supabase.co')){
      let data=[];
      if(url.pathname.endsWith('/profiles')){const profile={id,display_name:'Location',role:staff?'admin':'resident'};data=url.searchParams.has('id')?profile:[profile];}
      else if(url.pathname.endsWith('/report_categories'))data=categories;
      else if(url.pathname.endsWith('/reports')){if(request.method()==='POST'){writes.push(request.postDataJSON());data={...report,...request.postDataJSON(),status:'pending_review',is_public:false};}else data=[report];}
      else if(url.pathname.endsWith('/my_reports'))data=[{...report,is_public:false,status:'pending_review',reporter_id:id}];
      else if(url.pathname.endsWith('/user'))data=user;
      else if(url.pathname.endsWith('/volunteer_opportunities'))data=[opportunity];
      else if(url.pathname.endsWith('/join_volunteer_opportunity')){writes.push({join:request.postDataJSON()});data='dd111111-1111-4111-8111-111111111111';}
      else if(url.pathname.endsWith('/moderate_report')){writes.push({review:request.postDataJSON()});data=null;}
      else if(url.pathname.endsWith('/token')){writes.push({auth:true});data=session;}
      else if(url.pathname.includes('/functions/'))data={skipped:true};
      else if(url.pathname.endsWith('/platform_statistics'))data=[{total_reports:1,verified_reports:1}];
      return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    }
    if(url.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
    return route.abort();
  });
  await page.goto(base);await page.locator('.leaflet-map').waitFor();
  return {page,context,errors,writes};
}
async function language(page,code,scope=page.locator('.topbar')){
  const settings=scope.locator('.report-language-settings');
  if(await settings.count())await settings.evaluate(node=>{node.open=true;});
  await scope.locator('.language-selector select').selectOption(code);
  await page.waitForFunction(code=>document.documentElement.lang===code,code);
  if(await settings.count())await settings.evaluate(node=>{node.open=false;});
}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');}
try{
  for(const width of [320,390,768,1440]){
    const {page,context,errors}=await pageFor(width);
    await page.evaluate(()=>{window.languageSentinel=123;});
    for(const code of ['fil','war','en']){
      await language(page,code);await fits(page);
      assert.equal(await page.evaluate(()=>window.languageSentinel),123);
      assert.equal(await page.evaluate(()=>localStorage.getItem('escam.language')),code);
      assert.equal(await page.locator('.report-title').first().textContent(),'Report a Concern');
      if(code==='war')assert.match(await page.locator('.heading-copy h1').textContent(),/Maupay nga pag-abot/);
      await page.screenshot({path:`test-results.local/i18n/home-${code}-${width}.png`,fullPage:true});
    }
    await language(page,'war');await page.reload();await page.locator('.leaflet-map').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),'war');
    await page.locator('.header-profile').click();await page.locator('.resident-profile').waitFor();
    assert.equal(await page.locator('.resident-profile .language-selector select').inputValue(),'war');await fits(page);
    assert.deepEqual(errors,[]);results.push({width,languages:['en','fil','war'],persisted:true,contentPreserved:true,overflow:false});await context.close();
  }
  // Switch inside an open account dialog without clearing credentials, then log in.
  {
    const {page,context,errors}=await pageFor(390);
    await page.locator('.header-profile').click();await page.locator('.resident-profile .primary-button').click();
    const dialog=page.locator('.auth-modal');await dialog.locator('input[type=email]').fill('local@example.invalid');await dialog.locator('input[type=password]').fill('local-password');
    await language(page,'war',dialog);assert.equal(await dialog.locator('input[type=email]').inputValue(),'local@example.invalid');assert.equal(await dialog.locator('input[type=password]').inputValue(),'local-password');
    await dialog.locator('input[type=email]').fill('invalid-email');await dialog.locator('button[type=submit]').click();
    assert.equal(await dialog.locator('input[type=email]').evaluate(el=>el.validationMessage),'Ibutang an husto nga baton dinhi.');
    await dialog.locator('input[type=email]').fill('local@example.invalid');
    await dialog.locator('button[type=submit]').click();await dialog.waitFor({state:'detached'});
    await page.waitForFunction(()=>document.querySelector('.resident-profile h1')?.textContent==='Location');
    assert.ok(await page.evaluate(key=>Boolean(localStorage.getItem(key)),storageKey));assert.deepEqual(errors,[]);results.push({auth:true,credentialsPreserved:true});await context.close();
  }
  {
    const {page,context,errors,writes}=await pageFor(390,{signedIn:true});
    await page.locator('.mobile-bottom-nav button').nth(3).click();await page.locator('.volunteer-opportunity').waitFor();
    for(const code of ['war','fil','en']){await language(page,code);assert.equal(await page.locator('.volunteer-opportunity h2').textContent(),'Map');await fits(page);}
    await language(page,'war');
    await page.locator('.volunteer-filters select').last().selectOption('First Aid');assert.equal(await page.locator('.volunteer-opportunity').count(),1);
    await page.locator('.volunteer-card-actions .outline-button').click();const dialog=page.locator('.volunteer-modal');
    assert.equal(await dialog.locator('.volunteer-skill-list span').last().textContent(),'Map');
    assert.ok((await dialog.locator('.volunteer-detail-content').textContent()).includes('Home'));
    await dialog.locator('.volunteer-modal-actions .primary-button').click();await dialog.locator('input[type=checkbox]').check();
    await language(page,'fil',dialog);assert.equal(await dialog.locator('input[type=checkbox]').isChecked(),true);
    await dialog.locator('.volunteer-modal-actions .primary-button').click();await dialog.locator('.volunteer-success-content').waitFor();
    assert.equal(writes.find(item=>item.join).join.p_opportunity_id,opportunity.id);assert.deepEqual(errors,[]);results.push({volunteer:true,languages:['en','fil','war'],consentPreserved:true});await context.close();
  }
  // Actual report payload stays in the database's identifiers and original prose.
  {
    const {page,context,errors,writes}=await pageFor(390,{signedIn:true});
    await page.locator('.hero-actions .primary-button').click();const dialog=page.locator('.report-modal').filter({has:page.locator('#report-form-title')});
    await dialog.locator('input[name=title]').fill('Original resident title');await dialog.locator('textarea[name=description]').fill('Original resident description stays exactly as entered.');
    await language(page,'war',dialog);
    assert.equal(await dialog.locator('input[name=title]').inputValue(),'Original resident title');
    await dialog.locator('button[type=button]').filter({hasText:'Sunod'}).click();
    await dialog.locator('select[name=municipality]').selectOption('Borongan City');await dialog.locator('input[name=barangay]').fill('Home');
    await language(page,'fil',dialog);assert.equal(await dialog.locator('select[name=municipality]').inputValue(),'Borongan City');
    await dialog.getByRole('button',{name:'Susunod →',exact:true}).click();await dialog.locator('button[type=submit]').click();
    await page.locator('.receipt-dialog').waitFor();assert.equal(writes[0].title,'Original resident title');assert.equal(writes[0].barangay,'Home');assert.equal(writes[0].priority,'normal');assert.equal(writes[0].category_slug,'environment');assert.deepEqual(errors,[]);results.push({report:true,identifiersPreserved:true,formPreserved:true});await context.close();
  }
  {
    const {page,context,errors,writes}=await pageFor(1440,{signedIn:true,staff:true});
    await page.goto(new URL('operations/',base).href);await page.locator('.ops-nav').waitFor();
    for(const code of ['war','fil','en']){await language(page,code,page.locator('.ops-header'));await page.locator('.ops-nav nav button').nth(2).click();await page.locator('.review-table').waitFor();assert.equal(await page.locator('.review-table tbody tr').count(),1);await fits(page);}
    await page.locator('.review-report-title').click();const review=page.locator('.review-modal');
    await review.locator('textarea').first().fill('Original reporter note');
    await review.locator('textarea').last().fill('Original private moderator note');
    await language(page,'war',review);assert.equal(await review.locator('textarea').last().inputValue(),'Original private moderator note');
    await review.locator('form select').first().selectOption('verified');await review.locator('button[type=submit]').click();await review.waitFor({state:'detached'});
    const payload=writes.find(item=>item.review).review;assert.equal(payload.next_status,'verified');assert.equal(payload.internal_note,'Original private moderator note');assert.equal(payload.resident_note,'Original reporter note');
    assert.deepEqual(errors,[]);results.push({moderation:true,languages:['en','fil','war'],reviewPreserved:true});await context.close();
  }
  await writeFile('test-results.local/i18n/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
