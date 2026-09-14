import React from 'react';

/** Map a 0..1 memory strength to a color on the temperature ramp. */
export function memoryColor(strength) {
  const dawn = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dawn';
  const stops = dawn ? [
    [0.0, [108, 121, 155]],   // dead — still visible on light
    [0.25, [92, 108, 150]],  // faint
    [0.5, [76, 96, 148]],    // low
    [0.7, [52, 95, 190]],     // mid
    [0.88, [184, 128, 26]],   // high (deep amber)
    [1.0, [168, 109, 18]],    // full
  ] : [
    [0.0, [44, 53, 86]],    // dead
    [0.25, [70, 82, 122]],  // faint
    [0.5, [120, 150, 205]], // low
    [0.7, [159, 198, 255]], // mid
    [0.88, [255, 224, 150]],// high
    [1.0, [255, 244, 214]], // full
  ];
  const s = Math.max(0, Math.min(1, strength));
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i];
      const t = (s - a) / (b - a || 1);
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(255,244,214)';
}

/**
 * MemoryBar — a knowledge star's memory strength as a thin track that fills
 * cold→warm along the temperature ramp. Optional label + percentage.
 * `fading` adds a faint pulse to flag "needs review".
 */
export function MemoryBar({ value = 0.5, label, showPct = false, height = 6, fading = false, style }) {
  const v = Math.max(0, Math.min(1, value));
  const col = memoryColor(v);
  const warm = v >= 0.82;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {(label || showPct) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          {label && <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{label}</span>}
          {showPct && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: warm ? 'var(--gold)' : 'var(--star-blue)' }}>{Math.round(v * 100)}%</span>}
        </div>
      )}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-label={typeof label === 'string' ? label : '记忆强度'}
        style={{ height, borderRadius: 999, background: 'rgba(159,198,255,0.10)', overflow: 'hidden' }}
      >
        <div style={{
          width: (v * 100) + '%', height: '100%', borderRadius: 999,
          background: `linear-gradient(90deg, var(--star-blue-deep), ${col})`,
          boxShadow: warm ? '0 0 10px rgba(255,217,138,0.55)' : '0 0 8px rgba(159,198,255,0.35)',
          animation: fading ? 'sr-breathe 3.4s var(--ease-flight) infinite' : 'none',
          transition: 'width var(--dur-slow) var(--ease-flight)',
        }} />
      </div>
    </div>
  );
}
