import React from 'react';
import { Icon } from './Icon.jsx';

/**
 * IconButton — a square, ghost-by-default icon control.
 * Default: star-blue at ~70%. Hover/active: warm gold + faint glow.
 * Press: gentle shrink. This is the canonical icon-tint behavior.
 */
export function IconButton({
  name,
  size = 'md',
  active = false,
  disabled = false,
  title,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const dims = { sm: 30, md: 36, lg: 44 }[size] || 36;
  const icon = { sm: 16, md: 20, lg: 22 }[size] || 20;
  const lit = (active || hover) && !disabled;

  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        width: dims,
        height: dims,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--r-md)',
        border: '1px solid',
        borderColor: lit ? 'var(--glass-border-strong)' : 'transparent',
        background: lit ? 'rgba(159,198,255,0.06)' : 'transparent',
        color: disabled
          ? 'var(--text-disabled)'
          : lit ? 'var(--gold)' : 'rgba(159,198,255,0.7)',
        boxShadow: lit && !active ? 'none' : active ? 'var(--glow-gold-soft)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: press ? 'scale(0.92)' : 'scale(1)',
        transition: 'color var(--dur-fast) var(--ease-flight), background var(--dur-fast), transform var(--dur-fast), border-color var(--dur-fast), box-shadow var(--dur-base)',
        padding: 0,
        ...style,
      }}
      {...rest}
    >
      <Icon name={name} size={icon} title={title} />
    </button>
  );
}
