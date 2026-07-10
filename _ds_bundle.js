/* @ds-bundle: {"format":3,"namespace":"StellarRaftDesignSystem_2866af","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"GlassPanel","sourcePath":"components/core/GlassPanel.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"ConstellationItem","sourcePath":"components/knowledge/ConstellationItem.jsx"},{"name":"MemoryBar","sourcePath":"components/knowledge/MemoryBar.jsx"},{"name":"StarNode","sourcePath":"components/knowledge/StarNode.jsx"}],"sourceHashes":{"assets/starfield.js":"c884236415c6","components/core/Badge.jsx":"b0bd9735d638","components/core/Button.jsx":"05578fc5ddc2","components/core/GlassPanel.jsx":"299a19d8fbb4","components/core/Icon.jsx":"d6804e3d9da2","components/core/IconButton.jsx":"d0632940a8c1","components/core/Input.jsx":"b420e1dab922","components/core/Tag.jsx":"c2ef9d0e17f1","components/knowledge/ConstellationItem.jsx":"f30d67af5720","components/knowledge/MemoryBar.jsx":"995265dbdebe","components/knowledge/StarNode.jsx":"7bd6fa95be84","ui_kits/stellar-raft/AerialView.jsx":"b3b9e32d8bf2","ui_kits/stellar-raft/Editor.jsx":"cfc1adef888f","ui_kits/stellar-raft/EditorMenus.jsx":"c3e7b6fe7f5b","ui_kits/stellar-raft/FeynmanDrawer.jsx":"2918c4a811f5","ui_kits/stellar-raft/ListView.jsx":"163a7538365e","ui_kits/stellar-raft/Sidebar.jsx":"ad7caa24ddf5","ui_kits/stellar-raft/StarMap.jsx":"4f76d34c3735","ui_kits/stellar-raft/app.jsx":"7d0fa4db8540","ui_kits/stellar-raft/codehl.js":"258dd04b595f","ui_kits/stellar-raft/data.js":"0d8c5aea8065"},"inlinedExternals":[],"unexposedExports":[{"name":"memoryColor","sourcePath":"components/knowledge/MemoryBar.jsx"}]} */

(() => {

const __ds_ns = (window.StellarRaftDesignSystem_2866af = window.StellarRaftDesignSystem_2866af || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/starfield.js
try { (() => {
/* ===== 星图 Stellar Raft — Starfield helper =====
   A self-registering web component <sr-starfield> that paints a slow,
   twinkling deep-space background of small stars on a canvas.
   Lightweight, respects prefers-reduced-motion, fills its parent.

   Usage:  <sr-starfield density="1"></sr-starfield>   (position the host)
   Attributes:
     density  multiplier on star count (default 1)
     warm     0..1 share of faint gold stars (default 0.12)
*/
(function () {
  if (customElements.get('sr-starfield')) return;
  class Starfield extends HTMLElement {
    connectedCallback() {
      this.canvas = document.createElement('canvas');
      Object.assign(this.style, {
        position: this.style.position || 'absolute',
        inset: '0',
        display: 'block',
        pointerEvents: 'none'
      });
      Object.assign(this.canvas.style, {
        width: '100%',
        height: '100%',
        display: 'block'
      });
      this.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._resize = this.resize.bind(this);
      window.addEventListener('resize', this._resize);
      this.resize();
      this.t = 0;
      this.loop();
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._resize);
      cancelAnimationFrame(this._raf);
    }
    resize() {
      const r = this.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, r.width);
      this.h = Math.max(1, r.height);
      this.canvas.width = this.w * dpr;
      this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.build();
    }
    build() {
      const density = parseFloat(this.getAttribute('density') || '1');
      const warm = parseFloat(this.getAttribute('warm') || '0.12');
      const n = Math.round(this.w * this.h / 5200 * density);
      this.stars = Array.from({
        length: n
      }, () => ({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: Math.random() * 1.1 + 0.25,
        base: Math.random() * 0.4 + 0.15,
        amp: Math.random() * 0.45 + 0.1,
        sp: Math.random() * 0.8 + 0.2,
        ph: Math.random() * Math.PI * 2,
        warm: Math.random() < warm
      }));
    }
    loop() {
      this._raf = requestAnimationFrame(() => this.loop());
      this.t += this.reduced ? 0 : 0.012;
      const c = this.ctx;
      c.clearRect(0, 0, this.w, this.h);
      for (const s of this.stars) {
        const tw = this.reduced ? s.base + s.amp * 0.5 : s.base + s.amp * (0.5 + 0.5 * Math.sin(this.t * s.sp + s.ph));
        c.beginPath();
        c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        const dawn = document.documentElement.dataset.theme === 'dawn';
        c.fillStyle = dawn ? s.warm ? `rgba(196,140,40,${tw * 0.7})` : `rgba(70,98,168,${tw * 0.6})` : s.warm ? `rgba(255,225,170,${tw})` : `rgba(190,212,255,${tw})`;
        c.fill();
      }
    }
  }
  customElements.define('sr-starfield', Starfield);

  /* Organic connection path generator (mycelium curve between two points).
     Returns an SVG path 'd' string with a gentle perpendicular bow. */
  window.SRConnect = function (x1, y1, x2, y2, bow) {
    bow = bow == null ? 0.18 : bow;
    const mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2;
    const dx = x2 - x1,
      dy = y2 - y1;
    const nx = -dy,
      ny = dx;
    const len = Math.hypot(dx, dy) || 1;
    const off = len * bow;
    const cx = mx + nx / len * off,
      cy = my + ny / len * off;
    return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/starfield.js", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — small status / count marker.
 * tones: blue (default), gold (reward/active), fading (dimming/needs review),
 *        neutral. `dot` renders a tiny notification dot; `count` an unread pill.
 */
function Badge({
  children,
  tone = 'blue',
  dot = false,
  soft = true,
  style,
  ...rest
}) {
  const tones = {
    blue: {
      fg: 'var(--star-blue)',
      bg: 'rgba(159,198,255,0.14)',
      bd: 'rgba(159,198,255,0.28)'
    },
    gold: {
      fg: 'var(--gold)',
      bg: 'rgba(255,217,138,0.14)',
      bd: 'rgba(255,217,138,0.32)'
    },
    fading: {
      fg: 'var(--star-blue-dim)',
      bg: 'rgba(120,150,205,0.12)',
      bd: 'rgba(120,150,205,0.26)'
    },
    neutral: {
      fg: 'var(--text-2)',
      bg: 'rgba(159,198,255,0.06)',
      bd: 'var(--line)'
    }
  };
  const t = tones[tone] || tones.blue;
  if (dot) {
    return /*#__PURE__*/React.createElement("span", _extends({
      style: {
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: t.fg,
        boxShadow: tone === 'gold' ? 'var(--glow-gold-soft)' : 'none',
        ...style
      }
    }, rest));
  }
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 6px',
      borderRadius: 'var(--r-pill)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      lineHeight: 1,
      fontWeight: 500,
      color: t.fg,
      background: soft ? t.bg : 'transparent',
      border: soft ? '1px solid ' + t.bd : 'none',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/GlassPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * GlassPanel — the brand's floating glass surface. Semi-transparent deep
 * blue, backdrop blur, 1px cool edge, deep soft shadow + inner light edge.
 * Surfaces float in the void; they never sit on an opaque plane.
 */
function GlassPanel({
  children,
  strong = false,
  radius = 'lg',
  pad = 'md',
  glow = false,
  style,
  ...rest
}) {
  const radii = {
    sm: 'var(--r-sm)',
    md: 'var(--r-md)',
    lg: 'var(--r-lg)',
    xl: 'var(--r-xl)',
    pill: 'var(--r-pill)'
  };
  const pads = {
    none: 0,
    sm: 'var(--s-3)',
    md: 'var(--s-5)',
    lg: 'var(--s-8)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: strong ? 'var(--glass-bg-strong)' : 'var(--glass-bg)',
      WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
      backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
      border: '1px solid',
      borderColor: strong ? 'var(--glass-border-strong)' : 'var(--glass-border)',
      borderRadius: radii[radius] || radii.lg,
      boxShadow: glow ? 'var(--shadow-lg), var(--glow-faint), var(--inset-edge)' : (strong ? 'var(--shadow-lg)' : 'var(--shadow-md)') + ', var(--inset-edge)',
      padding: pads[pad] != null ? pads[pad] : pads.md,
      color: 'var(--text-1)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { GlassPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/GlassPanel.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
/**
 * Icon — a themed Lucide linear icon. The brand's only icon source.
 * Renders via the Lucide CDN global (window.lucide). Color flows from
 * `currentColor`, so wrappers tint it (cold star-blue default, gold on hover).
 * No emoji, no unicode glyphs — ever.
 */
function Icon({
  name,
  size = 20,
  strokeWidth = 1.6,
  color,
  className,
  style,
  title
}) {
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
      if (title) svg.setAttribute('aria-label', title);
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
      ...style
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — text action. Three variants:
 *  · primary  : warm gold fill, dark ink — reward / ignition / confirm
 *  · secondary: glass surface, star-blue text — default actions
 *  · ghost    : transparent, tertiary
 * Press shrinks slightly; hover lifts/brightens. Optional leading icon.
 */
function Button({
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
  const h = {
    sm: 32,
    md: 40,
    lg: 48
  }[size] || 40;
  const pad = {
    sm: '0 14px',
    md: '0 18px',
    lg: '0 24px'
  }[size] || '0 18px';
  const fs = {
    sm: 13,
    md: 15,
    lg: 16
  }[size] || 15;
  const palettes = {
    primary: {
      background: hover ? 'linear-gradient(180deg, var(--gold-white), var(--gold))' : 'linear-gradient(180deg, var(--gold), var(--gold-warm))',
      color: 'var(--text-on-gold)',
      border: '1px solid rgba(255,240,200,0.5)',
      boxShadow: glow || hover ? 'var(--glow-gold)' : 'var(--glow-gold-soft)',
      fontWeight: 600
    },
    secondary: {
      background: hover ? 'rgba(159,198,255,0.12)' : 'var(--glass-bg)',
      color: 'var(--text-1)',
      border: '1px solid',
      borderColor: hover ? 'var(--glass-border-strong)' : 'var(--glass-border)',
      boxShadow: 'var(--inset-edge)',
      fontWeight: 500
    },
    ghost: {
      background: hover ? 'rgba(159,198,255,0.07)' : 'transparent',
      color: hover ? 'var(--text-1)' : 'var(--text-2)',
      border: '1px solid transparent',
      boxShadow: 'none',
      fontWeight: 500
    }
  };
  const p = palettes[variant] || palettes.secondary;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
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
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: fs + 3,
    color: "currentColor"
  }), children, iconRight && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: fs + 3,
    color: "currentColor"
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — a square, ghost-by-default icon control.
 * Default: star-blue at ~70%. Hover/active: warm gold + faint glow.
 * Press: gentle shrink. This is the canonical icon-tint behavior.
 */
function IconButton({
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
  const dims = {
    sm: 30,
    md: 36,
    lg: 44
  }[size] || 36;
  const icon = {
    sm: 16,
    md: 20,
    lg: 22
  }[size] || 20;
  const lit = (active || hover) && !disabled;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": title,
    "aria-pressed": active,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      width: dims,
      height: dims,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--r-md)',
      border: '1px solid',
      borderColor: lit ? 'var(--glass-border-strong)' : 'transparent',
      background: lit ? 'rgba(159,198,255,0.06)' : 'transparent',
      color: disabled ? 'var(--text-disabled)' : lit ? 'var(--gold)' : 'rgba(159,198,255,0.7)',
      boxShadow: lit && !active ? 'none' : active ? 'var(--glow-gold-soft)' : 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transform: press ? 'scale(0.92)' : 'scale(1)',
      transition: 'color var(--dur-fast) var(--ease-flight), background var(--dur-fast), transform var(--dur-fast), border-color var(--dur-fast), box-shadow var(--dur-base)',
      padding: 0,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: name,
    size: icon,
    title: title
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Input — dark glass text field. Optional leading icon and trailing kbd hint
 * (e.g. ⌘K on the global search). Focus brings a faint cool glow.
 */
function Input({
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
  const h = {
    sm: 34,
    md: 40,
    lg: 46
  }[size] || 40;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: h,
      padding: '0 12px',
      borderRadius: 'var(--r-md)',
      background: 'var(--space-1)',
      border: '1px solid',
      borderColor: focus ? 'var(--glass-border-strong)' : 'var(--glass-border)',
      boxShadow: focus ? '0 0 0 3px rgba(159,198,255,0.10), var(--glow-faint)' : 'none',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-base)',
      ...style
    }
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    color: focus ? 'var(--star-blue)' : 'var(--text-3)'
  }), /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: 'var(--text-1)',
      fontFamily: 'var(--font-sans)',
      fontSize: {
        sm: 13,
        md: 14.5,
        lg: 16
      }[size] || 14.5,
      ...inputStyle
    }
  }, rest)), kbd && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-3)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: '2px 6px',
      lineHeight: 1
    }
  }, kbd));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tag — a metadata chip (note tags, filters). Quiet glass capsule with an
 * optional leading dot/icon. `removable` shows an x; `active` lights gold.
 */
function Tag({
  children,
  icon,
  dot,
  active = false,
  removable = false,
  onRemove,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 26,
      padding: '0 10px',
      borderRadius: 'var(--r-pill)',
      fontFamily: 'var(--font-sans)',
      fontSize: 12.5,
      color: active ? 'var(--gold)' : 'var(--text-2)',
      background: active ? 'rgba(255,217,138,0.10)' : hover ? 'rgba(159,198,255,0.10)' : 'rgba(159,198,255,0.05)',
      border: '1px solid',
      borderColor: active ? 'rgba(255,217,138,0.30)' : 'var(--glass-border)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: typeof dot === 'string' ? dot : 'var(--star-blue)',
      flex: 'none'
    }
  }), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 13,
    color: "currentColor"
  }), children, removable && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 13,
    color: "currentColor",
    style: {
      opacity: 0.6,
      cursor: 'pointer'
    },
    onClick: e => {
      e.stopPropagation();
      onRemove && onRemove();
    }
  }));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/knowledge/ConstellationItem.jsx
