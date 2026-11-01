import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import useDialogFocus from '../lib/useDialogFocus.js';

export default function ReportReceipt({ report, onClose, onReports, onAnother }) {
  useTranslation();
  const ref = useDialogFocus({ active: true, onClose });
  return <div className="modal-backdrop"><section ref={ref} tabIndex={-1} className="report-modal receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
    <button className="icon-button receipt-close" onClick={onClose} aria-label={t("Close confirmation")}><X /></button>
    <span className="receipt-check"><Check size={36} /></span><h2 id="receipt-title">{t("Report submitted!")}</h2><p>{t("Thank you for helping build a better Eastern Samar. Your report is saved privately for review.")}</p>
    <label className="field-label">{t("Reference number")}<output className="receipt-reference">{report.id}</output></label>
    <p>{t("Follow its status in My Reports. Your concern appears publicly after moderator approval.")}</p>
    <button className="primary-button" onClick={onReports}>{t("View My Reports")}</button><button className="outline-button" onClick={onAnother}>{t("Report another concern")}</button>
  </section></div>;
}
