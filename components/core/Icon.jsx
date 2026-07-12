import React from 'react';

/**
 * Icon — a themed Lucide linear icon. The brand's only icon source.
 * Renders via the Lucide CDN global (window.lucide). Color flows from
 * `currentColor`, so wrappers tint it (cold star-blue default, gold on hover).
 * No emoji, no unicode glyphs — ever.
 */
export function Icon({ name, size = 20, strokeWidth = 1.6, color, className, style, title }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', name);
    el.appendChild(i);
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    const svg = el.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.setAttribute('stroke-width', strokeWidth);
      svg.style.display = 'block';
      if (title) { svg.setAttribute('aria-label', title); svg.setAttribute('role', 'img'); }
    }
  }, [name, size, strokeWidth, title]);

  return React.createElement('span', {
    ref,
    className,
    'aria-hidden': title ? undefined : true,
    style: {
      display: 'inline-flex',
      width: size,
      height: size,
      flex: 'none',
      color: color || 'inherit',
      ...style,
    },
  });
}
