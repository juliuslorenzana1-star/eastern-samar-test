import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { Compass, Crosshair, Layers3, Minus, Plus } from 'lucide-react';
import easternSamarBoundary from '../assets/eastern-samar-boundary.json';
import {
  BASEMAPS, PROVINCE, categoryGlyphMarkup, categoryVisual, isReviewed,
} from '../lib/place.js';

// A marker is a category chip with a tail: colour + glyph carry the category,
// the small ring at the top carries the review state, and both themes get their
// own rim/shadow so pins never disappear into the basemap.
function reportIcon(report, selected, theme) {
  const { color } = categoryVisual(report.category_slug, theme);
  const reviewed = isReviewed(report.status);
  const classes = ['report-marker', selected ? 'is-selected' : '', reviewed ? 'is-reviewed' : 'is-pending',
    report.priority === 'urgent' ? 'is-urgent' : ''].filter(Boolean).join(' ');
  return divIcon({
    className: 'report-marker-shell',
    html: `<span class="${classes}" style="--marker-color:${color}">${categoryGlyphMarkup(report.category_slug)}<i class="marker-state" aria-hidden="true"></i></span>`,
    iconSize: [32, 40],
    iconAnchor: [16, 33],
  });
}

function pickIcon(theme) {
  return divIcon({
    className: 'report-marker-shell',
    html: `<span class="report-marker is-pick" style="--marker-color:${theme === 'dark' ? '#f2c65c' : '#a08326'}"><i class="marker-state"></i></span>`,
    iconSize: [32, 40],
    iconAnchor: [16, 33],
  });
}

// Publishes the Leaflet instance so overlays outside the map can drive it.
function MapHandle({ onReady }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

// Eastern Samar is the subject: the map opens fitted to the province, and the
// container keeps panning inside the padded province bounds.
function ProvinceViewport({ focus }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(PROVINCE.bounds, { padding: [18, 18], animate: false });
  }, [map]);
  useEffect(() => {
    if (!focus?.latlng) return;
    const zoom = focus.zoom ?? Math.min(Math.max(map.getZoom(), 12), 15);
    map.flyTo(focus.latlng, zoom, { duration: 0.75 });
  }, [map, focus]);
  return null;
}

function ClickCapture({ enabled, onPick }) {
  useMapEvents({ click(event) { if (enabled) onPick(event.latlng); } });
  return null;
}

