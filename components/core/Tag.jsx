import React from 'react';
import { Icon } from './Icon.jsx';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

/* Vertical hit-area extender for chip-shaped controls: the capsule keeps its
   quiet 26px visual height while the pointer target grows to ≥40px. Vertical
   only — neighbouring chips in a row must not steal each other's clicks. */
if (typeof document !== 'undefined' && !document.getElementById('sr-hit40v-css')) {
  const s = document.createElement('style');
  s.id = 'sr-hit40v-css';
  s.textContent = '.sr-hit40v{position:relative}.sr-hit40v::after{content:"";position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:max(100%,40px)}';
  document.head.appendChild(s);
}

/**
 * Tag — a metadata chip (note tags, filters). Quiet glass capsule with an
 * optional leading dot/icon. `removable` shows an x; `active` lights gold.
 * Interactive tags extend their pointer target to ≥40px height invisibly.
 *
 * A11y: activation semantics (`role="button"`) are attached only when
 * `onClick` exists. When the tag is both clickable *and* removable, the
 * button role moves to an inner label span so the native remove <button>
 * is a sibling, never a descendant, of a button role (WAI-ARIA legality);
 * key/click events from the remove button never reach the tag action.
 */
export function Tag({ children, icon, dot, active = false, removable = false, onRemove, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const interactive = typeof onClick === 'function';
  // Clickable + removable → the activation role must live on an inner span.
  const split = interactive && removable;
  const onActionKeyDown = (e) => {
    if (e.target !== e.currentTarget) return; // ignore keys bubbling from descendants
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
  };
  const actionProps = {
    role: 'button',
    tabIndex: 0,
    className: 'sr-focus-ring sr-hit40v',
    onClick,
    onKeyDown: onActionKeyDown,
  };
  const content = (
    <React.Fragment>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeof dot === 'string' ? dot : 'var(--star-blue)', flex: 'none' }} />}
      {icon && <Icon name={icon} size={13} color="currentColor" />}
      {children}
    </React.Fragment>
  );
  return (
    <span
      {...(interactive && !split ? actionProps : {})}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 26, padding: '0 10px',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-sans)', fontSize: '0.78125rem',
        color: active ? 'var(--gold)' : 'var(--text-2)',
        background: active ? 'rgba(255,217,138,0.10)' : (hover ? 'rgba(159,198,255,0.10)' : 'rgba(159,198,255,0.05)'),
        border: '1px solid',
        borderColor: active ? 'rgba(255,217,138,0.30)' : 'var(--glass-border)',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
        ...style,
      }}
      {...rest}
    >
      {split ? (
        <span
          {...actionProps}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'stretch', cursor: 'pointer', borderRadius: 'var(--r-pill)' }}
        >
          {content}
        </span>
      ) : content}
      {removable && (
        <button
          type="button"
          aria-label="移除"
          className="sr-focus-ring"
          onClick={(e) => { e.stopPropagation(); if (onRemove) onRemove(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', padding: 0, margin: 0,
            color: 'currentColor', opacity: 0.6, cursor: 'pointer', borderRadius: 'var(--r-full)',
          }}
        >
          <Icon name="x" size={13} color="currentColor" />
        </button>
      )}
    </span>
  );
}