try { (() => {
/**
 * ConstellationItem — a sidebar row for one constellation (note group).
 * Shows a representative memory color (warm = solid, cold = dimming), name,
 * star count, and active/hover lift. Low density, hairline highlights only.
 */
function ConstellationItem({
  name,
  color = 'var(--star-blue)',
  count,
  active = false,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: 38,
      padding: '0 10px',
      borderRadius: 'var(--r-sm)',
      border: '1px solid',
      borderColor: active ? 'var(--glass-border-strong)' : 'transparent',
      background: active ? 'rgba(159,198,255,0.08)' : hover ? 'rgba(159,198,255,0.05)' : 'transparent',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'background var(--dur-fast), border-color var(--dur-fast)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      flex: 'none',
      background: color,
      boxShadow: `0 0 8px ${color}`
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: 13.5,
      color: active ? 'var(--text-1)' : 'var(--text-2)'
    }
  }, name), count != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-3)'
    }
  }, count));
}
Object.assign(__ds_scope, { ConstellationItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/knowledge/ConstellationItem.jsx", error: String((e && e.message) || e) }); }

// components/knowledge/MemoryBar.jsx
try { (() => {
/** Map a 0..1 memory strength to a color on the temperature ramp. */
function memoryColor(strength) {
  const dawn = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dawn';
  const stops = dawn ? [[0.0, [108, 121, 155]],
  // dead — still visible on light
  [0.25, [92, 108, 150]],
  // faint
  [0.5, [76, 96, 148]],
  // low
  [0.7, [52, 95, 190]],
  // mid
  [0.88, [184, 128, 26]],
  // high (deep amber)
  [1.0, [168, 109, 18]] // full
  ] : [[0.0, [44, 53, 86]],
  // dead
  [0.25, [70, 82, 122]],
  // faint
  [0.5, [120, 150, 205]],
  // low
  [0.7, [159, 198, 255]],
  // mid
  [0.88, [255, 224, 150]],
  // high
  [1.0, [255, 244, 214]] // full
  ];
  const s = Math.max(0, Math.min(1, strength));
  for (let i = 1; i < stops.length; i++) {
    if (s <= stops[i][0]) {
      const [a, ca] = stops[i - 1],
        [b, cb] = stops[i];
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
function MemoryBar({
  value = 0.5,
  label,
  showPct = false,
  height = 6,
  fading = false,
  style
}) {
  const v = Math.max(0, Math.min(1, value));
  const col = memoryColor(v);
  const warm = v >= 0.82;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, (label || showPct) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-2)'
    }
  }, label), showPct && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: warm ? 'var(--gold)' : 'var(--star-blue)'
    }
  }, Math.round(v * 100), "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      borderRadius: 999,
      background: 'rgba(159,198,255,0.10)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: v * 100 + '%',
      height: '100%',
      borderRadius: 999,
      background: `linear-gradient(90deg, var(--star-blue-deep), ${col})`,
      boxShadow: warm ? '0 0 10px rgba(255,217,138,0.55)' : '0 0 8px rgba(159,198,255,0.35)',
      animation: fading ? 'sr-breathe 3.4s var(--ease-flight) infinite' : 'none',
      transition: 'width var(--dur-slow) var(--ease-flight)'
    }
  })));
}
Object.assign(__ds_scope, { memoryColor, MemoryBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/knowledge/MemoryBar.jsx", error: String((e && e.message) || e) }); }

// components/knowledge/StarNode.jsx
try { (() => {
/**
 * StarNode — a single knowledge star on the canvas.
 * Encodes meaning visually: brightness/color = memory strength,
 * size = importance, breathing = alive. Selected adds a ring.
 * Position via `style` (absolute left/top) from the parent canvas.
 */
function StarNode({
  strength = 0.6,
  importance = 1,
  // 0.6..1.6 size multiplier
  label,
  selected = false,
  breathe = true,
  onClick,
  onMouseEnter,
  onMouseLeave,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const core = 12 * importance; // px core diameter
  const col = __ds_scope.memoryColor(strength);
  const warm = strength >= 0.82;
  // 黎明（浅底）：白核与奶油金辉光会融进背景，改用深琥珀核心 + 琥珀/藏蓝辉光
  const dawn = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dawn';
  const glow = warm ? (dawn ? `0 0 ${14 * importance}px rgba(156,86,10,0.5), 0 0 ${5 * importance}px rgba(122,68,8,0.75)` : `0 0 ${18 * importance}px rgba(255,217,138,0.6), 0 0 ${7 * importance}px rgba(255,244,214,0.9)`) : (dawn ? `0 0 ${12 * importance}px rgba(58,98,192,${0.25 + strength * 0.35}), 0 0 ${4 * importance}px rgba(58,98,192,0.6)` : `0 0 ${14 * importance}px rgba(159,198,255,${0.25 + strength * 0.4}), 0 0 ${5 * importance}px rgba(159,198,255,0.7)`);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: e => {
      setHover(true);
      onMouseEnter && onMouseEnter(e);
    },
    onMouseLeave: e => {
      setHover(false);
      onMouseLeave && onMouseLeave(e);
    },
    style: {
      position: 'absolute',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      cursor: onClick ? 'pointer' : 'default',
      transform: 'translate(-50%, -50%)',
      ...style
    }
  }, selected && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: core / 2,
      left: '50%',
      width: core + 18,
      height: core + 18,
      transform: 'translate(-50%, -50%)',
      borderRadius: '50%',
      border: '1px solid rgba(255,217,138,0.55)',
      boxShadow: '0 0 16px rgba(255,217,138,0.35)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: breathe ? 'sr-breathe' : '',
    style: {
      width: core,
      height: core,
      borderRadius: '50%',
      background: warm ? (dawn ? `radial-gradient(circle at 38% 35%, #ffc95c 0%, #b07d1c 30%, #6f4a08 100%)` : `radial-gradient(circle at 38% 35%, #fff, ${col} 55%, var(--gold-warm) 100%)`) : (dawn ? `radial-gradient(circle at 38% 35%, #b9cdf5, ${col} 70%)` : `radial-gradient(circle at 38% 35%, #eaf2ff, ${col} 70%)`),
      boxShadow: glow,
      transform: hover ? 'scale(1.25)' : 'scale(1)',
      transition: 'transform var(--dur-base) var(--ease-flight)'
    }
  }), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontFamily: 'var(--font-sans)',
      color: hover || selected ? 'var(--text-1)' : 'var(--text-3)',
      whiteSpace: 'nowrap',
      textShadow: 'var(--star-label-shadow)',
      opacity: hover || selected || importance > 1.15 ? 1 : 0.7,
      transition: 'color var(--dur-base), opacity var(--dur-base)'
    }
  }, label));
}
Object.assign(__ds_scope, { StarNode });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/knowledge/StarNode.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/AerialView.jsx
try { (() => {
/* AerialView — extreme far view: the whole universe as a brightness heat map.
   Dark zones = needs review. Constellation names surface. */
const {
  GlassPanel,
  Icon,
  Button: SRButton
} = window.StellarRaftDesignSystem_2866af;
function AerialView({
  onClose
}) {
  const D = window.SR_DATA;
  // centroid + brightness per constellation
  const groups = D.constellations.map(c => {
    const ss = D.stars.filter(s => s.con === c.id);
    const cx = ss.reduce((a, s) => a + s.x, 0) / ss.length;
    const cy = ss.reduce((a, s) => a + s.y, 0) / ss.length;
    return {
      ...c,
      cx,
      cy
    };
  });
  const weakest = groups.slice().sort((a, b) => a.health - b.health)[0];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("sr-starfield", {
    density: "1.6"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 1
    }
  }, groups.map(g => {
    const warm = g.health;
    const color = warm > 0.7 ? '255,217,138' : warm > 0.45 ? '159,198,255' : '120,150,205';
    const size = 240 + g.count * 4;
    return /*#__PURE__*/React.createElement("div", {
      key: g.id,
      style: {
        position: 'absolute',
        left: `${g.cx}%`,
        top: `${g.cy}%`,
        transform: 'translate(-50%,-50%)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: size,
        height: size,
        borderRadius: '50%',
        filter: 'blur(36px)',
        background: `radial-gradient(circle, rgba(${color},${0.16 + warm * 0.4}) 0%, rgba(${color},0.06) 45%, transparent 70%)`
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        textAlign: 'center',
        whiteSpace: 'nowrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 300,
        color: 'var(--text-1)',
        letterSpacing: '0.04em',
        textShadow: '0 2px 10px rgba(0,0,0,0.8)'
      }
    }, g.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: warm > 0.6 ? 'var(--gold)' : 'var(--star-blue-dim)',
        marginTop: 3
      }
    }, Math.round(warm * 100), "% \xB7 ", g.count, " \u661F")));
  }), D.stars.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    style: {
      position: 'absolute',
      left: `${s.x}%`,
      top: `${s.y}%`,
      width: 3,
      height: 3,
      borderRadius: '50%',
      transform: 'translate(-50%,-50%)',
      background: s.strength > 0.7 ? '#ffe096' : '#9fc6ff',
      opacity: 0.3 + s.strength * 0.5
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 18,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    radius: "pill",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 26,
      padding: '10px 26px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "satellite",
    size: 17,
    color: "var(--gold)"
  }), "\u4EAE\u5EA6\u9E1F\u77B0"), /*#__PURE__*/React.createElement(Sep, null), /*#__PURE__*/React.createElement(Stat, {
    n: "12",
    t: "\u672C\u5468\u65B0\u589E"
  }), /*#__PURE__*/React.createElement(Stat, {
    n: "5",
    t: "\u70B9\u4EAE",
    tone: "var(--gold)"
  }), /*#__PURE__*/React.createElement(Sep, null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: 'var(--text-2)'
    }
  }, "\u6700\u8584\u5F31\u661F\u5EA7 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--star-blue-dim)',
      fontWeight: 500
    }
  }, weakest.name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 26,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement(SRButton, {
    icon: "corner-up-left",
    onClick: onClose
  }, "\u8FD4\u56DE\u661F\u56FE")));
}
function Sep() {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 20,
      background: 'var(--line)'
    }
  });
}
function Stat({
  n,
  t,
  tone
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 17,
      color: tone || 'var(--text-1)'
    }
  }, n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--text-3)'
    }
  }, t));
}
window.SRKit = Object.assign(window.SRKit || {}, {
  AerialView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/AerialView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/Editor.jsx
try { (() => {
/* Editor — professional block editor (screen 8). Block-driven: hover handles,
   right-click context menu, slash insert, selection toolbar, many block types,
   contentEditable text, + the right knowledge rail. */
const {
  GlassPanel,
  Icon,
  IconButton,
  Input,
  Tag,
  Badge,
  MemoryBar,
  Button
} = window.StellarRaftDesignSystem_2866af;
const TXT = {
  default: 'var(--text-1)',
  blue: 'var(--star-blue)',
  gold: 'var(--gold)',
  dim: 'var(--star-blue-dim)',
  danger: 'var(--danger)'
};
const BG = {
  none: 'transparent',
  bgblue: 'rgba(159,198,255,0.10)',
  bggold: 'rgba(255,217,138,0.10)',
  bgdeep: 'rgba(26,35,80,0.45)'
};
const uid = () => 'b' + Math.random().toString(36).slice(2, 8);
const INITIAL = [{
  id: 'b1',
  type: 'rich'
}, {
  id: 'b2',
  type: 'h2',
  text: 'CHSH 形式'
}, {
  id: 'b3',
  type: 'callout',
  tone: 'gold',
  text: '关键判据：经典定域理论给出 |S| ≤ 2，而量子力学允许 |S| 达到 2√2 ≈ 2.83。'
}, {
  id: 'b4',
  type: 'math',
  tex: 'S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′),   |S| ≤ 2'
}, {
  id: 'b5',
  type: 'bulleted',
  text: '经典定域理论：|S| ≤ 2'
}, {
  id: 'b6',
  type: 'bulleted',
  text: '量子力学预测：|S| 可达 2√2 ≈ 2.83'
}, {
  id: 'b7',
  type: 'bulleted',
  text: '实验值显著超过 2，排除定域隐变量'
}, {
  id: 'b8',
  type: 'h3',
  text: '实验验证'
}, {
  id: 'b9',
  type: 'todo',
  checked: true,
  text: 'Aspect 1982 实验（光子偏振关联）'
}, {
  id: 'b10',
  type: 'todo',
  checked: false,
  text: '复现 CHSH 推导（待整理）'
}, {
  id: 'b11',
  type: 'code',
  lang: 'python'
}, {
  id: 'b12',
  type: 'quote',
  text: '“No reasonable definition of reality could be expected to permit this.” — EPR, 1935'
}, {
  id: 'b13',
  type: 'toggle',
  open: false,
  text: '延伸：GHZ 态与三粒子佯谬',
  child: 'GHZ 态用三个粒子给出确定性（而非统计性）的矛盾，比 CHSH 更强地排除了定域实在论。'
}, {
  id: 'b14',
  type: 'table'
}, {
  id: 'b15',
  type: 'divider'
}, {
  id: 'b16',
  type: 'p',
  text: ''
}];
const EDITABLE = ['p', 'h1', 'h2', 'h3', 'bulleted', 'numbered', 'todo', 'quote', 'toggle', 'callout'];
function Handle({
  icon,
  title,
  onClick
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    title: title,
    onMouseDown: e => e.preventDefault(),
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      width: 22,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 5,
      background: h ? 'rgba(159,198,255,0.12)' : 'transparent',
      border: 'none',
      cursor: 'grab',
      color: 'var(--text-3)',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 15,
    color: "currentColor"
  }));
}
function useDawn() {
  const [dawn, setDawn] = React.useState(typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dawn');
  React.useEffect(() => {
    const obs = new MutationObserver(() => setDawn(document.documentElement.dataset.theme === 'dawn'));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => obs.disconnect();
  }, []);
  return dawn;
}
const CODE_LANGS = window.SR_HL && window.SR_HL.LANGS || ['python', 'javascript', 'plaintext'];
function CodeBlock() {
  const dawn = useDawn();
  const [copied, setCopied] = React.useState(false);
  const [lang, setLang] = React.useState('python');
  const [menu, setMenu] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const langBtnRef = React.useRef(null);
  const [menuPos, setMenuPos] = React.useState(null);
  React.useLayoutEffect(() => {
    if (!menu || !langBtnRef.current) return;
    const r = langBtnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const below = spaceBelow >= 220 || spaceBelow >= r.top;
    const maxH = Math.max(160, Math.min(340, below ? spaceBelow : r.top - 16));
    setMenuPos(below ? {
      left: r.left,
      top: r.bottom + 6,
      maxH
    } : {
      left: r.left,
      bottom: window.innerHeight - r.top + 6,
      maxH
    });
  }, [menu]);

  // Light code surface in dawn, deep surface at night — syntax palette per theme.
  const P = dawn ? {
    bg: '#e8ecf4',
    head: '#dde3ef',
    border: 'rgba(36,52,96,0.18)',
    plain: '#1b2440',
    kw: '#7c3aed',
    fn: '#2563eb',
    str: '#0a7a4f',
    com: '#7c87a4',
    num: '#0e7490',
    ln: '#9aa4be',
    meta: '#566184'
  } : {
    bg: 'rgba(3,4,12,0.66)',
    head: 'transparent',
    border: 'var(--glass-border)',
    plain: '#e2e9ff',
    kw: '#c9a6ff',
    fn: '#9fc6ff',
    str: '#ffd98a',
    com: '#828fb2',
    num: '#7fd6c0',
    ln: 'rgba(190,212,255,0.5)',
    meta: 'rgba(190,212,255,0.62)'
  };
  const HL = window.SR_HL;
  const code = HL && (HL.SAMPLES[lang] || HL.GENERIC) || '';
  const rows = HL ? HL.tokenize(code, lang) : [[{
    t: code,
    c: 'plain'
  }]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: P.bg,
      border: '1px solid ' + P.border,
      borderRadius: 'var(--r-md)',
      overflow: 'hidden',
      margin: '2px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderBottom: '1px solid ' + P.border,
      background: P.head,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, ['#ff6b6b88', '#ffc94e99', '#5ec98e99'].map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: c
    }
  }))), editing ? /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    defaultValue: lang,
    onBlur: e => {
      const v = e.target.value.trim().toLowerCase();
      if (v) setLang(v);
      setEditing(false);
    },
    onKeyDown: e => {
      if (e.key === 'Enter') {
        const v = e.target.value.trim().toLowerCase();
        if (v) setLang(v);
        setEditing(false);
      }
      if (e.key === 'Escape') setEditing(false);
    },
    style: {
      marginLeft: 4,
      width: 110,
      background: 'transparent',
      border: 'none',
      borderBottom: '1px solid ' + P.meta,
      outline: 'none',
      color: P.plain,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      padding: '1px 0'
    }
  }) : /*#__PURE__*/React.createElement("button", {
    type: "button",
    ref: langBtnRef,
    onClick: () => setMenu(m => !m),
    onDoubleClick: () => {
      setMenu(false);
      setEditing(true);
    },
    title: "\u70B9\u51FB\u5207\u6362\u8BED\u8A00 \xB7 \u53CC\u51FB\u76F4\u63A5\u7F16\u8F91",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      marginLeft: 4,
      padding: '2px 6px',
      borderRadius: 6,
      background: menu ? dawn ? 'rgba(36,52,96,0.08)' : 'rgba(159,198,255,0.1)' : 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: P.meta
    }
  }, lang, " ", /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 12,
    color: "currentColor",
    style: {
      transform: menu ? 'rotate(180deg)' : 'none',
      transition: 'transform var(--dur-fast)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    },
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: copied ? dawn ? '#b8801a' : '#ffd98a' : P.meta,
      fontSize: 11.5,
      fontFamily: 'var(--font-mono)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: copied ? 'check' : 'copy',
    size: 13,
    color: "currentColor"
  }), copied ? '已复制' : '复制'), menu && menuPos && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => setMenu(false),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 9
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: menuPos.left,
      top: menuPos.top,
      bottom: menuPos.bottom,
      zIndex: 10,
      width: 160
    }
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    strong: true,
    radius: "md",
    pad: "none",
    style: {
      padding: 5,
      maxHeight: menuPos.maxH,
      overflow: 'auto'
    }
  }, CODE_LANGS.map(l => /*#__PURE__*/React.createElement("div", {
    key: l,
    onClick: () => {
      setLang(l);
      setMenu(false);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '6px 9px',
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      color: l === lang ? 'var(--gold)' : 'var(--text-1)'
    },
    onMouseEnter: e => e.currentTarget.style.background = dawn ? 'rgba(36,52,96,0.07)' : 'rgba(159,198,255,0.08)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      display: 'inline-flex'
    }
  }, l === lang && /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 13,
    color: "var(--gold)"
  })), l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      lineHeight: 1.85,
      color: P.plain,
      overflowX: 'auto'
    }
  }, rows.map((toks, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 16,
      whiteSpace: 'pre'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      flex: 'none',
      textAlign: 'right',
      color: P.ln,
      userSelect: 'none'
    }
  }, i + 1), /*#__PURE__*/React.createElement("span", null, toks.map((tk, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    style: {
      color: P[tk.c] || P.plain
    }
  }, tk.t)))))));
}
function DataTable() {
  const head = ['理论', 'S 上限', '是否定域'];
  const rows = [['经典隐变量', '2', '是'], ['量子力学', '2√2 ≈ 2.83', '否'], ['实验观测', '≈ 2.4', '—']];
  const cell = (txt, isHead) => /*#__PURE__*/React.createElement("td", {
    contentEditable: true,
    suppressContentEditableWarning: true,
    style: {
      outline: 'none',
      padding: '9px 13px',
      borderRight: '1px solid var(--line)',
      borderBottom: '1px solid var(--line)',
      fontSize: 13.5,
      color: isHead ? 'var(--text-1)' : 'var(--text-2)',
      fontWeight: isHead ? 500 : 400,
      background: isHead ? 'rgba(159,198,255,0.05)' : 'transparent'
    }
  }, txt);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--r-md)',
      overflow: 'hidden',
      margin: '2px 0'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, head.map((h, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, cell(h, true)))), rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, r.map((c, j) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: j
  }, cell(c, false))))))));
}
function RichIntro() {
  return /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0
    }
  }, "\u8D1D\u5C14\u4E0D\u7B49\u5F0F\u7ED9\u51FA\u4E86\u4EFB\u4F55", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-1)',
      background: 'rgba(255,217,138,0.16)',
      padding: '1px 4px',
      borderRadius: 4
    }
  }, "\u5B9A\u57DF\u9690\u53D8\u91CF\u7406\u8BBA"), "\u6240\u80FD\u4EA7\u751F\u7684\u5173\u8054\u7684\u7EDF\u8BA1\u4E0A\u9650\u3002\u5B9E\u9A8C\u4E0A\u5BF9\u8BE5\u4E0D\u7B49\u5F0F\u7684", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-1)',
      fontWeight: 600
    }
  }, "\u8FDD\u80CC"), "\uFF0C\u786E\u7ACB\u4E86\u91CF\u5B50\u7EA0\u7F20\u7684", /*#__PURE__*/React.createElement("a", {
    style: {
      color: 'var(--star-blue)',
      textDecoration: 'none',
      borderBottom: '1px solid rgba(159,198,255,0.4)',
      cursor: 'pointer'
    }
  }, "\u975E\u5B9A\u57DF\u6027"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      verticalAlign: 'super',
      marginLeft: 2,
      color: 'var(--text-3)',
      fontSize: 11,
      cursor: 'pointer'
    },
    title: "1 \u6761\u8BC4\u8BBA"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "message-square-text",
    size: 12,
    color: "currentColor"
  })), "\u3002");
}
function Properties() {
  const [open, setOpen] = React.useState(true);
  const rows = [{
    icon: 'tag',
    k: '类型',
    v: '推导',
    kind: 'select'
  }, {
    icon: 'circle-dot',
    k: '状态',
    v: '复习中',
    kind: 'status'
  }, {
    icon: 'book-open',
    k: '来源',
    v: '量子信息 · 第 4 讲',
    kind: 'text'
  }, {
    icon: 'languages',
    k: '别名',
    v: 'Bell inequality',
    kind: 'text'
  }, {
    icon: 'calendar',
    k: '下次复习',
    v: '6 天后',
    kind: 'text'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 22,
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--r-md)',
      background: 'rgba(159,198,255,0.03)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(o => !o),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 14px',
      cursor: 'pointer',
      color: 'var(--text-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 14,
    color: "currentColor",
    style: {
      transform: open ? 'rotate(90deg)' : 'none',
      transition: 'transform var(--dur-fast)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      letterSpacing: 'var(--ls-hud)',
      textTransform: 'uppercase',
      fontFamily: 'var(--font-mono)'
    }
  }, "\u5C5E\u6027 Properties"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11
    }
  }, rows.length)), open && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '2px 14px 12px'
    }
  }, rows.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '5px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      width: 96,
      flex: 'none',
      color: 'var(--text-3)',
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: r.icon,
    size: 13,
    color: "currentColor"
  }), r.k), r.kind === 'status' ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12.5,
      color: 'var(--text-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--gold)',
      boxShadow: 'var(--glow-gold-soft)'
    }
  }), r.v) : r.kind === 'select' ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      padding: '2px 9px',
      borderRadius: 'var(--r-pill)',
      background: 'rgba(159,198,255,0.12)',
      color: 'var(--star-blue)'
    }
  }, r.v) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-1)'
    }
  }, r.v))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 0 2px',
      color: 'var(--text-3)',
      fontSize: 12.5,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13,
    color: "currentColor"
  }), "\u6DFB\u52A0\u5C5E\u6027")));
}
function Editor({
  starId,
  onBack
}) {
  const D = window.SR_DATA;
  const star = D.byId[starId] || D.stars[0];
  const refs = React.useRef({});
  const [blocks, setBlocks] = React.useState(INITIAL);
  const [hover, setHover] = React.useState(null);
  const [ctx, setCtx] = React.useState(null); // {x,y,id}
  const [slash, setSlash] = React.useState(null); // {x,y,id}
  const [sel, setSel] = React.useState(null); // {x,y}
  const [colorPop, setColorPop] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const {
    SlashMenu,
    SelectionToolbar,
    ContextMenu,
    ColorMenu
  } = window.SRKit;
  const links = D.stars.filter(s => s.id !== star.id && s.con === star.con).slice(0, 3);
  const backlinks = D.stars.filter(s => s.con !== star.con).slice(0, 2);
  const scrollRef = React.useRef(null);
  const outline = blocks.filter(b => ['h1', 'h2', 'h3'].includes(b.type) && (b.text || '').trim());
  const charCount = blocks.filter(b => EDITABLE.includes(b.type)).map(b => b.text || '').join('').replace(/\s/g, '').length + star.label.length;
  const readMin = Math.max(1, Math.round(charCount / 350));
  const scrollToBlock = id => {
    const c = scrollRef.current,
      el = document.getElementById('blk-' + id);
    if (c && el) c.scrollTo({
      top: el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 40,
      behavior: 'smooth'
    });
  };
  const flash = msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };
  const withSynced = fn => setBlocks(bs => fn(bs.map(b => refs.current[b.id] && EDITABLE.includes(b.type) ? {
    ...b,
    text: refs.current[b.id].innerText
  } : b)));
  const act = id => (action, arg) => {
    if (action === 'delete') withSynced(s => s.filter(b => b.id !== id));else if (action === 'duplicate') withSynced(s => {
      const i = s.findIndex(b => b.id === id);
      return [...s.slice(0, i + 1), {
        ...s[i],
        id: uid()
      }, ...s.slice(i + 1)];
    });else if (action === 'turn') withSynced(s => s.map(b => b.id === id ? {
      ...b,
      type: arg
    } : b));else if (action === 'color') withSynced(s => s.map(b => b.id === id ? arg.kind === 'text' ? {
      ...b,
      color: arg.id
    } : {
      ...b,
      bg: arg.id
    } : b));else if (action === 'copyLink') flash('已复制块链接');else if (action === 'move') flash('已移动到「' + D.conName(arg) + '」');else if (action === 'comment') flash('已添加评论');else if (action === 'review') flash('已加入复习队列');else if (action === 'ai') flash('AI 正在阅读这个块…');
    setCtx(null);
  };
  const insertAfter = (id, type = 'p') => withSynced(s => {
    const i = s.findIndex(b => b.id === id);
    const nb = {
      id: uid(),
      type,
      text: ''
    };
    return [...s.slice(0, i + 1), nb, ...s.slice(i + 1)];
  });
  const onMouseUp = () => {
    const s = window.getSelection();
    if (s && !s.isCollapsed && s.rangeCount && s.toString().trim()) {
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (r.width > 1) {
        setSel({
          x: r.left + r.width / 2,
          y: r.top - 6
        });
        return;
      }
    }
    setSel(null);
  };
  const editable = (b, tag, style) => {
    const Tag = tag;
    return React.createElement(Tag, {
      ref: el => refs.current[b.id] = el,
      contentEditable: true,
      suppressContentEditableWarning: true,
      'data-ph': '输入正文，或按 / 选择块类型',
      onContextMenu: e => {
        e.preventDefault();
        e.stopPropagation();
        setCtx({
          x: e.clientX,
          y: e.clientY,
          id: b.id
        });
      },
      style: {
        outline: 'none',
        color: TXT[b.color] || 'var(--text-1)',
        ...style
      },
      dangerouslySetInnerHTML: {
        __html: b.text || ''
      }
    });
  };
  let numCount = 0;
  const renderInner = b => {
    if (b.type !== 'numbered') numCount = 0;
    switch (b.type) {
      case 'rich':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 16.5,
            lineHeight: 1.85,
            color: 'var(--text-2)'
          }
        }, /*#__PURE__*/React.createElement(RichIntro, null));
      case 'h1':
        return editable(b, 'div', {
          fontSize: 28,
          fontWeight: 300,
          lineHeight: 1.3
        });
      case 'h2':
        return editable(b, 'div', {
          fontSize: 21,
          fontWeight: 300,
          marginTop: 6
        });
      case 'h3':
        return editable(b, 'div', {
          fontSize: 17.5,
          fontWeight: 500,
          color: 'var(--text-1)'
        });
      case 'p':
        return editable(b, 'div', {
          fontSize: 16.5,
          lineHeight: 1.85,
          color: 'var(--text-2)',
          minHeight: 26
        });
      case 'quote':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 14
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            width: 3,
            borderRadius: 2,
            background: 'linear-gradient(var(--gold), var(--star-blue))',
            flex: 'none'
          }
        }), editable(b, 'div', {
          fontSize: 16,
          lineHeight: 1.75,
          color: 'var(--text-2)',
          fontStyle: 'italic'
        }));
      case 'callout':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 12,
            padding: '13px 15px',
            borderRadius: 'var(--r-md)',
            background: 'rgba(255,217,138,0.06)',
            border: '1px solid rgba(255,217,138,0.20)'
          }
        }, /*#__PURE__*/React.createElement(Icon, {
          name: "lightbulb",
          size: 18,
          color: "var(--gold)",
          style: {
            marginTop: 2
          }
        }), editable(b, 'div', {
          flex: 1,
          fontSize: 15,
          lineHeight: 1.7,
          color: 'var(--text-1)'
        }));
      case 'bulleted':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 12
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            color: 'var(--star-blue)',
            marginTop: 11,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--star-blue)',
            flex: 'none'
          }
        }), editable(b, 'div', {
          flex: 1,
          fontSize: 16.5,
          lineHeight: 1.7,
          color: 'var(--text-2)'
        }));
      case 'numbered':
        {
          numCount += 1;
          const n = numCount;
          return /*#__PURE__*/React.createElement("div", {
            style: {
              display: 'flex',
              gap: 12
            }
          }, /*#__PURE__*/React.createElement("span", {
            style: {
              color: 'var(--star-blue)',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              marginTop: 2,
              minWidth: 16
            }
          }, n, "."), editable(b, 'div', {
            flex: 1,
            fontSize: 16.5,
            lineHeight: 1.7,
            color: 'var(--text-2)'
          }));
        }
      case 'todo':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 11,
            alignItems: 'flex-start'
          }
        }, /*#__PURE__*/React.createElement("span", {
          onClick: () => setBlocks(s => s.map(x => x.id === b.id ? {
            ...x,
            checked: !x.checked
          } : x)),
          style: {
            width: 18,
            height: 18,
            marginTop: 2,
            borderRadius: 5,
            flex: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid',
            borderColor: b.checked ? 'var(--gold)' : 'var(--line-strong)',
            background: b.checked ? 'var(--gold)' : 'transparent'
          }
        }, b.checked && /*#__PURE__*/React.createElement(Icon, {
          name: "check",
          size: 12,
          color: "var(--text-on-gold)"
        })), editable(b, 'div', {
          flex: 1,
          fontSize: 16,
          lineHeight: 1.7,
          color: b.checked ? 'var(--text-3)' : 'var(--text-2)',
          textDecoration: b.checked ? 'line-through' : 'none'
        }));
      case 'toggle':
        return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start'
          }
        }, /*#__PURE__*/React.createElement("span", {
          onClick: () => setBlocks(s => s.map(x => x.id === b.id ? {
            ...x,
            open: !x.open
          } : x)),
          style: {
            marginTop: 4,
            cursor: 'pointer',
            transform: b.open ? 'rotate(90deg)' : 'none',
            transition: 'transform var(--dur-fast)',
            color: 'var(--text-3)'
          }
        }, /*#__PURE__*/React.createElement(Icon, {
          name: "chevron-right",
          size: 16,
          color: "currentColor"
        })), editable(b, 'div', {
          flex: 1,
          fontSize: 16.5,
          lineHeight: 1.7,
          color: 'var(--text-1)'
        })), b.open && /*#__PURE__*/React.createElement("div", {
          style: {
            marginLeft: 24,
            marginTop: 6,
            fontSize: 15,
            lineHeight: 1.7,
            color: 'var(--text-2)'
          }
        }, b.child));
      case 'math':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            justifyContent: 'center',
            padding: '16px 0',
            borderRadius: 'var(--r-md)',
            background: 'rgba(159,198,255,0.04)',
            border: '1px solid var(--glass-border)'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            fontFamily: 'var(--font-mono)',
            fontSize: 18.5,
            color: 'var(--text-1)',
            letterSpacing: '0.02em'
          }
        }, b.tex));
      case 'code':
        return /*#__PURE__*/React.createElement(CodeBlock, null);
      case 'table':
        return /*#__PURE__*/React.createElement(DataTable, null);
      case 'image':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 120,
            borderRadius: 'var(--r-md)',
            border: '1px dashed var(--line-strong)',
            color: 'var(--text-3)'
          }
        }, /*#__PURE__*/React.createElement(Icon, {
          name: "image",
          size: 22,
          color: "currentColor"
        }), /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 13
          }
        }, "\u62D6\u5165\u56FE\u7247\uFF0C\u6216\u70B9\u51FB\u4E0A\u4F20"));
      case 'divider':
        return /*#__PURE__*/React.createElement("div", {
          style: {
            height: 1,
            background: 'var(--line-strong)',
            margin: '6px 0'
          }
        });
      default:
        return null;
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      display: 'flex',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("sr-starfield", {
    density: "0.4"
  }), /*#__PURE__*/React.createElement("div", {
    ref: scrollRef,
    onMouseUp: onMouseUp,
    style: {
      flex: 1,
      minWidth: 0,
      overflow: 'auto',
      position: 'relative',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: '0 auto',
      padding: '20px 52px 120px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    icon: "corner-up-left",
    onClick: onBack
  }, "\u661F\u56FE"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-3)'
    }
  }, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: 'var(--text-2)',
      whiteSpace: 'nowrap',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: D.conColor(star.con),
      boxShadow: `0 0 7px ${D.conColor(star.con)}`
    }
  }), D.conName(star.con)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: 'var(--text-3)',
      whiteSpace: 'nowrap',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14,
    color: "var(--gold)"
  }), "\u5DF2\u81EA\u52A8\u4FDD\u5B58"), /*#__PURE__*/React.createElement(IconButton, {
    name: "star",
    title: "\u6536\u85CF"
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "more-horizontal",
    title: "\u66F4\u591A",
    onClick: e => setCtx({
      x: e.clientX - 200,
      y: e.clientY + 8,
      id: blocks[0].id
    })
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    icon: "hash"
  }, "\u63A8\u5BFC"), /*#__PURE__*/React.createElement(Tag, {
    icon: "hash"
  }, "\u8003\u70B9"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      height: 26,
      padding: '0 10px',
      borderRadius: 'var(--r-pill)',
      border: '1px dashed var(--line-strong)',
      color: 'var(--text-3)',
      fontSize: 12.5,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13,
    color: "currentColor"
  }), "\u6807\u7B7E"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-3)'
    }
  }, "\u521B\u5EFA 5/12 \xB7 \u7F16\u8F91 2h"), /*#__PURE__*/React.createElement(Badge, {
    tone: "gold"
  }, "Lv.4")), /*#__PURE__*/React.createElement("div", {
    contentEditable: true,
    suppressContentEditableWarning: true,
    style: {
      outline: 'none',
      fontSize: 32,
      fontWeight: 200,
      color: 'var(--text-1)',
      letterSpacing: '-0.01em',
      textShadow: 'var(--text-glow-cool)',
      marginBottom: 20,
      lineHeight: 1.2
    }
  }, star.label), /*#__PURE__*/React.createElement(Properties, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    },
    onMouseLeave: () => setHover(null)
  }, blocks.map((b, idx) => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    id: 'blk-' + b.id,
    onMouseEnter: () => setHover(b.id),
    onContextMenu: e => {
      e.preventDefault();
      setCtx({
        x: e.clientX,
        y: e.clientY,
        id: b.id
      });
    },
    style: {
      position: 'relative',
      borderRadius: 'var(--r-sm)',
      padding: b.bg && b.bg !== 'none' ? '8px 12px' : '2px 0',
      background: hover === b.id ? b.bg && b.bg !== 'none' ? BG[b.bg] : 'rgba(159,198,255,0.025)' : b.bg ? BG[b.bg] : 'transparent',
      transition: 'background var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: -52,
      top: 1,
      display: 'flex',
      gap: 1,
      opacity: hover === b.id ? 1 : 0,
      transition: 'opacity var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement(Handle, {
    icon: "plus",
    title: "\u5728\u4E0B\u65B9\u63D2\u5165\u5757",
    onClick: () => insertAfter(b.id)
  }), /*#__PURE__*/React.createElement(Handle, {
    icon: "grip-vertical",
    title: "\u62D6\u52A8 \xB7 \u53F3\u952E\u6253\u5F00\u83DC\u5355",
    onClick: e => setCtx({
      x: e.clientX,
      y: e.clientY,
      id: b.id
    })
  })), renderInner(b)))), /*#__PURE__*/React.createElement("div", {
    onClick: e => setSlash({
      x: e.clientX,
      y: e.clientY,
      id: blocks[blocks.length - 1].id
    }),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: 'var(--text-3)',
      fontSize: 16,
      cursor: 'text',
      minHeight: 30,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--star-blue)',
      opacity: 0.7
    }
  }, "/"), " \u8F93\u5165\u659C\u6760\u5524\u8D77\u547D\u4EE4\u2026"))), /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 312,
      flex: 'none',
      borderLeft: '1px solid var(--glass-border)',
      background: 'var(--glass-bg)',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      backdropFilter: 'blur(var(--glass-blur))',
      overflow: 'auto',
      position: 'relative',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(RailHead, {
    icon: "list-tree",
    title: "\u5927\u7EB2"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => scrollRef.current && scrollRef.current.scrollTo({
      top: 0,
      behavior: 'smooth'
    }),
    style: {
      padding: '5px 10px',
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      fontSize: 13,
      color: 'var(--text-1)',
      borderLeft: '2px solid var(--gold)'
    }
  }, star.label), outline.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.id,
    onClick: () => scrollToBlock(o.id),
    style: {
      padding: '5px 10px',
      paddingLeft: o.type === 'h3' ? 30 : 18,
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      fontSize: 12.5,
      color: 'var(--text-2)',
      borderLeft: '2px solid var(--line)'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(159,198,255,0.06)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, o.text)))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(RailHead, {
    icon: "waypoints",
    title: "\u8FDE\u63A5\u7684\u661F",
    extra: links.length
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 10
    }
  }, links.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    style: {
      padding: '10px 12px',
      borderRadius: 'var(--r-md)',
      background: 'rgba(159,198,255,0.04)',
      border: '1px solid var(--glass-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "link",
    size: 13,
    color: "var(--star-blue)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--text-1)'
    }
  }, l.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--text-3)',
      lineHeight: 1.5,
      paddingLeft: 21
    }
  }, ['是其推导的前提条件', '提供了实验判据', '在同一框架下统一'][i] || '相关概念'))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '9px 12px',
      borderRadius: 'var(--r-md)',
      border: '1px dashed var(--line-strong)',
      background: 'transparent',
      color: 'var(--text-3)',
      fontSize: 12.5,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14,
    color: "currentColor"
  }), "\u65B0\u5EFA\u8FDE\u63A5 \xB7 \u5199\u4E00\u53E5\u5173\u7CFB"))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(RailHead, {
    icon: "corner-down-left",
    title: "\u53CD\u5411\u94FE\u63A5",
    extra: backlinks.length
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 10
    }
  }, backlinks.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    style: {
      padding: '10px 12px',
      borderRadius: 'var(--r-md)',
      background: 'rgba(159,198,255,0.04)',
      border: '1px solid var(--glass-border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: D.conColor(b.con),
      boxShadow: `0 0 7px ${D.conColor(b.con)}`,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--text-1)'
    }
  }, b.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginLeft: 'auto'
    }
  }, D.conName(b.con))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--text-3)',
      marginTop: 6,
      lineHeight: 1.6,
      paddingLeft: 15
    }
  }, "\u2026\u5176\u63A8\u5BFC\u76F4\u63A5\u5F15\u7528\u4E86 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--star-blue)',
      background: 'rgba(159,198,255,0.10)',
      padding: '0 4px',
      borderRadius: 3
    }
  }, "[[", star.label, "]]"), " \u7ED9\u51FA\u7684\u7EDF\u8BA1\u4E0A\u9650\u3002"))))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(RailHead, {
    icon: "zap",
    title: "\u8BB0\u5FC6"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: 14,
      borderRadius: 'var(--r-md)',
      background: 'rgba(255,217,138,0.05)',
      border: '1px solid rgba(255,217,138,0.18)'
    }
  }, /*#__PURE__*/React.createElement(MemoryBar, {
    value: star.strength,
    showPct: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 12,
      fontSize: 12,
      color: 'var(--text-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar-clock",
    size: 14,
    color: "var(--gold)"
  }), "\u9057\u5FD8\u66F2\u7EBF\u9884\u8BA1 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--gold)',
      fontWeight: 500
    }
  }, "6 \u5929\u540E"), " \u590D\u4E60"))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(RailHead, {
    icon: "crosshair",
    title: "\u5728\u661F\u56FE\u4E2D\u5B9A\u4F4D"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      height: 132,
      borderRadius: 'var(--r-md)',
      border: '1px solid var(--glass-border)',
      position: 'relative',
      overflow: 'hidden',
      background: 'radial-gradient(120% 100% at 40% 40%, rgba(26,35,80,0.5), transparent 60%)'
    }
  }, D.stars.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.id,
    style: {
      position: 'absolute',
      left: `${s.x}%`,
      top: `${s.y}%`,
      transform: 'translate(-50%,-50%)',
      width: s.id === star.id ? 8 : 3.5,
      height: s.id === star.id ? 8 : 3.5,
      borderRadius: '50%',
      background: s.id === star.id ? 'var(--gold)' : s.strength > 0.7 ? '#ffe096' : '#9fc6ff',
      boxShadow: s.id === star.id ? '0 0 10px var(--gold)' : 'none',
      opacity: s.id === star.id ? 1 : 0.5
    }
  })))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 312,
      zIndex: 3,
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '7px 24px',
      borderTop: '1px solid var(--line)',
      background: 'var(--glass-bg-strong)',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      backdropFilter: 'blur(var(--glass-blur))',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-3)',
      whiteSpace: 'nowrap',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "layout-list",
    size: 13,
    color: "currentColor"
  }), blocks.length, " \u5757"), /*#__PURE__*/React.createElement("span", null, charCount, " \u5B57"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 13,
    color: "currentColor"
  }), "\u7EA6 ", readMin, " \u5206\u949F\u9605\u8BFB"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "command",
    size: 13,
    color: "currentColor"
  }), "\u2318P \u547D\u4EE4"), /*#__PURE__*/React.createElement("span", null, "Markdown"), /*#__PURE__*/React.createElement("span", null, "UTF-8")), ctx && /*#__PURE__*/React.createElement(ContextMenu, {
    x: ctx.x,
    y: ctx.y,
    constellations: D.constellations,
    onClose: () => setCtx(null),
    onAction: act(ctx.id)
  }), slash && /*#__PURE__*/React.createElement(SlashMenu, {
    x: slash.x,
    y: slash.y,
    onClose: () => setSlash(null),
    onPick: t => {
      insertAfter(slash.id, t);
      setSlash(null);
    }
  }), sel && !ctx && /*#__PURE__*/React.createElement(SelectionToolbar, {
    x: sel.x,
    y: sel.y,
    onColor: () => {
      setColorPop({
        x: sel.x,
        y: sel.y + 10
      });
    }
  }), colorPop && /*#__PURE__*/React.createElement(ColorMenu, {
    x: colorPop.x,
    y: colorPop.y,
    onClose: () => setColorPop(null),
    onPick: () => setColorPop(null)
  }), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 26,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 95,
      animation: 'sr-cardin var(--dur-base) var(--ease-flight) both'
    }
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    strong: true,
    radius: "pill",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '10px 18px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16,
    color: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'var(--text-1)'
    }
  }, toast))));
}
function RailHead({
  icon,
  title,
  extra
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 15,
    color: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      letterSpacing: '0.04em',
      color: 'var(--text-2)',
      fontWeight: 500,
      whiteSpace: 'nowrap'
    }
  }, title), extra != null && /*#__PURE__*/React.createElement(Badge, {
    tone: "blue"
  }, extra));
}
window.SRKit = Object.assign(window.SRKit || {}, {
  Editor
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/Editor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/EditorMenus.jsx
try { (() => {
/* EditorMenus — professional editor overlays: slash menu, selection toolbar,
   and the block right-click context menu with 转换为 / 颜色 / 移动到 submenus. */
const {
  GlassPanel: SRGlass,
  Icon: SRIcon,
  IconButton: SRIconBtn
} = window.StellarRaftDesignSystem_2866af;
const BLOCK_TYPES = [{
  type: 'p',
  icon: 'type',
  label: '文本',
  hint: ''
}, {
  type: 'h1',
  icon: 'heading-1',
  label: '标题 1',
  hint: '#'
}, {
  type: 'h2',
  icon: 'heading-2',
  label: '标题 2',
  hint: '##'
}, {
  type: 'h3',
  icon: 'heading-3',
  label: '标题 3',
  hint: '###'
}, {
  type: 'todo',
  icon: 'square-check-big',
  label: '待办列表',
  hint: '[]'
}, {
  type: 'bulleted',
  icon: 'list',
  label: '无序列表',
  hint: '-'
}, {
  type: 'numbered',
  icon: 'list-ordered',
  label: '有序列表',
  hint: '1.'
}, {
  type: 'toggle',
  icon: 'chevron-right',
  label: '折叠列表',
  hint: '>'
}, {
  type: 'quote',
  icon: 'quote',
  label: '引用',
  hint: '"'
}, {
  type: 'callout',
  icon: 'info',
  label: '标注',
  hint: ''
}, {
  type: 'code',
  icon: 'code',
  label: '代码块',
  hint: '```'
}, {
  type: 'math',
  icon: 'sigma',
  label: '数学公式',
  hint: '$$'
}, {
  type: 'table',
  icon: 'table',
  label: '表格',
  hint: ''
}, {
  type: 'divider',
  icon: 'minus',
  label: '分割线',
  hint: '---'
}, {
  type: 'image',
  icon: 'image',
  label: '图片',
  hint: ''
}];
const TEXT_COLORS = [{
  id: 'default',
  label: '默认',
  c: 'var(--text-1)'
}, {
  id: 'blue',
  label: '星辉蓝',
  c: 'var(--star-blue)'
}, {
  id: 'gold',
  label: '暖金',
  c: 'var(--gold)'
}, {
  id: 'dim',
  label: '暗淡',
  c: 'var(--star-blue-dim)'
}, {
  id: 'danger',
  label: '警示',
  c: 'var(--danger)'
}];
const BG_COLORS = [{
  id: 'none',
  label: '无背景',
  c: 'transparent',
  ring: 'var(--line-strong)'
}, {
  id: 'bgblue',
  label: '星蓝底',
  c: 'rgba(159,198,255,0.16)'
}, {
  id: 'bggold',
  label: '暖金底',
  c: 'rgba(255,217,138,0.16)'
}, {
  id: 'bgdeep',
  label: '深蓝底',
  c: 'rgba(26,35,80,0.55)'
}];

/* ---- generic floating panel that closes on outside click / Esc ---- */
function Floating({
  x,
  y,
  width = 240,
  onClose,
  children,
  anchor = 'left'
}) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({
    left: x,
    top: y
  });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = anchor === 'right' ? x - r.width : x;
    let top = y;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    if (left + r.width > vw - 8) left = vw - r.width - 8;
    if (left < 8) left = 8;
    if (top + r.height > vh - 8) top = Math.max(8, vh - r.height - 8);
    setPos({
      left,
      top
    });
  }, [x, y]);
  React.useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [onClose]);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'fixed',
      left: pos.left,
      top: pos.top,
      zIndex: 95,
      width
    }
  }, /*#__PURE__*/React.createElement(SRGlass, {
    strong: true,
    radius: "md",
    pad: "none",
    glow: true,
    style: {
      padding: 6
    }
  }, children));
}
function Row({
  icon,
  label,
  hint,
  chevron,
  danger,
  tone,
  active,
  onClick,
  onMouseEnter
}) {
  const [h, setH] = React.useState(false);
  const color = danger ? 'var(--danger)' : tone === 'gold' ? 'var(--gold)' : h || active ? 'var(--text-1)' : 'var(--text-2)';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: e => {
      setH(true);
      onMouseEnter && onMouseEnter(e);
    },
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '7px 9px',
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      background: h || active ? danger ? 'rgba(232,145,122,0.12)' : 'rgba(159,198,255,0.08)' : 'transparent',
      color
    }
  }, icon && /*#__PURE__*/React.createElement(SRIcon, {
    name: icon,
    size: 16,
    color: "currentColor"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 13,
      color: danger ? 'var(--danger)' : h || active ? 'var(--text-1)' : 'var(--text-2)'
    }
  }, label), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      color: 'var(--text-3)'
    }
  }, hint), chevron && /*#__PURE__*/React.createElement(SRIcon, {
    name: "chevron-right",
    size: 14,
    color: "var(--text-3)"
  }));
}
function Label({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 'var(--ls-hud)',
      textTransform: 'uppercase',
      color: 'var(--text-3)',
      padding: '6px 10px 4px',
      fontFamily: 'var(--font-mono)'
    }
  }, children);
}
function Divider() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line)',
      margin: '5px 6px'
    }
  });
}

