// Browser fixtures are intercepted locally. No production sign-in or writes.
import { chromium } from 'playwright-core';
import { loadEnv } from 'vite';
import assert from 'node:assert/strict';
import { CATEGORY_LABELS } from '../src/lib/categories.js';
import { mkdir } from 'node:fs/promises';
const env=loadEnv('development',process.cwd(),'VITE_');
const base=process.env.UI_TEST_URL || 'http://localhost:5178/';
const storageKey=`sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const id='aa111111-1111-4111-8111-111111111111';
const user={id,email:'recognition-fixture@example.invalid',aud:'authenticated',role:'authenticated',user_metadata:{},app_metadata:{provider:'email'}};
const exp=Math.floor(Date.now()/1000)+3600;
const token=`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.local-only`;
const session={user,access_token:token,refresh_token:'local-only',token_type:'bearer',expires_at:exp,expires_in:3600};
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
await mkdir('test-results.local',{recursive:true});
async function fixture(width,height,theme,{signedIn=false,empty=false,fail=false}={}) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<=900,isMobile:width<=900});
  page.setDefaultTimeout(10000);
  const errors=[],requests=[];let broken=fail,visible=false,alias='River helper';
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({theme,storageKey,session,signedIn})=>{localStorage.setItem('escam.theme-mode',theme);sessionStorage.setItem('escam.intro-seen.v1','1');if(signedIn)localStorage.setItem(storageKey,JSON.stringify(session));},{theme,storageKey,session,signedIn});
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://*.supabase.co/**',async route=>{
    const req=route.request(),url=new URL(req.url());requests.push({path:url.pathname,method:req.method()});let data=[];
    if(url.pathname.endsWith('/get_community_recognition')) {
      if(broken){broken=false;return route.fulfill({status:503,json:{message:'Test service temporarily unavailable'}});}
      data=empty?[]:[{rank:1,public_alias:'Coastal helper',verified_hours:40,completed_activities:5,badges:['first-community-action','dedicated-volunteer']},{rank:1,public_alias:'River helper',verified_hours:40,completed_activities:5,badges:['active-volunteer']}];
    } else if(url.pathname.endsWith('/get_my_recognition')) data={verified_hours:40,completed_activities:5,rank:visible?1:null,public_alias:alias,show_on_leaderboard:visible,badges:['first-community-action','active-volunteer'],history:[{id:'record-one',title:'Verified coastal cleanup',municipality:'Guiuan',status:'completed',hours:8,completed_at:'2026-10-20T08:00:00Z'}]};
    else if(url.pathname.endsWith('/profiles')) {
      if(req.method()==='PATCH'){const body=req.postDataJSON();assert.equal(url.searchParams.get('id'),`eq.${id}`);visible=body.show_on_leaderboard;if(body.public_alias)alias=body.public_alias;data={id};}
      else data={id,display_name:'PRIVATE legal name',role:'resident',show_on_leaderboard:visible};
    } else if(url.pathname.endsWith('/report_categories')) data=Object.keys(CATEGORY_LABELS).map(slug=>({slug,name:slug,active:true}));
    else if(url.pathname.endsWith('/user'))data=user;
    else if(url.pathname.endsWith('/token'))data=session;
    assert.ok(req.method()==='GET'||url.pathname.includes('/rpc/')||url.pathname.endsWith('/profiles')&&req.method()==='PATCH'||url.pathname.endsWith('/logout')&&req.method()==='POST','Unexpected fixture mutation');
    await route.fulfill({status:200,json:data});
  });
  return {page,errors,requests};
}
const noOverflow=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
try {
  for(const [width,height] of [[320,640],[375,812],[390,844],[430,932],[768,1024],[1440,1000]]) for(const theme of ['light','dark']) {
    const {page,errors,requests}=await fixture(width,height,theme);
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.leaflet-map').waitFor();await page.waitForFunction(()=>document.querySelector('.report-list .empty-state strong')?.textContent==='No reports yet');
    await noOverflow(page);
    if(width<=900) {
      const map=await page.locator('.map-stage').boundingBox();assert.ok(map.y<540,'Map preview follows the compact mobile introduction');assert.ok(map.height>=280);
      await page.getByRole('button',{name:/^Filters/}).click();
      const sheet=page.getByRole('dialog',{name:'Filter community map',exact:true});await sheet.waitFor();
      for(const label of Object.values(CATEGORY_LABELS)) {
        const button=sheet.getByRole('button',{name:new RegExp(label)});await button.scrollIntoViewIfNeeded();assert.ok(await button.isVisible());
        assert.ok(await button.locator('span').evaluate(el=>getComputedStyle(el).textOverflow!=='ellipsis'));
      }
      await sheet.getByRole('combobox',{name:'Municipality',exact:true}).selectOption('Guiuan');
      await sheet.getByRole('button',{name:/Disaster and Emergency/}).click();await sheet.getByRole('button',{name:'Apply filters',exact:true}).click();
      assert.match(await page.locator('.map-location-copy').innerText(),/Guiuan/);
      await page.getByRole('button',{name:/^Filters/}).click();await sheet.getByRole('button',{name:'Clear filters',exact:true}).click();await sheet.getByRole('button',{name:'Apply filters',exact:true}).click();
      assert.ok(await page.locator('.map-stage').evaluate(el=>el.classList.contains('is-touch-active')));await page.getByRole('button',{name:'Done moving',exact:true}).click();await page.getByRole('button',{name:'Move map',exact:true}).click();
    } else {
      assert.equal(await page.locator('select[aria-label="Map category"] option').count(),11);
      await page.getByRole('combobox',{name:'Map category',exact:true}).selectOption('disaster-emergency');
      await page.getByRole('combobox',{name:'Map category',exact:true}).selectOption('all');
    }
    if(width===320||width===768)await page.screenshot({path:`test-results.local/focused-map-${width}-${theme}.png`});
    await page.goto(new URL('#recognition',base).href,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Estehanon Community Leaders',exact:true}).waitFor();await page.locator('.recognition-ranking > li').first().waitFor();
    assert.equal(await page.locator('.recognition-rank').allTextContents().then(x=>x.join(',')),'#1,#1');
    assert.equal(await page.getByText('PRIVATE legal name',{exact:true}).count(),0);
    assert.equal(requests.some(req=>req.path.endsWith('/get_my_recognition')),false);
    await noOverflow(page);if(width===320)await page.screenshot({path:`test-results.local/focused-recognition-${theme}.png`,fullPage:true});
    await page.getByRole('button',{name:'Back to volunteer opportunities',exact:true}).click();await page.locator('.recognition-link').click();await page.locator('.recognition-ranking').waitFor();
    assert.deepEqual(errors,[]);console.log(`PASS map filters and public recognition ${width} ${theme}`);await page.close();
  }
  for(const state of ['empty','error','personal']) {
    const {page,errors}=await fixture(375,812,'dark',{empty:state==='empty',fail:state==='error',signedIn:state==='personal'});
    await page.goto(new URL('#recognition',base).href,{waitUntil:'domcontentloaded'});
    if(state==='empty')await page.getByRole('heading',{name:'Every contribution starts somewhere.',exact:true}).waitFor();
    if(state==='error'){await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.recognition-ranking').waitFor();}
    if(state==='personal') {
      await page.getByRole('heading',{name:'My contribution',exact:true}).waitFor();await page.getByText('Verified coastal cleanup',{exact:true}).waitFor();
      await page.getByRole('textbox',{name:'Public alias',exact:true}).fill('Private volunteer alias');
      await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Save privacy settings',exact:true}).click();await page.getByText('Your recognition privacy settings were saved.',{exact:true}).waitFor();
      await page.getByRole('checkbox').uncheck();await page.getByRole('button',{name:'Save privacy settings',exact:true}).click();await page.getByText('Private / unranked',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Open profile',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByText('You have signed out.',{exact:true}).waitFor();await page.goto(new URL('#recognition',base).href,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Sign in to view my contribution',exact:true}).waitFor();assert.equal(await page.getByText('Verified coastal cleanup',{exact:true}).count(),0);
    }
    await noOverflow(page);assert.deepEqual(errors,[]);console.log(`PASS recognition ${state}`);await page.close();
  }
}finally{await browser.close();}
