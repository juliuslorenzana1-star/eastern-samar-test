import { useTranslation } from 'react-i18next';
import { t } from '../i18n/config.js';
import { collectionPauseMessage, collectionPolicy, personalDataCollectionEnabled, visitorReportingEnabled } from '../lib/collection-policy.js';

// Availability information is not a privacy notice or an authorization boundary.
// Keep the public gate intact and never label an unrestricted public site staging.
export default function CollectionStatus() {
  useTranslation();
  if (collectionPolicy.kind === 'staging' || import.meta.env?.VITE_PROTECTED_TEST_ENVIRONMENT === 'true') return <p className="testing-environment-label">{t('Testing environment · authorized testers only')}</p>;
  if (collectionPolicy.kind === 'fixtures') return <p className="testing-environment-label">{t('Fictional test data')}</p>;
  if (personalDataCollectionEnabled || visitorReportingEnabled) return null;
  return <details className="collection-status">
    <summary>{t('Public reporting unavailable')}</summary>
    <p>{t(collectionPauseMessage)}</p>
    <p>{t('A verified privacy contact, confirmed operator and approved retention schedule are required before public collection opens.')}</p>
  </details>;
}
