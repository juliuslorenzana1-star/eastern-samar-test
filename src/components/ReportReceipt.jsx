import { Check, X } from 'lucide-react';
import useDialogFocus from '../lib/useDialogFocus.js';

export default function ReportReceipt({ report, onClose, onReports, onAnother }) {
  const ref = useDialogFocus({ active: true, onClose });
  return <div className="modal-backdrop"><section ref={ref} tabIndex={-1} className="report-modal receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
    <button className="icon-button receipt-close" onClick={onClose} aria-label="Close confirmation"><X /></button>
    <span className="receipt-check"><Check size={36} /></span><h2 id="receipt-title">Report submitted!</h2><p>Thank you for helping build a better Eastern Samar. Your report is saved privately for review.</p>
    <label className="field-label">Reference number<output className="receipt-reference">{report.id}</output></label>
    <p>Follow its status in My Reports. Your concern appears publicly after moderator approval.</p>
    <button className="primary-button" onClick={onReports}>View My Reports</button><button className="outline-button" onClick={onAnother}>Report another concern</button>
  </section></div>;
}
