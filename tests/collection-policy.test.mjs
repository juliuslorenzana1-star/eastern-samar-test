import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requirePersonalDataCollection, personalDataCollectionEnabled, resolveCollectionPolicy,resolveVisitorReporting } from '../src/lib/collection-policy.js';
test('personal collection fails closed without privacy approval or the isolated demo origin', () => {
  assert.equal(personalDataCollectionEnabled, false);
  assert.throws(requirePersonalDataCollection, /submissions are temporarily unavailable/);
});

test('future public release requires explicit approval and exact intended project identity',()=>{
  const env={VITE_APP_ENVIRONMENT:'public',VITE_PUBLIC_REPORTING_RELEASE_APPROVED:'true',VITE_PUBLIC_PROJECT_REF:'xoitncotbgobcsdmvyjb',VITE_SUPABASE_URL:'https://xoitncotbgobcsdmvyjb.supabase.co',VITE_ENABLE_PERSONAL_DATA_COLLECTION:'true',VITE_ENABLE_ANONYMOUS_REPORTING:'true'};
  assert.equal(resolveVisitorReporting(env),true);assert.equal(resolveCollectionPolicy(env).writable,true);
  for(const patch of [{VITE_PUBLIC_REPORTING_RELEASE_APPROVED:'false'},{VITE_PUBLIC_PROJECT_REF:''},{VITE_SUPABASE_URL:'https://egqoczyvhwtujwaflmgz.supabase.co'}]){
    assert.equal(resolveVisitorReporting({...env,...patch}),false);assert.equal(resolveCollectionPolicy({...env,...patch}).writable,false);
  }
  assert.equal(resolveVisitorReporting({...env,VITE_ENABLE_ANONYMOUS_REPORTING:'false'}),false);
});
test('staging opt-in requires exact isolated project identity and protects existing apps',()=>{
  const ref='abcdefghijklmnopqrst';const config={VITE_APP_ENVIRONMENT:'staging',VITE_STAGING_PROJECT_REF:ref,VITE_SUPABASE_URL:`https://${ref}.supabase.co`,VITE_ENABLE_PERSONAL_DATA_COLLECTION:'true'};
  assert.equal(resolveCollectionPolicy(config).writable,true);
  for(const VITE_SUPABASE_URL of ['https://xoitncotbgobcsdmvyjb.supabase.co','https://egqoczyvhwtujwaflmgz.supabase.co','https://other.example.invalid'])assert.equal(resolveCollectionPolicy({...config,VITE_SUPABASE_URL}).writable,false);
  assert.equal(resolveCollectionPolicy({...config,VITE_APP_ENVIRONMENT:'public'}).writable,false);
  assert.equal(resolveCollectionPolicy({...config,VITE_ENABLE_PERSONAL_DATA_COLLECTION:'false'}).writable,false);
});
