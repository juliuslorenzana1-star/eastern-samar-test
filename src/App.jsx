import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import {
  Activity, ArrowDownUp, ArrowRight, CalendarDays, Check, ChevronDown,
  CircleHelp, Clock3, Compass, Filter, HeartPulse, Layers3, MapPin, Menu,
  Plus, Search, ShieldCheck, Trees, Users, X,
} from 'lucide-react';

const categories = [
  { name: 'Infrastructure', color: '#e36e53' },
  { name: 'Disaster resilience', color: '#8767c4' },
  { name: 'Health & services', color: '#d95f87' },
  { name: 'Education & youth', color: '#d5a33a' },
  { name: 'Livelihood', color: '#438b64' },
  { name: 'Environment', color: '#278d88' },
];

const demoReports = [];

const statuses = { Submitted: '#d39829', 'Under review': '#5483a6', Verified: '#438b64', Addressed: '#738078' };
const municipalities = ['Arteche', 'Balangiga', 'Balangkayan', 'Borongan City', 'Can-avid', 'Dolores', 'General MacArthur', 'Giporlos', 'Guiuan', 'Hernani', 'Jipapad', 'Lawaan', 'Llorente', 'Maslog', 'Maydolong', 'Mercedes', 'Oras', 'Quinapondan', 'Salcedo', 'San Julian', 'San Policarpo', 'Sulat', 'Taft'];
const pageLoadedAt = Date.now();
const categoryColor = (name) => categories.find((item) => item.name === name)?.color ?? '#438b64';

function pinIcon(report, selected) {
  return divIcon({ className: 'report-marker-shell', html: `<span class="report-marker${selected ? ' is-selected' : ''}" style="--marker-color:${categoryColor(report.category)}"><span></span></span>`, iconSize: [30, 38], iconAnchor: [15, 35], popupAnchor: [0, -31] });
}

function MapFocus({ report }) {
  const map = useMap();
  useEffect(() => {
    if (report) map.flyTo([report.lat, report.lng], Math.max(map.getZoom(), 11), { duration: 0.75 });
  }, [map, report]);
  return null;
}

function MapPicker({ enabled, onPick }) {
  useMapEvents({ click(event) { if (enabled) onPick(event.latlng); } });
  return null;
}

function Status({ value }) {
  return <span className="status-pill" style={{ '--status-color': statuses[value] }}><i className="status-dot" />{value}</span>;
}

function ReportRow({ report, active, onSelect }) {
  return <button className={`report-card${active ? ' is-active' : ''}`} onClick={() => onSelect(report)}>
    <i className="report-card-mark" style={{ '--category-color': categoryColor(report.category) }} />
    <span className="report-card-content">
      <span className="report-card-topline"><span className="report-category">{report.category}</span><span className="report-date">{new Date(`${report.date}T12:00:00`).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })}</span></span>
      <span className="report-title">{report.title}</span>
      <span className="report-place"><MapPin size={12} />{report.barangay}, {report.municipality}</span>
      <span className="report-card-bottom"><Status value={report.status} /><span className="report-id">{report.id}</span></span>
    </span><ArrowRight className="report-arrow" size={15} />
  </button>;
}

