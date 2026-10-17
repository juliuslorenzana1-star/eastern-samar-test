import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Hand, Layers3, MapPin, Maximize2, Minimize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { GeoJSON, MapContainer, Marker, Pane, Popup, ScaleControl, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { DomEvent, divIcon } from 'leaflet';
import boundary from '../assets/eastern-samar-boundary.json';
import { PROVINCE, categoryVisual, categoryGlyphMarkup, hasCoordinates, placeLine, statusColor } from '../lib/place.js';
import './operations-map.css';

// Verified against the public Esri service metadata and its ArcGIS item credits.
// These are native dark cartographic tiles, rather than a filtered street map.
const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services';
const BASEMAPS = {
  dark: { name: 'Dark map', detail: 'Roads & place names', url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, nativeZoom: 16, attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, GIS User Community' },
  satellite: { name: 'Satellite', detail: 'World imagery', url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, nativeZoom: 19, attribution: 'Imagery: <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri, Vantor, Earthstar Geographics, GIS User Community</a>' },
  outline: { name: 'Outline', detail: 'Province & reports' },
};
const BOUNDARY_CREDIT = 'Boundary: <a href="https://www.geoboundaries.org/">geoBoundaries</a> / NAMRIA, PSA, OCHA · CC BY 3.0 IGO';
const outerRings = boundary.features.flatMap(({ geometry }) => geometry.type === 'MultiPolygon' ? geometry.coordinates.map((polygon) => polygon[0]) : [geometry.coordinates[0]]);
const outsideProvince = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...outerRings] } };
const label = (value) => String(value ?? 'Unknown').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function markerIcon(reports, selectedId) {
  const report = reports.find((item) => item.id === selectedId) ?? reports[0];
  const isSelected = reports.some((item) => item.id === selectedId);
  const state = report.status === 'resolved' ? 'resolved' : report.status === 'rejected' ? 'rejected' : ['pending_review', 'under_review', 'needs_more_information'].includes(report.status) ? 'review' : 'active';
  const count = reports.length > 1 ? `<b class="ops-geo-pin-count">${reports.length}</b>` : '';
  // Glyph paths and colours come only from the fixed, local category definitions.
  return divIcon({ className: `ops-geo-marker is-${state}${isSelected ? ' is-selected' : ''}`, html: `<span class="ops-geo-pin" style="--pin:${categoryVisual(report.category_slug, 'dark').color};--status:${statusColor(report.status, 'dark')}">${categoryGlyphMarkup(report.category_slug)}<i class="ops-geo-pin-status"></i>${count}</span>`, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -20] });
}

function Viewport({ selected, reset, expanded }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(PROVINCE.bounds, { padding: [34, 40], animate: false });
  }, [map, reset]);
  useEffect(() => {
    if (!selected || !hasCoordinates(selected)) return;
    map.flyTo([Number(selected.latitude), Number(selected.longitude)], Math.max(map.getZoom(), 12), { animate: !reduceMotion(), duration: 0.65 });
  }, [map, selected]);
  useEffect(() => {
    let frame;
    const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => map.invalidateSize({ pan: false })); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(map.getContainer());
    window.addEventListener('resize', resize);
    resize();
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); cancelAnimationFrame(frame); };
  }, [map, expanded]);
  return null;
}

