/* ===== 星图 Stellar Raft — Starfield helper =====
   A self-registering web component <sr-starfield> that paints a deep-space
   background the way a long-exposure photograph reads:
     · three parallax depth layers of stars, drifting almost imperceptibly
     · star colors follow stellar temperature classes (blue-white → orange)
     · a few bright stars carry a halo + 4-point diffraction spikes
     · a faint diagonal Milky-Way band of unresolved star dust and nebula haze
     · a rare meteor streak (never in prefers-reduced-motion)
   Lightweight: the nebula band is pre-rendered once per resize; per frame we
   blit it and repaint the twinkling stars only.

   Usage:  <sr-starfield density="1"></sr-starfield>   (position the host)
   Attributes:
     density  multiplier on star count (default 1)
     warm     0..1 bias toward warm-class stars (default 0.12)
     nebula   0 to disable the Milky-Way band (default 1)
     meteors  0 to disable meteor streaks (default 1)
*/
(function () {
  if (customElements.get('sr-starfield')) return;

  /* Stellar temperature classes, weighted roughly like the naked-eye sky. */
  const SPECTRA = [
    { w: 0.16, c: [170, 196, 255] },  // B — blue-white
    { w: 0.24, c: [204, 218, 255] },  // A — pale blue
    { w: 0.22, c: [236, 240, 255] },  // F — white
    { w: 0.20, c: [255, 243, 216] },  // G — yellow-white
    { w: 0.12, c: [255, 224, 182] },  // K — pale orange
    { w: 0.06, c: [255, 202, 160] },  // M — orange-red
  ];
  function pickSpectrum(warmBias) {
    // warmBias shifts probability mass toward the warm end of the sequence
    let r = Math.random();
    if (Math.random() < warmBias) r = 0.6 + Math.random() * 0.4;
    let acc = 0;
    for (const sp of SPECTRA) { acc += sp.w; if (r <= acc) return sp.c; }
    return SPECTRA[SPECTRA.length - 1].c;
  }
  const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1; // ~N(0,·) in [-1,1]

  class Starfield extends HTMLElement {
    connectedCallback() {
      /* 纯装饰背景：对读屏隐藏，否则有的会念出「空白画布/图像」 */
      this.setAttribute('aria-hidden', 'true');
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      Object.assign(this.style, { position: this.style.position || 'absolute', inset: '0', display: 'block', pointerEvents: 'none' });
      Object.assign(this.canvas.style, { width: '100%', height: '100%', display: 'block' });
      this.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      /* 页面开着时切系统设置也要跟：只在挂载时读一次的话，开着页去开「减少动态
         效果」的人得不到任何变化。reduced 为真时 rAF 循环里 dt=0（画面静止），
         恢复时无需重建，下一帧自然继续。 */
      this._mq = matchMedia('(prefers-reduced-motion: reduce)');
      this._mqChange = (e) => { this.reduced = e.matches; };
      if (this._mq.addEventListener) this._mq.addEventListener('change', this._mqChange);
      this._resize = this.resize.bind(this);
      window.addEventListener('resize', this._resize);
      this.meteor = null;
      this.resize();
      this.t = 0;
      this.loop();
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._resize);
      if (this._mq && this._mq.removeEventListener) this._mq.removeEventListener('change', this._mqChange);
      cancelAnimationFrame(this._raf);
    }
    resize() {
      const r = this.getBoundingClientRect();
      // 画布必须与设备像素严格 1:1——任何 DPR 钳制都会引入非整数重采样，
      // 在高缩放显示器上表现为贯穿画面的摩尔纹亮线
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.dpr = dpr;
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.build();
    }
    build() {
      const density = parseFloat(this.getAttribute('density') || '1');
      const warm = parseFloat(this.getAttribute('warm') || '0.12');
      const w = this.w, h = this.h;

      // Milky-Way band geometry: a diagonal through the canvas.
      const ang = -0.42;                       // radians, gentle tilt
      this.bandAng = ang;
      const bandHalf = Math.max(90, Math.min(w, h) * 0.22);
      const cx = w * 0.56, cy = h * 0.42;
      const distToBand = (x, y) => Math.abs(-Math.sin(ang) * (x - cx) + Math.cos(ang) * (y - cy));

      // Three depth layers. Far stars are tiny and dense; near stars are few,
      // larger, brighter, and twinkle harder. Star density rises inside the band.
      const n = Math.round((w * h) / 4300 * density);
      this.stars = Array.from({ length: n }, () => {
        // rejection-sample positions so ~40% of stars fall along the band
        let x = Math.random() * w, y = Math.random() * h;
        if (Math.random() < 0.4) {
          const along = Math.random() * Math.hypot(w, h) - Math.hypot(w, h) / 2;
          const off = gauss() * bandHalf;
          x = cx + Math.cos(ang) * along - Math.sin(ang) * off;
          y = cy + Math.sin(ang) * along + Math.cos(ang) * off;
          x = (x % w + w) % w; y = (y % h + h) % h;
        }
        const depth = Math.random();                       // 0 far … 1 near
        const bright = Math.random() < 0.022 && depth > 0.5;
        const col = pickSpectrum(warm);
        return {
          x, y, depth, col, bright,
          colDawn: col.map(v => Math.round(v * 0.34 + 14)),
          r: bright ? 1.5 + Math.random() * 1.0 : (0.22 + depth * 0.95) * (0.7 + Math.random() * 0.75),
          base: (0.12 + depth * 0.3) + Math.random() * 0.22 + (bright ? 0.3 : 0),
          amp: 0.08 + Math.random() * (0.18 + depth * 0.3),
          sp: 0.2 + Math.random() * (bright ? 1.4 : 0.9),
          ph: Math.random() * Math.PI * 2,
          drift: (0.06 + depth * 0.5) * (Math.random() < 0.5 ? 1 : -1) * 0.14, // px/s, parallax
          inBand: distToBand(x, y) < bandHalf,
        };
      });

      // Pre-render the nebula haze + unresolved star dust once.
      // 必须按设备像素 1:1 生成：任何非整数比例的重采样都会让星尘点阵
      // 产生摩尔纹（Windows 125%/150% 缩放下表现为竖向亮线）。
      this.nebula = null;
      if ((this.getAttribute('nebula') || '1') !== '0') {
        const nd = this.dpr || 1;
        const nc = document.createElement('canvas');
        nc.width = Math.max(1, Math.round(w * nd)); nc.height = Math.max(1, Math.round(h * nd));
        const g = nc.getContext('2d');
        g.scale(nd, nd);
        const diag = Math.hypot(w, h);
        // layered haze blobs along the band — cool blue-violet with a breath of warm
        for (let i = 0; i < 30; i++) {
          const along = (i / 30 - 0.5) * diag * 1.15 + gauss() * 60;
          const off = gauss() * bandHalf * 0.75;
          const bx = cx + Math.cos(ang) * along - Math.sin(ang) * off;
          const by = cy + Math.sin(ang) * along + Math.cos(ang) * off;
          const R = bandHalf * (0.7 + Math.random() * 0.9);
          const warmCore = Math.random() < 0.18;
          const rg = g.createRadialGradient(bx, by, 0, bx, by, R);
          if (warmCore) {
            rg.addColorStop(0, 'rgba(120,96,80,0.055)');
            rg.addColorStop(0.5, 'rgba(70,62,96,0.035)');
          } else {
            const violet = Math.random() < 0.4;
            rg.addColorStop(0, violet ? 'rgba(66,60,110,0.06)' : 'rgba(44,64,116,0.062)');
            rg.addColorStop(0.55, 'rgba(30,40,80,0.032)');
          }
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rg;
          g.fillRect(bx - R, by - R, R * 2, R * 2);
        }
        // dark dust lane cutting the band — real galaxies are ragged, not smooth
        for (let i = 0; i < 14; i++) {
          const along = (i / 14 - 0.5) * diag + gauss() * 80;
          const off = gauss() * bandHalf * 0.25;
          const bx = cx + Math.cos(ang) * along - Math.sin(ang) * off;
          const by = cy + Math.sin(ang) * along + Math.cos(ang) * off;
          const R = bandHalf * (0.3 + Math.random() * 0.35);
          const rg = g.createRadialGradient(bx, by, 0, bx, by, R);
          rg.addColorStop(0, 'rgba(3,4,10,0.10)');
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = rg;
          g.fillRect(bx - R, by - R, R * 2, R * 2);
        }
        // unresolved star dust — thousands of sub-pixel points make the band glitter
        const dust = Math.round(n * 2.2);
        for (let i = 0; i < dust; i++) {
          const along = Math.random() * diag - diag / 2;
          const off = gauss() * bandHalf * 0.8;
          const bx = cx + Math.cos(ang) * along - Math.sin(ang) * off;
          const by = cy + Math.sin(ang) * along + Math.cos(ang) * off;
          const c = pickSpectrum(0.1);
          g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.05 + Math.random() * 0.16})`;
          g.fillRect(bx, by, 0.9, 0.9);
        }
        this.nebula = nc;
      }
    }
    spawnMeteor() {
      // enters near the top, drifts down-and-across — slow enough to admire
      const fromLeft = Math.random() < 0.5;
      const speed = 240 + Math.random() * 140;
      const a = (fromLeft ? 0.3 : Math.PI - 0.3) + gauss() * 0.1;
      this.meteor = {
        x: this.w * (fromLeft ? 0.05 + Math.random() * 0.4 : 0.55 + Math.random() * 0.4),
        y: this.h * (0.04 + Math.random() * 0.3),
        vx: Math.cos(a) * speed, vy: Math.abs(Math.sin(a)) * speed * 0.4,
        life: 0, ttl: 1.3 + Math.random() * 0.5,
      };
    }
    loop() {
      this._raf = requestAnimationFrame(() => this.loop());
      const dt = this.reduced ? 0 : 1 / 60;
      this.t += dt;
      const c = this.ctx, w = this.w, h = this.h;
      const dawn = document.documentElement.dataset.theme === 'dawn';
      c.clearRect(0, 0, w, h);

      // Milky-Way haze (skipped on the dawn theme — haze reads as dirt on light)
      if (this.nebula && !dawn) c.drawImage(this.nebula, 0, 0, w, h);

      for (const s of this.stars) {
        const tw = this.reduced ? s.base + s.amp * 0.5 : s.base + s.amp * (0.5 + 0.5 * Math.sin(this.t * s.sp + s.ph));
        const x = ((s.x + this.t * s.drift) % w + w) % w;
        const col = dawn ? s.colDawn : s.col;
        const a = dawn ? tw * 0.6 : tw;
        c.beginPath();
        c.arc(x, s.y, s.r, 0, Math.PI * 2);
        c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
        c.fill();
        // bright stars: soft halo + 4-point diffraction spikes (night only)
        if (s.bright && !dawn) {
          const R = s.r * 7;
          const rg = c.createRadialGradient(x, s.y, 0, x, s.y, R);
          rg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.32})`);
          rg.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = rg;
          c.fillRect(x - R, s.y - R, R * 2, R * 2);
          const L = s.r * (5.5 + Math.sin(this.t * s.sp + s.ph) * 1.2);
          c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a * 0.5})`;
          c.lineWidth = 0.8;
          c.beginPath();
          c.moveTo(x - L, s.y); c.lineTo(x + L, s.y);
          c.moveTo(x, s.y - L); c.lineTo(x, s.y + L);
          c.stroke();
        }
      }

      // meteor
      if (!this.reduced && !dawn && (this.getAttribute('meteors') || '1') !== '0') {
        if (!this.meteor && Math.random() < dt / 22) this.spawnMeteor(); // ~1 per 22 s
        const m = this.meteor;
        if (m) {
          m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt;
          const k = 1 - m.life / m.ttl;
          if (k <= 0 || m.x < -60 || m.x > w + 60 || m.y > h + 60) this.meteor = null;
          else {
            const tail = 90 * k + 26;
            const nx = m.vx / Math.hypot(m.vx, m.vy), ny = m.vy / Math.hypot(m.vx, m.vy);
            const lg = c.createLinearGradient(m.x, m.y, m.x - nx * tail, m.y - ny * tail);
            lg.addColorStop(0, `rgba(235,242,255,${0.85 * k})`);
            lg.addColorStop(0.3, `rgba(180,206,255,${0.4 * k})`);
            lg.addColorStop(1, 'rgba(0,0,0,0)');
            c.strokeStyle = lg; c.lineWidth = 1.4; c.lineCap = 'round';
            c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x - nx * tail, m.y - ny * tail); c.stroke();
          }
        }
      }
    }
  }
  customElements.define('sr-starfield', Starfield);

  /* Organic connection path generator (mycelium curve between two points).
     Returns an SVG path 'd' string with a gentle perpendicular bow. */
  window.SRConnect = function (x1, y1, x2, y2, bow) {
    bow = bow == null ? 0.18 : bow;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const nx = -dy, ny = dx;
    const len = Math.hypot(dx, dy) || 1;
    const off = len * bow;
    const cx = mx + (nx / len) * off, cy = my + (ny / len) * off;
    return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
  };
})();
