import { t, locale } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function PlatformStatistics({ staff, refreshKey }) {
  useTranslation();
  const [result,setResult]=useState(null);
  useEffect(() => {
    let active=true;
    const load=()=> {
      if (!supabase || document.hidden) return;
      supabase.rpc('platform_statistics').then(({data,error})=> { if(active) setResult(error ? {error:true} : {data:data?.[0]}); });
    };
    load();
    const interval=setInterval(load,60000);
    document.addEventListener('visibilitychange',load);
    return ()=> {active=false;clearInterval(interval);document.removeEventListener('visibilitychange',load);};
  },[staff,refreshKey]);
  const metrics=result?.data;
  return <details className="civic-guide"><summary>{t("Live platform totals")}</summary><p>{t("Database totals, refreshed every minute while this tab is visible.")} {staff ? t("Staff report totals include private submissions.") : t("Report totals include publicly approved concerns only.")}</p>{!result ? <p role="status">{t("Loading totals…")}</p> : result.error || !metrics ? <p>{t("Platform totals are unavailable. View the loaded-report statistics below.")}</p> : <dl className="platform-totals">{[
    ['Total reports',metrics.total_reports],['Pending reports',metrics.pending_reports],['Verified reports',metrics.verified_reports],['Resolved reports',metrics.resolved_reports],['Active volunteers',metrics.active_volunteers],['Completed activities',metrics.completed_activities],['Verified volunteer hours',metrics.verified_hours],['Municipalities reached',metrics.municipalities_reached],
  ].filter(([,value])=>value!==null && value!==undefined).map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{Number(value).toLocaleString(locale())}</dd></div>)}</dl>}</details>;
}
