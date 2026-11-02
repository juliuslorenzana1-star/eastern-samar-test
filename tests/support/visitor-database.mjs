import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir } from 'node:fs/promises';
export async function visitorDatabase({legacy=false}={}) {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public,storage to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;grant select,insert on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;`);
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql') && (!legacy || !/review_decision|ai_review_runs|leaderboard_and_email|platform_completion|community_recognition/.test(n))).sort())await db.exec(await readFile(new URL(name,dir),'utf8'));
  const as=async(role,id,sql,params=[])=>{
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id || '']);
    await db.exec(`set role ${role}`);
    try{return await db.query(sql,params);}finally{await db.exec('reset role');}
  };
  const signatures={claim_visitor_attempt:['source','operation'],submit_visitor_report:['payload','tracking_hash','source_hash','payload_hash','has_photo'],finalize_visitor_photo:['target_report_id','tracking_hash'],track_visitor_report:['tracking_hash']};
  const database={async rpc(name,args){const keys=signatures[name];if(!keys)throw Error('Unknown RPC');return(await as('service_role',null,`select public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) result`,keys.map(key=>key==='payload'?JSON.stringify(args[key]):args[key]))).rows[0].result;}};
  const objects=new Map();
  const storage={async upload(path,bytes){
    if(objects.has(path))return;
    await db.query("insert into storage.objects(bucket_id,name,metadata)values('report-evidence',$1,$2)",[path,JSON.stringify({size:bytes.length,mimetype:'image/jpeg'})]);
    objects.set(path,bytes);
  }};
  return {db,as,database,storage,objects};
}
