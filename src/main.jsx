import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App.jsx';
import CinematicEntry from './components/CinematicEntry.jsx';
import './atlas.css';
import './mobile.css';
import { isOperationsPath } from './lib/routes.js';
const OperationsCommand = React.lazy(() => import('./components/OperationsCommand.jsx'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isOperationsPath(window.location.pathname, import.meta.env.BASE_URL) ? <React.Suspense fallback={<p role="status">Loading operations workspace…</p>}><OperationsCommand /></React.Suspense> : <CinematicEntry><App /></CinematicEntry>}
  </React.StrictMode>,
)
