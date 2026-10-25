import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, ShieldCheck, WifiOff, X } from 'lucide-react';
import { MUNICIPALITIES as municipalities } from '../lib/place.js';
import { validateEvidenceFile } from '../lib/reports.js';
import { saveOfflineDraft } from '../lib/offline-drafts.js';
import useDialogFocus from '../lib/useDialogFocus.js';

export default function ReportDialog({ categories, location, hidden, userId, onClose, onPickLocation, onSubmit, onDraftSaved }) {
  const [form, setForm] = useState({ title: '', category: '', municipality: '', barangay: '', description: '', incidentAt: '', neededBy: '', priority: 'normal' });
  const [evidence, setEvidence] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const stepHeading = useRef(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const dialogRef = useDialogFocus({ active: !hidden, busy, onClose });
  const submitLock = useRef(false);

  useEffect(() => { stepHeading.current?.focus(); }, [step]);

  function nextStep(event) {
    event?.preventDefault();
    const fields = dialogRef.current?.querySelectorAll('fieldset:not([hidden]) input, fieldset:not([hidden]) select, fieldset:not([hidden]) textarea');
    for (const field of fields || []) if (!field.reportValidity()) return;
    setError('');
    setStep(current => Math.min(3, current + 1));
  }

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    function handleOnline() { setIsOffline(false); }
    function handleOffline() { setIsOffline(true); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function chooseEvidence(event) {
    const file = event.target.files?.[0] ?? null;
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setEvidence(null);
    setError('');
    if (!file) return;
    try {
      await validateEvidenceFile(file);
      setEvidence(file);
      setPreview(URL.createObjectURL(file));
    } catch (fileError) {
      event.target.value = '';
      setError(fileError.message);
    }
  }

  function handleSaveOffline() {
    if (!form.title.trim() || !form.municipality || !form.description.trim()) {
      setError('To save an offline draft, please fill in at least the Title, Municipality, and Description.');
      return;
    }
    try {
      saveOfflineDraft({
        ...form,
        ownerId: userId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category || categories[0]?.slug || '',
        location,
      });
      if (onDraftSaved) onDraftSaved();
      onClose();
    } catch (draftError) {
      setError(draftError.message || 'Could not save offline draft.');
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (step !== 3) { nextStep(); return; }
    if (submitLock.current) return;
    submitLock.current = true;
    setError('');
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        category: form.category || categories[0]?.slug || '',
        incidentAt: form.incidentAt ? new Date(form.incidentAt).toISOString() : null,
        evidence,
        location,
      });
      onClose();
    } catch (submitError) {
      setError(submitError.message || 'We couldn’t submit your report. Please try again.');
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  const selectedCategory = form.category || categories[0]?.slug || '';

  return (
    <div className={`modal-backdrop${hidden ? ' is-hidden' : ''}`} onMouseDown={(event) => !busy && event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} tabIndex={-1} className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-form-title" aria-busy={busy}>
        <div className="modal-head">
          <div><span className="eyebrow">COMMUNITY REPORT</span><h2 id="report-form-title">Report a Concern</h2></div>
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Close report form"><X size={19} /></button>
        </div>

        {isOffline && (
          <div className="offline-notice-banner" role="status">
            <WifiOff size={15} />
            <span><strong>Offline Mode:</strong> No internet connection detected. You can draft your report now and save it to your device to sync later.</span>
          </div>
        )}

        <ol className="report-steps" aria-label="Report progress">{['Details', 'Location', 'Review'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
        <h3 className="step-heading" ref={stepHeading} tabIndex={-1}>{['What needs attention?', 'Where is the concern?', 'Review your report'][step - 1]}</h3>
        <p className="modal-intro">Your report stays private until reviewed. Avoid names or details that identify vulnerable people. Automated screening, when configured, supports human review.</p>
        <form onSubmit={submit}>
          <fieldset className="report-form-section" disabled={busy || step !== 1} hidden={step !== 1}>
          <legend><span>01</span> What needs attention?</legend>
          <label className="field-label">Concern title
            <input name="title" maxLength="120" minLength="6" required value={form.title} onChange={update} placeholder="What needs attention?" />
          </label>
          <div className="form-row">
            <label className="field-label">Issue category
              <select name="category" required value={selectedCategory} onChange={update}>
                {categories.map((category) => <option value={category.slug} key={category.slug}>{category.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field-label">Describe the concern
            <textarea name="description" rows="4" maxLength="4000" minLength="12" required value={form.description} onChange={update} placeholder="What happened, and what help is needed?" />
          </label>
          <label className="field-label photo-field">Supporting photo <span className="optional-label">Optional, private</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseEvidence} />
            <span className="field-hint">JPEG, PNG, or WebP up to 5 MB. Photos remain private to you and authorized staff.</span>
          </label>
          {preview && <img className="evidence-preview" src={preview} alt="Preview of selected evidence" />}
          </fieldset>
          <fieldset className="report-form-section" disabled={busy || step !== 2} hidden={step !== 2}>
          <legend><span>02</span> Choose a location</legend>
            <label className="field-label">Municipality / city
              <select name="municipality" required value={form.municipality} onChange={update}>
                <option value="">Choose an area</option>
                {municipalities.map((place) => <option key={place}>{place}</option>)}
              </select>
            </label>
          <label className="field-label">Barangay <span className="optional-label">Optional</span>
            <input name="barangay" maxLength="100" value={form.barangay} onChange={update} placeholder="Barangay name" />
          </label>
          <div className="form-row">
            <label className="field-label">Incident date and time <span className="optional-label">Optional</span>
              <input name="incidentAt" type="datetime-local" value={form.incidentAt} onChange={update} />
            </label>
            <label className="field-label">Needed by <span className="optional-label">Optional</span>
              <input name="neededBy" type="date" value={form.neededBy} onChange={update} />
            </label>
          </div>
          <label className="field-label">Urgency
            <select name="priority" value={form.priority} onChange={update}>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <div className="location-select-row">
            <span className="location-select-icon"><MapPin size={16} /></span>
            <span className="location-select-copy"><strong>{location ? 'Map point selected' : 'Add a map point'}</strong><span>{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} (public location will be approximate)` : 'Optional. Choose a point on the map.'}</span></span>
            <button type="button" className="outline-button" onClick={onPickLocation}>{location ? 'Change' : 'Choose point'}</button>
          </div>
          </fieldset>
          {step === 3 && <section className="report-review" aria-label="Report review">
            {preview && <img className="evidence-preview" src={preview} alt="Photo attached to this report" />}
            <span className="eyebrow">{categories.find(category => category.slug === selectedCategory)?.name}</span><h3>{form.title}</h3><p><MapPin size={16} />{[form.barangay, form.municipality].filter(Boolean).join(', ')}</p><p className="review-description">{form.description}</p>
            <dl><dt>Urgency</dt><dd>{form.priority}</dd><dt>Map point</dt><dd>{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Not supplied'}</dd>{form.incidentAt && <><dt>Incident</dt><dd>{form.incidentAt.replace('T', ' ')}</dd></>}{form.neededBy && <><dt>Needed by</dt><dd>{form.neededBy}</dd></>}</dl><button type="button" className="outline-button" onClick={() => setStep(1)}>Edit details</button><button type="button" className="outline-button" onClick={() => setStep(2)}>Edit location</button>
          </section>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-foot">
            <span><ShieldCheck size={14} /> Private until reviewed</span>
            <div className="modal-foot-actions">
              {step > 1 && <button className="outline-button" type="button" disabled={busy} onClick={() => setStep(current => current - 1)}>Back</button>}
              {(isOffline || error) && (
                <button
                  type="button"
                  className="outline-button offline-save-btn"
                  onClick={handleSaveOffline}
                  title="Save this report to device memory to sync when back online"
                >
                  <WifiOff size={14} /> Save Draft
                </button>
              )}
              {step < 3 ? <button key="next" className="primary-button" type="button" disabled={!categories.length} onClick={nextStep}>Next →</button> : <button key="submit" className="primary-button" type="submit" disabled={busy || !categories.length}><Plus size={16} />{busy ? 'Submitting…' : 'Submit report'}</button>}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
