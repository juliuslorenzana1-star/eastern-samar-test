import { Monitor, Moon, Sun } from 'lucide-react';
import { themeModes } from '../lib/theme.js';
import usePhoneLayout from '../lib/useMediaQuery.js';

const labels = { light: 'Light', dark: 'Dark', system: 'System' };
const icons = { light: Sun, dark: Moon, system: Monitor };

// One control for the three modes the platform supports. The stored value is
// the resident's choice ("system" keeps following the OS), not the resolved look.
export default function ThemeToggle({ mode, onChange }) {
  const mobile = usePhoneLayout();
  if (mobile) return <select className="mobile-theme-select" value={mode} onChange={(event) => onChange(event.target.value)} aria-label="Colour theme">{themeModes.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select>;
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Colour theme">
      {themeModes.map((option) => {
        const Icon = icons[option];
        const active = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={`${labels[option]} theme`}
            className={`theme-option${active ? ' is-active' : ''}`}
            onClick={() => onChange(option)}
            onKeyDown={(event) => {
              const index = themeModes.indexOf(option);
              let next;
              if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = themeModes[(index + 1) % themeModes.length];
              else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = themeModes[(index + themeModes.length - 1) % themeModes.length];
              else if (event.key === 'Home') next = themeModes[0];
              else if (event.key === 'End') next = themeModes[themeModes.length - 1];
              if (next) {
                event.preventDefault();
                onChange(next);
                event.currentTarget.parentElement.children[themeModes.indexOf(next)]?.focus();
              }
            }}
          >
            <Icon size={13} />
            <span>{labels[option]}</span>
          </button>
        );
      })}
    </div>
  );
}
