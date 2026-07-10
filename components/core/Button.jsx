import React from 'react';
import { Icon } from './Icon.jsx';

/**
 * Button — text action. Three variants:
 *  · primary  : warm gold fill, dark ink — reward / ignition / confirm
 *  · secondary: glass surface, star-blue text — default actions
 *  · ghost    : transparent, tertiary
 * Press shrinks slightly; hover lifts/brightens. Optional leading icon.
 */
export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  disabled = false,
  glow = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const h = { sm: 32, md: 40, lg: 48 }[size] || 40;
  const pad = { sm: '0 14px', md: '0 18px', lg: '0 24px' }[size] || '0 18px';
  const fs = { sm: 13, md: 15, lg: 16 }[size] || 15;

  const palettes = {
    primary: {
      background: hover
        ? 'linear-gradient(180deg, var(--gold-white), var(--gold))'
        : 'linear-gradient(180deg, var(--gold), var(--gold-warm))',
      color: 'var(--text-on-gold)',
      border: '1px solid rgba(255,240,200,0.5)',
      boxShadow: (glow || hover) ? 'var(--glow-gold)' : 'var(--glow-gold-soft)',
      fontWeight: 600,
    },
    secondary: {
      background: hover ? 'rgba(159,198,255,0.12)' : 'var(--glass-bg)',
      color: 'var(--text-1)',
      border: '1px solid',
      borderColor: hover ? 'var(--glass-border-strong)' : 'var(--glass-border)',
      boxShadow: 'var(--inset-edge)',
      fontWeight: 500,
    },
    ghost: {
      background: hover ? 'rgba(159,198,255,0.07)' : 'transparent',
      color: hover ? 'var(--text-1)' : 'var(--text-2)',
      border: '1px solid transparent',
      boxShadow: 'none',
      fontWeight: 500,
    },
  };
  const p = palettes[variant] || palettes.secondary;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        height: h,
        padding: pad,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-sans)',
        fontSize: fs,
        letterSpacing: '0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transform: press ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform var(--dur-fast), background var(--dur-base), box-shadow var(--dur-base), border-color var(--dur-base), color var(--dur-base)',
        whiteSpace: 'nowrap',
        ...p,
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={fs + 3} color="currentColor" />}
      {children}
      {iconRight && <Icon name={iconRight} size={fs + 3} color="currentColor" />}
    </button>
  );
}
