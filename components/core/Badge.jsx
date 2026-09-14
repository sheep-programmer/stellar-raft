import React from 'react';

/**
 * Badge — small status / count marker.
 * tones: blue (default), gold (reward/active), fading (dimming/needs review),
 *        neutral. `dot` renders a tiny notification dot; `count` an unread pill.
 */
export function Badge({ children, tone = 'blue', dot = false, soft = true, style, ...rest }) {
  const tones = {
    blue:    { fg: 'var(--star-blue)', bg: 'rgba(159,198,255,0.14)', bd: 'rgba(159,198,255,0.28)' },
    gold:    { fg: 'var(--gold)', bg: 'rgba(255,217,138,0.14)', bd: 'rgba(255,217,138,0.32)' },
    fading:  { fg: 'var(--star-blue-dim)', bg: 'rgba(120,150,205,0.12)', bd: 'rgba(120,150,205,0.26)' },
    neutral: { fg: 'var(--text-2)', bg: 'rgba(159,198,255,0.06)', bd: 'var(--line)' },
  };
  const t = tones[tone] || tones.blue;

  if (dot) {
    return (
      <span
        style={{
          display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
          background: t.fg, boxShadow: tone === 'gold' ? 'var(--glow-gold-soft)' : 'none',
          ...style,
        }}
        {...rest}
      />
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 18, height: 18, padding: '0 6px',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', lineHeight: 1, fontWeight: 500,
        color: t.fg,
        background: soft ? t.bg : 'transparent',
        border: soft ? '1px solid ' + t.bd : 'none',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
