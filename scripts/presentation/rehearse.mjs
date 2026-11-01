import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { startDemo } from './demo.mjs';
import { DEMO_ORIGIN } from './fixtures.mjs';

const recording = process.argv.includes('--record');
const out = 'presentation-output.local'; await mkdir(out, { recursive: true });
const scenes = JSON.parse(await readFile(new URL('./storyboard.json', import.meta.url)));
const boundary = JSON.parse(await readFile('src/assets/eastern-samar-boundary.json', 'utf8'));
const rings = boundary.features.flatMap(feature => feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates.flat() : feature.geometry.coordinates);
const points = rings.flat(), xs = points.map(point => point[0]), ys = points.map(point => point[1]);
const minX = Math.min(...xs), maxY = Math.max(...ys), scale = 720 / (maxY - Math.min(...ys));
const path = rings.map(ring => ring.map(([x,y], i) => `${i ? 'L' : 'M'}${((x-minX)*scale).toFixed(1)},${((maxY-y)*scale).toFixed(1)}`).join(' ') + 'Z').join(' ');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#0b2635"/><path d="${path}" transform="translate(1350 145)" fill="#187f7d" stroke="#45b9ab" stroke-width="2"/><path d="M100 170H1180M100 890H1820" stroke="#3b6773"/><text x="100" y="125" fill="#67d6bf" font-family="Segoe UI,Arial" font-size="24" letter-spacing="6">EASTERN SAMAR · CIVIC PARTICIPATION</text><text x="100" y="390" fill="#f6f3eb" font-family="Georgia" font-size="86">Eastern Samar</text><text x="100" y="500" fill="#f6f3eb" font-family="Georgia" font-size="75">Community Action Map</text><text x="105" y="595" fill="#8fe0cf" font-family="Segoe UI,Arial" font-size="35">Bridging Citizen Voices and Collective Action</text><text x="105" y="745" fill="#f6f3eb" font-family="Segoe UI,Arial" font-size="26">eastern-samar-test.vercel.app</text><text x="105" y="950" fill="#bccfd1" font-family="Segoe UI,Arial" font-size="21">LOCAL REHEARSAL · FICTIONAL DEMONSTRATION DATA · NOT A GOVERNMENT ENDORSEMENT</text><text x="105" y="1000" fill="#91aeb6" font-family="Segoe UI,Arial" font-size="17">Boundary: geoBoundaries / NAMRIA, PSA, OCHA · CC BY 3.0 IGO · geographic reference only</text></svg>`;
await writeFile(`${out}/title-card.svg`, svg);
const demo = await startDemo({ headless: true, ...(recording ? { recordVideo: `${out}/source-footage` } : {}) });
const errors = []; demo.context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
const manifest = [];
async function label(page, scene) {
  await page.evaluate(scene => {
    document.getElementById('production-caption')?.remove();
    const el = document.createElement('div'); el.id = 'production-caption';
    el.style.cssText = 'position:fixed;left:24px;bottom:64px;z-index:99999;max-width:840px;background:#0b2635ef;color:#fff;padding:14px 22px;border-left:4px solid #48c5b0;font:22px system-ui;pointer-events:none';
    const h = document.createElement('strong'); h.style.fontSize='23px'; h.textContent=scene.heading;
    const p = document.createElement('div'); p.style.cssText='font-size:17px;color:#b3e8dc;margin-top:6px';p.textContent=scene.caption;el.append(h,p);document.body.append(el);
  }, scene);
}
async function role(page, value, route='/') { await page.evaluate(value => { localStorage.setItem('escam.demo.role', value); localStorage.setItem('escam.language','en'); },value); await page.goto(demo.origin+route); }
async function click(page, locator) { await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox(); if(box) await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:recording?18:1}); await locator.click(); if(recording) await page.waitForTimeout(650); }
async function card(page, text) { await page.evaluate(({ svg, text }) => {const el=document.createElement('div');el.id='film-card';el.style.cssText='position:fixed;inset:0;z-index:99998;background:#0b2635';el.innerHTML=svg;if(text){const h=document.createElement('div');h.textContent=text;h.style.cssText='position:absolute;left:106px;top:210px;color:#b2ded7;font:24px system-ui;letter-spacing:3px';el.append(h);}document.body.append(el);},{svg,text}); }
try {
  // Create a wholly original evidence graphic. It depicts no real incident or person.
  const evidencePage=await demo.context.newPage();await evidencePage.setContent('<body style="margin:0;background:#eaf3ee;font:32px system-ui;padding:80px;color:#0b2635"><h1>DEMONSTRATION EVIDENCE</h1><p>Fictional coastal litter report</p><p>This original graphic is for rehearsal only.</p><p>No real incident, person or photograph is depicted.</p>');await evidencePage.screenshot({path:`${out}/demo-evidence.png`});await evidencePage.close();
  for (let index=0; index<scenes.length; index++) {
    const scene=scenes[index], page=index===0?demo.page:await demo.context.newPage(); const started=Date.now();
    if(index>0) await page.goto(demo.origin);
    await page.locator('.topbar').waitFor();
    if(index===0) { await card(page,'EVERY COMMUNITY HAS A VOICE.'); await page.screenshot({path:`${out}/title-card.png`}); }
    if(index===1) { await label(page,scene); await page.locator('.leaflet-map').scrollIntoViewIfNeeded(); }
    if(index===2) {
      await click(page,page.locator('.hero-actions .primary-button'));const form=page.locator('.report-modal').filter({has:page.locator('#report-form-title')});
      await form.locator('input[name=title]').fill('[DEMO] Coastal litter needs community attention');await form.locator('select[name=category]').selectOption('environment');
      await form.locator('textarea[name=description]').fill('FICTIONAL REHEARSAL: Litter has gathered beside a sample coastal walkway in Borongan City. This example demonstrates a concern for human review; it does not describe a real incident.');
      await form.locator('input[type=file]').setInputFiles(`${out}/demo-evidence.png`);
      await click(page,form.getByRole('button',{name:'Next →',exact:true}));await form.locator('select[name=municipality]').selectOption('Borongan City');await form.locator('input[name=barangay]').fill('Demonstration area');
      await click(page,form.getByRole('button',{name:'Choose point',exact:true}));const map=page.locator('.leaflet-map:visible').last();await map.waitFor();const box=await map.boundingBox();await map.click({position:{x:box.width/2,y:box.height/2}});
      await form.waitFor();await click(page,form.getByRole('button',{name:'Next →',exact:true}));await label(page,scene);await click(page,form.locator('button[type=submit]'));await page.locator('.receipt-dialog').waitFor();
      assert.equal(demo.state.reports.length,1);assert.equal(demo.state.reports[0].is_public,false);assert.equal(demo.state.evidence.length,1);assert.ok(demo.state.locations.length);
      const publicBefore=await page.evaluate(async origin=>(await (await fetch(origin+'/rest/v1/reports?is_public=eq.true')).json()).length,DEMO_ORIGIN);assert.equal(publicBefore,0);
    }
    if(index===3) {
      await role(page,'moderator','/operations/');await page.locator('.ops-nav').waitFor();await click(page,page.locator('.ops-nav nav button').nth(2));await click(page,page.locator('.review-report-title'));
      const review=page.locator('.review-modal');await review.locator('textarea').first().fill('Demonstration review completed.');await review.locator('textarea').last().fill('Fictional evidence checked for this isolated walkthrough.');await review.locator('form select').first().selectOption('verified');await click(page,review.locator('button[type=submit]'));await review.waitFor({state:'detached'});assert.equal(demo.state.reports[0].status,'verified');
      await role(page,'guest');await page.locator('.report-title').waitFor();await click(page,page.locator('.report-title').first());await page.locator('.detail-card').first().waitFor();await label(page,scene);assert.equal(demo.state.reports[0].is_public,true);assert.equal(await page.locator('.report-progress ol li').count(),1);
    }
    if(index===4) {
      await role(page,'resident');await click(page,page.locator('.desktop-navigation button').nth(2));await page.locator('.volunteer-opportunity').waitFor();await click(page,page.locator('.volunteer-card-actions .outline-button').first());const modal=page.locator('.volunteer-modal');await click(page,modal.locator('.volunteer-modal-actions .primary-button'));await modal.locator('input[type=checkbox]').check();await click(page,modal.locator('.volunteer-modal-actions .primary-button'));await page.locator('.volunteer-success-content').waitFor();await label(page,scene);assert.equal(demo.state.registrations.length,1);
    }
    if(index===5) {
      for(const code of ['fil','war']) { await page.locator('.topbar .language-selector select').selectOption(code);await page.waitForFunction(code=>document.documentElement.lang===code,code);if(recording)await page.waitForTimeout(2200); }
      await label(page,scene);assert.equal(await page.locator('.report-title').first().textContent(),demo.state.reports[0].title);
    }
    if(index===6) await card(page,'AN IMO TINGOG IMPORTANTE.');
    await page.screenshot({path:`${out}/${scene.id}.png`});
    if(recording) await page.waitForTimeout(Math.max(500,scene.duration*1000+1500-(Date.now()-started)));
    const video=recording?await page.video().path():null;manifest.push({...scene,video});await page.close();
    console.log(`PASS ${scene.id}: ${recording?'recorded':'rehearsed'}`);
  }
  assert.deepEqual(errors,[]);assert.ok(!demo.state.writes.some(write=>write.path.startsWith('/functions/')));
  await writeFile(`${out}/manifest.json`,JSON.stringify({recording,localBuild:true,fictional:true,productionMatched:false,scenes:manifest,checks:{reports:1,evidence:1,moderation:true,publicTimeline:true,registration:true,languages:['en','fil','war'],pageErrors:errors,optionalApiCalls:0,externalOriginsBlocked:[...new Set(demo.state.blocked)]}},null,2));
} catch(error) {
  for(const page of demo.context.pages()) { await page.screenshot({path:`${out}/failure.png`}).catch(()=>{}); console.error((await page.locator('.form-error').allTextContents()).join(' ')); }
  throw error;
} finally { await demo.close(); }
