import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { createVisitorHandler,ingressEnabled,sourceIdentity,sanitizePhoto,validateVisitorPayload,MAX_BODY_BYTES } from '../server/visitor-handler.mjs';
import { assertSafeClientEnv } from '../scripts/client-env.mjs';
const env={ANON_REPORTING_ENABLED:'true',ANON_ENVIRONMENT:'isolated',SUPABASE_URL:'http://127.0.0.1:54321',ANON_ALLOWED_ORIGIN:'http://localhost:5195',ANON_SOURCE_HMAC_KEY:'fictional-local-hmac-secret-long-enough'};
const report={title:'Non-personal sample concern',description:'An isolated sample concern for regression testing.',category:'infrastructure',municipality:'Guiuan',priority:'normal'};
const credential='A'.repeat(43);
async function invoke({method='POST',origin=env.ANON_ALLOWED_ORIGIN,body={},headers={},configuration=env,url='/api/anonymous',database,storage}={}){
  const calls=[];
  const req=Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);
  Object.assign(req,{method,url,headers:{origin,'content-type':'application/json','x-report-operation':'submit',...headers},socket:{remoteAddress:'127.0.0.1'}});
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=JSON.parse(value);}};
  await createVisitorHandler({env:configuration,database:database || {async rpc(name){calls.push(name);return true;}},storage:storage || {}})(req,res);
  return {...res,calls};
}
test('release gate is closed by default, independently of frontend flags',async()=>{
  assert.throws(()=>assertSafeClientEnv({VITE_ANON_SOURCE_HMAC_KEY:'an-accidental-client-secret'}),/Secret credentials/);
  assert.equal(ingressEnabled({}),false);
  for(const configuration of [{...env,ANON_REPORTING_ENABLED:'false'},{...env,ANON_ENVIRONMENT:'public'},{...env,SUPABASE_URL:'https://xoitncotbgobcsdmvyjb.supabase.co'},{...env,ANON_SOURCE_HMAC_KEY:'short'}]){
    const response=await invoke({configuration});assert.equal(response.statusCode,503);assert.equal(response.calls.length,0);
  }
});
test('source identity ignores spoofed proxy headers locally and fails closed on untrusted production hosts',()=>{
  const req={headers:{'x-forwarded-for':'192.0.2.4'},socket:{remoteAddress:'127.0.0.1'}};
  const first=sourceIdentity(req,env);req.headers['x-forwarded-for']='192.0.2.99';assert.equal(sourceIdentity(req,env),first);
  assert.throws(()=>sourceIdentity(req,{...env,ANON_ENVIRONMENT:'public'}));
  assert.throws(()=>sourceIdentity({...req,headers:{'x-forwarded-for':'192.0.2.1,192.0.2.2'}},{...env,VERCEL:'1'}));
  assert.notEqual(first,sourceIdentity(req,{...env,VERCEL:'1'}));
});
test('method, cross-origin and credential-bearing URLs fail before database use',async()=>{
  for(const options of [{method:'GET'},{origin:'https://attacker.invalid'},{url:'/api/anonymous?trackingCredential='+credential}]){
    const response=await invoke(options);assert.ok([400,403,405].includes(response.statusCode));assert.equal(response.calls.length,0);
    assert.equal(response.headers['Cache-Control'],'no-store, private');
  }
});
test('stream size, malformed JSON, contact validation and forged public flags are rejected',async()=>{
  assert.equal((await invoke({body:'{bad'})).statusCode,400);
  assert.equal((await invoke({body:'x'.repeat(MAX_BODY_BYTES+1)})).statusCode,413);
  for(const patch of [{status:'approved'},{reporter_id:'other'},{contact:{email:'bad'}},{contact:{name:42}},{location:{lat:0,lng:0}},{neededBy:'2026-02-30'},{incidentAt:'2026-02-30T00:00:00Z'}])assert.throws(()=>validateVisitorPayload({...report,...patch}));
  assert.deepEqual(validateVisitorPayload(report).contact,{});
  assert.deepEqual(validateVisitorPayload({...report,contact:{name:' Fictional ',email:'fictional@example.invalid',phone:'+63 000 000'}}).contact,{name:'Fictional',email:'fictional@example.invalid',phone:'+63 000 000'});
});
test('photo decoder rejects SVG, unsupported bytes, oversized input and strips metadata',async()=>{
  for(const data of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),Buffer.from('not an image')])await assert.rejects(sanitizePhoto(data.toString('base64')));
  await assert.rejects(sanitizePhoto(Buffer.alloc(2097153).toString('base64')));
  const png=await sharp({create:{width:32,height:32,channels:3,background:'blue'}}).png().withMetadata({exif:{IFD0:{Artist:'Sensitive metadata'}}}).toBuffer();
  const output=await sanitizePhoto(png.toString('base64'));const metadata=await sharp(output).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);
});
test('quota denial prevents image decoding and private data never appear in database errors',async()=>{
  const denied=await invoke({body:{trackingCredential:credential,photo:'bad'},database:{async rpc(){return false;}}});assert.equal(denied.statusCode,429);
  const failed=await invoke({body:{trackingCredential:credential},database:{async rpc(){throw Error('secret SQL and contact details');}}});assert.equal(failed.statusCode,503);assert.deepEqual(failed.body,{error:'unavailable'});
});
test('a committed report retains a valid receipt when its photo upload fails',async()=>{
  const photo=(await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer()).toString('base64');
  const result=await invoke({body:{trackingCredential:credential,report,photo},database:{async rpc(name){return name==='claim_visitor_attempt'?true:{id:'fictional-id',objectPath:'fictional/path.jpg',replayed:false};}},storage:{async upload(){throw Error('Storage failure');}}});
  assert.equal(result.statusCode,200);assert.equal(result.body.id,'fictional-id');assert.equal(result.body.photoSaved,false);
  assert.equal(JSON.stringify(result.body).includes('path.jpg'),false);
});
