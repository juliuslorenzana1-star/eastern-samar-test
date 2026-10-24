import { useCallback, useSyncExternalStore } from 'react';
const phoneQuery = '(max-width: 620px), (max-width: 900px) and (max-height: 480px)';
export default function usePhoneLayout(maxWidth) {
  const query = maxWidth ? `(max-width: ${maxWidth}px)` : phoneQuery;
  const subscribe = useCallback(callback => {
    const media = window.matchMedia(query);
    media.addEventListener('change', callback);
    return () => media.removeEventListener('change', callback);
  }, [query]);
  const snapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
