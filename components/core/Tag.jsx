import React from 'react';
import { Icon } from './Icon.jsx';

/**
 * Tag — a metadata chip (note tags, filters). Quiet glass capsule with an
 * optional leading dot/icon. `removable` shows an x; `active` lights gold.
 */
export function Tag({ children, icon, dot, active = false, removable = false, onRemove, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 26, padding: '0 10px',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-sans)', fontSize: 12.5,
        color: active ? 'var(--gold)' : 'var(--text-2)',
        background: active ? 'rgba(255,217,138,0.10)' : (hover ? 'rgba(159,198,255,0.10)' : 'rgba(159,198,255,0.05)'),
        border: '1px solid',
        borderColor: active ? 'rgba(255,217,138,0.30)' : 'var(--glass-border)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeof dot === 'string' ? dot : 'var(--star-blue)', flex: 'none' }} />}
      {icon && <Icon name={icon} size={13} color="currentColor" />}
      {children}
      {removable && (
        <Icon name="x" size={13} color="currentColor" style={{ opacity: 0.6, cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }} />
      )}
    </span>
  );
}