function MapTools({ touchEnabled, onToggleTouch }) {
  const map = useMap();
  const controlsRef = useRef(null);
  const [position, setPosition] = useState(() => ({ center: map.getCenter(), zoom: map.getZoom() }));
  useMapEvents({ moveend: () => setPosition({ center: map.getCenter(), zoom: map.getZoom() }), zoomend: () => setPosition({ center: map.getCenter(), zoom: map.getZoom() }) });
  useEffect(() => {
    const node = controlsRef.current;
    DomEvent.disableClickPropagation(node);
    DomEvent.disableScrollPropagation(node);
  }, []);
  useEffect(() => {
    // Viewport can fit the province before this component subscribes to events.
    const frame = requestAnimationFrame(() => setPosition({ center: map.getCenter(), zoom: map.getZoom() }));
    return () => cancelAnimationFrame(frame);
  }, [map]);
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    if (touchEnabled) map.dragging.enable();
    else map.dragging.disable();
    map.getContainer().style.touchAction = touchEnabled ? 'none' : 'pan-y';
    return () => { map.getContainer().style.touchAction = ''; };
  }, [map, touchEnabled]);
  return <>
    <div className="ops-geo-tools" ref={controlsRef}>
      <div className="ops-geo-north" title="North is up"><span>N</span><svg width="17" height="24" viewBox="0 0 17 24" aria-hidden="true"><path d="M8.5 1 16 22l-7.5-5L1 22Z" fill="currentColor" /><path d="m8.5 1 0 16L1 22Z" fill="#324a53" /></svg></div>
      <div className="ops-geo-zoom"><button type="button" aria-label="Zoom in" title="Zoom in" disabled={position.zoom >= map.getMaxZoom()} onClick={() => map.zoomIn()}><Plus size={18} /></button><button type="button" aria-label="Zoom out" title="Zoom out" disabled={position.zoom <= map.getMinZoom()} onClick={() => map.zoomOut()}><Minus size={18} /></button></div>
      <button className="ops-geo-fit" type="button" aria-label="Fit Eastern Samar province" title="Fit province" onClick={() => map.fitBounds(PROVINCE.bounds, { padding: [34, 40], animate: !reduceMotion() })}><Crosshair size={17} /></button>
      <button className={`ops-geo-touch-toggle${touchEnabled ? ' is-active' : ''}`} type="button" aria-label={touchEnabled ? 'Unlock page scrolling' : 'Enable dragging the map'} aria-pressed={touchEnabled} onClick={onToggleTouch}><Hand size={16} /></button>
    </div>
    <div className="ops-geo-readout" aria-label="Map center coordinates and zoom"><span>{position.center.lat.toFixed(4)}° N</span><span>{position.center.lng.toFixed(4)}° E</span><b>Z{position.zoom}</b></div>
  </>;
}

