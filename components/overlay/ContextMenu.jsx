import React from 'react';
import { Icon } from '../core/Icon.jsx';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

function MenuRow({ id, item, active, onHover, onPick }) {
  const disabled = !!item.disabled;
  return (
    <div
      id={id}
      role="menuitem"
      aria-disabled={disabled || undefined}
      onMouseEnter={disabled ? undefined : onHover}
      onClick={disabled ? undefined : onPick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        height: 32, padding: '0 10px', borderRadius: 'var(--r-sm)',
        fontSize: 13, fontFamily: 'var(--font-sans)',
        color: disabled
          ? 'var(--text-disabled)'
          : item.danger ? 'var(--danger)' : (active ? 'var(--text-1)' : 'var(--text-2)'),
        background: active && !disabled
          // danger 悬停底纹跟随主题里的 --danger（黎明下已 remap 为深赭）
          ? (item.danger ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'rgba(159,198,255,0.10)')
          : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast), color var(--dur-fast)',
        whiteSpace: 'nowrap',
      }}
    >
      {item.icon && <Icon name={item.icon} size={15} color="currentColor" />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
      {item.kbd && (
        <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', marginLeft: 12 }}>
          {item.kbd}
        </span>
      )}
    </div>
  );
}

/**
 * ContextMenu — right-click menu primitive. Wrap any target area; a glass
 * panel opens at the cursor with hairline separators. Items:
 *   { id, label, icon?, kbd?, danger?, disabled?, onSelect? } or { type: 'separator' }.
 * Keyboard: ↑↓ Home End move, Enter picks, Esc closes. Focus returns to the
 * previously focused element on close.
 */
export function ContextMenu({ items = [], onSelect, disabled = false, menuWidth = 200, children, style, ...rest }) {
  const [at, setAt] = React.useState(null); // { x, y }
  const [active, setActive] = React.useState(-1);
  const menuRef = React.useRef(null);
  const prevFocus = React.useRef(null);
  const baseId = React.useId();
  const itemId = (i) => baseId + 'mi-' + i;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const enabledIdx = items
    .map((it, i) => (!it.type && !it.disabled ? i : -1))
    .filter((i) => i >= 0);

  const close = React.useCallback(() => {
    setAt(null);
    setActive(-1);
    const p = prevFocus.current;
    if (p && p.focus) p.focus();
  }, []);

  const openAt = (e) => {
    if (disabled) return;
    e.preventDefault();
    prevFocus.current = document.activeElement;
    setAt({ x: e.clientX, y: e.clientY });
    setActive(-1);
  };

  const pick = (it) => {
    close();
    if (it.onSelect) it.onSelect(it);
    if (onSelect) onSelect(it);
  };

  // Clamp to the viewport, then take focus for keyboard use.
  React.useLayoutEffect(() => {
    if (!at || !menuRef.current) return;
    const m = menuRef.current;
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)) + 'px';
    m.focus();
  }, [at]);

  // Keep the active row in view while navigating with the keyboard.
  React.useEffect(() => {
    if (!at || active < 0) return;
    const row = document.getElementById(itemId(active));
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }, [at, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any press outside dismisses.
  React.useEffect(() => {
    if (!at) return;
    const down = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', down, true);
    document.addEventListener('contextmenu', down, true);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('contextmenu', down, true);
      window.removeEventListener('blur', close);
    };
  }, [at, close]);

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { e.preventDefault(); return; }
    if (!enabledIdx.length) return;
    const cur = enabledIdx.indexOf(active);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(enabledIdx[(cur + 1) % enabledIdx.length]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(cur < 0 ? enabledIdx[enabledIdx.length - 1] : enabledIdx[(cur - 1 + enabledIdx.length) % enabledIdx.length]);
    } else if (e.key === 'Home') {
      e.preventDefault(); setActive(enabledIdx[0]);
    } else if (e.key === 'End') {
      e.preventDefault(); setActive(enabledIdx[enabledIdx.length - 1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const it = items[active];
      if (it && !it.type && !it.disabled) pick(it);
    }
  };

  return (
    <span onContextMenu={openAt} style={{ display: 'contents' }} {...rest}>
      {children}
      {at && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="上下文菜单"
          aria-activedescendant={active >= 0 ? itemId(active) : undefined}
          tabIndex={-1}
          className="sr-focus-ring"
          onKeyDown={onKey}
          style={{
            position: 'fixed', left: at.x, top: at.y, zIndex: 'var(--z-menu)',
            minWidth: menuWidth,
            background: 'var(--glass-bg-strong)',
            WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)', backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
            border: '1px solid var(--glass-border-strong)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg), var(--inset-edge)',
            padding: 6,
            animation: reduced ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both',
            outline: 'none',
            ...style,
          }}
        >
          {items.map((it, i) =>
            it.type === 'separator' ? (
              <div key={'sep-' + i} role="separator" style={{ height: 1, background: 'var(--line)', margin: '5px 6px' }} />
            ) : (
              <MenuRow
                key={it.id != null ? it.id : i}
                id={itemId(i)}
                item={it}
                active={active === i}
                onHover={() => setActive(i)}
                onPick={() => pick(it)}
              />
            )
          )}
        </div>
      )}
    </span>
  );
}
