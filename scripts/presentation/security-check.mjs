import assert from 'node:assert/strict';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files=[];
async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const full=path+'/'+entry.name;if(entry.isDirectory()){if(!['.temp','node_modules'].includes(entry.name))await walk(full);}else files.push(full);}}
for(const root of ['src','public','supabase','scripts','tests','.github'])await walk(root);
files.push('package.json','package-lock.json','vite.config.js','vercel.json','index.html');
const inventory=[], findings=[];
const patterns=[/\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/g,/\bsb_secret_[A-Za-z0-9_-]{20,}/g,/\bgithub_pat_[A-Za-z0-9_]{30,}/g,/\bgh[pousr]_[A-Za-z0-9]{30,}/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g];
for(const file of files){const bytes=await readFile(file);inventory.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});if(/\.(?:jsx?|mjs|ts|sql|json|html|yml|svg)$/.test(file)){const text=bytes.toString();for(const pattern of patterns)if(pattern.test(text)){findings.push({file,type:'credential-pattern; value withheld'});}for(const pattern of patterns)pattern.lastIndex=0;}}
const headers=JSON.parse(await readFile('vercel.json','utf8')).headers[0].headers;
assert.ok(headers.some(item=>item.key==='Content-Security-Policy-Report-Only'));
assert.ok(headers.some(item=>item.key==='Permissions-Policy'));
const html=await readFile('dist/index.html','utf8');assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html),'No inline scripts');
const assets=await readdir('dist/assets');assert.ok(!assets.some(file=>file.endsWith('.map')),'No public source maps');
await mkdir('test-results.local/readiness',{recursive:true});await writeFile('test-results.local/readiness/source-inventory.json',JSON.stringify({inventory,findings},null,2));
assert.deepEqual(findings,[],'Review any credential-pattern finding locally; never print values');
console.log(JSON.stringify({filesInventoried:inventory.length,credentialPatternFindings:findings.length,sourceMaps:false,inlineScripts:false,csp:'Report-Only; enforcement pending acceptance'},null,2));
