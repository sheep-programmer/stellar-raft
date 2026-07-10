import React from 'react';
import { Icon } from '../core/Icon.jsx';

/**
 * ConstellationItem — a sidebar row for one constellation (note group).
 * Shows a representative memory color (warm = solid, cold = dimming), name,
 * star count, and active/hover lift. Low density, hairline highlights only.
 */
export function ConstellationItem({ name, color = 'var(--star-blue)', count, active = false, onClick, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        height: 38, padding: '0 10px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid',
        borderColor: active ? 'var(--glass-border-strong)' : 'transparent',
        background: active ? 'rgba(159,198,255,0.08)' : (hover ? 'rgba(159,198,255,0.05)' : 'transparent'),
        cursor: 'pointer', textAlign: 'left',
        transition: 'background var(--dur-fast), border-color var(--dur-fast)',
        ...style,
      }}
    >
      <span style={{
        width: 9, height: 9, borderRadius: '50%', flex: 'none',
        background: color,
        boxShadow: `0 0 8px ${color}`,
      }} />
      <span style={{
        flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: 13.5, color: active ? 'var(--text-1)' : 'var(--text-2)',
      }}>{name}</span>
      {count != null && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{count}</span>
      )}
    </button>
  );
}
