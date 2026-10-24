// Group in projected world pixels so clustering is deterministic at each zoom.
export function clusterReports(reports, zoom, cellSize = 54) {
  const groups = new Map();
  const scale = 256 * 2 ** zoom;
  for (const report of reports) {
    const lat = Number(report.latitude), lng = Number(report.longitude);
    const sin = Math.sin(lat * Math.PI / 180);
    const x = (lng + 180) / 360 * scale;
    const y = (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
    const key = `${Math.floor(x/cellSize)}:${Math.floor(y/cellSize)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }
  return [...groups.entries()].map(([id, items]) => ({ id, items, position: [items.reduce((total,report) => total+Number(report.latitude),0)/items.length, items.reduce((total,report) => total+Number(report.longitude),0)/items.length] }));
}
