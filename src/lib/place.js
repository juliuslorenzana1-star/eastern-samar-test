// Eastern Samar geography, the seeded report categories, and the small
// derived-data helpers the interface needs.
//
// Nothing here invents data: municipalities come from the province's list of
// local government units, categories are the slugs seeded by
// supabase/migrations/202609290001_initial_platform.sql, and every count,
// coverage figure, and focus point is computed from reports already loaded from
// Supabase.

// Real-world extent of Eastern Samar province (main island plus the outlying
// island barangays in the Samar Sea), used for the default viewport.
export const PROVINCE = {
  name: 'Eastern Samar',
  region: 'Eastern Visayas · Philippines',
  coastline: 'Philippine Sea',
  // [southWest, northEast]
  bounds: [[10.687949282, 125.125405412], [12.349578051, 125.969094646]],
  // A small breathing room so panning never wanders off into a world map.
  maxBounds: [[10.53, 124.95], [12.51, 126.13]],
  center: [11.52, 125.55],
  focusZoom: 9,
  zoomRange: [8, 17],
};

// Keyless raster styles keep the map available without vendor credentials.
const mapAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Boundaries: <a href="https://www.geoboundaries.org/">geoBoundaries</a> (NAMRIA, PSA, OCHA Philippines) · CC BY 3.0 IGO';

export const BASEMAPS = {
  light: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: mapAttribution,
  },
  dark: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: mapAttribution,
  },
};

export const MUNICIPALITIES = [
  'Arteche', 'Balangiga', 'Balangkayan', 'Borongan City', 'Can-avid', 'Dolores',
  'General MacArthur', 'Giporlos', 'Guiuan', 'Hernani', 'Jipapad', 'Lawaan',
  'Llorente', 'Maslog', 'Maydolong', 'Mercedes', 'Oras', 'Quinapondan',
  'Salcedo', 'San Julian', 'San Policarpo', 'Sulat', 'Taft',
];

// stroke-only 24x24 glyphs so a marker stays legible at 22px in either theme.
export const CATEGORY_META = {
  'disaster-emergency': {
    light: '#d8492f', dark: '#ff8362',
    glyph: ['M12 3.7 21.4 20.2H2.6z', 'M12 9.6v4.5', 'M12 17.2h.01'],
  },
  infrastructure: {
    light: '#b0602c', dark: '#f0a35f',
    glyph: ['M3.6 20.3h16.8', 'M6.4 20.3V7.4l5.4-3.2v16.1', 'M11.8 11.4l5.8 2.6v6.3', 'M8.9 11.6h.9M8.9 14.9h.9'],
  },
  environment: {
    light: '#1f8f5e', dark: '#4bd593',
    glyph: ['M5.2 19.4c-.6-7.4 4.3-13 14-13.6-.5 9.3-4.9 13.2-11.6 13.2', 'M5.6 19.4c2.6-4.2 5.7-6.6 9.2-8'],
  },
  'public-safety': {
    light: '#2f6f9f', dark: '#6cb6f0',
    glyph: ['M12 3.4 19.2 6.1v6.1c0 4-3 6.6-7.2 8.4-4.2-1.8-7.2-4.4-7.2-8.4V6.1z', 'M9.4 12.1l1.9 1.9 3.5-3.7'],
  },
  health: {
    light: '#c2334f', dark: '#ff7089',
    glyph: ['M12 5.6v12.8', 'M5.6 12h12.8'],
  },
  education: {
    light: '#6c4fbf', dark: '#b49cff',
    glyph: ['M4 6.6c2.7-1.4 5.3-1.4 8 0v12.2c-2.7-1.4-5.3-1.4-8 0z', 'M12 6.6c2.7-1.4 5.3-1.4 8 0v12.2c-2.7-1.4-5.3-1.4-8 0z'],
  },
  transportation: {
    light: '#0e7f8f', dark: '#45d2e0',
    glyph: ['M9 20.4 10.6 4h2.8l1.6 16.4z', 'M12 7.6v2.4M12 12.6v2.4M12 17.4v1.4'],
  },
  'community-services': {
    light: '#a08326', dark: '#f2c65c',
    glyph: ['M4.2 11.4 12 5.1l7.8 6.3v8.9H4.2z', 'M9.9 20.3v-5.6h4.2v5.6'],
  },
  youth: {
    light: '#a3357f', dark: '#ff83cf',
    glyph: ['M12 9.6a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z', 'M6.4 20.4a5.6 5.6 0 0 1 11.2 0'],
  },
  other: {
    light: '#64757f', dark: '#a9bcc7',
    glyph: ['M12 4.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6z', 'M12 10.4v5.4M12 7.4h.01'],
  },
};

const FALLBACK_CATEGORY = CATEGORY_META.other;

// Category colours are tuned per theme: dark mode needs brighter, slightly
// desaturated markers so they read against a charcoal basemap.
export function categoryVisual(slug, theme = 'light') {
  const meta = CATEGORY_META[slug] ?? FALLBACK_CATEGORY;
  return {
    color: theme === 'dark' ? meta.dark : meta.light,
    glyph: meta.glyph,
    known: Boolean(CATEGORY_META[slug]),
  };
}

