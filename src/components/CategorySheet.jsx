import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useDialogFocus from '../lib/useDialogFocus.js';
import { categoryVisual } from '../lib/place.js';

export default function CategorySheet({ categories, counts, category, theme, onApply, onClose }) {
  const [draft, setDraft] = useState(category);
  const ref = useDialogFocus({ onClose });
  return createPortal(<div className="category-sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="category-sheet" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="category-sheet-title">
      <header><div><span className="eyebrow">EXPLORE COMMUNITY CONCERNS</span><h2 id="category-sheet-title">Concern categories</h2></div><button className="icon-button" onClick={onClose} aria-label="Close category filters"><X size={20} /></button></header>
      <p>Select one category, or explore all concerns. Counts follow your other report filters.</p>
      <div className="category-sheet-options" role="group" aria-label="Choose a concern category">
        <button aria-pressed={draft === 'all'} onClick={() => setDraft('all')}><span>All categories</span></button>
        {categories.map((item) => {
          const { color, glyph } = categoryVisual(item.slug, theme);
          return <button key={item.slug} aria-pressed={draft === item.slug} onClick={() => setDraft(draft === item.slug ? 'all' : item.slug)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ color }}>{glyph.map((d) => <path d={d} key={d} />)}</svg><span>{item.name}</span><b>{counts.get(item.slug) ?? 0}</b>
          </button>;
        })}
        {!categories.length && <p>Categories will appear when the shared category list is available.</p>}
      </div>
      <footer><button className="outline-button" onClick={() => setDraft('all')}>Clear filters</button><button className="primary-button" onClick={() => { onApply(draft); onClose(); }}>Apply filters</button></footer>
    </section>
  </div>, document.body);
}
