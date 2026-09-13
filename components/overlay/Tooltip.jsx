import React from 'react';

/**
 * Tooltip — a small glass card that appears after a quiet delay, on hover or
 * keyboard focus. Esc hides it. The child is described via aria-describedby.
 * Content stays one short line; this is a whisper, not a panel.
 */
export function Tooltip({ content, children, side = 'top', delay = 450, style, ...rest }) {
  const [show, setShow] = React.useState(false);
  const timer = React.useRef(null);
  const id = React.useId();
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const open = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setShow(true), delay); };
  const close = () => { clearTimeout(timer.current); setShow(false); };

  React.useEffect(() => () => clearTimeout(timer.current), []);
  React.useEffect(() => {
    if (!show) return;
    const onKey = (e) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show]);

  const pos = {
    top:    { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
    left:   { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
    right:  { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
  }[side] || { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' };

  const child = React.isValidElement(children)
    ? React.cloneElement(children, { 'aria-describedby': show ? id : children.props['aria-describedby'] })
    : children;

  return (
    <span
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      {...rest}
    >
      {child}
      {show && content != null && (
        <span style={{ position: 'absolute', zIndex: 'var(--z-menu)', pointerEvents: 'none', ...pos }}>
          <span
            role="tooltip"
            id={id}
            style={{
              display: 'block',
              background: 'var(--glass-bg-strong)',
              WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)', backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--r-sm)',
              boxShadow: 'var(--shadow-md), var(--inset-edge)',
              padding: '5px 10px',
              fontSize: 12, fontFamily: 'var(--font-sans)',
              color: 'var(--text-1)', whiteSpace: 'nowrap', lineHeight: 1.5,
              animation: reduced ? 'none' : 'sr-cardin var(--dur-fast) var(--ease-flight) both',
            }}
          >{content}</span>
        </span>
      )}
    </span>
  );
}
