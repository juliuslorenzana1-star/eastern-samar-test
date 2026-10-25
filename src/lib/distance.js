// Great-circle distance; public map coordinates are deliberately approximate.
export function distanceKm(origin, report) {
  const lat = Number(report.latitude), lng = Number(report.longitude);
  if (report.latitude == null || report.longitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  const radians = value => value * Math.PI / 180;
  const a = Math.sin(radians(lat - origin.latitude) / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(lat)) * Math.sin(radians(lng - origin.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
