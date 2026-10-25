import { useEffect, useEffectEvent, useRef } from 'react';

// Dialogs can hand focus to another dialog (for example map picking → review
// or report form → confirmation). Keep the page locked until the last closes.
const scrollLocks = new Set();
let previousPageOverflow = '';
function lockPage() {
  const owner = Symbol('dialog');
  if (!scrollLocks.size) previousPageOverflow = document.body.style.overflow;
  scrollLocks.add(owner);
  document.body.style.overflow = 'hidden';
  return () => {
    scrollLocks.delete(owner);
    if (!scrollLocks.size) document.body.style.overflow = previousPageOverflow;
  };
}

// Keep keyboard focus in a modal and return it to the opener on dismissal.
export default function useDialogFocus({ active = true, busy = false, onClose }) {
  const dialogRef = useRef(null);
  const close = useEffectEvent(() => { if (!busy) onClose(); });
  useEffect(() => {
    if (!active) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const opener = document.activeElement;
    const unlockPage = lockPage();
    const controls = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
      .filter((element) => element.getClientRects().length > 0);
    // Wait for the entry overlay to release inert content before taking focus.
    const focusFirst = () => { if (!dialog.closest('[inert]')) (controls()[0] || dialog).focus(); };
    const frame = window.requestAnimationFrame(focusFirst);
    const observer = new MutationObserver(focusFirst);
    const container = dialog.closest('.entry-application');
    if (container) observer.observe(container, { attributes: true, attributeFilter: ['inert'] });
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    dialog.addEventListener('keydown', keydown);
    return () => {
      window.cancelAnimationFrame(frame); observer.disconnect();
      dialog.removeEventListener('keydown', keydown);
      unlockPage();
      if (opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
    };
  }, [active]);
  return dialogRef;
}
