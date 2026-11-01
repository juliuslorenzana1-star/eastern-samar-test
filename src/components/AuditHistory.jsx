import { t, locale } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { formatStatus } from '../lib/reports.js';

export default function AuditHistory() {
  useTranslation();
  const [result,setResult]=useState(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(() => {
    let active=true;
    supabase?.from('platform_audit').select('id,actor_id,entity,record_id,created_at').order('created_at',{ascending:false}).limit(50)
      .then(({data,error}) => { if(active) setResult(error ? {error:true} : {rows:data || []}); });
    return () => {active=false;};
  },[attempt]);
  return <details className="civic-guide"><summary>{t("Recent platform audit · staff only")}</summary>{!result ? <p role="status">{t("Loading audit history…")}</p> : result.error ? <p>{t("Audit history is unavailable. The database update may be pending.")} <button onClick={()=>setAttempt(value=>value+1)}>{t("Retry")}</button></p> : result.rows.length ? <ol>{result.rows.map(row=><li key={row.id}><strong>{formatStatus(row.entity)}</strong> · {new Date(row.created_at).toLocaleString(locale(),{timeZone:'Asia/Manila'})}<br />{t("Actor")} {row.actor_id || t("System")}  {t("· Record")} {row.record_id}</li>)}</ol> : <p>{t("No audit entries recorded yet.")}</p>}</details>;
}
