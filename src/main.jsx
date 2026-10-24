import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import CinematicEntry from './components/CinematicEntry.jsx';
import './atlas.css';
import './mobile.css';
import './community-refresh.css';
import './completion.css';
import { isOperationsPath } from './lib/routes.js';
const OperationsCommand = React.lazy(() => import('./components/OperationsCommand.jsx'));
const App = React.lazy(() => import('./App.jsx'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <React.Suspense fallback={<main className="view-loading" role="status">Loading community platform…</main>}>
    {isOperationsPath(window.location.pathname, import.meta.env.BASE_URL) ? <OperationsCommand /> : <CinematicEntry><App /></CinematicEntry>}
    </React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
)
