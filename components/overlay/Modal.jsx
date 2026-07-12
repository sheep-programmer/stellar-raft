import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { IconButton } from '../core/IconButton.jsx';
import { GlassPanel } from '../core/GlassPanel.jsx';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

/**
 * Modal — a floating glass dialog over a deep-space darkened, blurred mask
 * (never flat black). Focus is trapped inside; Esc or the mask closes it.
 * Body scrolls; header/footer stay pinned. Restores focus on close.
 */
export function Modal({
  open = false,
  onClose,
  title,
  icon,
  width = 480,
  footer,
  children,
  closeOnMask = true,
  style,
  ...rest
}) {
  const panelRef = React.useRef(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = React.useId();
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  React.useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const root = panelRef.current;
    const focusables = () => Array.from(root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    const first = focusables()[0];
    (first || root).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); if (onCloseRef.current) onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) { e.preventDefault(); root.focus(); return; }
      const inside = root.contains(document.activeElement);
      const i = list.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0 || !inside)) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (i === list.length - 1 || !inside)) { e.preventDefault(); list[0].focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (prev && prev.focus) prev.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onMouseDown={closeOnMask ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
        background: 'rgba(3,4,12,0.55)',
        WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--s-5)',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="sr-focus-ring"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width, maxWidth: '94vw', maxHeight: '90vh',
          display: 'flex',
          animation: reduced ? 'none' : 'sr-cardin var(--dur-base) var(--ease-flight) both',
          ...style,
        }}
        {...rest}
      >
        <GlassPanel strong glow radius="lg" pad="none" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {(title || onClose) && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px var(--s-4) 14px var(--s-5)', borderBottom: '1px solid var(--line)', flex: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {icon && <Icon name={icon} size={17} color="var(--star-blue)" />}
                {title && (
                  <span id={titleId} style={{
                    fontSize: 15, color: 'var(--text-1)', fontWeight: 300, letterSpacing: '0.02em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{title}</span>
                )}
              </div>
              {onClose && <IconButton name="x" size="sm" title="关闭" onClick={onClose} />}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'var(--s-5)' }}>
            {children}
          </div>
          {footer && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--s-2)',
              padding: 'var(--s-4) var(--s-5)', borderTop: '1px solid var(--line)', flex: 'none',
            }}>{footer}</div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
