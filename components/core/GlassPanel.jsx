import React from 'react';

/**
 * GlassPanel — the brand's floating glass surface. Semi-transparent deep
 * blue, backdrop blur, 1px cool edge, deep soft shadow + inner light edge.
 * Surfaces float in the void; they never sit on an opaque plane.
 */
export function GlassPanel({
  children,
  strong = false,
  radius = 'lg',
  pad = 'md',
  glow = false,
  style,
  ...rest
}) {
  const radii = { sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)', pill: 'var(--r-pill)' };
  const pads = { none: 0, sm: 'var(--s-3)', md: 'var(--s-5)', lg: 'var(--s-8)' };
  return (
    <div
      style={{
        background: strong ? 'var(--glass-bg-strong)' : 'var(--glass-bg)',
        WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)', backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
        border: '1px solid',
        borderColor: strong ? 'var(--glass-border-strong)' : 'var(--glass-border)',
        borderRadius: radii[radius] || radii.lg,
        boxShadow: glow
          ? 'var(--shadow-lg), var(--glow-faint), var(--inset-edge)'
          : (strong ? 'var(--shadow-lg)' : 'var(--shadow-md)') + ', var(--inset-edge)',
        padding: pads[pad] != null ? pads[pad] : pads.md,
        color: 'var(--text-1)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