/* ---- Slash command menu ---- */
function SlashMenu({
  x,
  y,
  onPick,
  onClose
}) {
  return /*#__PURE__*/React.createElement(Floating, {
    x: x,
    y: y,
    width: 252,
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 340,
      overflow: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "\u57FA\u7840\u5757"), BLOCK_TYPES.map((b, i) => /*#__PURE__*/React.createElement(Row, {
    key: b.type,
    icon: b.icon,
    label: b.label,
    hint: b.hint,
    active: i === 0,
    onClick: () => onPick(b.type)
  }))));
}

/* ---- Selection mini toolbar ---- */
function SelectionToolbar({
  x,
  y,
  onColor
}) {
  const tools = [{
    n: 'bold',
    t: '加粗 ⌘B'
  }, {
    n: 'italic',
    t: '斜体 ⌘I'
  }, {
    n: 'underline',
    t: '下划线 ⌘U'
  }, {
    n: 'strikethrough',
    t: '删除线'
  }, {
    n: 'code',
    t: '行内代码'
  }, {
    n: 'highlighter',
    t: '高亮',
    active: true
  }, {
    n: 'link',
    t: '链接 ⌘K'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: x,
      top: y,
      zIndex: 95,
      transform: 'translate(-50%,-100%)'
    }
  }, /*#__PURE__*/React.createElement(SRGlass, {
    strong: true,
    radius: "pill",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      padding: '5px 7px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onColor,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 8px',
      height: 30,
      cursor: 'pointer',
      color: 'var(--text-2)',
      fontSize: 12.5
    }
  }, "A", /*#__PURE__*/React.createElement(SRIcon, {
    name: "chevron-down",
    size: 13,
    color: "var(--text-3)"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: 'var(--line)'
    }
  }), tools.map(t => /*#__PURE__*/React.createElement(SRIconBtn, {
    key: t.n,
    name: t.n,
    size: "sm",
    title: t.t,
    active: t.active
  }))));
}

