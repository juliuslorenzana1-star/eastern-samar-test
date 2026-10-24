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
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const dialogRef = useDialogFocus({ active: !hidden, busy, onClose });
  const submitLock = useRef(false);

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
          <div><span className="eyebrow">COMMUNITY REPORT</span><h2 id="report-form-title">Add a concern</h2></div>
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Close report form"><X size={19} /></button>
        </div>

        {isOffline && (
          <div className="offline-notice-banner" role="status">
            <WifiOff size={15} />
            <span><strong>Offline Mode:</strong> No internet connection detected. You can draft your report now and save it to your device to sync later.</span>
          </div>
        )}

        <p className="modal-intro">Reports begin private and pending review. Don’t include names or details that could identify vulnerable people. When configured, title and description may be screened by an external service; its flags are advisory and a human moderator decides publication.</p>
        <form onSubmit={submit}>
          <fieldset className="report-form-section" disabled={busy}>
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
            <label className="field-label">Municipality / city
              <select name="municipality" required value={form.municipality} onChange={update}>
                <option value="">Choose an area</option>
                {municipalities.map((place) => <option key={place}>{place}</option>)}
              </select>
            </label>
          </div>
          <label className="field-label">Barangay <span className="optional-label">Optional</span>
            <input name="barangay" maxLength="100" value={form.barangay} onChange={update} placeholder="Barangay name" />
          </label>
          </fieldset>
          <fieldset className="report-form-section" disabled={busy}>
          <legend><span>02</span> Add context and a location</legend>
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
          <label className="field-label">Describe the concern
            <textarea name="description" rows="4" maxLength="4000" minLength="12" required value={form.description} onChange={update} placeholder="What happened, and what help is needed?" />
          </label>
          <label className="field-label photo-field">Supporting photo <span className="optional-label">Optional, private</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseEvidence} />
            <span className="field-hint">JPEG, PNG, or WebP up to 5 MB. Evidence is stored privately for the reporter and moderators.</span>
          </label>
          {preview && <img className="evidence-preview" src={preview} alt="Preview of selected evidence" />}
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-foot">
            <span><ShieldCheck size={14} /> Private until reviewed</span>
            <div className="modal-foot-actions">
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
              <button className="primary-button" type="submit" disabled={busy || !categories.length}>
                <Plus size={16} /> {busy ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
