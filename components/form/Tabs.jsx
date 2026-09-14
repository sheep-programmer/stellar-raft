import React from 'react';
import { Icon } from '../core/Icon.jsx';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

function TabButton({ tab, selected, tabId, onPick, refFn, size }) {
  const [hover, setHover] = React.useState(false);
  const h = { sm: 34, md: 40 }[size] || 40;
  return (
    <button
      ref={refFn}
      id={tabId}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={tab.panelId}
      tabIndex={selected ? 0 : -1}
      disabled={tab.disabled}
      data-tab="1"
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="sr-focus-ring"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: h, padding: '0 14px',
        background: 'none', border: 'none',
        fontFamily: 'var(--font-sans)',
        fontSize: size === 'sm' ? '0.8125rem' : '0.84375rem',
        letterSpacing: '0.01em',
        color: tab.disabled
          ? 'var(--text-disabled)'
          : selected ? 'var(--text-1)' : (hover ? 'var(--text-1)' : 'var(--text-2)'),
        cursor: tab.disabled ? 'not-allowed' : 'pointer',
        transition: 'color var(--dur-fast)',
        whiteSpace: 'nowrap',
      }}
    >
      {tab.icon && <Icon name={tab.icon} size={15} color={selected ? 'var(--star-blue)' : 'currentColor'} />}
      {tab.label}
      {tab.count != null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-3)' }}>{tab.count}</span>
      )}
    </button>
  );
}

/**
 * Tabs — underline tabs over a hairline baseline. The selected tab carries a
 * thin star-blue indicator with a faint glow that glides between tabs.
 * role="tablist" with roving tabindex; ←→ Home End move and select.
 */
export function Tabs({ tabs = [], value, onChange, size = 'md', style, ...rest }) {
  const id = React.useId();
  const listRef = React.useRef(null);
  const btnRefs = React.useRef({});
  const [bar, setBar] = React.useState(null);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selIdx = tabs.findIndex((t) => t.id === value);

  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector('[data-tab][aria-selected="true"]');
    if (!el) { setBar(null); return; }
    setBar({ left: el.offsetLeft, width: el.offsetWidth });
  }, []);

  React.useLayoutEffect(measure, [value, tabs.length, size, measure]);
  React.useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const goto = (i) => {
    const t = tabs[i];
    if (!t || t.disabled) return;
    if (onChange) onChange(t.id, t);
    const el = btnRefs.current[t.id];
    if (el) el.focus();
  };

  const onKey = (e) => {
    if (!tabs.length) return;
    const enabled = tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const cur = enabled.indexOf(selIdx);
    let next = null;
    if (e.key === 'ArrowRight') next = enabled[(cur + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(cur - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next == null) return;
    e.preventDefault();
    goto(next);
  };

  return (
    <div style={{ position: 'relative', ...style }} {...rest}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKey}
        style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--s-1)' }}
      >
        {tabs.map((t, i) => (
          <TabButton
            key={t.id}
            tab={t}
            size={size}
            selected={t.id === value}
            tabId={id + '-tab-' + i}
            refFn={(el) => { btnRefs.current[t.id] = el; }}
            onPick={() => goto(i)}
          />
        ))}
      </div>
      {/* hairline baseline */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: 'var(--line)' }} />
      {/* glowing indicator */}
      {bar && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', bottom: 0, height: 2, borderRadius: 'var(--r-pill)',
            left: bar.left + 12,
            width: Math.max(16, bar.width - 24),
            background: 'var(--star-blue)',
            boxShadow: 'var(--glow-faint)',
            transition: reduced ? 'none' : 'left var(--dur-base) var(--ease-flight), width var(--dur-base) var(--ease-flight)',
          }}
        />
      )}
    </div>
  );
}
