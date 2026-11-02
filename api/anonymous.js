import { createClient } from '@supabase/supabase-js';
import { createVisitorHandler, ingressEnabled } from '../server/visitor-handler.mjs';
// Raw Node request stream: never access Vercel's lazy request.body helper.

export default async function anonymous(req,res) {
  const env=process.env;
  // No client is constructed and no provider request occurs while disabled.
  let client;
  const getClient=()=> {
    if (!ingressEnabled(env) || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('unavailable');
    return client ??= createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  };
  const database={async rpc(name,args){const {data,error}=await getClient().rpc(name,args);if(error)throw error;return data;}};
  const storage={async upload(path,bytes){
    const bucket=getClient().storage.from('report-evidence');
    const {error}=await bucket.upload(path,bytes,{contentType:'image/jpeg',upsert:false});
    // An interrupted response can leave a successfully stored immutable object.
    // Finalization verifies real object metadata. Never overwrite an existing path.
    if(error && !['409','Duplicate'].includes(String(error.statusCode || error.error)))throw error;
  }};
  return createVisitorHandler({env,database,storage})(req,res);
}