/* ---- Color submenu (text + background) ---- */
function ColorMenu({
  x,
  y,
  onClose,
  onPick
}) {
  return /*#__PURE__*/React.createElement(Floating, {
    x: x,
    y: y,
    width: 200,
    onClose: onClose
  }, /*#__PURE__*/React.createElement(Label, null, "\u6587\u5B57\u989C\u8272"), TEXT_COLORS.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    onClick: () => onPick({
      kind: 'text',
      ...c
    }),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 9px',
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 5,
      border: '1px solid var(--line-strong)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: c.c,
      fontSize: 12,
      fontWeight: 600
    }
  }, "A"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, c.label))), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(Label, null, "\u80CC\u666F"), BG_COLORS.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    onClick: () => onPick({
      kind: 'bg',
      ...c
    }),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 9px',
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 5,
      background: c.c,
      border: '1px solid ' + (c.ring || 'var(--line)')
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, c.label))));
}

/* ---- Block context menu (right-click / ⋮⋮ handle) ---- */
function ContextMenu({
  x,
  y,
  onClose,
  onAction,
  constellations
}) {
  const [sub, setSub] = React.useState(null); // 'turn' | 'color' | 'move'
  const [subPos, setSubPos] = React.useState({
    x: 0,
    y: 0
  });
  const openSub = (name, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSubPos({
      x: r.right + 4,
      y: r.top - 6
    });
    setSub(name);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Floating, {
    x: x,
    y: y,
    width: 238,
    onClose: onClose
  }, /*#__PURE__*/React.createElement(Row, {
    icon: "sparkles",
    label: "\u8BE2\u95EE AI",
    tone: "gold",
    onClick: () => onAction('ai'),
    onMouseEnter: () => setSub(null)
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(Row, {
    icon: "refresh-cw",
    label: "\u8F6C\u6362\u4E3A",
    chevron: true,
    onMouseEnter: e => openSub('turn', e)
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "copy",
    label: "\u590D\u5236\u4E3A\u526F\u672C",
    hint: "\u2318D",
    onClick: () => onAction('duplicate'),
    onMouseEnter: () => setSub(null)
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "link",
    label: "\u590D\u5236\u5757\u94FE\u63A5",
    onClick: () => onAction('copyLink'),
    onMouseEnter: () => setSub(null)
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "corner-up-right",
    label: "\u79FB\u52A8\u5230\u661F\u5EA7",
    chevron: true,
    onMouseEnter: e => openSub('move', e)
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(Row, {
    icon: "palette",
    label: "\u989C\u8272",
    chevron: true,
    onMouseEnter: e => openSub('color', e)
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "message-square-text",
    label: "\u8BC4\u8BBA",
    hint: "\u2318\u21E7M",
    onClick: () => onAction('comment'),
    onMouseEnter: () => setSub(null)
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "bookmark",
    label: "\u52A0\u5165\u590D\u4E60\u961F\u5217",
    onClick: () => onAction('review'),
    onMouseEnter: () => setSub(null)
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(Row, {
    icon: "trash-2",
    label: "\u5220\u9664",
    hint: "Del",
    danger: true,
    onClick: () => onAction('delete'),
    onMouseEnter: () => setSub(null)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '7px 11px 4px',
      borderTop: '1px solid var(--line)',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)'
    }
  }, "\u6797\u6DF1 \u7F16\u8F91\u4E8E 2 \u5C0F\u65F6\u524D"))), sub === 'turn' && /*#__PURE__*/React.createElement(Floating, {
    x: subPos.x,
    y: subPos.y,
    width: 208,
    onClose: () => setSub(null)
  }, /*#__PURE__*/React.createElement(Label, null, "\u8F6C\u6362\u4E3A"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 300,
      overflow: 'auto'
    }
  }, BLOCK_TYPES.filter(b => b.type !== 'divider' && b.type !== 'image').map(b => /*#__PURE__*/React.createElement(Row, {
    key: b.type,
    icon: b.icon,
    label: b.label,
    onClick: () => {
      onAction('turn', b.type);
      onClose();
    }
  })))), sub === 'move' && /*#__PURE__*/React.createElement(Floating, {
    x: subPos.x,
    y: subPos.y,
    width: 190,
    onClose: () => setSub(null)
  }, /*#__PURE__*/React.createElement(Label, null, "\u79FB\u52A8\u5230\u661F\u5EA7"), constellations.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    onClick: () => {
      onAction('move', c.id);
      onClose();
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '7px 9px',
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(159,198,255,0.08)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: c.color,
      boxShadow: `0 0 7px ${c.color}`
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-2)'
    }
  }, c.name)))), sub === 'color' && /*#__PURE__*/React.createElement(ColorMenu, {
    x: subPos.x,
    y: subPos.y,
    onClose: () => setSub(null),
    onPick: c => {
      onAction('color', c);
      onClose();
    }
  }));
}
window.SRKit = Object.assign(window.SRKit || {}, {
  SlashMenu,
  SelectionToolbar,
  ContextMenu,
  ColorMenu,
  BLOCK_TYPES,
  TEXT_COLORS,
  BG_COLORS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/EditorMenus.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/FeynmanDrawer.jsx
try { (() => {
/* FeynmanDrawer — right drawer for 费曼内化 mode + the ignite climax (screen 5).
   Explain the concept to the AI student, then 点亮这颗星 → glow burst + toast. */
const {
  GlassPanel,
  IconButton,
  Icon,
  Button,
  MemoryBar,
  Tag
} = window.StellarRaftDesignSystem_2866af;
function IgniteBurst() {
  // particle ring + flash, 1.3s
  const parts = Array.from({
    length: 18
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 80,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: 'var(--gold-white)',
      boxShadow: '0 0 60px 30px rgba(255,217,138,0.5)',
      animation: 'sr-flash var(--dur-ignite) var(--ease-flight) both'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: '2px solid var(--gold)',
      animation: 'sr-ring var(--dur-ignite) var(--ease-out) both'
    }
  }), parts.map((_, i) => {
    const a = i / parts.length * Math.PI * 2;
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        position: 'absolute',
        width: 3,
        height: 3,
        borderRadius: '50%',
        background: i % 3 ? 'var(--gold)' : 'var(--star-blue)',
        ['--dx']: `${Math.cos(a) * (120 + i % 4 * 30)}px`,
        ['--dy']: `${Math.sin(a) * (120 + i % 4 * 30)}px`,
        animation: `sr-particle var(--dur-ignite) var(--ease-out) both`,
        boxShadow: '0 0 6px var(--gold)'
      }
    });
  }));
}
function IgniteToast() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      top: 28,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 90,
      animation: 'sr-toast 2.6s var(--ease-flight) both'
    }
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    strong: true,
    radius: "pill",
    pad: "none",
    glow: true,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '11px 22px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 20,
    color: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: 'var(--text-1)'
    }
  }, "\u70B9\u4EAE +1 \xB7 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--gold)',
      fontWeight: 500
    }
  }, "\u878D\u4F1A\u8D2F\u901A"))));
}
function FeynmanDrawer({
  starId,
  onClose
}) {
  const D = window.SR_DATA;
  const star = D.byId[starId] || D.stars[0];
  const [strength, setStrength] = React.useState(star.strength);
  const [igniting, setIgniting] = React.useState(false);
  const [lit, setLit] = React.useState(false);
  const ignite = () => {
    setIgniting(true);
    setTimeout(() => setStrength(0.97), 250);
    setTimeout(() => {
      setLit(true);
    }, 200);
    setTimeout(() => setIgniting(false), 2600);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, igniting && /*#__PURE__*/React.createElement(IgniteBurst, null), igniting && /*#__PURE__*/React.createElement(IgniteToast, null), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 60,
      background: 'rgba(3,4,12,0.45)',
      backdropFilter: 'blur(2px)'
    },
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 392,
      zIndex: 62,
      boxShadow: 'var(--shadow-drawer)',
      animation: 'sr-drawerin var(--dur-base) var(--ease-flight) both',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg-strong)',
      WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
      backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
      borderLeft: '1px solid var(--glass-border-strong)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 20px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      letterSpacing: '0.06em',
      color: 'var(--text-3)',
      textTransform: 'uppercase',
      fontFamily: 'var(--font-mono)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "brain",
    size: 16,
    color: "var(--gold)"
  }), "\u8D39\u66FC\u5185\u5316"), /*#__PURE__*/React.createElement(IconButton, {
    name: "x",
    title: "\u5173\u95ED",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '0 20px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: 'var(--text-3)',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: D.conColor(star.con),
      boxShadow: `0 0 8px ${D.conColor(star.con)}`
    }
  }), D.conName(star.con)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 300,
      color: 'var(--text-1)',
      textShadow: lit ? 'var(--text-glow-warm)' : 'var(--text-glow-cool)',
      transition: 'text-shadow var(--dur-slow)'
    }
  }, star.label)), /*#__PURE__*/React.createElement(MemoryBar, {
    value: strength,
    label: "\u8BB0\u5FC6\u5F3A\u5EA6",
    showPct: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      lineHeight: 1.75,
      color: 'var(--text-2)'
    }
  }, "\u7528\u6700\u7B80\u5355\u7684\u8BDD\u5411 AI \u5B66\u751F\u8BB2\u6E05\u695A\u8FD9\u9897\u661F\u3002\u8BB2\u660E\u767D\u4E86\uFF0C\u5B83\u5C31\u88AB\u70B9\u4EAE\u3002"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Bubble, {
    who: "ai",
    name: "AI \u5B66\u751F"
  }, "\u4E3A\u4EC0\u4E48\u5B9A\u57DF\u9690\u53D8\u91CF\u7406\u8BBA\u4E0D\u80FD\u89E3\u91CA\u5B9E\u9A8C\u7ED3\u679C\uFF1F\u80FD\u7528\u4E00\u53E5\u8BDD\u8BF4\u6E05\u5417\uFF1F"), /*#__PURE__*/React.createElement(Bubble, {
    who: "me"
  }, "\u56E0\u4E3A\u8D1D\u5C14\u4E0D\u7B49\u5F0F\u7ED9\u51FA\u4E86\u4EFB\u4F55\u5B9A\u57DF\u7406\u8BBA\u7684\u7EDF\u8BA1\u4E0A\u9650\uFF0C\u800C\u5B9E\u9A8C\u6D4B\u5F97\u7684\u5173\u8054\u8D85\u8FC7\u4E86\u8FD9\u4E2A\u4E0A\u9650\u3002"), /*#__PURE__*/React.createElement(Bubble, {
    who: "ai",
    name: "AI \u5B66\u751F"
  }, "\u90A3\u300C\u8D85\u8FC7\u4E0A\u9650\u300D\u5177\u4F53\u610F\u5473\u7740\u4EC0\u4E48\uFF1F", lit ? ' 好——你已经讲透了。' : '')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    icon: "hash"
  }, "\u63A8\u5BFC"), /*#__PURE__*/React.createElement(Tag, {
    icon: "hash"
  }, "\u8003\u70B9"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 18,
      borderTop: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "zap",
    glow: !lit,
    disabled: lit,
    onClick: ignite,
    style: {
      width: '100%',
      height: 48,
      fontSize: 16
    }
  }, lit ? '已点亮 · 融会贯通' : '点亮这颗星'))));
}
function Bubble({
  who,
  name,
  children
}) {
  const ai = who === 'ai';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: ai ? 'flex-start' : 'flex-end',
      maxWidth: '88%'
    }
  }, name && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--text-3)',
      marginBottom: 4,
      marginLeft: 2
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.6,
      padding: '10px 13px',
      borderRadius: ai ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
      background: ai ? 'rgba(159,198,255,0.08)' : 'rgba(255,217,138,0.10)',
      border: '1px solid',
      borderColor: ai ? 'var(--glass-border)' : 'rgba(255,217,138,0.24)',
      color: ai ? 'var(--text-2)' : 'var(--text-1)'
    }
  }, children));
}
window.SRKit = Object.assign(window.SRKit || {}, {
  FeynmanDrawer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/FeynmanDrawer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/ListView.jsx
try { (() => {
/* ListView — 笔记管理界面 (俯瞰态·列表视图): flatten the universe into a
   scannable, filterable data table. Dimming rows read colder. */
const {
  GlassPanel,
  Icon,
  IconButton,
  Input,
  Tag,
  Badge,
  MemoryBar,
  Button
} = window.StellarRaftDesignSystem_2866af;
function strengthLabel(s) {
  if (s < 0.2) return {
    t: '将熄灭',
    c: 'var(--star-blue-deep)'
  };
  if (s < 0.4) return {
    t: '正变暗',
    c: 'var(--star-blue-dim)'
  };
  if (s < 0.7) return {
    t: '正常',
    c: 'var(--star-blue)'
  };
  return {
    t: '牢固',
    c: 'var(--gold)'
  };
}
function ListView({
  onOpen
}) {
  const D = window.SR_DATA;
  const [filter, setFilter] = React.useState('all');
  const [sel, setSel] = React.useState([]);
  const filters = [{
    id: 'all',
    label: '全部'
  }, {
    id: 'solid',
    label: '牢固'
  }, {
    id: 'normal',
    label: '正常'
  }, {
    id: 'fading',
    label: '正变暗'
  }, {
    id: 'dying',
    label: '将熄灭'
  }];
  const match = n => filter === 'all' || filter === 'solid' && n.strength >= 0.7 || filter === 'normal' && n.strength >= 0.4 && n.strength < 0.7 || filter === 'fading' && n.strength >= 0.2 && n.strength < 0.4 || filter === 'dying' && n.strength < 0.2;
  const rows = D.notes.filter(match);
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      overflow: 'auto',
      padding: '26px 30px 40px'
    }
  }, /*#__PURE__*/React.createElement("sr-starfield", {
    density: "0.5"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 2,
      maxWidth: 1040,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 23,
      fontWeight: 300,
      color: 'var(--text-1)'
    }
  }, "\u7B14\u8BB0\u7BA1\u7406"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-3)',
      marginTop: 2
    }
  }, "1,284 \u9897\u661F \xB7 47 \u9897\u6B63\u5728\u53D8\u6697")), /*#__PURE__*/React.createElement(GlassPanel, {
    radius: "pill",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '9px 20px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 12.5,
      color: 'var(--text-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "activity",
    size: 16,
    color: "var(--gold)"
  }), "\u77E5\u8BC6\u4F53\u68C0"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--gold)'
    }
  }, "\u5065\u5EB7\u5EA6 78%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 260
    }
  }, /*#__PURE__*/React.createElement(Input, {
    icon: "search",
    placeholder: "\u68C0\u7D22\u6807\u9898\u3001\u6807\u7B7E\u2026",
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, filters.map(f => /*#__PURE__*/React.createElement(Tag, {
    key: f.id,
    active: filter === f.id,
    onClick: () => setFilter(f.id)
  }, f.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12.5,
      color: 'var(--text-3)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-up-down",
    size: 15,
    color: "currentColor"
  }), "\u6700\u8FD1\u7F16\u8F91")), sel.length > 0 && /*#__PURE__*/React.createElement(GlassPanel, {
    radius: "md",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-1)'
    }
  }, "\u5DF2\u9009 ", sel.length, " \u9879"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    icon: "folder-input"
  }, "\u79FB\u52A8\u661F\u5EA7"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    icon: "hash"
  }, "\u52A0\u6807\u7B7E"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: "repeat"
  }, "\u52A0\u5165\u590D\u4E60")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '28px 1fr 130px 150px 92px 70px',
      gap: 14,
      padding: '0 16px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: 'var(--ls-hud)',
      textTransform: 'uppercase',
      color: 'var(--text-3)'
    }
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null, "\u6807\u9898"), /*#__PURE__*/React.createElement("span", null, "\u8BB0\u5FC6\u5F3A\u5EA6"), /*#__PURE__*/React.createElement("span", null, "\u6240\u5C5E\u661F\u5EA7"), /*#__PURE__*/React.createElement("span", null, "\u4E0B\u6B21\u590D\u4E60"), /*#__PURE__*/React.createElement("span", null, "\u8FDE\u63A5")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, rows.map(n => {
    const sl = strengthLabel(n.strength);
    const dim = n.strength < 0.4;
    const checked = sel.includes(n.id);
    return /*#__PURE__*/React.createElement("div", {
      key: n.id,
      onClick: () => onOpen(n.id),
      style: {
        display: 'grid',
        gridTemplateColumns: '28px 1fr 130px 150px 92px 70px',
        gap: 14,
        alignItems: 'center',
        padding: '13px 16px',
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        background: checked ? 'rgba(255,217,138,0.06)' : dim ? 'rgba(8,11,28,0.5)' : 'rgba(159,198,255,0.035)',
        border: '1px solid',
        borderColor: checked ? 'rgba(255,217,138,0.24)' : 'var(--glass-border)',
        opacity: dim ? 0.82 : 1,
        transition: 'background var(--dur-fast), border-color var(--dur-fast)'
      },
      onMouseEnter: e => {
        if (!checked) e.currentTarget.style.background = 'rgba(159,198,255,0.07)';
      },
      onMouseLeave: e => {
        if (!checked) e.currentTarget.style.background = dim ? 'rgba(8,11,28,0.5)' : 'rgba(159,198,255,0.035)';
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        toggle(n.id);
      },
      style: {
        width: 17,
        height: 17,
        borderRadius: 5,
        border: '1px solid',
        borderColor: checked ? 'var(--gold)' : 'var(--line-strong)',
        background: checked ? 'var(--gold)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, checked && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 12,
      color: "var(--text-on-gold)"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        color: dim ? 'var(--text-2)' : 'var(--text-1)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, n.title), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        marginTop: 4
      }
    }, n.tags.map(t => /*#__PURE__*/React.createElement("span", {
      key: t,
      style: {
        fontSize: 10.5,
        color: 'var(--text-3)'
      }
    }, "#", t)))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(MemoryBar, {
      value: n.strength,
      height: 5,
      fading: dim
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: sl.c,
        width: 38
      }
    }, sl.t)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12.5,
        color: 'var(--text-2)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: D.conColor(n.con),
        boxShadow: `0 0 6px ${D.conColor(n.con)}`
      }
    }), D.conName(n.con)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: n.nextReview === '已逾期' ? 'var(--danger)' : 'var(--text-3)'
      }
    }, n.nextReview), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--text-3)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "link",
      size: 13,
      color: "currentColor"
    }), n.links));
  }))));
}
window.SRKit = Object.assign(window.SRKit || {}, {
  ListView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/ListView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/Sidebar.jsx
try { (() => {
/* Sidebar — persistent deep-space glass nav. Collapsible 260 ⇄ 64. */
const {
  IconButton,
  Input,
  ConstellationItem,
  Badge,
  Icon
} = window.StellarRaftDesignSystem_2866af;
function SRLogo({
  collapsed,
  theme
}) {
  const dawn = theme === 'dawn';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 'none',
      display: 'inline-flex',
      filter: 'drop-shadow(0 0 7px rgba(255,217,138,0.35))'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "27",
    viewBox: "0 0 26 26",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "25",
    height: "25",
    rx: "7.5",
    fill: "#080c1c",
    stroke: "rgba(159,198,255,0.28)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.5 9 L16.5 7 L19 16.5 L11 18.5",
    stroke: "rgba(159,198,255,0.5)",
    strokeWidth: "0.8",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.5 9 L11 18.5",
    stroke: "rgba(255,217,138,0.55)",
    strokeWidth: "0.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7.5",
    cy: "9",
    r: "1.35",
    fill: "#d6e6ff"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "16.5",
    r: "1.15",
    fill: "#9fc6ff"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "18.5",
    r: "1.1",
    fill: "#9fc6ff"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16.5",
    cy: "7",
    r: "3.4",
    fill: "#ffd98a",
    opacity: "0.22"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16.5",
    cy: "7",
    r: "1.8",
    fill: "#ffe9b0"
  }))), !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1.1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: dawn ? {
      fontSize: 19,
      fontWeight: 400,
      letterSpacing: '0.06em',
      color: '#b3781a'
    } : {
      fontSize: 19,
      fontWeight: 300,
      letterSpacing: '0.06em',
      background: 'linear-gradient(176deg, #fff3da 0%, #ffffff 30%, #e9f0ff 62%, #b6cbf2 100%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      filter: 'drop-shadow(0 0 10px rgba(159,198,255,0.2))'
    }
  }, "\u661F\u56FE"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color: 'var(--text-3)'
    }
  }, "Stellar Raft")));
}
function NavRow({
  icon,
  label,
  active,
  badge,
  collapsed,
  onClick,
  dawn
}) {
  const [hover, setHover] = React.useState(false);
  const lit = active || hover;
  const idle = dawn ? 'rgba(22,30,56,0.82)' : 'rgba(159,198,255,0.72)';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      width: '100%',
      height: 40,
      padding: collapsed ? 0 : '0 11px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      borderRadius: 'var(--r-sm)',
      cursor: 'pointer',
      position: 'relative',
      border: '1px solid',
      borderColor: active ? 'var(--glass-border-strong)' : 'transparent',
      background: active ? 'rgba(159,198,255,0.08)' : hover ? 'rgba(159,198,255,0.05)' : 'transparent',
      color: active ? 'var(--gold)' : lit ? 'var(--text-1)' : idle,
      transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 19,
    color: "currentColor"
  }), !collapsed && /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      textAlign: 'left',
      fontSize: 13.5,
      color: lit && !active ? 'var(--text-1)' : 'inherit'
    }
  }, label), !collapsed && badge != null && /*#__PURE__*/React.createElement(Badge, {
    tone: active ? 'gold' : 'blue'
  }, badge), collapsed && badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 5,
      right: 9
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    dot: true,
    tone: "gold"
  })));
}
function Sidebar({
  collapsed,
  onToggle,
  view,
  onView,
  focus,
  onFocus,
  theme,
  onToggleTheme
}) {
  const D = window.SR_DATA;
  const dawn = theme === 'dawn';
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: collapsed ? 64 : 260,
      flex: 'none',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 5,
      background: 'var(--glass-bg-strong)',
      WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
      backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)',
      borderRight: '1px solid var(--glass-border)',
      transition: 'width var(--dur-base) var(--ease-flight)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 60,
      padding: collapsed ? '0' : '0 14px',
      flex: 'none',
      justifyContent: collapsed ? 'center' : 'space-between'
    }
  }, /*#__PURE__*/React.createElement(SRLogo, {
    collapsed: collapsed,
    theme: theme
  }), !collapsed && /*#__PURE__*/React.createElement(IconButton, {
    name: "panel-left-close",
    title: "\u6298\u53E0",
    onClick: onToggle
  })), collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    name: "panel-left-open",
    title: "\u5C55\u5F00",
    onClick: onToggle
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: collapsed ? '0 12px 8px' : '0 14px 10px',
      flex: 'none'
    }
  }, collapsed ? /*#__PURE__*/React.createElement(IconButton, {
    name: "search",
    title: "\u641C\u7D22"
  }) : /*#__PURE__*/React.createElement(Input, {
    icon: "search",
    placeholder: "\u641C\u7D22\u4F60\u7684\u661F\u7A7A\u2026",
    kbd: "\u2318K",
    size: "sm"
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      padding: collapsed ? '6px 8px' : '6px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement(NavRow, {
    icon: "orbit",
    label: "\u661F\u56FE\u89C6\u56FE",
    active: view === 'map',
    collapsed: collapsed,
    dawn: dawn,
    onClick: () => onView('map')
  }), /*#__PURE__*/React.createElement(NavRow, {
    icon: "list",
    label: "\u5217\u8868\u89C6\u56FE",
    active: view === 'list',
    collapsed: collapsed,
    dawn: dawn,
    onClick: () => onView('list')
  }), /*#__PURE__*/React.createElement(NavRow, {
    icon: "git-commit-horizontal",
    label: "\u65F6\u95F4\u8F74\u89C6\u56FE",
    active: view === 'timeline',
    collapsed: collapsed,
    dawn: dawn,
    onClick: () => onView('timeline')
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line)',
      margin: '8px 4px'
    }
  }), /*#__PURE__*/React.createElement(NavRow, {
    icon: "inbox",
    label: "\u6536\u4EF6\u7BB1",
    badge: 7,
    collapsed: collapsed,
    dawn: dawn,
    onClick: () => onView('inbox'),
    active: view === 'inbox'
  })), !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      padding: '10px 12px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 'var(--ls-hud)',
      textTransform: 'uppercase',
      color: 'var(--text-3)',
      padding: '0 6px 8px',
      fontFamily: 'var(--font-mono)'
    }
  }, "\u6211\u7684\u661F\u5EA7"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, D.constellations.map(c => /*#__PURE__*/React.createElement(ConstellationItem, {
    key: c.id,
    name: c.name,
    color: c.color,
    count: c.count,
    active: focus === c.id,
    onClick: () => onFocus(c.id)
  })))), collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      padding: collapsed ? '10px 8px' : '12px',
      borderTop: '1px solid var(--line)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(NavRow, {
    icon: dawn ? 'moon-star' : 'sunrise',
    label: dawn ? '切回深空' : '黎明模式',
    collapsed: collapsed,
    dawn: dawn,
    onClick: onToggleTheme
  }), /*#__PURE__*/React.createElement(NavRow, {
    icon: "activity",
    label: "\u77E5\u8BC6\u4F53\u68C0\u62A5\u544A",
    collapsed: collapsed,
    dawn: dawn,
    onClick: () => {}
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: collapsed ? 0 : '6px 8px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      flex: 'none',
      borderRadius: '50%',
      background: dawn ? 'linear-gradient(140deg, #8ea2cc, #b6c3dc)' : 'linear-gradient(140deg, #2a3566, #56689c)',
      border: '1px solid var(--glass-border-strong)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      color: dawn ? '#1a2238' : 'var(--text-1)'
    }
  }, "\u6797"), !collapsed && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      lineHeight: 1.2,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--text-1)'
    }
  }, "\u6797\u6DF1"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)'
    }
  }, "\u8FDE\u7EED\u70B9\u4EAE 14 \u5929")))));
}
window.SRKit = Object.assign(window.SRKit || {}, {
  Sidebar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/StarMap.jsx
try { (() => {
/* StarMap — infinite pannable/zoomable creation canvas.
   · Drag empty space to pan · wheel to zoom (toward cursor) · drag a star to move it
   · Right-click empty space → create a 星域 (constellation) or a knowledge star
   Stars, connections and domain halos live in a transformed world layer;
   HUD / tool capsule / cards stay screen-fixed. */
const {
  StarNode,
  GlassPanel,
  IconButton,
  Icon,
  Button,
  MemoryBar
} = window.StellarRaftDesignSystem_2866af;
const WORLD = {
  w: 1680,
  h: 1040
};
const NEW_COLORS = ['#ffd98a', '#9fc6ff', '#bcd0ff', '#7896cd'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function HudStat({
  label,
  value,
  tone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 64
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 9.5,
      letterSpacing: 'var(--ls-hud)',
      textTransform: 'uppercase',
      color: 'var(--text-3)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 18,
      color: tone || 'var(--text-1)'
    }
  }, value));
}
function CapBtn({
  icon,
  label,
  onClick
}) {
  const [h, setH] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setH(true),
    onMouseLeave: () => setH(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      height: 34,
      padding: '0 14px',
      borderRadius: 'var(--r-pill)',
      background: h ? 'rgba(159,198,255,0.08)' : 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: h ? 'var(--gold)' : 'var(--text-2)',
      transition: 'color var(--dur-fast), background var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18,
    color: "currentColor"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: h ? 'var(--text-1)' : 'var(--text-2)'
    }
  }, label));
}

