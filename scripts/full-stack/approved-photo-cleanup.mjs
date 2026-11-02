// One-off, owner-confirmed cleanup. Exact immutable object allowlist only.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.VERCEL_ENV,'preview');
assert.equal(process.env.VERCEL_GIT_COMMIT_REF,'codex/full-stack-verification');
assert.equal(process.env.SUPABASE_URL,'https://xoitncotbgobcsdmvyjb.supabase.co');
assert.equal(process.env.APPROVED_REPORT_PHOTO_CLEANUP,'2026-11-02-confirmed-three-reports');
const paths=['e8b22487-9f4a-405e-b4ec-f14aab28f3d8/a4908c75-1d95-4136-ae87-b788441178b4.jpg','8c30efcd-0518-4f85-b9e0-79e98d8381ee/1193feec-8068-46a8-95ed-fcd5c62bbef9.jpg'];
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {error}=await client.storage.from('report-evidence').remove(paths);
if(error)throw Error('Approved photo cleanup failed; credential and provider response suppressed');
console.log('APPROVED_PHOTO_CLEANUP '+JSON.stringify({requestedObjects:paths.length,storageApiSuccess:true}));
