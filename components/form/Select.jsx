import React from 'react';
import { Icon } from '../core/Icon.jsx';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

/**
 * Select — custom dropdown on the dark glass input surface. The list is a
 * strong-glass panel; the selected option carries a star-blue check.
 * Keyboard: ↑↓ move, Enter/Space pick, Esc closes, Home/End jump.
 * ARIA combobox pattern with aria-activedescendant.
 */
export function Select({
  value,
  onChange,
  options = [],
  placeholder = '请选择…',
  size = 'md',
  disabled = false,
  style,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const id = React.useId();
  const wrapRef = React.useRef(null);
  const listRef = React.useRef(null);
  const btnRef = React.useRef(null);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const h = { sm: 34, md: 40, lg: 46 }[size] || 40;
  const fs = { sm: 13, md: 14.5, lg: 16 }[size] || 14.5;
  const selIdx = options.findIndex((o) => o.value === value);
  const selected = selIdx >= 0 ? options[selIdx] : null;
  const enabledIdx = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActive(selIdx >= 0 ? selIdx : (enabledIdx[0] != null ? enabledIdx[0] : -1));
  };
  const closeList = (refocus) => {
    setOpen(false);
    if (refocus !== false && btnRef.current) btnRef.current.focus();
  };
  const pick = (i) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (onChange) onChange(o.value, o);
    closeList();
  };
  const move = (d) => {
    if (!enabledIdx.length) return;
    const cur = enabledIdx.indexOf(active);
    if (cur < 0) { setActive(d > 0 ? enabledIdx[0] : enabledIdx[enabledIdx.length - 1]); return; }
    setActive(enabledIdx[(cur + d + enabledIdx.length) % enabledIdx.length]);
  };

  React.useEffect(() => {
    if (!open) return;
    const down = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closeList(false);
    };
    document.addEventListener('mousedown', down, true);
    return () => document.removeEventListener('mousedown', down, true);
  }, [open]);

  React.useEffect(() => {
    if (!open || !listRef.current || active < 0) return;
    const el = listRef.current.querySelector('[data-active="1"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKey = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); closeList(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); if (enabledIdx.length) setActive(enabledIdx[0]); }
    else if (e.key === 'End') { e.preventDefault(); if (enabledIdx.length) setActive(enabledIdx[enabledIdx.length - 1]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Tab') { closeList(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id + '-list'}
        aria-activedescendant={open && active >= 0 ? id + '-opt-' + active : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onKey}
        className="sr-focus-ring"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          height: h, padding: '0 12px', boxSizing: 'border-box',
          borderRadius: 'var(--r-md)',
          background: 'var(--space-1)',
          border: '1px solid',
          borderColor: open ? 'var(--glass-border-strong)' : 'var(--glass-border)',
          boxShadow: open ? '0 0 0 3px rgba(159,198,255,0.10), var(--glow-faint)' : 'none',
          color: selected ? 'var(--text-1)' : 'var(--text-3)',
          fontFamily: 'var(--font-sans)', fontSize: fs, textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          transition: 'border-color var(--dur-fast), box-shadow var(--dur-base)',
        }}
        {...rest}
      >
        {selected && selected.icon && <Icon name={selected.icon} size={15} color="var(--star-blue)" />}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon
          name="chevron-down"
          size={15}
          color={open ? 'var(--star-blue)' : 'var(--text-3)'}
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: reduced ? 'none' : 'transform var(--dur-base) var(--ease-flight)',
          }}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          id={id + '-list'}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            zIndex: 'var(--z-menu)',
            background: 'var(--glass-bg-strong)',
            WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)', backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
            border: '1px solid var(--glass-border-strong)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-lg), var(--inset-edge)',
            padding: 5, maxHeight: 240, overflowY: 'auto',
            animation: reduced ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both',
          }}
        >
          {options.map((o, i) => {
            const isSel = i === selIdx;
            const isAct = i === active;
            return (
              <div
                key={o.value != null ? o.value : i}
                id={id + '-opt-' + i}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                data-active={isAct ? '1' : undefined}
                onMouseEnter={o.disabled ? undefined : () => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={o.disabled ? undefined : () => pick(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  height: 34, padding: '0 10px', borderRadius: 'var(--r-sm)',
                  fontSize: 13.5, fontFamily: 'var(--font-sans)',
                  color: o.disabled ? 'var(--text-disabled)' : (isSel || isAct ? 'var(--text-1)' : 'var(--text-2)'),
                  background: isAct && !o.disabled ? 'rgba(159,198,255,0.10)' : 'transparent',
                  cursor: o.disabled ? 'not-allowed' : 'pointer',
                  transition: 'background var(--dur-fast), color var(--dur-fast)',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.icon && <Icon name={o.icon} size={15} color="currentColor" />}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
                {isSel && <Icon name="check" size={14} color="var(--star-blue)" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
