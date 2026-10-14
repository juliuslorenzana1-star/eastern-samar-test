import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import boundary from '../assets/eastern-samar-boundary.json';
import './cinematic.css';

const sessionKey = 'escam.intro-seen.v1';
const mercator = (latitude) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
const rings = boundary.features.flatMap(({ geometry }) => geometry.type === 'MultiPolygon'
  ? geometry.coordinates.flatMap((polygon) => polygon)
  : geometry.coordinates);
const coordinates = rings.flat();
const west = Math.min(...coordinates.map(([x]) => x * Math.PI / 180));
const east = Math.max(...coordinates.map(([x]) => x * Math.PI / 180));
const south = Math.min(...coordinates.map(([, y]) => mercator(y)));
const north = Math.max(...coordinates.map(([, y]) => mercator(y)));
const scale = Math.min(300 / (east - west), 520 / (north - south));
function project([longitude, latitude]) {
  return [200 + (longitude * Math.PI / 180 - (west + east) / 2) * scale,
    290 - (mercator(latitude) - (south + north) / 2) * scale];
}
const outline = rings.map((ring) => `${ring.map((point, index) => `${index ? 'L' : 'M'}${project(point).map((value) => value.toFixed(2)).join(',')}`).join('')}Z`).join('');
const mainRing = [...rings].sort((a, b) => b.length - a.length)[0];
const accents = [0.08, 0.23, 0.4, 0.56, 0.72, 0.89].map((fraction) => project(mainRing[Math.floor(mainRing.length * fraction)]));

function shouldPlay() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try { return sessionStorage.getItem(sessionKey) !== '1'; } catch { return true; }
}

export default function CinematicEntry({ children }) {
  const [playing, setPlaying] = useState(shouldPlay);
  const skipRef = useRef(null);
  const appRef = useRef(null);

  function finish() {
    try { sessionStorage.setItem(sessionKey, '1'); } catch { /* Storage may be disabled. */ }
    setPlaying(false);
    window.requestAnimationFrame(() => appRef.current?.querySelector('.brand')?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    if (!playing) return undefined;
    try { sessionStorage.setItem(sessionKey, '1'); } catch { /* In-memory state still works. */ }
    skipRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(finish, 4600);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => { if (media.matches) finish(); };
    media.addEventListener('change', onMotionChange);
    return () => { window.clearTimeout(timer); media.removeEventListener('change', onMotionChange); };
  }, [playing]);

  return <>
    <div ref={appRef} inert={playing} className={`entry-application${playing ? ' is-entering' : ''}`}>{children}</div>
    {playing && <section className="cinematic-entry" role="dialog" aria-modal="true" aria-labelledby="entry-title" onKeyDown={(event) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'Tab') { event.preventDefault(); skipRef.current?.focus(); }
    }}>
      <div className="entry-graticule" aria-hidden="true" />
      <header className="entry-topline"><span>PH / EASTERN VISAYAS</span><span>A COMMUNITY ATLAS</span></header>
      <div className="entry-composition">
        <div className="entry-geography" aria-hidden="true">
          <svg viewBox="0 0 400 580" className="entry-outline">
            <path className="entry-land" d={outline} fillRule="evenodd" />
            <path className="entry-coast" d={outline} pathLength="1" />
            {accents.map(([cx, cy], index) => <circle className="entry-point" key={index} cx={cx} cy={cy} r="3" style={{ '--point-delay': `${1 + index * .18}s` }} />)}
          </svg>
          <span className="entry-sea">PHILIPPINE SEA</span>
          <span className="entry-north">N ↑</span>
        </div>
        <div className="entry-title-block">
          <span className="entry-kicker">OUR COAST. OUR COMMUNITIES.</span>
          <h1 id="entry-title">EASTERN<br />SAMAR<span>COMMUNITY ACTION MAP</span></h1>
          <p>Every community has a voice. Every concern deserves attention. Every action can create change.</p>
          <small>By Julius Lorenzana</small>
        </div>
      </div>
      <footer className="entry-footer"><span>BUILT FOR ESTEHANONS</span><button ref={skipRef} onClick={finish}>Skip intro <ArrowUpRight size={17} /></button></footer>
    </section>}
  </>;
}
