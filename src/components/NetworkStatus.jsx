import { t } from '../i18n/config.js';
import { useTranslation } from 'react-i18next';
import { useSyncExternalStore } from 'react';
const subscribe=(notify)=>{
  window.addEventListener('online',notify);window.addEventListener('offline',notify);
  return ()=>{window.removeEventListener('online',notify);window.removeEventListener('offline',notify);};
};
export default function NetworkStatus() {
  useTranslation();
  const online=useSyncExternalStore(subscribe,()=>navigator.onLine,()=>true);
  return online ? null : <p className="civic-guide" role="status">{t("You are offline. Loaded records remain visible. Submissions need a connection; you can save a report draft on this device and sync it later.")}</p>;
}
