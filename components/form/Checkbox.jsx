import React from 'react';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

/**
 * Checkbox — a soft-cornered box whose check is a self-drawn SVG stroke that
 * draws itself in (dashoffset) when checked. Star-blue, never emoji or a
 * unicode glyph. role="checkbox" + aria-checked on a native button.
 */
export function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  label,
  children,
  style,
  ...rest
}) {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const text = label != null ? label : children;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled && onChange) onChange(!checked); }}
      className="sr-focus-ring"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9,
        background: 'none', border: 'none', padding: 0,
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          width: 18, height: 18, boxSizing: 'border-box', flex: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--r-xs)',
          background: checked ? 'rgba(159,198,255,0.20)' : 'var(--space-1)',
          border: '1px solid ' + (checked ? 'var(--glass-border-strong)' : 'var(--glass-border)'),
          boxShadow: checked ? 'var(--glow-faint), var(--inset-edge)' : 'var(--inset-edge)',
          transition: 'background var(--dur-fast), border-color var(--dur-fast), box-shadow var(--dur-base)',
        }}
      >
        <svg width="11" height="9" viewBox="0 0 12 10" fill="none" style={{ display: 'block' }}>
          <path
            d="M1.5 5.2 L4.6 8.2 L10.5 1.8"
            stroke="var(--star-blue)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14"
            strokeDashoffset={checked ? 0 : 14}
            style={{ transition: reduced ? 'none' : 'stroke-dashoffset var(--dur-base) var(--ease-flight)' }}
          />
        </svg>
      </span>
      {text != null && (
        <span style={{ fontSize: '0.84375rem', color: checked ? 'var(--text-1)' : 'var(--text-2)', transition: 'color var(--dur-fast)' }}>
          {text}
        </span>
      )}
    </button>
  );
}