function OperationsMap({ reports = [], categories = [], selected = null, onSelect, onInspect, reset = 0 }) {
  const [style, setStyle] = useState('dark');
  const [layersOpen, setLayersOpen] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const [tileReady, setTileReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [touchEnabled, setTouchEnabled] = useState(false);
  const shellRef = useRef(null);
  const expandButtonRef = useRef(null);
  const points = useMemo(() => reports.filter(hasCoordinates), [reports]);
  const groups = useMemo(() => {
    const grouped = new Map();
    points.forEach((report) => {
      // An exact coordinate match shares a marker. Report locations are never moved.
      const key = `${Number(report.latitude)},${Number(report.longitude)}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(report);
    });
    return [...grouped.entries()];
  }, [points]);
  const legend = useMemo(() => {
    const counts = new Map();
    points.forEach((report) => counts.set(report.category_slug ?? 'other', (counts.get(report.category_slug ?? 'other') ?? 0) + 1));
    return [...counts].map(([slug, count]) => ({ slug, count, name: categories.find((item) => item.slug === slug)?.name ?? label(slug.replaceAll('-', ' ')) })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [points, categories]);
  useEffect(() => {
    if (!expanded) return;
    const shell = shellRef.current;
    const expandButton = expandButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...shell.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')].filter((node) => node.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => expandButton?.focus({ preventScroll: true }));
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setExpanded(false); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); shell.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !shell.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !shell.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', keydown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', keydown, true);
      if (expandButton?.isConnected) expandButton.focus({ preventScroll: true });
    };
  }, [expanded]);
  const switchStyle = (next) => { setStyle(next); setTileErrors(0); setTileReady(false); };
  const basemap = BASEMAPS[style];
  const missing = reports.length - points.length;
  return <section className={`ops-geo${expanded ? ' is-expanded' : ''} is-${style}`} ref={shellRef} role={expanded ? 'dialog' : 'region'} aria-modal={expanded ? true : undefined} tabIndex={expanded ? -1 : undefined} aria-label="Eastern Samar geographic report map">
    <MapContainer className="ops-geo-canvas" center={PROVINCE.center} zoom={9} minZoom={8} maxZoom={18} zoomSnap={0.25} zoomDelta={0.5} maxBounds={PROVINCE.maxBounds} maxBoundsViscosity={1} scrollWheelZoom={false} zoomControl={false} attributionControl={true} dragging={!window.matchMedia?.('(pointer: coarse)').matches} tapHold={false} keyboardPanDelta={60}>
      <Viewport selected={selected} reset={reset} expanded={expanded} />
      {style !== 'outline' && <TileLayer key={`${style}-${retry}`} url={basemap.url} attribution={basemap.attribution} maxNativeZoom={basemap.nativeZoom} maxZoom={18} noWrap keepBuffer={2} eventHandlers={{ tileload: () => setTileReady(true), tileerror: () => setTileErrors((count) => count + 1) }} />}
      <Pane name="ops-geo-mask" style={{ zIndex: 430, pointerEvents: 'none' }}><GeoJSON data={outsideProvince} attribution={BOUNDARY_CREDIT} interactive={false} style={{ stroke: false, fillColor: '#030b12', fillOpacity: style === 'outline' ? 0 : 0.68, fillRule: 'evenodd' }} /></Pane>
      {showBoundary && <Pane name="ops-geo-boundary" style={{ zIndex: 410, pointerEvents: 'none' }}><GeoJSON data={boundary} attribution={BOUNDARY_CREDIT} interactive={false} style={{ color: '#65d5cf', opacity: 0.8, weight: 1.4, fillColor: '#65d5cf', fillOpacity: style === 'outline' ? 0.09 : 0.035 }} /></Pane>}
      {style !== 'outline' && <Pane name="ops-geo-labels" style={{ zIndex: 420, pointerEvents: 'none' }}><TileLayer key={`labels-${style}-${retry}`} url={`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`} attribution={BASEMAPS.dark.attribution} maxNativeZoom={16} maxZoom={18} noWrap keepBuffer={2} /></Pane>}
      {showReports && groups.map(([key, group]) => <Marker key={key} position={[Number(group[0].latitude), Number(group[0].longitude)]} icon={markerIcon(group, selected?.id)} zIndexOffset={group.some((report) => report.id === selected?.id) ? 1000 : 0} title={group.length > 1 ? `${group.length} reports at this location` : group[0].title} eventHandlers={{ click: () => onSelect?.(group.find((report) => report.id === selected?.id) ?? group[0]) }}>
        <Popup minWidth={240} maxWidth={310} className="ops-geo-popup" autoPanPaddingTopLeft={[20, 72]} autoPanPaddingBottomRight={[60, 100]}>
          {group.length > 1 && <div className="ops-geo-popup-group">{group.length} REPORTS AT THIS LOCATION</div>}
          <div className="ops-geo-popup-list">{group.map((report) => <article key={report.id}>
            <span className="ops-geo-popup-status" style={{ '--status': statusColor(report.status, 'dark') }}><i />{label(report.status)}</span>
            <h3>{report.title}</h3><p><MapPin size={12} />{placeLine(report)}</p>
            <div className="ops-geo-popup-actions">{group.length > 1 && <button type="button" onClick={() => onSelect?.(report)}>Select report</button>}<button type="button" onClick={() => { setExpanded(false); onSelect?.(report); onInspect?.(report); }}>Inspect report <span aria-hidden="true">↗</span></button></div>
          </article>)}</div>
        </Popup>
      </Marker>)}
      <ScaleControl position="bottomleft" imperial={false} />
      <MapTools touchEnabled={touchEnabled} onToggleTouch={() => setTouchEnabled(!touchEnabled)} />
    </MapContainer>
    <div className="ops-geo-topline"><div className="ops-geo-location"><span className="ops-geo-location-icon"><Crosshair size={17} /></span><span><strong>Eastern Samar</strong><small>REGION VIII · PHILIPPINES</small></span></div><div className="ops-geo-top-actions"><button type="button" className={layersOpen ? 'is-active' : ''} aria-label="Map layers" onClick={() => setLayersOpen(!layersOpen)} aria-expanded={layersOpen} aria-controls="ops-geo-layers"><Layers3 size={15} /><span>Layers</span></button><button type="button" ref={expandButtonRef} aria-label={expanded ? 'Exit expanded map' : 'Expand map'} title={expanded ? 'Exit expanded map · Esc' : 'Expand map'} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div></div>
    {layersOpen && <div className="ops-geo-layers" id="ops-geo-layers"><div className="ops-geo-panel-title"><span>MAP LAYERS</span><button type="button" aria-label="Close map layers" onClick={() => setLayersOpen(false)}><X size={14} /></button></div><div className="ops-geo-styles" role="group" aria-label="Choose basemap">{Object.entries(BASEMAPS).map(([key, item]) => <button type="button" key={key} aria-pressed={style === key} className={`ops-geo-style ops-geo-style-${key}${style === key ? ' is-active' : ''}`} onClick={() => switchStyle(key)}><span aria-hidden="true" /><strong>{item.name}</strong></button>)}</div><label><input type="checkbox" checked={showBoundary} onChange={(event) => setShowBoundary(event.target.checked)} /><span className="ops-geo-boundary-key" />Province boundary</label><label><input type="checkbox" checked={showReports} onChange={(event) => setShowReports(event.target.checked)} /><span className="ops-geo-report-key" />Report locations <b>{points.length}</b></label><p>Basemap place names are provided by Esri. Report coordinates may be approximate.</p></div>}
    {tileErrors > 0 && style !== 'outline' && <div className="ops-geo-tile-error" role="status"><span>Some basemap tiles are unavailable. Province and reports remain visible.</span><button type="button" aria-label="Retry loading basemap" onClick={() => { setTileErrors(0); setTileReady(false); setRetry(retry + 1); }}><RotateCcw size={13} />Retry</button><button type="button" onClick={() => switchStyle('outline')}>Use outline</button></div>}
    <div className="ops-geo-bottomline"><div className="ops-geo-legend"><button type="button" className="ops-geo-legend-toggle" aria-label="Report map legend" onClick={() => setLegendOpen(!legendOpen)} aria-expanded={legendOpen}><span className="ops-geo-live-dot" /><strong>{points.length}</strong> mapped <span className="ops-geo-legend-separator">/</span>{reports.length} matching <Layers3 size={12} /><span className="ops-geo-legend-word">Legend</span></button>{legendOpen && <div className="ops-geo-legend-body"><span className="ops-geo-legend-title">REPORT CATEGORIES</span>{legend.length ? legend.map((item) => <div key={item.slug}><i style={{ background: categoryVisual(item.slug, 'dark').color }} /><span>{item.name}</span><b>{item.count}</b></div>) : <p>No report locations in this view.</p>}<div className="ops-geo-status-key"><span><i className="is-review" />Review</span><span><i className="is-active" />Active</span><span><i className="is-resolved" />Resolved</span></div><small>Category icon · status ring</small></div>}</div><span className="ops-geo-basemap-name"><i className={tileErrors ? 'is-warning' : ''} />{style === 'outline' ? 'VECTOR OUTLINE' : tileReady ? style === 'satellite' ? 'SATELLITE IMAGERY' : 'DARK CARTOGRAPHY' : 'LOADING BASEMAP'}</span></div>
    {missing > 0 && <div className="ops-geo-unmapped">{missing} matching {missing === 1 ? 'report has' : 'reports have'} no coordinates</div>}
    <div className="ops-geo-touch-hint">{touchEnabled ? 'Map dragging on · tap the hand to scroll the page' : 'Tap the hand to move the map · use + / − to zoom'}</div>
  </section>;
}

export default memo(OperationsMap);
