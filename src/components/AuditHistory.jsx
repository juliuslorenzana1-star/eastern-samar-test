import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuditHistory() {
  const [result,setResult]=useState(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(() => {
    let active=true;
    supabase?.from('platform_audit').select('id,actor_id,entity,record_id,created_at').order('created_at',{ascending:false}).limit(50)
      .then(({data,error}) => { if(active) setResult(error ? {error:true} : {rows:data || []}); });
    return () => {active=false;};
  },[attempt]);
  return <details className="civic-guide"><summary>Recent platform audit · staff only</summary>{!result ? <p role="status">Loading audit history…</p> : result.error ? <p>Audit history is unavailable. The database update may be pending. <button onClick={()=>setAttempt(value=>value+1)}>Retry</button></p> : result.rows.length ? <ol>{result.rows.map(row=><li key={row.id}><strong>{row.entity}</strong> · {new Date(row.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}<br />Actor {row.actor_id || 'System'} · Record {row.record_id}</li>)}</ol> : <p>No audit entries recorded yet.</p>}</details>;
}
