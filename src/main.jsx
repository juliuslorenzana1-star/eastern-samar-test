import React from 'react';
import { initializeLanguage, t } from './i18n/config.js';
import { installValidationLocalization } from './i18n/validation.js';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './atlas.css';
import './mobile.css';
import './community-refresh.css';
import './completion.css';
import { isOperationsPath } from './lib/routes.js';
const OperationsCommand = React.lazy(() => import('./components/OperationsCommand.jsx'));
const App = React.lazy(() => import('./App.jsx'));
installValidationLocalization(document);

initializeLanguage().catch(() => {}).finally(() => createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <React.Suspense fallback={<main className="view-loading" role="status">{t('Loading community platform…')}</main>}>
    {isOperationsPath(window.location.pathname, import.meta.env.BASE_URL) ? <OperationsCommand /> : <App />}
    </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
));

import './mobile-recognition.css';
import './redesign.css';
// Shared navigation controls follow generic form/layout rules.
import './i18n/language.css';
