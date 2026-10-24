// Reproducible extraction from geoBoundaries gbOpen PHL ADM3 (2020), CC BY 3.0 IGO.
import { readFile, writeFile } from 'node:fs/promises';
import { MUNICIPALITIES, PROVINCE } from '../src/lib/place.js';
const source = JSON.parse(await readFile(process.argv[2], 'utf8'));
const normalize = (name) => name.toLowerCase().replace('city of ', '').replace(' city', '').replaceAll('-', '').replaceAll(' ', '');
const names = new Map(MUNICIPALITIES.map((name) => [normalize(name), name]));
const [[south, west], [north, east]] = PROVINCE.bounds;
const selected = source.features.filter((feature) => {
  const coordinates = feature.geometry.coordinates.flat(feature.geometry.type === 'MultiPolygon' ? 2 : 1);
  const xs = coordinates.map(([x]) => x), ys = coordinates.map(([,y]) => y);
  const x = (Math.min(...xs) + Math.max(...xs))/2, y = (Math.min(...ys) + Math.max(...ys))/2;
  return names.has(normalize(feature.properties.shapeName)) && x >= west && x <= east && y >= south && y <= north;
}).map((feature) => ({ ...feature, properties: { ...feature.properties, municipality: names.get(normalize(feature.properties.shapeName)) } }));
if (selected.length !== 23 || new Set(selected.map((feature) => feature.properties.municipality)).size !== 23) throw new Error(`Expected 23 distinct municipalities; found ${selected.length}`);
await writeFile(new URL('../src/assets/eastern-samar-municipalities.json', import.meta.url), JSON.stringify({ type:'FeatureCollection', source:'https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/', license:'CC BY 3.0 IGO', features:selected }));
console.log(`Saved ${selected.length} verified municipal features.`);
