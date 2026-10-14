import { useSyncExternalStore } from 'react';

const phoneQuery = '(max-width: 620px), (max-width: 900px) and (max-height: 480px)';
const subscribe = (callback) => {
  const media = window.matchMedia(phoneQuery);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const snapshot = () => window.matchMedia(phoneQuery).matches;
export default function usePhoneLayout() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
