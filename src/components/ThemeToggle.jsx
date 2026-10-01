import { Monitor, Moon, Sun } from 'lucide-react';
import { themeModes } from '../lib/theme.js';

const labels = { light: 'Light', dark: 'Dark', system: 'System' };
const icons = { light: Sun, dark: Moon, system: Monitor };

// One control for the three modes the platform supports. The stored value is
// the resident's choice ("system" keeps following the OS), not the resolved look.
export default function ThemeToggle({ mode, onChange }) {
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
            title={`${labels[option]} theme`}
            className={`theme-option${active ? ' is-active' : ''}`}
            onClick={() => onChange(option)}
          >
            <Icon size={13} />
            <span>{labels[option]}</span>
          </button>
        );
      })}
    </div>
  );
}