export default function ProvinceMap({
  reports, theme, categories, counts, category, onCategory, area, selected, onSelect,
  focus, picking, onPick, onCancelPick, pickLocation, onStartReport, detail, mappedCount,
}) {
  const mapRef = useRef(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const handleReady = useCallback((instance) => { mapRef.current = instance; }, []);
  const basemap = BASEMAPS[theme] ?? BASEMAPS.light;
  const provinceMask = useMemo(() => {
    const shell = [[-85, -360], [85, -360], [85, 360], [-85, 360]];
    const provinceRings = easternSamarBoundary.features.flatMap((feature) => (
      feature.geometry.coordinates.map((polygon) => (
        polygon[0].map(([longitude, latitude]) => [latitude, longitude])
      ))
    ));
    return [shell, ...provinceRings];
  }, []);
  const visible = useMemo(() => reports.filter((report) => (
    Number.isFinite(Number(report.latitude)) && Number.isFinite(Number(report.longitude))
  )), [reports]);

  function nudge(action) {
    const instance = mapRef.current;
    if (!instance) return;
    if (action === 'in') instance.zoomIn();
    else if (action === 'out') instance.zoomOut();
    else instance.flyBounds(PROVINCE.bounds, { padding: [18, 18], duration: 0.7 });
  }

  return (
    <section className="map-stage" aria-label="Map of Eastern Samar">
      <div className="map-topline">
        <div className="map-location">
          <span className="map-location-mark"><Crosshair size={14} /></span>
          <span className="map-location-copy">
            <strong>{PROVINCE.name}</strong>
            <small>{area !== 'all' ? area : `${PROVINCE.region} · ${visible.length} mapped points`}</small>
          </span>
        </div>
        <div className="map-top-actions">
          <span className="map-count"><i /> {mappedCount} shown</span>
          <button className="map-tool-button" type="button" onClick={onStartReport}><Plus size={14} /> Report</button>
        </div>
      </div>

      <div className="map-hud" aria-live="polite">
        <span className="map-hud-badge">Eastern Samar</span>
        <span>{reports.length ? `${reports.length} mapped actions in view` : 'Demo mode · live provincial map ready'}</span>
      </div>

      <MapContainer
        center={PROVINCE.center}
        zoom={PROVINCE.focusZoom}
        minZoom={PROVINCE.zoomRange[0]}
        maxZoom={PROVINCE.zoomRange[1]}
        maxBounds={PROVINCE.maxBounds}
        maxBoundsViscosity={0.72}
        scrollWheelZoom
        zoomControl={false}
        className="leaflet-map"
        preferCanvas
      >
        <TileLayer
          key={theme}
          url={basemap.url}
          attribution={basemap.attribution}
          subdomains="abcd"
          detectRetina
        />
        <Polygon
          positions={provinceMask}
          fillRule="evenodd"
          interactive={false}
          pathOptions={{
            stroke: false,
            fillColor: theme === 'dark' ? '#050b09' : '#d1ded7',
            fillOpacity: theme === 'dark' ? 0.7 : 0.3,
          }}
        />
        <GeoJSON
          data={easternSamarBoundary}
          interactive={false}
          style={{
            color: theme === 'dark' ? '#67cfa0' : '#236b59',
            weight: 1.8,
            opacity: 0.9,
            fillColor: theme === 'dark' ? '#1d7457' : '#5d927d',
            fillOpacity: theme === 'dark' ? 0.22 : 0.1,
          }}
        />
        <MapHandle onReady={handleReady} />
        <ProvinceViewport focus={focus} />
        <ClickCapture enabled={picking} onPick={onPick} />
        {pickLocation && (
          <Marker position={[pickLocation.lat, pickLocation.lng]} icon={pickIcon(theme)} interactive={false} />
        )}
        {visible.map((report) => (
          <Marker
            key={report.id}
            position={[Number(report.latitude), Number(report.longitude)]}
            icon={reportIcon(report, selected?.id === report.id, theme)}
            zIndexOffset={selected?.id === report.id ? 1200 : 0}
            eventHandlers={{ click: () => onSelect(report) }}
          />
        ))}
      </MapContainer>

      <div className="map-controls" role="group" aria-label="Map controls">
        <button type="button" onClick={() => nudge('in')} aria-label="Zoom in" title="Zoom in"><Plus size={15} /></button>
        <button type="button" onClick={() => nudge('out')} aria-label="Zoom out" title="Zoom out"><Minus size={15} /></button>
        <button type="button" onClick={() => nudge('province')} aria-label="Recentre on Eastern Samar" title="Recentre on Eastern Samar"><Compass size={15} /></button>
      </div>

      {picking && (
        <div className="map-pick-banner">
          <Crosshair size={14} /> Click the map to place the report pin
          <button type="button" onClick={onCancelPick}>Cancel</button>
        </div>
      )}

      <div className="map-legend">
        <div className="legend-head">
          <span><Layers3 size={12} /> Concern categories</span>
          <button type="button" className="legend-toggle" onClick={() => setLegendOpen((open) => !open)} aria-expanded={legendOpen}>
            {legendOpen ? 'Hide' : 'Show'}
          </button>
        </div>
        {legendOpen && (
          <div className="legend-items">
            {categories.map((item) => {
              const { color, glyph } = categoryVisual(item.slug, theme);
              return (
                <button
                  type="button"
                  key={item.slug}
                  className={`legend-item${category === item.slug ? ' is-active' : ''}`}
                  style={{ '--legend-color': color }}
                  onClick={() => onCategory(category === item.slug ? 'all' : item.slug)}
                  title={`Filter by ${item.name}`}
                >
                  <svg className="legend-glyph" viewBox="0 0 24 24" aria-hidden="true">{glyph.map((d) => <path key={d} d={d} />)}</svg>
                  <i className="legend-mark" />
                  <span>{item.name}</span>
                  <b>{counts.get(item.slug) ?? 0}</b>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="map-status-key">
        <span><i className="key-verified" /> Reviewed</span>
        <span><i className="key-pending" /> Pending review</span>
      </div>

      {detail}
    </section>
  );
}
