import useDialogFocus from '../lib/useDialogFocus.js';
import ReportDetailCard from './ReportDetailCard.jsx';

export default function ReportDetailsDialog(props) {
  const ref = useDialogFocus({ onClose: props.onClose });
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) props.onClose(); }}><section className="report-details-dialog" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Report details"><ReportDetailCard {...props} /></section></div>;
}
