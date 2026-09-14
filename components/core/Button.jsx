import React from 'react';
import { Icon } from './Icon.jsx';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

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
  const fs = { sm: '0.8125rem', md: '0.9375rem', lg: '1rem' }[size] || '0.9375rem';

  const palettes = {
    primary: disabled ? {
      // 不可点就不发光：收掉金色渐变与辉光，退成玻璃面 + 失效墨色
      background: 'var(--glass-bg)',
      color: 'var(--text-disabled)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'none',
      fontWeight: 600,
    } : {
      background: hover
        ? 'linear-gradient(180deg, var(--gold-btn-hover-hi), var(--gold-btn-hover-lo))'
        : 'linear-gradient(180deg, var(--gold-btn-hi), var(--gold-btn-lo))',
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
        // primary 的禁用态已换成专门的哑光玻璃面，不再叠加整体降透明
        opacity: disabled && variant !== 'primary' ? 0.45 : 1,
        transform: press ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform var(--dur-fast), background var(--dur-base), box-shadow var(--dur-base), border-color var(--dur-base), color var(--dur-base)',
        whiteSpace: 'nowrap',
        ...p,
        ...style,
      }}
      {...rest}
      className={['sr-focus-ring', rest.className].filter(Boolean).join(' ')}
    >
      {icon && <Icon name={icon} size={fs + 3} color="currentColor" />}
      {children}
      {iconRight && <Icon name={iconRight} size={fs + 3} color="currentColor" />}
    </button>
  );
}
