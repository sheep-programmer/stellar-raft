import React from 'react';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

/**
 * Switch — an on/off toggle. On = the thumb warms to star-blue with a faint
 * glow (a small light turned on, not a color celebration). Semantic
 * role="switch" + aria-checked; Space/Enter toggle via the native button.
 */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  size = 'md',
  style,
  ...rest
}) {
  const [w, hh] = { sm: [32, 18], md: [40, 22] }[size] || [40, 22];
  const thumb = hh - 6;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled && onChange) onChange(!checked); }}
      className="sr-focus-ring"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
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
          position: 'relative', flex: 'none', boxSizing: 'border-box',
          width: w, height: hh, borderRadius: 'var(--r-pill)',
          background: checked ? 'rgba(159,198,255,0.28)' : 'rgba(159,198,255,0.08)',
          border: '1px solid ' + (checked ? 'var(--glass-border-strong)' : 'var(--glass-border)'),
          boxShadow: 'var(--inset-edge)',
          transition: 'background var(--dur-base) var(--ease-flight), border-color var(--dur-base)',
        }}
      >
        <span
          style={{
            position: 'absolute', top: 2, left: 2,
            width: thumb, height: thumb, borderRadius: '50%',
            background: checked ? 'var(--star-blue)' : 'var(--star-blue-dim)',
            boxShadow: checked ? 'var(--glow-faint)' : 'none',
            opacity: checked ? 1 : 0.75,
            transform: checked ? 'translateX(' + (w - thumb - 6) + 'px)' : 'none',
            transition: reduced
              ? 'none'
              : 'transform var(--dur-base) var(--ease-flight), background var(--dur-base), box-shadow var(--dur-base), opacity var(--dur-base)',
          }}
        />
      </span>
      {label && (
        <span style={{ fontSize: 13.5, color: checked ? 'var(--text-1)' : 'var(--text-2)', transition: 'color var(--dur-fast)' }}>
          {label}
        </span>
      )}
    </button>
  );
}