/* connections drawn in world px (uses live star positions) */
function Connections({
  stars,
  dim
}) {
  const D = window.SR_DATA;
  const byId = React.useMemo(() => Object.fromEntries(stars.map(s => [s.id, s])), [stars]);
  return /*#__PURE__*/React.createElement("svg", {
    width: WORLD.w,
    height: WORLD.h,
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 1,
      pointerEvents: 'none',
      opacity: dim ? 0.22 : 1,
      transition: 'opacity var(--dur-base)'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("filter", {
    id: "cglow",
    x: "-20%",
    y: "-20%",
    width: "140%",
    height: "140%"
  }, /*#__PURE__*/React.createElement("feGaussianBlur", {
    stdDeviation: "2.4"
  }))), D.connections.map((c, i) => {
    const A = byId[c.a],
      B = byId[c.b];
    if (!A || !B) return null;
    const d = window.SRConnect(A.wx, A.wy, B.wx, B.wy, 0.16 + i % 3 * 0.04);
    const gold = c.kind === 'cross';
    const col = gold ? 'var(--gold)' : 'var(--star-blue)';
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: col,
      strokeWidth: gold ? 2.6 : 1.8,
      opacity: gold ? 0.5 : 0.32,
      filter: "url(#cglow)"
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: col,
      strokeWidth: gold ? 1.4 : 1,
      opacity: 0.8
    }), /*#__PURE__*/React.createElement("path", {
      d: d,
      fill: "none",
      stroke: gold ? '#fff4d6' : '#cfe0ff',
      strokeWidth: "1.5",
      strokeDasharray: "2 9",
      style: {
        animation: `sr-flow ${gold ? 2.2 : 3}s linear infinite`
      }
    }));
  }));
}

