import React from 'react';
import { memoryColor } from './MemoryBar.jsx';

if (typeof document !== 'undefined' && !document.getElementById('sr-focus-ring-css')) {
  const s = document.createElement('style');
  s.id = 'sr-focus-ring-css';
  s.textContent = '.sr-focus-ring:focus{outline:none}.sr-focus-ring:focus-visible{outline:2px solid var(--focus);outline-offset:2px}';
  document.head.appendChild(s);
}

/**
 * StarNode — a single knowledge star on the canvas.
 * Encodes meaning visually: brightness/color = memory strength,
 * size = importance, breathing = alive. Selected adds a ring.
 * Position via `style` (absolute left/top) from the parent canvas.
 */
export function StarNode({
  strength = 0.6,
  importance = 1,      // 0.6..1.6 size multiplier
  label,
  selected = false,
  breathe = true,
  onClick,
  onMouseEnter,
  onMouseLeave,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const core = 12 * importance;            // px core diameter
  const col = memoryColor(strength);
  const warm = strength >= 0.82;
  // 黎明（浅底）：白核与奶油金辉光会融进背景，改用深琥珀核心 + 琥珀/藏蓝辉光
  const dawn = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dawn';
  const glow = warm
    ? (dawn
      ? `0 0 ${14 * importance}px rgba(156,86,10,0.5), 0 0 ${5 * importance}px rgba(122,68,8,0.75)`
      : `0 0 ${18 * importance}px rgba(255,217,138,0.6), 0 0 ${7 * importance}px rgba(255,244,214,0.9)`)
    : (dawn
      ? `0 0 ${12 * importance}px rgba(58,98,192,${0.25 + strength * 0.35}), 0 0 ${4 * importance}px rgba(58,98,192,0.6)`
      : `0 0 ${14 * importance}px rgba(159,198,255,${0.25 + strength * 0.4}), 0 0 ${5 * importance}px rgba(159,198,255,0.7)`);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? (label || '知识星') : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      className={onClick ? 'sr-focus-ring' : undefined}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onMouseEnter={(e) => { setHover(true); if (onMouseEnter) onMouseEnter(e); }}
      onMouseLeave={(e) => { setHover(false); if (onMouseLeave) onMouseLeave(e); }}
      style={{
        position: 'absolute',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        cursor: onClick ? 'pointer' : 'default',
        transform: 'translate(-50%, -50%)',
        ...style,
      }}
    >
      {selected && (
        <span style={{
          position: 'absolute', top: core / 2, left: '50%',
          width: core + 18, height: core + 18, transform: 'translate(-50%, -50%)',
          borderRadius: '50%', border: '1px solid rgba(255,217,138,0.55)',
          boxShadow: '0 0 16px rgba(255,217,138,0.35)',
        }} />
      )}
      <span
        className={breathe ? 'sr-breathe' : ''}
        style={{
          width: core, height: core, borderRadius: '50%',
          background: warm
            ? (dawn
              ? `radial-gradient(circle at 38% 35%, #ffc95c 0%, #b07d1c 30%, #6f4a08 100%)`
              : `radial-gradient(circle at 38% 35%, #fff, ${col} 55%, var(--gold-warm) 100%)`)
            : (dawn
              ? `radial-gradient(circle at 38% 35%, #b9cdf5, ${col} 70%)`
              : `radial-gradient(circle at 38% 35%, #eaf2ff, ${col} 70%)`),
          boxShadow: glow,
          transform: hover ? 'scale(1.25)' : 'scale(1)',
          transition: 'transform var(--dur-base) var(--ease-flight)',
        }}
      />
      {label && (
        <span title={label} style={{
          fontSize: 11.5, fontFamily: 'var(--font-sans)',
          // 寻路文字的地板抬到 --text-2：找星时还没 hover，也要能读
          color: hover || selected ? 'var(--text-1)' : 'var(--text-2)',
          whiteSpace: 'nowrap', textShadow: 'var(--star-label-shadow)',
          // 超长星名不横贯画布：截断给省略号，完整名走 title / 摘要卡
          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
          // 亮度层级仍随记忆强度呼吸，但只在可读区间 0.9–1 内浮动
          // （地板 0.9 保证最暗星名在深空/黎明双主题下都 ≥4.5:1）
          opacity: hover || selected || importance > 1.15 ? 1 : 0.9 + 0.1 * Math.max(0, Math.min(1, strength)),
          transition: 'color var(--dur-base), opacity var(--dur-base)',
        }}>{label}</span>
      )}
    </div>
  );
}
