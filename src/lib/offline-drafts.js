/**
 * Offline report drafting & queue management for SMART ESTE.
 * Allows residents and field responders to draft reports with GPS coordinates
 * even when cell data drops (island/upland barangays), and sync once reconnected.
 */

const STORAGE_KEY = 'smart_este_offline_drafts_v1';

export function getOfflineDrafts(ownerId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return ownerId === undefined ? parsed : ownerId ? parsed.filter((draft) => draft.ownerId === ownerId) : [];
  } catch {
    return [];
  }
}

export function saveOfflineDraft(draft) {
  const existing = getOfflineDrafts();
  const entry = {
    ...draft,
    id: draft.id || `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };

  // Remove existing by id if updating, then prepend
  const updated = [entry, ...existing.filter((item) => item.id !== entry.id)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('smart_este_drafts_changed', { detail: { count: updated.length } }));
    return entry;
  } catch (err) {
    console.error('Failed to save offline draft:', err);
    throw new Error('Device storage is full or restricted. Could not save offline draft.');
  }
}

export function removeOfflineDraft(id) {
  const existing = getOfflineDrafts();
  const updated = existing.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('smart_este_drafts_changed', { detail: { count: updated.length } }));
  } catch (err) {
    console.error('Failed to update offline drafts:', err);
    throw new Error('Device storage could not be updated. Your draft may still be stored on this device.');
  }
}

export function clearOfflineDrafts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('smart_este_drafts_changed', { detail: { count: 0 } }));
  } catch (err) {
    console.error('Failed to clear offline drafts:', err);
  }
}

/**
 * Attempt to sync all offline drafts to Supabase via the provided submitReport handler.
 */
export async function syncOfflineDrafts(submitReportHandler, ownerId) {
  const drafts = getOfflineDrafts(ownerId);
  if (!drafts.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const draft of drafts) {
    try {
      // Reconstitute payload expected by createReport
      const payload = {
        title: draft.title,
        description: draft.description,
        category: draft.category,
        municipality: draft.municipality,
        barangay: draft.barangay || '',
        incidentAt: draft.incidentAt || null,
        neededBy: draft.neededBy || null,
        priority: draft.priority || 'normal',
        location: draft.location || null,
      };

      await submitReportHandler(payload);
      removeOfflineDraft(draft.id);
      synced++;
    } catch (err) {
      console.warn(`Failed to sync offline draft ${draft.id}:`, err);
      failed++;
    }
  }

  return { synced, failed };
}