/* faint glowing domain halo + name behind each constellation cluster */
function DomainHalos({
  stars,
  cons,
  k
}) {
  const nameOpacity = clamp(1.4 - k, 0.25, 1); // semantic zoom: names louder when far
  return /*#__PURE__*/React.createElement(React.Fragment, null, cons.map(c => {
    const members = stars.filter(s => s.con === c.id);
    let cx, cy, r;
    if (members.length) {
      cx = members.reduce((a, s) => a + s.wx, 0) / members.length;
      cy = members.reduce((a, s) => a + s.wy, 0) / members.length;
      r = Math.max(150, ...members.map(s => Math.hypot(s.wx - cx, s.wy - cy))) + 96;
    } else {
      cx = c.wx;
      cy = c.wy;
      r = 150;
    }
    return /*#__PURE__*/React.createElement("div", {
      key: c.id
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: cx,
        top: cy,
        width: r * 2,
        height: r * 2,
        transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${c.color}1f 0%, ${c.color}0d 38%, transparent 68%)`,
        border: `1px solid ${c.color}1c`,
        pointerEvents: 'none'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: cx,
        top: cy - r + 22,
        transform: 'translate(-50%,-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
        opacity: nameOpacity,
        transition: 'opacity var(--dur-base)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: c.color,
        boxShadow: `0 0 8px ${c.color}`
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 300,
        letterSpacing: '0.08em',
        color: 'var(--text-1)',
        textShadow: '0 1px 8px rgba(0,0,0,0.8)',
        whiteSpace: 'nowrap'
      }
    }, c.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-3)'
      }
    }, members.length)));
  }));
}
function SummaryCard({
  star,
  onOpen,
  onFeynman,
  onClose,
  screen
}) {
  if (!star || !screen) return null;
  const D = window.SR_DATA;
  const flip = screen.x > window.innerWidth - 320;
  const left = flip ? screen.x - 280 : screen.x + 26;
  const top = clamp(screen.y - 40, 78, window.innerHeight - 300);
  return /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => e.stopPropagation(),
    style: {
      position: 'fixed',
      left,
      top,
      width: 260,
      zIndex: 28,
      animation: 'sr-cardin var(--dur-base) var(--ease-flight) both'
    }
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    strong: true,
    radius: "lg",
    pad: "md",
    glow: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: 'var(--text-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: D.conColor(star.con),
      boxShadow: `0 0 8px ${D.conColor(star.con)}`
    }
  }), D.conName(star.con)), /*#__PURE__*/React.createElement(IconButton, {
    name: "x",
    size: "sm",
    title: "\u5173\u95ED",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 300,
      color: 'var(--text-1)',
      marginBottom: 10,
      textShadow: 'var(--text-glow-cool)'
    }
  }, star.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.7,
      color: 'var(--text-2)',
      marginBottom: 14
    }
  }, "\u4EFB\u4F55\u5B9A\u57DF\u9690\u53D8\u91CF\u7406\u8BBA\u90FD\u65E0\u6CD5\u91CD\u73B0\u91CF\u5B50\u529B\u5B66\u7684\u5168\u90E8\u7EDF\u8BA1\u9884\u6D4B\u2014\u2014\u8FD9\u6B63\u662F\u7EA0\u7F20\u975E\u5B9A\u57DF\u6027\u7684\u5224\u636E\u3002"), /*#__PURE__*/React.createElement(MemoryBar, {
    value: star.strength,
    label: "\u8BB0\u5FC6\u5F3A\u5EA6",
    showPct: true,
    fading: star.strength < 0.4
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    icon: "zap",
    glow: true,
    onClick: onFeynman,
    style: {
      flex: 1
    }
  }, "\u8D39\u66FC\u5185\u5316"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: "maximize-2",
    onClick: onOpen,
    style: {
      flex: 1
    }
  }, "\u6253\u5F00\u7F16\u8F91"))));
}

/* small right-click create menu */
function CreateMenu({
  x,
  y,
  onClose,
  onDomain,
  onStar
}) {
  React.useEffect(() => {
    const h = () => onClose();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', h);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', h);
    };
  }, []);
  const Item = ({
    icon,
    label,
    hint,
    tone,
    onClick
  }) => {
    const [h, setH] = React.useState(false);
    return /*#__PURE__*/React.createElement("div", {
      onMouseDown: e => {
        e.stopPropagation();
        onClick();
      },
      onMouseEnter: () => setH(true),
      onMouseLeave: () => setH(false),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '8px 10px',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        background: h ? 'rgba(159,198,255,0.08)' : 'transparent'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: icon,
      size: 16,
      color: tone || (h ? 'var(--gold)' : 'var(--text-2)')
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 13,
        color: h ? 'var(--text-1)' : 'var(--text-2)'
      }
    }, label), hint && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-3)'
      }
    }, hint));
  };
  const left = Math.min(x, window.innerWidth - 220),
    top = Math.min(y, window.innerHeight - 160);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left,
      top,
      width: 208,
      zIndex: 60
    },
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    strong: true,
    radius: "md",
    pad: "none",
    glow: true,
    style: {
      padding: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 'var(--ls-hud)',
      textTransform: 'uppercase',
      color: 'var(--text-3)',
      padding: '6px 10px 4px',
      fontFamily: 'var(--font-mono)'
    }
  }, "\u5728\u6B64\u521B\u5EFA"), /*#__PURE__*/React.createElement(Item, {
    icon: "orbit",
    label: "\u65B0\u5EFA\u661F\u57DF",
    tone: "var(--gold)",
    onClick: onDomain
  }), /*#__PURE__*/React.createElement(Item, {
    icon: "plus",
    label: "\u65B0\u5EFA\u77E5\u8BC6\u661F",
    onClick: onStar
  })));
}
function StarMap({
  selected,
  onSelect,
  onOpenEditor,
  onFeynman,
  onAerial,
  igniteId
}) {
  const D = window.SR_DATA;
  const ref = React.useRef(null);
  const [view, setView] = React.useState({
    x: 0,
    y: 0,
    k: 0.82
  });
  const [stars, setStars] = React.useState(() => D.stars.map(s => ({
    ...s,
    wx: s.x / 100 * WORLD.w,
    wy: s.y / 100 * WORLD.h
  })));
  const [cons, setCons] = React.useState(() => D.constellations.map(c => ({
    ...c,
    wx: WORLD.w / 2,
    wy: WORLD.h / 2
  })));
  const [menu, setMenu] = React.useState(null); // {x,y,wx,wy}
  const [naming, setNaming] = React.useState(null); // {x,y,wx,wy}
  const [draftName, setDraftName] = React.useState('');
  const [selScreen, setSelScreen] = React.useState(null);
  const viewRef = React.useRef(view);
  viewRef.current = view;
  const drag = React.useRef(null);
  const inited = React.useRef(false);
  const toScreen = (wx, wy) => {
    const r = ref.current.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: r.left + v.x + wx * v.k,
      y: r.top + v.y + wy * v.k
    };
  };
  const toWorld = (cx, cy) => {
    const r = ref.current.getBoundingClientRect();
    const v = viewRef.current;
    return {
      wx: (cx - r.left - v.x) / v.k,
      wy: (cy - r.top - v.y) / v.k
    };
  };

  // center the world on first measure
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      if (inited.current) return;
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w) return;
      inited.current = true;
      setView({
        k: 0.82,
        x: (w - WORLD.w * 0.82) / 2,
        y: (h - WORLD.h * 0.82) / 2
      });
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, []);

  // keep summary card pinned to its star while panning/zooming
  React.useEffect(() => {
    if (!selected) {
      setSelScreen(null);
      return;
    }
    const s = stars.find(x => x.id === selected);
    if (s) setSelScreen(toScreen(s.wx, s.wy));
  }, [selected, view, stars]);

  // wheel zoom toward cursor
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left,
        py = e.clientY - r.top;
      setView(v => {
        const k = clamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89), 0.34, 2.6);
        return {
          k,
          x: px - (px - v.x) * (k / v.k),
          y: py - (py - v.y) * (k / v.k)
        };
      });
    };
    el.addEventListener('wheel', onWheel, {
      passive: false
    });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // global drag handlers (pan or move-star)
  React.useEffect(() => {
    const move = e => {
      const d = drag.current;
      if (!d) return;
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      if (d.mode === 'pan') setView(v => ({
        ...v,
        x: d.ox + (e.clientX - d.sx),
        y: d.oy + (e.clientY - d.sy)
      }));else if (d.mode === 'star') {
        const k = viewRef.current.k;
        setStars(ss => ss.map(s => s.id === d.id ? {
          ...s,
          wx: d.swx + (e.clientX - d.sx) / k,
          wy: d.swy + (e.clientY - d.sy) / k
        } : s));
      }
    };
    const up = e => {
      const d = drag.current;
      drag.current = null;
      if (d && d.mode === 'pan' && !d.moved && e.button === 0) onSelect(null);
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [onSelect]);
  const bgDown = e => {
    if (e.button !== 0) return;
    setMenu(null);
    setNaming(null);
    drag.current = {
      mode: 'pan',
      sx: e.clientX,
      sy: e.clientY,
      ox: view.x,
      oy: view.y,
      moved: false
    };
    document.body.style.cursor = 'grabbing';
  };
  const starDown = (e, s) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(s.id); // select immediately so the summary card always appears
    drag.current = {
      mode: 'star',
      id: s.id,
      sx: e.clientX,
      sy: e.clientY,
      swx: s.wx,
      swy: s.wy,
      moved: false
    };
  };
  const onContext = e => {
    e.preventDefault();
    const w = toWorld(e.clientX, e.clientY);
    setMenu({
      x: e.clientX,
      y: e.clientY,
      wx: w.wx,
      wy: w.wy
    });
    setNaming(null);
  };
  const startDomain = () => {
    setNaming({
      x: menu.x,
      y: menu.y,
      wx: menu.wx,
      wy: menu.wy
    });
    setDraftName('');
    setMenu(null);
  };
  const commitDomain = () => {
    const name = draftName.trim() || '新星域';
    const color = NEW_COLORS[cons.length % NEW_COLORS.length];
    setCons(cs => [...cs, {
      id: 'c' + Math.random().toString(36).slice(2, 6),
      name,
      color,
      wx: naming.wx,
      wy: naming.wy
    }]);
    setNaming(null);
  };
  const createStar = () => {
    // assign to nearest domain centroid
    let best = null,
      bd = 1e9;
    cons.forEach(c => {
      const mem = stars.filter(s => s.con === c.id);
      const cx = mem.length ? mem.reduce((a, s) => a + s.wx, 0) / mem.length : c.wx;
      const cy = mem.length ? mem.reduce((a, s) => a + s.wy, 0) / mem.length : c.wy;
      const dist = Math.hypot(menu.wx - cx, menu.wy - cy);
      if (dist < bd) {
        bd = dist;
        best = c.id;
      }
    });
    const id = 's' + Math.random().toString(36).slice(2, 6);
    setStars(ss => [...ss, {
      id,
      con: best,
      wx: menu.wx,
      wy: menu.wy,
      strength: 0.5,
      importance: 1,
      label: '新的知识星'
    }]);
    setMenu(null);
    onSelect(id);
  };
  const resetView = () => {
    const el = ref.current;
    const w = el.clientWidth,
      h = el.clientHeight;
    setView({
      k: 0.82,
      x: (w - WORLD.w * 0.82) / 2,
      y: (h - WORLD.h * 0.82) / 2
    });
    onSelect(null);
  };
  const sel = stars.find(s => s.id === selected);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    onMouseDown: bgDown,
    onContextMenu: onContext,
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      cursor: 'grab',
      userSelect: 'none'
    }
  }, /*#__PURE__*/React.createElement("sr-starfield", {
    density: "1"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      transformOrigin: '0 0',
      transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
      willChange: 'transform'
    }
  }, /*#__PURE__*/React.createElement(DomainHalos, {
    stars: stars,
    cons: cons,
    k: view.k
  }), /*#__PURE__*/React.createElement(Connections, {
    stars: stars,
    dim: !!sel
  }), stars.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    onMouseDown: e => starDown(e, s),
    onDoubleClick: () => onOpenEditor(s.id),
    style: {
      position: 'absolute',
      left: s.wx,
      top: s.wy,
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement(StarNode, {
    strength: s.id === igniteId ? 0.96 : s.strength,
    importance: s.importance,
    label: s.label,
    selected: selected === s.id,
    style: {
      left: 0,
      top: 0,
      cursor: 'grab',
      opacity: sel && selected !== s.id ? 0.45 : 1,
      transition: 'opacity var(--dur-base)'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 18,
      left: 22,
      right: 22,
      zIndex: 30,
      display: 'flex',
      alignItems: 'stretch',
      gap: 14,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    radius: "pill",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 18px',
      pointerEvents: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "orbit",
    size: 17,
    color: "var(--gold)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-1)'
    }
  }, "\u6211\u7684\u661F\u7A7A"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--text-3)'
    }
  }, "\u521B\u4F5C\u6001 \xB7 \u4E2D\u666F")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(GlassPanel, {
    radius: "pill",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 22,
      padding: '8px 22px',
      pointerEvents: 'auto'
    }
  }, /*#__PURE__*/React.createElement(HudStat, {
    label: "Knowledge Stars",
    value: stars.length
  }), /*#__PURE__*/React.createElement(HudStat, {
    label: "\u6B63\u53D1\u5149",
    value: stars.filter(s => s.strength >= 0.7).length,
    tone: "var(--gold)"
  }), /*#__PURE__*/React.createElement(HudStat, {
    label: "\u6B63\u53D8\u6697",
    value: stars.filter(s => s.strength < 0.4).length,
    tone: "var(--star-blue-dim)"
  }), /*#__PURE__*/React.createElement(HudStat, {
    label: "\u661F\u57DF",
    value: cons.length,
    tone: "var(--star-blue)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 26,
      left: 24,
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11.5,
      color: 'var(--text-3)',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "move",
    size: 14,
    color: "currentColor"
  }), "\u62D6\u52A8\u5E73\u79FB \xB7 \u6EDA\u8F6E\u7F29\u653E \xB7 \u53F3\u952E\u521B\u5EFA\u661F\u57DF"), /*#__PURE__*/React.createElement("div", {
    onMouseDown: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 26,
      right: 24,
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    radius: "pill",
    pad: "none",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '6px 8px'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    name: "minus",
    size: "sm",
    title: "\u7F29\u5C0F",
    onClick: () => setView(v => ({
      ...v,
      k: clamp(v.k * 0.85, 0.34, 2.6)
    }))
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text-2)',
      minWidth: 42,
      textAlign: 'center'
    }
  }, Math.round(view.k * 100), "%"), /*#__PURE__*/React.createElement(IconButton, {
    name: "plus",
    size: "sm",
    title: "\u653E\u5927",
    onClick: () => setView(v => ({
      ...v,
      k: clamp(v.k * 1.18, 0.34, 2.6)
    }))
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 18,
      background: 'var(--line)'
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "satellite",
    size: "sm",
    title: "\u4EAE\u5EA6\u9E1F\u77B0",
    onClick: onAerial
  }), /*#__PURE__*/React.createElement(IconButton, {
    name: "locate-fixed",
    size: "sm",
    title: "\u590D\u4F4D\u89C6\u56FE",
    onClick: resetView
  }))), /*#__PURE__*/React.createElement(SummaryCard, {
    star: sel,
    screen: selScreen,
    onOpen: () => onOpenEditor(sel.id),
    onFeynman: () => onFeynman(sel.id),
    onClose: () => onSelect(null)
  }), menu && /*#__PURE__*/React.createElement(CreateMenu, {
    x: menu.x,
    y: menu.y,
    onClose: () => setMenu(null),
    onDomain: startDomain,
    onStar: createStar
  }), naming && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: Math.min(naming.x, window.innerWidth - 240),
      top: Math.min(naming.y, window.innerHeight - 90),
      zIndex: 60,
      width: 220
    },
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(GlassPanel, {
    strong: true,
    radius: "md",
    pad: "sm",
    glow: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--text-3)',
      marginBottom: 7
    }
  }, "\u65B0\u661F\u57DF\u540D\u79F0"), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: draftName,
    onChange: e => setDraftName(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') commitDomain();
      if (e.key === 'Escape') setNaming(null);
    },
    placeholder: "\u4F8B\u5982\uFF1A\u6982\u7387\u8BBA",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: 'rgba(3,4,12,0.5)',
      border: '1px solid var(--glass-border-strong)',
      borderRadius: 'var(--r-sm)',
      color: 'var(--text-1)',
      fontSize: 14,
      padding: '8px 10px',
      outline: 'none',
      fontFamily: 'var(--font-sans)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    glow: true,
    onClick: commitDomain,
    style: {
      flex: 1
    }
  }, "\u521B\u5EFA"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setNaming(null)
  }, "\u53D6\u6D88")))));
}
window.SRKit = Object.assign(window.SRKit || {}, {
  StarMap
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/StarMap.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/app.jsx
try { (() => {
/* App — orchestrates the Stellar Raft kit as one interactive click-through.
   star map ⇄ list ⇄ editor, with Feynman drawer + ignite, all via the sidebar. */
const {
  Sidebar,
  StarMap,
  AerialView,
  FeynmanDrawer,
  ListView,
  Editor
} = window.SRKit;
function App() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [view, setView] = React.useState('map'); // map | list | editor | inbox | timeline
  const [selected, setSelected] = React.useState(null);
  const [focus, setFocus] = React.useState('qm');
  const [aerial, setAerial] = React.useState(false);
  const [feynman, setFeynman] = React.useState(null); // starId or null
  const [editing, setEditing] = React.useState(null); // starId or null
  const [theme, setTheme] = React.useState('night'); // night | dawn

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dawn' ? 'dawn' : '';
  }, [theme]);
  const openEditor = id => {
    setEditing(id);
    setView('editor');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    collapsed: collapsed,
    onToggle: () => setCollapsed(c => !c),
    view: view === 'editor' ? 'map' : view,
    onView: v => {
      setView(v);
      setAerial(false);
      setEditing(null);
    },
    focus: focus,
    onFocus: id => {
      setFocus(id);
      setView('map');
      setAerial(false);
    },
    theme: theme,
    onToggleTheme: () => setTheme(t => t === 'dawn' ? 'night' : 'dawn')
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      position: 'relative',
      display: 'flex'
    }
  }, view === 'map' && !aerial && /*#__PURE__*/React.createElement(StarMap, {
    selected: selected,
    onSelect: setSelected,
    onOpenEditor: openEditor,
    onFeynman: id => setFeynman(id),
    onAerial: () => setAerial(true),
    igniteId: null
  }), view === 'map' && aerial && /*#__PURE__*/React.createElement(AerialView, {
    onClose: () => setAerial(false)
  }), view === 'list' && /*#__PURE__*/React.createElement(ListView, {
    onOpen: openEditor
  }), view === 'editor' && /*#__PURE__*/React.createElement(Editor, {
    starId: editing,
    onBack: () => {
      setView('map');
      setEditing(null);
    }
  }), (view === 'inbox' || view === 'timeline') && /*#__PURE__*/React.createElement(Placeholder, {
    view: view
  }), feynman && /*#__PURE__*/React.createElement(FeynmanDrawer, {
    starId: feynman,
    onClose: () => setFeynman(null)
  })));
}
function Placeholder({
  view
}) {
  const map = {
    inbox: ['inbox', '收件箱', '随手捕捉的卡片暂存于此，待整理入星座。'],
    timeline: ['git-commit-horizontal', '时间轴视图', '按时间回溯你点亮过的每一颗星。']
  };
  const [icon, title, sub] = map[view];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("sr-starfield", {
    density: "0.7"
  }), /*#__PURE__*/React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: 34,
      height: 34,
      color: 'var(--star-blue)',
      opacity: 0.6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 300,
      color: 'var(--text-1)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'var(--text-3)'
    }
  }, sub));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
if (window.lucide) window.lucide.createIcons();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/codehl.js
try { (() => {
/* codehl.js — lightweight, language-aware syntax highlighter for the editor's
   code block. window.SR_HL = { DEFS, SAMPLES, GENERIC, LANGS, tokenize }.
   tokenize(code, lang) → array of lines, each an array of {t, c} tokens where
   c ∈ kw|fn|str|num|com|plain. Unknown language (no DEF) → everything plain. */
(function () {
  if (window.SR_HL) return;
  const DEFS = {};
  // def(aliases, keywords, lineComment, [blockOpen, blockClose])
  const def = (names, kw, line, block) => {
    const d = {
      kw: kw ? kw.trim().split(/\s+/) : [],
      line: line || null,
      block: block || null
    };
    names.split(' ').forEach(n => {
      DEFS[n] = d;
    });
  };
  const JS = 'function var let const return if else for while do switch case break continue new class extends super this typeof instanceof in of try catch finally throw async await yield import export default from null undefined true false void delete static get set';
  def('python py', 'def class return if elif else for while import from as with try except finally lambda yield pass break continue in is not and or None True False global nonlocal raise assert del async await match case', '#');
  def('javascript js jsx mjs', JS, '//', ['/*', '*/']);
  def('typescript ts tsx', JS + ' interface type enum implements public private protected readonly namespace declare as keyof infer never unknown any string number boolean abstract', '//', ['/*', '*/']);
  def('java', 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record sealed yield', '//', ['/*', '*/']);
  def('c h', 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while inline restrict _Bool NULL', '//', ['/*', '*/']);
  def('c++ cpp cc cxx hpp hxx', 'alignas alignof auto bool break case catch char class const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static static_cast struct switch template this throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while', '//', ['/*', '*/']);
  def('c# csharp cs', 'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while async await record nameof when', '//', ['/*', '*/']);
  def('go golang', 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota make len cap append', '//', ['/*', '*/']);
  def('rust rs', 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while box', '//', ['/*', '*/']);
  def('ruby rb', 'def class module return if elsif else unless while until for in do begin rescue ensure end yield self nil true false and or not then case when next break redo retry raise require require_relative attr_accessor attr_reader attr_writer puts lambda proc', '#');
  def('php', 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile extends final finally fn for foreach function global if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null', '//', ['/*', '*/']);
  def('swift', 'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch false is nil rethrows super self throw throws true try some any actor await async', '//', ['/*', '*/']);
  def('kotlin kt kts', 'abstract as break by catch class companion const continue crossinline data do dynamic else enum external false final finally for fun if import in infix init inline inner interface internal is lateinit lazy null object open operator out override package private protected public reified return sealed super suspend this throw true try typealias val var vararg when where while', '//', ['/*', '*/']);
  def('scala', 'abstract case catch class def do else extends false final finally for forSome if implicit import lazy match new null object override package private protected return sealed super this throw trait true try type val var while with yield given using', '//', ['/*', '*/']);
  def('dart', 'abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for get if implements import in interface is late library mixin new null on operator part required rethrow return set static super switch sync this throw true try typedef var void while with yield', '//', ['/*', '*/']);
  def('r', 'if else for while repeat function return break next in TRUE FALSE NULL NA Inf NaN library require function', '#');
  def('julia jl', 'function return if elseif else for while begin end do try catch finally module using import export struct mutable abstract type quote let global local const in isa where true false nothing missing', '#', ['#=', '=#']);
  def('haskell hs', 'module where import data type newtype class instance deriving do let in if then else case of forall infix infixl infixr', '--', ['{-', '-}']);
  def('elixir ex exs', 'def defp defmodule defmacro do end fn if else unless case cond when for with try rescue catch after raise import alias require use quote unquote true false nil', '#');
  def('erlang erl', 'after begin case catch cond end fun if let of receive try when andalso orelse div rem band bor bxor bnot', '%');
  def('clojure clj cljs edn', 'def defn defmacro let if when cond do fn loop recur ns require import true false nil defrecord defprotocol', ';');
  def('lisp scheme scm el', 'define lambda let let* letrec if cond case when unless begin set! quote quasiquote do defun defvar defmacro setq', ';');
  def('lua', 'and break do else elseif end false for function goto if in local nil not or repeat return then true until while', '--', ['--[[', ']]']);
  def('perl pl pm', 'sub my our local if elsif else unless while until for foreach do return last next use require package print say wantarray defined undef', '#');
  def('sql', 'select from where insert into values update set delete create table alter drop index view join inner left right outer full on group by order having distinct as and or not null is in between like exists limit offset union all primary key foreign references default count sum avg min max case when then else end asc desc with', '--', ['/*', '*/']);
  def('bash sh shell zsh', 'if then else elif fi for while do done case esac function in select until return local export readonly declare echo exit source alias unset set test trap shift', '#');
  def('powershell ps1 pwsh', 'function param if else elseif switch foreach for while do until return break continue try catch finally throw begin process end filter class enum in', '#', ['<#', '#>']);
  def('fish', 'if else end for while function return break continue switch case set echo', '#');
  def('latex tex', 'documentclass usepackage begin end section subsection subsubsection paragraph textbf textit emph item frac sum int prod label ref cite newcommand renewcommand includegraphics caption', '%');
  def('matlab octave', 'function end if elseif else for while switch case otherwise break continue return try catch global persistent true false parfor', '%', ['%{', '%}']);
  def('dockerfile', 'FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS', '#');
  def('makefile make mk', 'ifeq ifneq ifdef ifndef else endif define endef include export', '#');
  def('graphql gql', 'query mutation subscription type input enum interface union scalar schema fragment on implements extend directive true false null', '#');
  def('solidity sol', 'contract library interface function modifier event error struct enum mapping address uint uint256 int bytes bool string public private external internal pure view payable returns return if else for while do break continue new delete emit require revert assert try catch memory storage calldata constant immutable constructor using is import pragma true false', '//', ['/*', '*/']);
  def('objective-c objectivec objc m mm', 'interface implementation protocol property synthesize end if else for while do switch case break continue return void id self super nil YES NO BOOL NSString NSInteger int float double char new class static const instancetype atomic nonatomic strong weak copy assign retain', '//', ['/*', '*/']);
  def('fortran f f90 f95 f03', 'program end subroutine function module use implicit none integer real complex character logical if then else elseif endif do while enddo call return stop print write read allocate deallocate true false', '!');
  def('vim viml', 'function endfunction if else elseif endif for endfor while endwhile let call return set au autocmd nnoremap inoremap', '"');
  def('assembly asm nasm s', 'mov push pop call ret jmp je jne jg jl cmp add sub mul div inc dec and or xor not lea int section global extern db dw dd resb', ';');
  def('groovy', 'def class return if else for while switch case break continue try catch finally throw new import package as in true false null assert', '//', ['/*', '*/']);
  def('nim', 'proc func method iterator template macro var let const type object enum if elif else case of for while block break continue return discard import include export true false nil', '#', ['#[', ']#']);
  def('crystal cr', 'def class module struct return if elsif else unless while until for in do begin rescue ensure end yield self nil true false require puts case when', '#');
  def('zig', 'const var fn pub return if else while for switch break continue defer errdefer try catch struct enum union comptime inline export extern test true false null undefined', '//');
  def('css', '', null, ['/*', '*/']);
  def('scss less sass', '', '//', ['/*', '*/']);
  def('html xml svg vue svelte', '', null, ['<!--', '-->']);
  def('yaml yml', '', '#');
  def('toml', '', '#');
  def('ini cfg conf', '', ';');
  def('json json5 jsonc', '', null, ['/*', '*/']);
  def('markdown md mdx', '', null);
  // 'plaintext'/'text' intentionally NOT defined → renders plain.

  const idword = /[A-Za-z_$\u00C0-\uFFFF]/;
  const idword2 = /[A-Za-z0-9_$\u00C0-\uFFFF]/;
  function tokenize(code, lang) {
    const d = DEFS[(lang || '').toLowerCase()];
    const lines = String(code).split('\n');
    if (!d) return lines.map(l => [{
      t: l || ' ',
      c: 'plain'
    }]); // unknown → no highlight
    const kw = new Set(d.kw);
    const lc = d.line,
      bc = d.block;
    const out = [];
    let inBlock = false;
    for (const line of lines) {
      const toks = [];
      let i = 0;
      const n = line.length;
      const push = (t, c) => {
        if (t) toks.push({
          t,
          c
        });
      };
      while (i < n) {
        if (inBlock) {
          const end = bc ? line.indexOf(bc[1], i) : -1;
          if (end < 0) {
            push(line.slice(i), 'com');
            i = n;
          } else {
            push(line.slice(i, end + bc[1].length), 'com');
            i = end + bc[1].length;
            inBlock = false;
          }
          continue;
        }
        const ch = line[i];
        if (bc && line.startsWith(bc[0], i)) {
          const end = line.indexOf(bc[1], i + bc[0].length);
          if (end < 0) {
            push(line.slice(i), 'com');
            i = n;
            inBlock = true;
          } else {
            push(line.slice(i, end + bc[1].length), 'com');
            i = end + bc[1].length;
          }
          continue;
        }
        if (lc && line.startsWith(lc, i)) {
          push(line.slice(i), 'com');
          i = n;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
          let j = i + 1;
          while (j < n && line[j] !== ch) {
            if (line[j] === '\\') j++;
            j++;
          }
          push(line.slice(i, Math.min(j + 1, n)), 'str');
          i = Math.min(j + 1, n);
          continue;
        }
        if (ch >= '0' && ch <= '9') {
          let j = i;
          while (j < n && /[0-9a-fA-FxX._]/.test(line[j])) j++;
          push(line.slice(i, j), 'num');
          i = j;
          continue;
        }
        if (idword.test(ch)) {
          let j = i;
          while (j < n && idword2.test(line[j])) j++;
          const word = line.slice(i, j);
          let c = 'plain';
          if (kw.has(word)) c = 'kw';else {
            let k = j;
            while (k < n && line[k] === ' ') k++;
            if (line[k] === '(') c = 'fn';
          }
          push(word, c);
          i = j;
          continue;
        }
        push(ch, 'plain');
        i++;
      }
      out.push(toks.length ? toks : [{
        t: ' ',
        c: 'plain'
      }]);
    }
    return out;
  }
  const SAMPLES = {
    python: `# 计算 CHSH 关联值 S\ndef chsh_s(E):\n    a, ap, b, bp = E.angles()\n    return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp)\n\n# |S| <= 2 为定域极限；量子上界 2√2`,
    javascript: `// 计算 CHSH 关联值 S\nfunction chshS(E) {\n  const { a, ap, b, bp } = E.angles();\n  return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp);\n}\nconsole.log(chshS(exp) <= 2);`,
    typescript: `// CHSH 关联值（带类型）\ninterface Angles { a: number; b: number }\nfunction chshS(E: Correlator): number {\n  const { a, ap, b, bp } = E.angles();\n  return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp);\n}`,
    java: `// 计算 CHSH 关联值\npublic class Bell {\n    static double chshS(Correlator E) {\n        return E.v(0,0) - E.v(0,1) + E.v(1,0) + E.v(1,1);\n    }\n}`,
    'c++': `// 计算 CHSH 关联值\n#include <cmath>\ndouble chsh_s(const Correlator& E) {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1);  // |S| <= 2\n}`,
    c: `/* 计算 CHSH 关联值 */\ndouble chsh_s(Correlator *E) {\n    return E->v[0] - E->v[1] + E->v[2] + E->v[3];\n}`,
    'c#': `// 计算 CHSH 关联值\npublic static double ChshS(Correlator E) {\n    return E[0,0] - E[0,1] + E[1,0] + E[1,1];\n}`,
    go: `// 计算 CHSH 关联值\nfunc chshS(E Correlator) float64 {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1)\n}`,
    rust: `// 计算 CHSH 关联值\nfn chsh_s(e: &Correlator) -> f64 {\n    let (a, ap, b, bp) = e.angles();\n    e(a,b) - e(a,bp) + e(ap,b) + e(ap,bp)\n}`,
    ruby: `# 计算 CHSH 关联值\ndef chsh_s(e)\n  a, ap, b, bp = e.angles\n  e[a,b] - e[a,bp] + e[ap,b] + e[ap,bp]\nend`,
    php: `<?php\n// 计算 CHSH 关联值\nfunction chsh_s($E) {\n    return $E(0,0) - $E(0,1) + $E(1,0) + $E(1,1);\n}`,
    swift: `// 计算 CHSH 关联值\nfunc chshS(_ E: Correlator) -> Double {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1)\n}`,
    kotlin: `// 计算 CHSH 关联值\nfun chshS(E: Correlator): Double {\n    return E(0,0) - E(0,1) + E(1,0) + E(1,1)\n}`,
    sql: `-- 查询变暗的知识星\nSELECT title, strength FROM stars\nWHERE strength < 0.4\nORDER BY strength ASC\nLIMIT 10;`,
    bash: `#!/bin/bash\n# 备份星图数据\nfor f in stars/*.json; do\n  cp "$f" "backup/$(basename $f)"\ndone\necho "完成"`,
    html: `<!-- 一颗知识星 -->\n<div class="star" data-strength="0.95">\n  <span class="label">贝尔不等式</span>\n</div>`,
    css: `/* 发光的知识星 */\n.star {\n  border-radius: 50%;\n  box-shadow: 0 0 24px rgba(255,217,138,0.6);\n}`,
    json: `{\n  "star": "贝尔不等式",\n  "strength": 0.95,\n  "links": ["纠缠态", "叠加原理"]\n}`,
    latex: `% CHSH 不等式\n\\begin{equation}\n  S = E(a,b) - E(a,b') + E(a',b) + E(a',b')\n\\end{equation}`,
    haskell: `-- 计算 CHSH 关联值\nchshS :: Correlator -> Double\nchshS e = e a b - e a bp + e ap b + e ap bp\n  where (a, ap, b, bp) = angles e`,
    lua: `-- 计算 CHSH 关联值\nlocal function chsh_s(E)\n  local a, ap, b, bp = E:angles()\n  return E(a,b) - E(a,bp) + E(ap,b) + E(ap,bp)\nend`
  };
  const GENERIC = `greeting = "Hello, 星图"\nitems = [1, 2, 3, 5, 8, 13]\ntotal = sum(items)\nprint(greeting, total)`;

  // ordered display list for the dropdown
  const LANGS = ['python', 'javascript', 'typescript', 'java', 'c', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'dart', 'r', 'julia', 'haskell', 'elixir', 'erlang', 'clojure', 'lisp', 'lua', 'perl', 'groovy', 'nim', 'crystal', 'zig', 'objective-c', 'fortran', 'matlab', 'sql', 'bash', 'powershell', 'fish', 'graphql', 'solidity', 'dockerfile', 'makefile', 'assembly', 'vim', 'html', 'css', 'scss', 'xml', 'yaml', 'toml', 'ini', 'json', 'markdown', 'latex', 'plaintext', 'text', 'txt', 'log', 'diff', 'csv', 'env'];
  window.SR_HL = {
    DEFS,
    SAMPLES,
    GENERIC,
    LANGS,
    tokenize
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/codehl.js", error: String((e && e.message) || e) }); }

// ui_kits/stellar-raft/data.js
try { (() => {
/* ===== Stellar Raft UI kit — mock data (plain global, no imports) ===== */
window.SR_DATA = function () {
  const constellations = [{
    id: 'qm',
    name: '量子力学',
    color: '#ffd98a',
    health: 0.9,
    count: 48
  }, {
    id: 'la',
    name: '线性代数',
    color: '#9fc6ff',
    health: 0.66,
    count: 31
  }, {
    id: 'ds',
    name: '数据结构',
    color: '#7896cd',
    health: 0.34,
    count: 12
  }, {
    id: 'th',
    name: '热力学',
    color: '#bcd0ff',
    health: 0.55,
    count: 19
  }];

  // Stars laid out across the canvas in four loose clusters (% coords).
  const stars = [
  // 量子力学 cluster (upper-left, bright/gold)
  {
    id: 's1',
    con: 'qm',
    x: 26,
    y: 32,
    strength: 0.95,
    importance: 1.5,
    label: '贝尔不等式'
  }, {
    id: 's2',
    con: 'qm',
    x: 17,
    y: 48,
    strength: 0.78,
    importance: 1.0,
    label: '纠缠态'
  }, {
    id: 's3',
    con: 'qm',
    x: 33,
    y: 52,
    strength: 0.6,
    importance: 0.95,
    label: '叠加原理'
  }, {
    id: 's4',
    con: 'qm',
    x: 24,
    y: 19,
    strength: 0.42,
    importance: 0.8,
    label: '波函数'
  },
  // 线性代数 cluster (upper-right, blue)
  {
    id: 's5',
    con: 'la',
    x: 70,
    y: 27,
    strength: 0.82,
    importance: 1.3,
    label: '特征值'
  }, {
    id: 's6',
    con: 'la',
    x: 80,
    y: 40,
    strength: 0.55,
    importance: 0.95,
    label: '奇异值分解'
  }, {
    id: 's7',
    con: 'la',
    x: 63,
    y: 42,
    strength: 0.5,
    importance: 0.85,
    label: '正交基'
  },
  // 数据结构 cluster (lower-left, dimming)
  {
    id: 's8',
    con: 'ds',
    x: 30,
    y: 76,
    strength: 0.3,
    importance: 1.0,
    label: '红黑树'
  }, {
    id: 's9',
    con: 'ds',
    x: 19,
    y: 70,
    strength: 0.16,
    importance: 0.75,
    label: '并查集'
  }, {
    id: 's10',
    con: 'ds',
    x: 40,
    y: 84,
    strength: 0.24,
    importance: 0.8,
    label: '跳表'
  },
  // 热力学 cluster (lower-right)
  {
    id: 's11',
    con: 'th',
    x: 72,
    y: 72,
    strength: 0.62,
    importance: 1.1,
    label: '熵增原理'
  }, {
    id: 's12',
    con: 'th',
    x: 83,
    y: 64,
    strength: 0.48,
    importance: 0.85,
    label: '卡诺循环'
  }];

  // Connections: intra (blue) and cross-constellation 融会贯通 (gold).
  const connections = [{
    a: 's1',
    b: 's2',
    kind: 'intra'
  }, {
    a: 's1',
    b: 's3',
    kind: 'intra'
  }, {
    a: 's2',
    b: 's4',
    kind: 'intra'
  }, {
    a: 's5',
    b: 's6',
    kind: 'intra'
  }, {
    a: 's5',
    b: 's7',
    kind: 'intra'
  }, {
    a: 's8',
    b: 's9',
    kind: 'intra'
  }, {
    a: 's8',
    b: 's10',
    kind: 'intra'
  }, {
    a: 's11',
    b: 's12',
    kind: 'intra'
  }, {
    a: 's1',
    b: 's5',
    kind: 'cross'
  },
  // 量子 ↔ 线代 融会贯通
  {
    a: 's5',
    b: 's11',
    kind: 'cross'
  } // 线代 ↔ 热力学
  ];
  const byId = Object.fromEntries(stars.map(s => [s.id, s]));

  // Note list for the management / list view.
  const notes = stars.map((s, i) => ({
    id: s.id,
    title: s.label,
    con: s.con,
    strength: s.strength,
    tags: [['推导', '公式'], ['概念'], ['考点', '复习'], ['实验']][i % 4],
    edited: ['2 小时前', '昨天', '3 天前', '上周', '2 周前'][i % 5],
    nextReview: s.strength < 0.35 ? '已逾期' : s.strength < 0.6 ? '明天' : '6 天后',
    links: 2 + i % 4
  }));
  return {
    constellations,
    stars,
    connections,
    byId,
    notes,
    conName: id => (constellations.find(c => c.id === id) || {}).name,
    conColor: id => (constellations.find(c => c.id === id) || {}).color
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/stellar-raft/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.GlassPanel = __ds_scope.GlassPanel;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.ConstellationItem = __ds_scope.ConstellationItem;

__ds_ns.MemoryBar = __ds_scope.MemoryBar;

__ds_ns.StarNode = __ds_scope.StarNode;

})();
