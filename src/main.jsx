import React from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App.jsx';
import CinematicEntry from './components/CinematicEntry.jsx';
import './atlas.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CinematicEntry><App /></CinematicEntry>
  </React.StrictMode>,
)
