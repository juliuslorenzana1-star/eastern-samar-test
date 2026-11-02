import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import useDialogFocus from '../lib/useDialogFocus.js';

export default function ReportReceipt({ report, onClose, onReports, onAnother }) {
  useTranslation();
  const ref = useDialogFocus({ active: true, onClose });
  function downloadReceipt(){
    const text=`Eastern Samar Community Action Map\n${t('Reference number')}: ${report.id}\n${t('Private tracking credential')}: ${report.trackingCredential}\n${t('Save this credential somewhere private before closing. It is not stored in this browser and cannot be recovered. Anyone with it can read status and resident-facing feedback.')}\n`;
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='private-report-receipt.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="modal-backdrop"><section ref={ref} tabIndex={-1} className="report-modal receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
    <button className="icon-button receipt-close" onClick={onClose} aria-label={t("Close confirmation")}><X /></button>
    <span className="receipt-check"><Check size={36} /></span><h2 id="receipt-title">{t("Report submitted!")}</h2><p>{t("Thank you for helping build a better Eastern Samar. Your report is saved privately for review.")}</p>
    <label className="field-label">{t("Reference number")}<output className="receipt-reference">{report.id}</output></label>
    {report.trackingCredential ? <>
      <label className="field-label">{t('Private tracking credential')}<textarea readOnly rows={2} value={report.trackingCredential} spellCheck={false} onFocus={event=>event.target.select()} /></label>
      <p>{t('Save this credential somewhere private before closing. It is not stored in this browser and cannot be recovered. Anyone with it can read status and resident-facing feedback.')}</p>
      <button className="outline-button" onClick={downloadReceipt}>{t('Download private receipt')}</button>
      {!report.photoSaved && <p role="alert">{t('Your report is saved, but its photo could not be confirmed saved. Keep your tracking credential; do not submit a duplicate report.')}</p>}
    </> : <p>{t("Follow its status in My Reports. Your concern appears publicly after moderator approval.")}</p>}
    <button className="primary-button" onClick={onReports}>{report.trackingCredential?t('Track a report'):t("View My Reports")}</button><button className="outline-button" onClick={onAnother}>{t("Report another concern")}</button>
  </section></div>;
}
