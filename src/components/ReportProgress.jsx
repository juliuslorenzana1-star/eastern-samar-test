import { t, locale } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { fetchEvidence, fetchReportProgress, formatStatus } from '../lib/reports.js';

export default function ReportProgress({ report, canViewEvidence }) {
  useTranslation();
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchReportProgress(report.id), canViewEvidence ? fetchEvidence(report.id) : Promise.resolve([])])
      .then(([progress, evidence]) => {
        if (active) setResult({ progress: progress.status === 'fulfilled' ? progress.value : null, evidence: evidence.status === 'fulfilled' ? evidence.value : null });
      });
    return () => { active = false; };
  }, [report.id, canViewEvidence, attempt]);
  return <div className="report-progress"><h4>{t("Progress timeline")}</h4>
    {!result ? <p role="status">{t("Loading progress…")}</p> : result.progress === null ? <p>{t("Full timeline unavailable. The current status and dates above are the latest loaded record.")} <button onClick={() => setAttempt((value) => value+1)}>{t("Retry")}</button></p> : result.progress.length ? <ol>{result.progress.map((event) => <li key={event.id}><strong>{formatStatus(event.status)}</strong><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(locale(), { timeZone:'Asia/Manila' })}</time></li>)}</ol> : <p>{t("No public progress events yet.")}</p>}
    {canViewEvidence && <><h4>{t("Private supporting evidence")}</h4>{result?.evidence === null ? <p>{t("Evidence could not be loaded.")}</p> : result?.evidence.map((item) => <a href={item.url} key={item.id} target="_blank" rel="noreferrer"><img loading="lazy" src={item.url} alt={t("Supporting evidence submitted for this concern")} /></a>)}{result?.evidence?.length === 0 && <p>{t("No supporting images attached.")}</p>}</>}
    <p>{t("Last update:")} {new Date(report.updated_at || report.created_at).toLocaleString(locale(), { timeZone:'Asia/Manila' })}</p>
  </div>;
}
