import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { CalendarDays, Compass, Crosshair, Layers3, MapPin, Minus, Plus, Users } from 'lucide-react';
import easternSamarBoundary from '../assets/eastern-samar-boundary.json';
import municipalBoundaries from '../assets/eastern-samar-municipalities.json';
import { clusterReports } from '../lib/mapClusters.js';
import { formatStatus } from '../lib/reports.js';
import CategorySheet from './CategorySheet.jsx';
import usePhoneLayout from '../lib/useMediaQuery.js';
import { observeMapViewport } from '../lib/mapViewport.js';
import {
  BASEMAPS, PROVINCE, categoryGlyphMarkup, categoryVisual, hasCoordinates, isReviewed,
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

function volunteerIcon(opportunity, theme) {
  const { color } = categoryVisual(opportunity.category, theme);
  return divIcon({
    className: 'volunteer-marker-shell',
    html: `<span class="volunteer-map-marker" style="--marker-color:${color}">${categoryGlyphMarkup(opportunity.category)}<i></i></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 35],
  });
}

// Publishes the Leaflet instance so overlays outside the map can drive it.
function MapHandle({ onReady }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

function ReportMarkers({ reports, selected, theme, categories, onSelect }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend() { setZoom(map.getZoom()); } });
  const groups = useMemo(() => clusterReports(reports, zoom), [reports, zoom]);
  return groups.map((group) => group.items.length > 1 ? <Marker key={group.id} position={group.position}
    title={`${group.items.length} community concerns. Zoom or open to inspect.`}
    icon={divIcon({ className:'report-cluster-shell',html:`<span class="report-cluster" style="width:40px;height:40px">${group.items.length}</span>`,iconSize:[40,40],iconAnchor:[20,20] })}
    eventHandlers={{ click: () => { if (map.getZoom()<map.getMaxZoom()) map.flyTo(group.position,Math.min(map.getZoom()+2,map.getMaxZoom()),{ animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches }); } }}>
    <Popup><div className="report-popup-content"><strong>{group.items.length} concerns in this area</strong>{group.items.map((report) => <button key={report.id} onClick={() => onSelect(report)}>{report.title}</button>)}</div></Popup>
  </Marker> : (() => {
    const report=group.items[0];
    return <Marker key={report.id} position={group.position} title={report.title} icon={reportIcon(report,selected?.id===report.id,theme)} zIndexOffset={selected?.id===report.id?1200:0}>
      <Popup><div className="report-popup-content"><strong>{report.title}</strong><span>{categories.find((category) => category.slug===report.category_slug)?.name || report.category_slug}</span><span>{[report.barangay,report.municipality].filter(Boolean).join(', ')}</span><span>{formatStatus(report.status)}</span><time>{new Date(report.created_at).toLocaleDateString('en-PH')}</time><p>{report.description.slice(0,160)}{report.description.length>160?'…':''}</p><button onClick={() => onSelect(report)}>View Details</button></div></Popup>
    </Marker>;
  })());
}

// Eastern Samar is the subject: the map opens fitted to the province, and the
// container keeps panning inside the padded province bounds.
function ProvinceViewport({ focus, area }) {
  const map = useMap();
  useEffect(() => observeMapViewport(map, PROVINCE.bounds), [map]);
  useEffect(() => {
    const feature=municipalBoundaries.features.find((feature) => feature.properties.municipality===area);
    if (feature) {
      const points=feature.geometry.coordinates.flat(feature.geometry.type==='MultiPolygon'?2:1);
      const xs=points.map(([x])=>x),ys=points.map(([,y])=>y);
      map.fitBounds([[Math.min(...ys),Math.min(...xs)],[Math.max(...ys),Math.max(...xs)]],{padding:[24,24],maxZoom:13});
    }
  },[map,area]);
  useEffect(() => {
    if (!focus?.latlng) return;
    const zoom = focus.zoom ?? Math.min(Math.max(map.getZoom(), 12), 15);
    map.flyTo(focus.latlng, zoom, { duration: 0.75, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  }, [map, focus]);
  return null;
}

function ClickCapture({ enabled, onPick }) {
  useMapEvents({ click(event) { if (enabled) onPick(event.latlng); } });
  return null;
}

function MapGestures({ mobile, enabled }) {
  const map = useMap();
  useEffect(() => {
    for (const handler of [map.dragging, map.touchZoom, map.scrollWheelZoom, map.doubleClickZoom]) {
      if (!mobile || enabled) handler.enable(); else handler.disable();
    }
  }, [map, mobile, enabled]);
  return null;
}

export default function ProvinceMap({
  reports, theme, categories, counts, category, onCategory, area, selected, onSelect, onTheme,
  focus, picking, onPick, onCancelPick, pickLocation, onStartReport, detail, mappedCount,
  volunteerOpportunities = [], volunteerSignupCounts = {}, onVolunteerOpen, filters, onFilters, municipalities, statuses,
}) {
  const mapRef = useRef(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [tileState, setTileState] = useState('loading');
  const mobile = usePhoneLayout(900);
  const activeFilters = (category !== 'all' ? 1 : 0) + Object.entries(filters || {}).filter(([key,value]) => key === 'query' ? value.trim() : value !== 'all').length;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [touchActive, setTouchActive] = useState(true);
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
  const visible = useMemo(() => reports.filter(hasCoordinates), [reports]);
  const visibleVolunteers = useMemo(() => volunteerOpportunities.filter((opportunity) => (
    hasCoordinates(opportunity) && !['cancelled', 'completed'].includes(opportunity.status)
  )), [volunteerOpportunities]);

  function nudge(action) {
    const instance = mapRef.current;
    if (!instance) return;
    if (action === 'in') instance.zoomIn();
    else if (action === 'out') instance.zoomOut();
    else instance.flyToBounds(PROVINCE.bounds, { padding: [18, 18], duration: 0.7, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
  }

  return (
    <section className={`map-stage${mobile && touchActive ? ' is-touch-active' : ''}`} id="explore-map" aria-label="Map of Eastern Samar">
      <div className="map-topline">
        <div className="map-location">
          <span className="map-location-mark"><Crosshair size={14} /></span>
          <span className="map-location-copy">
            <strong>{area !== 'all' ? area : PROVINCE.name}</strong>
            <small>{area !== 'all' ? area : `${PROVINCE.region} · ${visible.length} mapped points`}</small>
          </span>
        </div>
        <div className="map-top-actions">
          <button className="map-tool-button" type="button" aria-pressed={roadsVisible} onClick={() => setRoadsVisible((visible) => !visible)}><Layers3 size={14} />{roadsVisible ? 'Hide basemap' : 'Show basemap'}</button>
          <span className="map-count"><i /> {mappedCount} reports · {visibleVolunteers.length} activities</span>
          <button className="map-tool-button" type="button" onClick={onStartReport}><Plus size={14} /> Report</button>
        </div>
      </div>

      <div className="map-hud" aria-live="polite">
        <span className="map-hud-badge">Eastern Samar</span>
        <span>{reports.length || visibleVolunteers.length ? `${reports.length} concerns · ${visibleVolunteers.length} volunteer activities` : 'No published reports or activities match this view'}</span>
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
        {roadsVisible && <TileLayer
          key={theme}
          url={basemap.url}
          attribution={basemap.attribution}
          subdomains="abcd"
          detectRetina
          eventHandlers={{ tileload: () => setTileState('ready'), tileerror: () => setTileState(current => current === 'ready' ? current : 'error') }}
        />}
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
            fillColor: theme === 'dark' ? '#223b33' : '#c4d8cc',
            fillOpacity: roadsVisible ? 0.12 : 1,
          }}
        />
        <GeoJSON data={municipalBoundaries} style={(feature) => ({color:theme==='dark'?'#78b4b4':'#315b69',weight:feature.properties.municipality===area ? 3 : 1,fillOpacity:feature.properties.municipality===area ? .15 : 0,opacity:.7})} onEachFeature={(feature,layer) => layer.bindTooltip(feature.properties.municipality)} />
        <MapHandle onReady={handleReady} />
        <MapGestures mobile={mobile} enabled={touchActive || picking} />
        <ProvinceViewport focus={focus} area={area} />
        <ClickCapture enabled={picking} onPick={onPick} />
        {pickLocation && (
          <Marker position={[pickLocation.lat, pickLocation.lng]} icon={pickIcon(theme)} interactive={false} />
        )}
        <ReportMarkers reports={visible} selected={selected} theme={theme} categories={categories} onSelect={onSelect} />
        {visibleVolunteers.map((opportunity) => {
          const count = volunteerSignupCounts[opportunity.id] ?? 0;
          const remaining = opportunity.capacity ? Math.max(0, opportunity.capacity - count) : null;
          return <Marker
            key={`volunteer-${opportunity.id}`}
            position={[Number(opportunity.latitude), Number(opportunity.longitude)]}
            icon={volunteerIcon(opportunity, theme)}
          >
            <Popup className="volunteer-map-popup">
              <div className="volunteer-popup-content">
                <span className="eyebrow">VOLUNTEER ACTIVITY</span>
                <strong>{opportunity.title}</strong>
                <span><MapPin size={12} />{[opportunity.barangay, opportunity.municipality].filter(Boolean).join(', ') || PROVINCE.name}</span>
                <span><CalendarDays size={12} />{opportunity.starts_at ? new Date(opportunity.starts_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : 'Schedule to be announced'}</span>
                <span><Users size={12} />{remaining === null ? `${count} joined` : `${remaining} volunteer${remaining === 1 ? '' : 's'} needed`}</span>
                <div><button type="button" onClick={() => onVolunteerOpen?.(opportunity, false)}>View details</button><button type="button" onClick={() => onVolunteerOpen?.(opportunity, true)}>Join</button></div>
              </div>
            </Popup>
          </Marker>;
        })}
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

      {mobile && <div className="mobile-map-toolbar">
        <button onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-expanded={sheetOpen}><Layers3 size={17} />Filters{activeFilters > 0 && <b aria-label={`${activeFilters} active filters`}>{activeFilters}</b>}</button>
        <button aria-pressed={touchActive} onClick={() => setTouchActive((active) => !active)}><Crosshair size={17} />{touchActive ? 'Done moving' : 'Move map'}</button>
      </div>}
      {!mobile && <div className="desktop-map-filter"><select aria-label="Map category" value={category} onChange={event => onCategory(event.target.value)}><option value="all">All categories</option>{categories.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></div>}
      {onTheme && <button className="map-style-toggle" onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light map' : 'Dark map'}</button>}
      {roadsVisible && tileState === 'error' && <p className="map-connection-note" role="status">Street tiles could not load. Province boundaries and report points are still available.</p>}
      {mobile && sheetOpen && <CategorySheet filters={filters} onFilters={onFilters} municipalities={municipalities} statuses={statuses} categories={categories} counts={counts} category={category} theme={theme} onApply={onCategory} onClose={() => setSheetOpen(false)} />}
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
                  aria-pressed={category === item.slug}
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