function ReportForm({ onClose, onSubmit, onPickLocation, location, hidden }) {
  const [form, setForm] = useState({ title: '', category: categories[0].name, municipality: '', barangay: '', description: '' });
  const [error, setError] = useState('');
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function submit(event) {
    event.preventDefault();
    if (!location) { setError('Choose a point on the map before submitting.'); return; }
    if (form.title.trim().length < 6 || form.description.trim().length < 12) { setError('Add a clear title and a little more detail.'); return; }
    onSubmit({ ...form, title: form.title.trim(), description: form.description.trim(), ...location });
  }
  return <div className={`modal-backdrop${hidden ? ' is-hidden' : ''}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="modal-head"><div><span className="eyebrow">COMMUNITY REPORT</span><h2 id="form-title">Add a concern</h2></div><button className="icon-button" onClick={onClose} aria-label="Close report form"><X size={19} /></button></div>
      <p className="modal-intro">Share a local need for community review. Leave out names and other sensitive personal details.</p>
      <form onSubmit={submit}>
        <label className="field-label">Concern title<input name="title" maxLength="90" value={form.title} onChange={update} placeholder="What needs attention?" required /></label>
        <div className="form-row">
          <label className="field-label">Issue category<select name="category" value={form.category} onChange={update}>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
          <label className="field-label">Municipality / city<select name="municipality" value={form.municipality} onChange={update} required><option value="">Choose an area</option>{municipalities.map((place) => <option key={place}>{place}</option>)}</select></label>
        </div>
        <label className="field-label">Barangay<input name="barangay" maxLength="80" value={form.barangay} onChange={update} placeholder="Optional" /></label>
        <div className="location-select-row"><span className="location-select-icon"><MapPin size={16} /></span><span className="location-select-copy"><strong>{location ? 'Map point selected' : 'Pin the concern on the map'}</strong><span>{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Choose a point within the community.'}</span></span><button type="button" className="outline-button" onClick={onPickLocation}>{location ? 'Change' : 'Choose point'}</button></div>
        <label className="field-label">What is happening?<textarea name="description" rows="3" maxLength="500" value={form.description} onChange={update} placeholder="Describe the concern without identifying private individuals." required /></label>
        <label className="field-label photo-field">Optional photo<input type="file" accept="image/*" /><span className="field-hint">Photos are not uploaded or saved in this demo.</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-foot"><span><ShieldCheck size={14} /> New reports start unverified</span><button className="primary-button" type="submit"><Plus size={16} /> Submit report</button></div>
      </form>
    </section>
  </div>;
}

function App() {
  const [reports, setReports] = useState(demoReports);
  const [category, setCategory] = useState('All categories');
  const [area, setArea] = useState('All areas');
  const [status, setStatus] = useState('All statuses');
  const [dateRange, setDateRange] = useState('Any time');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [location, setLocation] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const placesWithReports = [...new Set(reports.map((report) => report.municipality))].sort();
  const filtered = reports.filter((report) => {
    const days = dateRange === 'Past 7 days' ? 7 : dateRange === 'Past 30 days' ? 30 : dateRange === 'Past 90 days' ? 90 : null;
    return (category === 'All categories' || report.category === category)
      && (area === 'All areas' || report.municipality === area)
      && (status === 'All statuses' || report.status === status)
      && (`${report.title} ${report.description} ${report.municipality} ${report.barangay}`.toLowerCase().includes(query.toLowerCase()))
      && (days === null || new Date(`${report.date}T23:59:59`).getTime() >= pageLoadedAt - days * 86400000);
  });
  const pending = reports.filter((report) => ['Submitted', 'Under review'].includes(report.status)).length;
  const addressed = reports.filter((report) => report.status === 'Addressed').length;
  function clearFilters() { setCategory('All categories'); setArea('All areas'); setStatus('All statuses'); setDateRange('Any time'); setQuery(''); }
  function startReport() { setLocation(null); setFormOpen(true); setPanelOpen(false); }
  function startPicking() { setPicking(true); setFormOpen(false); setNotice('Click the map to place the report pin.'); }
  function pickPoint(point) { setLocation({ lat: point.lat, lng: point.lng }); setPicking(false); setFormOpen(true); setNotice('Location added to the report.'); }
  function addReport(values) {
    const report = { ...values, id: `preview-${Date.now()}`, barangay: values.barangay.trim() || 'Barangay not specified', status: 'Submitted', date: new Date().toISOString().slice(0, 10) };
    setReports((current) => [report, ...current]); setSelected(report); setFormOpen(false); setNotice('Preview only: this report is temporary and is not shared.');
  }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Eastern Samar Community Action Map home"><span className="brand-mark"><Compass size={21} /></span><span className="brand-copy"><strong>Eastern Samar</strong><span>COMMUNITY ACTION MAP</span></span></a>
      <div className="topbar-center"><i className="live-indicator" /> Province-wide view <span className="topbar-divider">/</span> <span>Community reports</span></div>
      <div className="topbar-actions"><span className="demo-label"><i /> Preview mode</span><button className="primary-button top-report-button" onClick={startReport}><Plus size={16} /> Report a concern</button><button className="icon-button mobile-menu" onClick={() => setPanelOpen((open) => !open)} aria-label="Toggle report panel"><Menu size={20} /></button></div>
    </header>
    <section className="dashboard-heading" id="top"><div className="heading-copy"><span className="eyebrow">SEE THE PROBLEMS. MAP THE NEEDS. MOBILIZE THE COMMUNITY.</span><h1>Community Action Map</h1><p>Reported needs and local action across Eastern Samar.</p></div><div className="heading-meta"><div className="privacy-note"><ShieldCheck size={16} /><span>Community-reported<br /><strong>not official findings</strong></span></div><button className="text-button" onClick={() => setNotice('Demo reports are illustrative only. Community submissions are not official findings until reviewed by an authorized moderator.')}><CircleHelp size={16} /> About this map</button></div></section>
    <div className="connection-banner" role="note"><ShieldCheck size={16} /><span><strong>Preview only.</strong> Reports are not connected to a shared database yet. Anything submitted here is temporary and only visible in this browser session.</span></div>
    <section className="stats-strip" aria-label="Report summary">
      <div className="stat-item"><span className="stat-icon orange"><Activity size={17} /></span><div><span className="stat-value">{reports.length}</span><span className="stat-label">Community reports</span></div></div>
      <div className="stat-item"><span className="stat-icon green"><MapPin size={17} /></span><div><span className="stat-value">{placesWithReports.length}<small> / 23</small></span><span className="stat-label">Areas represented</span></div></div>
      <div className="stat-item"><span className="stat-icon blue"><Clock3 size={17} /></span><div><span className="stat-value">{pending}</span><span className="stat-label">Pending validation</span></div></div>
      <div className="stat-item"><span className="stat-icon violet"><Check size={17} /></span><div><span className="stat-value">{addressed}</span><span className="stat-label">Marked addressed</span></div></div>
      <div className="stats-caption">Illustrative data <span>·</span> not live community records</div>
    </section>
    <section className={`workspace${panelOpen ? ' panel-open' : ''}`}>
      <aside className="report-panel">
        <div className="panel-heading"><div><span className="eyebrow">COMMUNITY PULSE</span><h2>Reported concerns <span>{filtered.length}</span></h2></div><button className="icon-button mobile-close" onClick={() => setPanelOpen(false)} aria-label="Close report panel"><X size={18} /></button></div>
        <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports or places" aria-label="Search reports or places" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}</div>
        <div className="filter-heading"><span><Filter size={14} /> Filters</span><button className="reset-button" onClick={clearFilters}>Reset</button></div>
        <div className="filters-grid">
          <label className="filter-select"><MapPin size={14} /><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Filter by municipality"><option>All areas</option>{municipalities.map((place) => <option key={place}>{place}</option>)}</select><ChevronDown size={13} /></label>
          <label className="filter-select"><Layers3 size={14} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option>All categories</option>{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select><ChevronDown size={13} /></label>
          <label className="filter-select"><Activity size={14} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option>All statuses</option>{Object.keys(statuses).map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label>
          <label className="filter-select"><CalendarDays size={14} /><select value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label="Filter by date"><option>Any time</option><option>Past 7 days</option><option>Past 30 days</option><option>Past 90 days</option></select><ChevronDown size={13} /></label>
        </div>
        <div className="list-toolbar"><span>{filtered.length} {filtered.length === 1 ? 'report' : 'reports'}</span><button className="sort-button" onClick={() => setReports((current) => [...current].sort((first, second) => second.date.localeCompare(first.date)))}><ArrowDownUp size={13} /> Recent</button></div>
        <div className="report-list">{filtered.length ? filtered.map((report) => <ReportRow key={report.id} report={report} active={selected?.id === report.id} onSelect={setSelected} />) : <div className="empty-state"><Search size={22} /><strong>No reports found</strong><span>Try a different filter or search.</span><button className="text-button" onClick={clearFilters}>Clear filters</button></div>}</div>
        <div className="panel-footer"><span><Users size={15} /> Built with community input</span><button className="footer-link" onClick={() => setNotice('Community reports are shown as submitted. Verification status is separate from government confirmation.')}><ShieldCheck size={14} /> Review standards</button></div>
      </aside>
      <section className="map-stage" aria-label="Interactive map of Eastern Samar">
        <div className="map-topline"><div className="map-location"><span className="map-location-mark"><MapPin size={15} /></span><span><strong>Eastern Samar</strong><small>Eastern Visayas, Philippines</small></span></div><div className="map-top-actions"><span className="map-count"><i /> {filtered.length} visible</span><button className="map-tool-button" onClick={startReport}><Plus size={15} /> Add report</button></div></div>
        {picking && <div className="map-pick-banner"><MapPin size={16} /> Click the map to place the report pin <button onClick={() => setPicking(false)}>Cancel</button></div>}
        <MapContainer center={[11.55, 125.45]} zoom={8} minZoom={7} maxZoom={17} scrollWheelZoom className="leaflet-map" zoomControl={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapFocus report={selected} /><MapPicker enabled={picking} onPick={pickPoint} />
          {filtered.map((report) => <Marker key={report.id} position={[report.lat, report.lng]} icon={pinIcon(report, selected?.id === report.id)} eventHandlers={{ click: () => setSelected(report) }}><Popup><div className="popup-card"><span className="popup-category" style={{ color: categoryColor(report.category) }}>{report.category}</span><strong>{report.title}</strong><span>{report.barangay}, {report.municipality}</span><Status value={report.status} /><small>Community report · {report.id}</small></div></Popup></Marker>)}
        </MapContainer>
        <div className="map-legend"><div className="legend-head"><span>Issue categories</span><span className="legend-tag">{categories.length}</span></div><div className="legend-items">{categories.map((item) => <button className={`legend-item${category === item.name ? ' is-active' : ''}`} key={item.name} onClick={() => setCategory(category === item.name ? 'All categories' : item.name)}><i style={{ '--legend-color': item.color }} /><span>{item.name}</span></button>)}</div></div>
        <div className="map-attribution-note"><Trees size={13} /> Map data © OpenStreetMap contributors</div><div className="map-status-key"><span><i className="key-verified" />Reviewed</span><span><i className="key-unverified" />Unverified</span></div>
      </section>
    </section>
    {notice && <div className="toast" role="status"><span><Check size={15} /></span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={14} /></button></div>}
    {(formOpen || picking) && <ReportForm onClose={() => setFormOpen(false)} onSubmit={addReport} onPickLocation={startPicking} location={location} hidden={picking} />}
    <footer className="site-footer"><span><HeartPulse size={14} /> A community-powered view of Eastern Samar</span><span>Demo prototype <i /> Reports are not official findings</span></footer>
  </main>;
}

export default App;
