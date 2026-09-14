import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { GlassPanel } from '../core/GlassPanel.jsx';

/** Tone → icon tint. gold is reserved for the ignite / reward moment. */
const SR_TOAST_TONES = {
  blue: 'var(--star-blue)',
  gold: 'var(--gold)',
  danger: 'var(--danger)',
};

/**
 * Toast — a quiet glass pill of feedback, floating bottom-center.
 * Declarative form: render <Toast> yourself (position it however you like).
 * Imperative form: call toast('点亮 +1 · 融会贯通', { tone: 'gold' }) and a
 * self-dismissing pill appears in a shared aria-live stack. Gold tone = the
 * ignite moment only; blue is the everyday voice.
 */
export function Toast({ message, children, tone = 'blue', icon = 'check', style, ...rest }) {
  return (
    <GlassPanel
      strong
      radius="pill"
      pad="none"
      role="status"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 18px',
        boxShadow: tone === 'gold'
          ? 'var(--shadow-lg), var(--glow-gold-soft), var(--inset-edge)'
          : undefined,
        ...style,
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={15} strokeWidth={1.8} color={SR_TOAST_TONES[tone] || SR_TOAST_TONES.blue} />}
      <span style={{ fontSize: '0.84375rem', fontFamily: 'var(--font-sans)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
        {message != null ? message : children}
      </span>
    </GlassPanel>
  );
}

let __srToastHost = null;

function srToastHost() {
  if (__srToastHost && document.body.contains(__srToastHost)) return __srToastHost;
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  Object.assign(el.style, {
    position: 'fixed', bottom: '26px', left: '50%', transform: 'translateX(-50%)',
    zIndex: 'var(--z-toast)', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '10px', pointerEvents: 'none',
  });
  document.body.appendChild(el);
  __srToastHost = el;
  return el;
}

/**
 * toast(message, opts?) — imperative command. Appends a glass pill to a shared
 * fixed stack (bottom-center, aria-live polite) and removes it after
 * `duration` ms. Returns a dismiss function.
 *   toast('已移入「量子力学」');
 *   toast('点亮 +1 · 融会贯通', { tone: 'gold', icon: 'zap' });
 */
export function toast(message, opts = {}) {
  if (typeof document === 'undefined') return () => {};
  const { tone = 'blue', icon = 'check', duration = 2400 } = opts;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = srToastHost();

  const pill = document.createElement('div');
  pill.className = 'sr-glass-strong';
  Object.assign(pill.style, {
    display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 18px',
    borderRadius: 'var(--r-pill)', color: 'var(--text-1)',
    fontFamily: 'var(--font-sans)', fontSize: '0.84375rem', whiteSpace: 'nowrap',
    animation: reduced ? 'none' : 'sr-cardin var(--dur-base) var(--ease-flight) both',
  });
  if (tone === 'gold') {
    pill.style.boxShadow = 'var(--shadow-lg), var(--glow-gold-soft), var(--inset-edge)';
  }

  if (icon) {
    const holder = document.createElement('span');
    Object.assign(holder.style, {
      display: 'inline-flex', width: '15px', height: '15px', flex: 'none',
      color: SR_TOAST_TONES[tone] || SR_TOAST_TONES.blue,
    });
    holder.setAttribute('aria-hidden', 'true');
    const i = document.createElement('i');
    i.setAttribute('data-lucide', icon);
    holder.appendChild(i);
    pill.appendChild(holder);
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
      const svg = holder.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', 15);
        svg.setAttribute('height', 15);
        svg.setAttribute('stroke-width', 1.8);
        svg.style.display = 'block';
      }
    }
  }

  const text = document.createElement('span');
  text.textContent = message == null ? '' : String(message);
  pill.appendChild(text);
  host.appendChild(pill);

  let gone = false;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    if (reduced) { pill.remove(); return; }
    pill.style.animation = 'none';
    pill.style.transition = 'opacity var(--dur-base) var(--ease-flight), transform var(--dur-base) var(--ease-flight)';
    pill.style.opacity = '0';
    pill.style.transform = 'translateY(8px)';
    setTimeout(() => pill.remove(), 380);
  };
  const timer = setTimeout(dismiss, duration);
  return () => { clearTimeout(timer); dismiss(); };
}
