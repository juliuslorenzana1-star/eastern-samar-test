import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const directory='presentation-output.local';const svg=await readFile(directory+'/title-card.svg','utf8');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Eastern Samar Community Action Map</title><body style="margin:0;background:#0b2635">${svg}</body></html>`;
await writeFile(directory+'/title-card.html',html);
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.route('**/*',route=>route.abort());await page.setContent(html);await page.screenshot({path:directory+'/title-card.png'});}finally{await browser.close();}