export function categoryGlyphMarkup(slug, className = 'marker-glyph') {
  const { glyph } = categoryVisual(slug, 'light');
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${glyph
    .map((d) => `<path d="${d}" />`)
    .join('')}</svg>`;
}

export const STATUS_COLORS = {
  light: {
    pending_review: '#b8791a', under_review: '#3d7ba6', needs_more_information: '#7b5bb5',
    approved: '#2f8158', verified: '#177f79', in_progress: '#2f8158', resolved: '#5f6f68', rejected: '#bb463c',
  },
  dark: {
    pending_review: '#f2b34b', under_review: '#79b9e0', needs_more_information: '#b79bff',
    approved: '#4fd39a', verified: '#4ad2cc', in_progress: '#4fd39a', resolved: '#9db0a7', rejected: '#ff7d6f',
  },
};

export function statusColor(status, theme = 'light') {
  const table = STATUS_COLORS[theme] ?? STATUS_COLORS.light;
  return table[status] ?? (theme === 'dark' ? '#9db0a7' : '#5f6f68');
}

// Statuses that read as "an authorized reviewer has confirmed this".
const REVIEWED_STATUSES = ['approved', 'verified', 'in_progress', 'resolved'];

export function isReviewed(status) {
  return REVIEWED_STATUSES.includes(status);
}

// Eastern Samar -> Municipality -> Barangay, built only from stored columns.
export function provinceContext(report) {
  return [PROVINCE.name, report?.municipality, report?.barangay].filter((part) => Boolean(part && part.trim()));
}

export function placeLine(report) {
  const [, municipality, barangay] = provinceContext(report);
  if (municipality && barangay) return `${barangay}, ${municipality}`;
  return municipality || PROVINCE.name;
}

export function hasCoordinates(report) {
  return Number.isFinite(Number(report?.latitude)) && Number.isFinite(Number(report?.longitude));
}

export function centroid(reports) {
  const points = reports.filter(hasCoordinates);
  if (!points.length) return null;
  const total = points.length;
  const lat = points.reduce((sum, report) => sum + Number(report.latitude), 0) / total;
  const lng = points.reduce((sum, report) => sum + Number(report.longitude), 0) / total;
  return [lat, lng];
}

// Per-municipality activity, always derived from loaded reports.
export function municipalityCoverage(reports, municipalityList = MUNICIPALITIES) {
  const grouped = new Map();
  municipalityList.forEach((name) => grouped.set(name, { municipality: name, count: 0, barangays: new Set(), focus: [] }));
  reports.forEach((report) => {
    const entry = grouped.get(report.municipality);
    if (!entry) return;
    entry.count += 1;
    if (report.barangay && report.barangay.trim()) entry.barangays.add(report.barangay.trim());
    if (hasCoordinates(report)) entry.focus.push(report);
  });
  return [...grouped.values()]
    .map((entry) => ({
      municipality: entry.municipality,
      count: entry.count,
      barangays: [...entry.barangays].sort(),
      focus: entry.focus.length ? centroid(entry.focus) : null,
    }))
    .sort((first, second) => (second.count - first.count) || first.municipality.localeCompare(second.municipality));
}

export function barangayCoverage(reports) {
  const seen = new Set();
  reports.forEach((report) => {
    const barangay = report.barangay?.trim();
    if (barangay) seen.add(`${report.municipality}::${barangay.toLowerCase()}`);
  });
  return seen.size;
}

export function categoryCounts(reports) {
  const counts = new Map();
  reports.forEach((report) => {
    counts.set(report.category_slug, (counts.get(report.category_slug) ?? 0) + 1);
  });
  return counts;
}

export function withinDays(reports, days) {
  const cutoff = Date.now() - days * 86400000;
  return reports.filter((report) => Date.parse(report.created_at) >= cutoff).length;
}

// Place names actually present in the data, for search assistance.
export function placeOptions(reports) {
  const municipalities = new Map();
  const barangays = new Map();
  reports.forEach((report) => {
    if (report.municipality) {
      const entry = municipalities.get(report.municipality) ?? { count: 0, focus: [] };
      entry.count += 1;
      if (hasCoordinates(report)) entry.focus.push(report);
      municipalities.set(report.municipality, entry);
    }
    const barangay = report.barangay?.trim();
    if (barangay) {
      const key = `${barangay} · ${report.municipality}`;
      const entry = barangays.get(key) ?? { count: 0, municipality: report.municipality, barangay, focus: [] };
      entry.count += 1;
      if (hasCoordinates(report)) entry.focus.push(report);
      barangays.set(key, entry);
    }
  });
  const asOptions = (map, type) => [...map.entries()]
    .map(([label, entry]) => ({
      type,
      label,
      municipality: entry.municipality ?? label,
      barangay: entry.barangay ?? null,
      count: entry.count,
      focus: entry.focus.length ? centroid(entry.focus) : null,
    }))
    .filter((option) => option.focus)
    .sort((first, second) => (second.count - first.count) || first.label.localeCompare(second.label));
  return { municipalities: asOptions(municipalities, 'municipality'), barangays: asOptions(barangays, 'barangay') };
}

