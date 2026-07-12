import React from 'react';
import { Icon } from './Icon.jsx';

/**
 * Input — dark glass text field. Optional leading icon and trailing kbd hint
 * (e.g. ⌘K on the global search). Focus brings a faint cool glow.
 */
export function Input({
  value,
  onChange,
  placeholder,
  icon,
  kbd,
  type = 'text',
  size = 'md',
  style,
  inputStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const h = { sm: 34, md: 40, lg: 46 }[size] || 40;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: h, padding: '0 12px',
        borderRadius: 'var(--r-md)',
        background: 'var(--space-1)',
        border: '1px solid',
        borderColor: focus ? 'var(--glass-border-strong)' : 'var(--glass-border)',
        boxShadow: focus ? '0 0 0 3px rgba(159,198,255,0.10), var(--glow-faint)' : 'none',
        transition: 'border-color var(--dur-fast), box-shadow var(--dur-base)',
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={16} color={focus ? 'var(--star-blue)' : 'var(--text-3)'} />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1, minWidth: 0, height: '100%',
          background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text-1)', fontFamily: 'var(--font-sans)',
          fontSize: { sm: 13, md: 14.5, lg: 16 }[size] || 14.5,
          ...inputStyle,
        }}
        {...rest}
      />
      {kbd && (
        <span aria-hidden="true" style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)',
          border: '1px solid var(--line)', borderRadius: 6, padding: '2px 6px', lineHeight: 1,
        }}>{kbd}</span>
      )}
    </div>
  );
}
