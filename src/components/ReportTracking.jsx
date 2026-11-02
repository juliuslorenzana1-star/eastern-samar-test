import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t,formatDate } from '../i18n/config.js';
import useDialogFocus from '../lib/useDialogFocus.js';
import { trackVisitorReport } from '../lib/visitor-reports.js';
import { formatStatus } from '../lib/reports.js';

export default function ReportTracking({onClose}) {
  useTranslation();
  const [credential,setCredential]=useState('');const [report,setReport]=useState(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const ref=useDialogFocus({active:true,busy,onClose});
  async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');setReport(null);try{setReport(await trackVisitorReport(credential.trim()));}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="modal-backdrop"><section ref={ref} className="report-modal" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tracking-title">
    <div className="modal-head"><h2 id="tracking-title">{t('Track a report')}</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label={t('Close')}>×</button></div>
    <p>{t('Your tracking credential is private. Anyone with it can read your report status and feedback. It cannot be recovered through an account.')}</p>
    <form onSubmit={submit}><label className="field-label">{t('Private tracking credential')}<input type="password" autoComplete="off" spellCheck={false} required minLength={43} maxLength={43} value={credential} onChange={e=>setCredential(e.target.value)} /></label><button className="primary-button" disabled={busy}>{busy?t('Loading…'):t('Check status')}</button></form>
    {error&&<p className="form-error" role="alert">{t(error)}</p>}
    {report&&<section aria-live="polite"><h3>{formatStatus(report.status)}</h3><p>{report.decision_note}</p><ol>{report.events?.map((event,index)=><li key={index}>{formatStatus(event.status)} · {formatDate(event.created_at,{dateStyle:'medium'})}</li>)}</ol></section>}
  </section></div>;
}
