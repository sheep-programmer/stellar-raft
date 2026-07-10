/* Galaxy3D — 真三维星系视图（Three.js / WebGL）。
   把整张知识图谱读成一座旋转的星系：每个星座是一颗暖橙色的发光恒星(主星，
   带点光源照亮四周与一层辉光壳)，星座下的每颗知识星是绕它公转的行星——不同的
   轨道半径、公转速度、轨道倾角，行星按「记忆温度色阶」着色(冷蓝=正变暗，暖金=已掌握)
   并缓慢自转。恒星的三维位置沿用星图创作态的真实编排（成员星质心），因此
   「俯瞰」机位(theta=0 正上方)看到的布局与自己的 2D 星图完全一致。
   场景包含：软圆斑贴图的双层背景星点、双旋臂星尘盘、跨星域「融会贯通」的
   金色光弧与沿弧飞行的光点、始终面向相机的星域名牌(飞近时淡出)。
   相机为透视相机，自实现轨道控制(拖拽旋转 / 滚轮缩放 / 阻尼缓动 / 默认缓慢
   自转)，入场自远处斜掠飞入。点击恒星平滑飞近近景；点击行星飞入其所属星系、
   用屏幕空间的金色四角框标记选中(行星本身不放大不增亮)并在右侧弹出摘要卡片。
   可拾取对象悬停时指针变为 pointer。深空背景 ACESFilmic 色调映射。
   组件卸载时释放全部 GL 资源。 */
const { GlassPanel, Icon, Button: SRButton, IconButton, MemoryBar } = window.StellarRaftDesignSystem_2866af;

/* 记忆温度色阶：0..1 强度映射到一条冷→暖的颜色。镜像设计系统 memoryColor，
   读取 data-theme 以适配黎明模式。 */
function g3dMemoryColor(strength) {
  const dawn = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dawn';
  const stops = dawn ? [
    [0.0, [108, 121, 155]], [0.25, [92, 108, 150]], [0.5, [76, 96, 148]],
    [0.7, [52, 95, 190]], [0.88, [184, 128, 26]], [1.0, [168, 109, 18]],
  ] : [
    [0.0, [44, 53, 86]], [0.25, [70, 82, 122]], [0.5, [120, 150, 205]],
    [0.7, [159, 198, 255]], [0.88, [255, 224, 150]], [1.0, [255, 244, 214]],
  ];
  const v = Math.max(0, Math.min(1, strength));
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i][0] && v <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
  const c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * t));
  return { r: c[0], g: c[1], b: c[2] };
}

function g3dHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}

/* 生成一张径向渐变贴图，用于恒星辉光壳 / 行星高亮环 / 背景核心。 */
function g3dRadialTexture(THREE, inner, outer) {
  const s = 128;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* 星域名牌：把「名称 · 星数」画进 Canvas 再作为 Sprite 悬在恒星上方，
   始终面向相机；相机飞近该星系时淡出，避免遮挡近景。黎明用深琥珀墨 + 白晕。 */
function g3dLabelSprite(THREE, name, count, dawn) {
  const W = 360, H = 104, dpr = 2;
  const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const nameFont = (dawn ? '500' : '300') + ' 34px Sora, "Noto Sans SC", sans-serif';
  if (dawn) {
    // 白色柔和底板：让深琥珀文字在星尘与恒星辉光上都保持可读
    ctx.font = nameFont;
    const tw = Math.min(W - 16, ctx.measureText(name).width + 40);
    ctx.fillStyle = 'rgba(246,248,251,0.78)';
    ctx.beginPath();
    ctx.roundRect((W - tw) / 2, 12, tw, 82, 20);
    ctx.fill();
  }
  ctx.shadowColor = dawn ? 'rgba(255,255,255,0.9)' : 'rgba(255,150,70,0.55)'; ctx.shadowBlur = dawn ? 4 : 14;
  ctx.fillStyle = dawn ? '#5e3a0c' : '#ffe3b0';
  ctx.font = nameFont;
  ctx.fillText(name, W / 2, 40);
  ctx.shadowBlur = dawn ? 0 : 6;
  ctx.fillStyle = dawn ? 'rgba(94,58,12,0.9)' : 'rgba(255,200,140,0.72)';
  ctx.font = (dawn ? '500' : '400') + ' 19px "JetBrains Mono", monospace';
  ctx.fillText(String(count), W / 2, 78);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.92 });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(24, 24 * H / W, 1);
  return { spr, mat, tex };
}

/* 监听 data-theme，主题切换时触发整个三维场景以对应配色重建 */
function useG3dDawn() {
  const [dawn, setDawn] = React.useState(() => document.documentElement.dataset.theme === 'dawn');
  React.useEffect(() => {
    const obs = new MutationObserver(() => setDawn(document.documentElement.dataset.theme === 'dawn'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return dawn;
}

function Galaxy3D({ onClose, onOpenStar, onFeynman, dataset }) {
  // dataset：造访好友星系时注入的只读数据；缺省用自己的
  const D = dataset || window.SR_DATA;
  const mountRef = React.useRef(null);
  const apiRef = React.useRef(null);
  const [selected, setSelected] = React.useState(null);   // 选中的行星(知识星) 数据，控制右侧卡片
  const [playing, setPlaying] = React.useState(true);     // 公转是否进行
  const [closeup, setCloseup] = React.useState(false);    // 是否处于恒星近景
  const [ready, setReady] = React.useState(false);        // 入场淡入

  const reduced = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dawn = useG3dDawn();

  React.useEffect(() => {
    const THREE = window.THREE;
    const mount = mountRef.current;
    if (!THREE || !mount) return;

    // 黎明的浅色天幕上加色混合会"消失"，改用普通混合 + 深色星点
    const BLEND = dawn ? THREE.NormalBlending : THREE.AdditiveBlending;
    const SKY = dawn ? '#dde3f0' : '#05060f';

    // ── 渲染器 ───────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dawn ? 1.0 : 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.FogExp2(new THREE.Color(SKY).getHex(), dawn ? 0.0008 : 0.0011);

    const camera = new THREE.PerspectiveCamera(55, (mount.clientWidth || 1) / (mount.clientHeight || 1), 0.1, 3000);

    // ── 资源登记，便于卸载时释放 ─────────────────────────────
    const geoms = [], mats = [], texs = [];
    const reg = (o) => { if (o.geometry) geoms.push(o.geometry); if (o.material) mats.push(o.material); return o; };

    // ── 灯光 ─────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(dawn ? 0x9aa8c8 : 0x2a3552, dawn ? 0.95 : 0.55));
    const hemi = new THREE.HemisphereLight(dawn ? 0xd8e0ee : 0x213056, dawn ? 0xa8b2c8 : 0x070810, dawn ? 0.55 : 0.35);
    scene.add(hemi);

    // 软圆斑贴图：让 Points 呈现为带辉光的圆星点，而非方形像素
    const starTex = g3dRadialTexture(THREE, 'rgba(255,255,255,1)', 'rgba(255,255,255,0.28)'); texs.push(starTex);

    // ── 背景星空 (Points，双层深度) ──────────────────────────
    const mkStarLayer = (count, rMin, rMax, size, opacity) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const tmp = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const r = rMin + Math.random() * (rMax - rMin);
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.cos(ph);
        pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
        const warm = Math.random();
        if (dawn) {
          if (warm > 0.85) tmp.setStyle('rgb(176,125,28)');
          else if (warm > 0.4) tmp.setStyle('rgb(70,98,168)');
          else tmp.setStyle('rgb(106,127,173)');
        } else {
          if (warm > 0.85) tmp.setRGB(1.0, 0.86, 0.62);
          else if (warm > 0.7) tmp.setRGB(0.95, 0.96, 1.0);
          else if (warm > 0.4) tmp.setStyle('rgb(159,198,255)');
          else tmp.setStyle('rgb(120,150,205)');
        }
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size, sizeAttenuation: true, vertexColors: true, map: starTex, transparent: true, opacity: dawn ? opacity * 0.75 : opacity, depthWrite: false, blending: BLEND });
      const pts = new THREE.Points(geo, mat);
      geoms.push(geo); mats.push(mat);
      scene.add(pts);
      return pts;
    };
    const bgFar = mkStarLayer(2400, 700, 1300, 2.6, 0.6);   // 远层：细密星幕
    const bgStars = mkStarLayer(1100, 380, 700, 4.2, 0.85); // 近层：更大更亮，缓慢视差

    // ── 双旋臂星尘盘：所有知识星系都嵌在同一座星系里 ─────────
    const DUSTN = 2600;
    const dPos = new Float32Array(DUSTN * 3);
    const dCol = new Float32Array(DUSTN * 3);
    const dTmp = new THREE.Color();
    const dGauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
    for (let i = 0; i < DUSTN; i++) {
      const t01 = Math.random();
      const arm = i % 2;
      const ang = t01 * 4.4 * Math.PI + arm * Math.PI;         // 对数旋臂
      const rad = 24 + Math.pow(t01, 0.75) * 250;
      const spread = 3.5 + rad * 0.09;
      dPos[i * 3] = Math.cos(ang) * rad + dGauss() * spread;
      dPos[i * 3 + 1] = -7 + dGauss() * (2.2 + rad * 0.02);    // 薄盘，略低于知识星系平面
      dPos[i * 3 + 2] = Math.sin(ang) * rad + dGauss() * spread;
      if (dawn) {
        if (rad < 62 && Math.random() < 0.65) dTmp.setStyle('rgb(156,106,18)');  // 核球偏暖（深琥珀）
        else dTmp.setStyle(Math.random() < 0.5 ? 'rgb(70,98,168)' : 'rgb(96,112,156)');
      } else {
        if (rad < 62 && Math.random() < 0.65) dTmp.setRGB(1.0, 0.84, 0.55);      // 核球偏暖
        else if (Math.random() < 0.22) dTmp.setRGB(0.86, 0.9, 1.0);
        else dTmp.setStyle(Math.random() < 0.5 ? 'rgb(120,150,205)' : 'rgb(90,112,168)');
      }
      dCol[i * 3] = dTmp.r; dCol[i * 3 + 1] = dTmp.g; dCol[i * 3 + 2] = dTmp.b;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
    const dustMat = new THREE.PointsMaterial({ size: dawn ? 1.6 : 2.2, sizeAttenuation: true, vertexColors: true, map: starTex, transparent: true, opacity: dawn ? 0.2 : 0.38, depthWrite: false, blending: BLEND });
    const dust = new THREE.Points(dustGeo, dustMat);
    geoms.push(dustGeo); mats.push(dustMat);
    scene.add(dust);

    // 星系核心弥散辉光
    const coreTex = g3dRadialTexture(THREE, 'rgba(255,236,200,0.9)', 'rgba(255,180,110,0.28)'); texs.push(coreTex);
    const coreMat = new THREE.SpriteMaterial({ map: coreTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
    const coreGlow = new THREE.Sprite(coreMat); coreGlow.scale.set(220, 220, 1); mats.push(coreMat);
    if (!dawn) scene.add(coreGlow);

    // 共享辉光贴图
    const sunGlowTex = g3dRadialTexture(THREE, 'rgba(255,238,205,0.95)', 'rgba(255,168,92,0.45)'); texs.push(sunGlowTex);
    const ringGlowTex = g3dRadialTexture(THREE, 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.0)'); texs.push(ringGlowTex);

    // ── 布局：星座中心由成员星平均坐标决定 ───────────────────
    const SCALE = 1.7;
    const cons = D.constellations;
    const pickable = [];        // 可被射线拾取的网格(恒星+行星)
    const planetMeshById = {};  // id → 行星 mesh
    const planetAnims = [];     // 每帧驱动公转/自转
    const sunBreathe = [];      // 恒星呼吸
    const sunPosById = {};      // 星座 id → 恒星世界坐标(供金弧连接)
    const labels = [];          // 星域名牌，按相机距离淡入淡出

    const worldOf = (s) => {
      const b = D.byId[s.id] || s;
      const wx = (b.wx != null ? b.wx / 1680 * 100 : s.x);
      const wy = (b.wy != null ? b.wy / 1040 * 100 : s.y);
      return { x: wx, y: wy };
    };

    cons.forEach((c, ci) => {
      const members = D.stars.filter(s => s.con === c.id);
      if (!members.length) return;
      let mx = 0, my = 0;
      members.forEach(s => { const w = worldOf(s); mx += w.x; my += w.y; });
      mx /= members.length; my /= members.length;
      const h = g3dHash(c.id);
      const cx = (mx - 50) * SCALE;
      const cz = (my - 50) * SCALE;
      const cy = ((h % 36) - 18) * 1.1; // 纵向抖动，制造层次

      const sysGroup = new THREE.Group();
      sysGroup.position.set(cx, cy, cz);
      scene.add(sysGroup);

      // 恒星本体
      const sunR = 2.6 + Math.sqrt(c.count || members.length) * 0.72;
      const sunGeo = new THREE.SphereGeometry(sunR, 40, 40);
      const sunMat = new THREE.MeshStandardMaterial({ color: 0x2a1606, emissive: new THREE.Color('#ffb060'), emissiveIntensity: 1.5, roughness: 0.5, metalness: 0.0 });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      sun.userData = { kind: 'sun', con: c, sunR, pos: new THREE.Vector3(cx, cy, cz) };
      sysGroup.add(sun);
      pickable.push(sun);
      sunBreathe.push({ mat: sunMat, base: 1.5, phase: (h % 100) / 100 * Math.PI * 2, sun });

      sunPosById[c.id] = new THREE.Vector3(cx, cy, cz);

      // 点光源：照亮周围行星
      const light = new THREE.PointLight(0xffb066, 90, sunR * 16, 2.0);
      light.position.set(0, 0, 0);
      sysGroup.add(light);
      sunBreathe[sunBreathe.length - 1].light = light;

      // 星域名牌：悬在恒星的"屏幕上方"（随相机方位动态偏移），飞近时淡出
      const lbl = g3dLabelSprite(THREE, c.name, `${members.length} 星`, dawn);
      lbl.spr.position.set(0, sunR + 8.5, 0);
      sysGroup.add(lbl.spr);
      mats.push(lbl.mat); texs.push(lbl.tex);
      labels.push({ spr: lbl.spr, base: new THREE.Vector3(cx, cy, cz), sunR });

      // 恒星辉光壳 (Sprite，加色)
      const glowMat = new THREE.SpriteMaterial({ map: sunGlowTex, transparent: true, blending: BLEND, depthWrite: false, opacity: dawn ? 0.42 : 0.8 });
      const glow = new THREE.Sprite(glowMat); glow.scale.set(sunR * 5.0, sunR * 5.0, 1); mats.push(glowMat);
      sysGroup.add(glow);

      // 行星
      members.forEach((s, k) => {
        const ph = g3dHash(s.id);
        const orbitR = sunR + 4.5 + k * 3.4;
        const incX = (((ph % 40) - 20) / 90);        // 轨道倾角 ±0.22rad
        const incZ = ((((ph >> 5) % 32) - 16) / 110);
        const startA = ((ph >> 2) % 360) / 180 * Math.PI;
        const speed = (0.62 / Math.sqrt(orbitR)) * (1 + ((ph % 5) - 2) * 0.08); // 外圈更慢
        const spin = 0.5 + (ph % 7) * 0.08;
        const pr = 0.95 + (s.importance || 1) * 0.7;

        const orbitGroup = new THREE.Group();
        orbitGroup.rotation.x = incX;
        orbitGroup.rotation.z = incZ;
        sysGroup.add(orbitGroup);

        // 轨道环
        const ringGeo = new THREE.RingGeometry(orbitR - 0.06, orbitR + 0.06, 96);
        const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(dawn ? 'rgb(58,98,192)' : 'rgb(159,198,255)'), transparent: true, opacity: dawn ? 0.2 + (s.strength || 0) * 0.1 : 0.06 + (s.strength || 0) * 0.09, side: THREE.DoubleSide, depthWrite: false });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        orbitGroup.add(ring); geoms.push(ringGeo); mats.push(ringMat);

        // 公转支点
        const pivot = new THREE.Group();
        pivot.rotation.y = startA;
        orbitGroup.add(pivot);

        const c3 = g3dMemoryColor(s.strength);
        const baseCol = new THREE.Color().setStyle(`rgb(${c3.r},${c3.g},${c3.b})`);
        const pGeo = new THREE.SphereGeometry(pr, 28, 28);
        const pMat = new THREE.MeshStandardMaterial({ color: baseCol, emissive: baseCol.clone().multiplyScalar(dawn ? 0.12 : 0.45), emissiveIntensity: dawn ? 0.3 : 0.9 + (s.strength || 0) * 0.6, roughness: dawn ? 0.4 : 0.55, metalness: 0.1 });
        const planet = new THREE.Mesh(pGeo, pMat);
        planet.position.set(orbitR, 0, 0);
        planet.userData = {
          kind: 'planet', star: s, con: c, pr,
          sunPos: new THREE.Vector3(cx, cy, cz), sunR,
          sysR: sunR + 4.5 + (members.length - 1) * 3.4,   // 该星系最外圈轨道半径
        };
        pivot.add(planet);
        geoms.push(pGeo); mats.push(pMat);
        pickable.push(planet);
        planetMeshById[s.id] = planet;

        planetAnims.push({ pivot, planet, speed, spin });
      });
    });

    // ── 融会贯通：跨星域的金色光弧 + 沿弧飞行的光点 ──────────
    const arcs = [];
    {
      const seenPair = new Set();
      D.connections.forEach((cn) => {
        if (cn.kind !== 'cross') return;
        const A = D.byId[cn.a], B = D.byId[cn.b];
        if (!A || !B || A.con === B.con) return;
        const key = [A.con, B.con].sort().join('|');
        if (seenPair.has(key)) return; seenPair.add(key);
        const pa = sunPosById[A.con], pb = sunPosById[B.con];
        if (!pa || !pb) return;
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        mid.y += 14 + pa.distanceTo(pb) * 0.24;            // 拱起，像跨越星域的桥
        const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
        const mat = new THREE.LineBasicMaterial({ color: dawn ? 0xb07d1c : 0xffd98a, transparent: true, opacity: dawn ? 0.5 : 0.32, blending: BLEND, depthWrite: false });
        scene.add(new THREE.Line(geo, mat));
        geoms.push(geo); mats.push(mat);
        const tMat = new THREE.SpriteMaterial({ map: sunGlowTex, color: dawn ? 0x9c6a12 : 0xffe6b0, transparent: true, blending: BLEND, depthWrite: false, opacity: 0.9 });
        const traveler = new THREE.Sprite(tMat);
        traveler.scale.set(dawn ? 2.6 : 4.6, dawn ? 2.6 : 4.6, 1);
        scene.add(traveler); mats.push(tMat);
        arcs.push({ curve, traveler, mat, off: (arcs.length * 0.41) % 1 });
      });
    }

    // 选中行星：屏幕空间四角框 + 一圈金色描边（反向壳，不改动行星本身）
    let highlightId = null;
    const outlineGeo = new THREE.SphereGeometry(1, 32, 32);
    const outlineMat = new THREE.MeshBasicMaterial({ color: dawn ? 0xb07d1c : 0xffc561, side: THREE.BackSide, transparent: true, opacity: 0.95 });
    const outline = new THREE.Mesh(outlineGeo, outlineMat);
    outline.visible = false;
    scene.add(outline);
    geoms.push(outlineGeo); mats.push(outlineMat);

    // 点亮事件：行星色温从冷蓝升到暖金，带一次短促的发光爆发后落定
    const igniteFx = [];
    const onIgnite = (e) => {
      const { id, strength } = e.detail || {};
      const pm = planetMeshById[id]; if (!pm) return;
      const c3 = g3dMemoryColor(strength);
      igniteFx.push({
        pm, t0: performance.now(),
        to: new THREE.Color(`rgb(${c3.r},${c3.g},${c3.b})`),
        settle: (document.documentElement.dataset.theme === 'dawn') ? 0.3 : 0.9 + (strength || 0) * 0.6,
      });
    };
    window.addEventListener('sr-ignite', onIgnite);

    // 屏幕空间选择框（金色四角 bracket）跟随选中行星
    const selBox = document.createElement('div');
    selBox.className = 'g3d-selbox';
    selBox.innerHTML = '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>';
    selBox.style.display = 'none';
    mount.appendChild(selBox);

    // ── 自实现轨道相机控制 ───────────────────────────────────
    const target = new THREE.Vector3(0, 0, 0);
    const targetGoal = new THREE.Vector3(0, 0, 0);
    const cam = { theta: -0.42, phi: 0.82, radius: 660 };    // 当前(入场自远处斜掠飞入)
    const camGoal = { theta: 0.6, phi: 1.16, radius: 195 };  // 目标
    const RAD_MIN = 16, RAD_MAX = 620;
    let autoRotate = !reduced;
    let dragging = false, downX = 0, downY = 0, moved = 0, lastX = 0, lastY = 0;

    const applyCamera = () => {
      const sp = Math.sin(cam.phi), cp = Math.cos(cam.phi);
      camera.position.set(
        target.x + cam.radius * sp * Math.sin(cam.theta),
        target.y + cam.radius * cp,
        target.z + cam.radius * sp * Math.cos(cam.theta),
      );
      camera.lookAt(target);
    };

    const el = renderer.domElement;
    const onDown = (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = 0; downX = lastX = e.clientX; downY = lastY = e.clientY;
      autoRotate = false;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    };
    let hoverT = 0;
    const onMove = (e) => {
      if (!dragging) {
        // 节流射线检测：悬停在恒星/行星上时给出 pointer 指针
        if (e.timeStamp - hoverT > 90) {
          hoverT = e.timeStamp;
          const rect = el.getBoundingClientRect();
          ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(ndc, camera);
          el.style.cursor = raycaster.intersectObjects(pickable, false).length ? 'pointer' : '';
        }
        return;
      }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      camGoal.theta -= dx * 0.005;
      camGoal.phi = Math.max(0.18, Math.min(Math.PI - 0.18, camGoal.phi - dy * 0.005));
    };
    const onUp = (e) => {
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      const wasDrag = dragging && moved > 6;
      dragging = false;
      if (!wasDrag) handlePick(e);
    };
    const onWheel = (e) => {
      e.preventDefault();
      const f = Math.exp(e.deltaY * 0.0012);
      camGoal.radius = Math.max(RAD_MIN, Math.min(RAD_MAX, camGoal.radius * f));
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', (e) => { if (dragging) onUp(e); });
    el.addEventListener('wheel', onWheel, { passive: false });

    // ── 拾取 ─────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    // 飞入某个恒星系：相机目标移到恒星，收拢到给定半径的近景
    const flyToSystem = (pos, radius) => {
      targetGoal.copy(pos);
      camGoal.radius = Math.max(RAD_MIN, radius);
      camGoal.phi = 1.12;
      autoRotate = false;
      setCloseup(true);
    };
    const handlePick = (e) => {
      const rect = el.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pickable, false);
      if (!hits.length) { setSelected(null); return; }
      const ud = hits[0].object.userData;
      if (ud.kind === 'sun') { flyToSystem(ud.pos, ud.sunR * 5.2); setSelected(null); }
      else if (ud.kind === 'planet') {
        // 选中行星：相机直接拉近到行星本身，之后在渲染循环里持续跟随它公转
        camGoal.radius = Math.max(RAD_MIN, ud.pr * 10);
        camGoal.phi = 1.08;
        autoRotate = false;
        setCloseup(true);
        setSelected(ud.star);
      }
    };

    // ── 命令式 API，供 React 控制 ────────────────────────────
    let playingNow = !reduced;
    apiRef.current = {
      setPlaying: (v) => { playingNow = v; },
      flyHome: () => {
        targetGoal.set(0, 0, 0);
        camGoal.radius = 195; camGoal.phi = 1.16;
        autoRotate = !reduced;
        setCloseup(false);
      },
      // 俯瞰机位：theta=0 正对上方——此时布局与 2D 星图的编排逐点一致
      flyTop: () => {
        targetGoal.set(0, 0, 0);
        camGoal.radius = 340; camGoal.phi = 0.16; camGoal.theta = 0;
        autoRotate = false;
        setCloseup(true);
      },
      setHighlight: (id) => { highlightId = id; },
    };

    // ── 渲染循环 ─────────────────────────────────────────────
    let raf, last = performance.now();
    const wpos = new THREE.Vector3();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (autoRotate && !dragging) camGoal.theta += dt * 0.06;

      // 阻尼缓动
      const ka = 1 - Math.exp(-dt * 5);
      const kt = 1 - Math.exp(-dt * 4);
      cam.theta += (camGoal.theta - cam.theta) * ka;
      cam.phi += (camGoal.phi - cam.phi) * ka;
      cam.radius += (camGoal.radius - cam.radius) * ka;
      target.lerp(targetGoal, kt);
      applyCamera();

      // 公转 / 自转
      if (playingNow) {
        for (const a of planetAnims) { a.pivot.rotation.y += a.speed * dt; a.planet.rotation.y += a.spin * dt; }
      } else {
        for (const a of planetAnims) a.planet.rotation.y += a.spin * dt * 0.25;
      }

      // 恒星呼吸 + 光源随之微微闪烁
      for (const sb of sunBreathe) {
        const br = Math.sin(t * 0.0013 + sb.phase);
        sb.mat.emissiveIntensity = sb.base + br * 0.28;
        if (sb.light) sb.light.intensity = 90 * (1 + br * 0.08);
      }

      coreGlow.material.rotation += dt * 0.02;

      // 深空缓慢流动：远近星幕反向微转产生视差，星尘盘随星系旋转
      bgFar.rotation.y += dt * 0.0022;
      bgStars.rotation.y -= dt * 0.004;
      dust.rotation.y += dt * (playingNow ? 0.012 : 0.003);

      // 金弧上的光点沿曲线飞行，弧线亮度轻微脉动
      for (let i = 0; i < arcs.length; i++) {
        const a = arcs[i];
        const k01 = playingNow ? ((t * 0.00055 + a.off) % 1) : a.off;
        a.traveler.position.copy(a.curve.getPoint(k01));
        a.mat.opacity = (dawn ? 0.44 : 0.26) + 0.1 * Math.sin(t * 0.0016 + i * 1.7);
      }

      // 星域名牌：沿相机的屏幕上方向悬浮（俯瞰时也不会压在恒星光斑上），
      // 远处清晰、飞近淡出，避免遮挡近景行星
      const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      for (const L of labels) {
        const off = L.sunR + 8.5;
        L.spr.position.set(upDir.x * off, upDir.y * off, upDir.z * off);
        wpos.copy(L.base).addScaledVector(upDir, off);
        const d = camera.position.distanceTo(wpos);
        L.spr.material.opacity = Math.max(0, Math.min(1, (d - L.sunR * 7) / 55)) * 0.92;
        const sc = Math.min(2.1, Math.max(1, d / 230));   // 远观时放大，保持可读
        L.spr.scale.set(24 * sc, 24 * (104 / 360) * sc, 1);
      }

      // 点亮动画：1.6s 内色温升到暖金，发光先爆发后落定
      for (let i = igniteFx.length - 1; i >= 0; i--) {
        const fx = igniteFx[i];
        const k = (t - fx.t0) / 1600;
        if (k >= 1) {
          fx.pm.material.color.copy(fx.to);
          fx.pm.material.emissive.copy(fx.to).multiplyScalar(0.45);
          fx.pm.material.emissiveIntensity = fx.settle;
          igniteFx.splice(i, 1);
          continue;
        }
        fx.pm.material.color.lerp(fx.to, 1 - Math.exp(-dt * 4));
        fx.pm.material.emissive.copy(fx.pm.material.color).multiplyScalar(0.45);
        fx.pm.material.emissiveIntensity = fx.settle + Math.sin(Math.min(1, k) * Math.PI) * 2.4;
      }

      // 选中行星：相机目标持续跟随行星公转，屏幕空间的金色四角框标记它
      // （行星本身不放大、不增亮）
      if (highlightId && planetMeshById[highlightId]) {
        const pm = planetMeshById[highlightId];
        pm.getWorldPosition(wpos);
        targetGoal.copy(wpos);
        // 金色描边：稍大于行星的反向壳
        outline.visible = true;
        outline.position.copy(wpos);
        outline.scale.setScalar((pm.userData.pr || 1) * 1.035);
        const proj = wpos.clone().project(camera);
        const vw = mount.clientWidth, vh = mount.clientHeight;
        if (proj.z < 1) {
          const sx = (proj.x * 0.5 + 0.5) * vw;
          const sy = (-proj.y * 0.5 + 0.5) * vh;
          const dist = camera.position.distanceTo(wpos);
          const fovR = camera.fov * Math.PI / 180;
          const screenR = (pm.userData.pr || 1) / Math.max(0.001, dist) * (vh / 2) / Math.tan(fovR / 2);
          const half = Math.max(15, screenR * 1.3 + 9);   // 始终比星球投影大一圈，随远近缩放
          selBox.style.display = 'block';
          selBox.style.left = (sx - half) + 'px';
          selBox.style.top = (sy - half) + 'px';
          selBox.style.width = (half * 2) + 'px';
          selBox.style.height = (half * 2) + 'px';
        } else { selBox.style.display = 'none'; }
      } else {
        outline.visible = false;
        selBox.style.display = 'none';
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    applyCamera();
    raf = requestAnimationFrame(loop);
    requestAnimationFrame(() => setReady(true));

    // ── 自适应尺寸 ───────────────────────────────────────────
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight; if (!w || !h) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize); ro.observe(mount);

    // ── 卸载释放 ─────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('sr-ignite', onIgnite);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      apiRef.current = null;
      geoms.forEach(g => g.dispose());
      mats.forEach(m => m.dispose());
      texs.forEach(tx => tx.dispose());
      renderer.dispose();
      if (selBox.parentNode) selBox.parentNode.removeChild(selBox);
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [dawn]);

  // React 状态 → 场景
  React.useEffect(() => { if (apiRef.current) apiRef.current.setPlaying(playing); }, [playing]);
  React.useEffect(() => { if (apiRef.current) apiRef.current.setHighlight(selected ? selected.id : null); }, [selected]);

  // 点亮后刷新右侧卡片的记忆强度
  React.useEffect(() => {
    const h = (e) => setSelected(s => (s && e.detail && s.id === e.detail.id) ? { ...s, strength: e.detail.strength } : s);
    window.addEventListener('sr-ignite', h);
    return () => window.removeEventListener('sr-ignite', h);
  }, []);

  const flyHome = () => { if (apiRef.current) apiRef.current.flyHome(); };

  const cons = D.constellations;
  const totalStars = D.stars.length;
  const lit = D.stars.filter(s => s.strength >= 0.78).length;
  const noWebGL = typeof window !== 'undefined' && !window.THREE;

  return (
    <div className="g3d-root"
      style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'hidden', background: dawn ? '#dde3f0' : '#05060f', opacity: ready ? 1 : 0, transition: 'opacity 520ms var(--ease-flight, ease)' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      <div className="g3d-vignette" />
      <Galaxy3DStyle />

      {noWebGL && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
          <GlassPanel strong radius="lg" pad="md"><span style={{ color: 'var(--text-2)', fontSize: 13 }}>当前环境不支持 WebGL，无法渲染三维星系。</span></GlassPanel>
        </div>
      )}

      {/* 顶部 HUD */}
      <div style={{ position: 'absolute', top: 18, left: 24, zIndex: 30 }}>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '10px 24px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
            <Icon name="orbit" size={17} color="var(--gold)" />三维星系
          </span>
          {dataset && dataset.ownerName && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--gold)', whiteSpace: 'nowrap' }}>
              <Icon name="telescope" size={14} color="var(--gold)" />{dataset.ownerName} · 只读
            </span>
          )}
          <Sep />
          <Stat n={cons.length} t="星座" />
          <Stat n={totalStars} t="行星" />
          <Stat n={lit} t="已点亮" tone="var(--gold)" />
          <Sep />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>正变暗</span>
            <span style={{ width: 74, height: 5, borderRadius: 3, background: 'linear-gradient(90deg, var(--mem-dead), var(--mem-low), var(--mem-mid), var(--mem-high), var(--mem-full))' }} />
            <span style={{ fontSize: 10.5, color: 'var(--gold)' }}>已掌握</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 20, height: 0, borderTop: '2px solid var(--gold)', opacity: 0.8, borderRadius: 2 }} />
            <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>融会贯通</span>
          </span>
        </GlassPanel>
      </div>

      {/* 操作提示 */}
      <div style={{ position: 'absolute', bottom: 26, left: 24, zIndex: 30, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-3)', pointerEvents: 'none' }}>
        <Icon name="move-3d" size={14} color="currentColor" />拖拽旋转 · 滚轮缩放 · 点击恒星飞近 · 点击行星查看 · 金色光弧 = 融会贯通
      </div>

      {/* 右下控制：暂停/播放 · 回到全景 · 返回星图 */}
      <div style={{ position: 'absolute', bottom: 26, right: 24, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10 }}>
        <GlassPanel radius="pill" pad="none" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6 }}>
          <IconButton name={playing ? 'pause' : 'play'} size="sm" title={playing ? '暂停公转' : '播放公转'} onClick={() => setPlaying(p => !p)} />
          <IconButton name="satellite" size="sm" title="俯瞰全局 · 与星图同一编排" onClick={() => apiRef.current && apiRef.current.flyTop()} />
          <IconButton name="locate-fixed" size="sm" title="回到全景" onClick={flyHome} />
        </GlassPanel>
        <SRButton icon="corner-up-left" onClick={onClose}>返回星图</SRButton>
      </div>

      {/* 回到全景浮层提示(近景时) */}
      {closeup && (
        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
          <GlassPanel radius="pill" pad="none" style={{ padding: '6px 8px' }}>
            <SRButton size="sm" icon="minimize-2" onClick={flyHome}>回到全景</SRButton>
          </GlassPanel>
        </div>
      )}

      {/* 右侧行星摘要卡片 */}
      {selected && (
        <div onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '50%', right: 24, transform: 'translateY(-50%)', width: 286, zIndex: 32, animation: 'g3d-cardin 320ms var(--ease-flight, ease) both' }}>
          <GlassPanel strong radius="lg" pad="md" glow>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(selected.con), boxShadow: `0 0 8px ${D.conColor(selected.con)}` }} />
                {D.conName(selected.con)}
              </span>
              <IconButton name="x" size="sm" title="关闭" onClick={() => setSelected(null)} />
            </div>
            <div style={{ fontSize: 19, fontWeight: 300, color: 'var(--text-1)', marginBottom: 10, textShadow: 'var(--text-glow-cool)' }}>{selected.label}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 14 }}>
              {selected.summary || (dataset ? '对方未开放摘要。' : '还没有摘要——打开编辑器，写下第一段。')}
            </div>
            <MemoryBar value={selected.strength} label="记忆强度" showPct fading={selected.strength < 0.4} />
            {(onFeynman || onOpenStar) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {onFeynman && <SRButton variant="primary" size="sm" icon="zap" glow onClick={() => onFeynman(selected.id)} style={{ flex: 1 }}>费曼内化</SRButton>}
                {onOpenStar && <SRButton size="sm" icon="maximize-2" onClick={() => onOpenStar(selected.id)} style={{ flex: 1 }}>打开编辑</SRButton>}
              </div>
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

function Sep() { return <span style={{ width: 1, height: 20, background: 'var(--line)' }} />; }
function Stat({ n, t, tone }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 17, color: tone || 'var(--text-1)' }}>{n}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t}</span>
    </span>
  );
}

function Galaxy3DStyle() {
  return (
    <style>{`
    .g3d-root { cursor: grab; }
    .g3d-root:active { cursor: grabbing; }
    .g3d-vignette { position:absolute; inset:0; z-index:2; pointer-events:none;
      background: radial-gradient(125% 100% at 50% 46%, transparent 54%, rgba(3,4,12,0.6) 100%); }
    :root[data-theme="dawn"] .g3d-vignette { background: radial-gradient(125% 100% at 50% 46%, transparent 58%, rgba(223,228,238,0.55) 100%); }
    @keyframes g3d-cardin { from { opacity:0; transform: translateY(-50%) translateX(14px); } to { opacity:1; transform: translateY(-50%) translateX(0); } }
    .g3d-selbox { position:absolute; z-index:25; pointer-events:none; animation: g3d-selpulse 1.6s var(--ease-flight, ease) infinite; }
    .g3d-selbox .c { position:absolute; width:22%; max-width:16px; height:22%; max-height:16px; border:1.5px solid var(--gold); filter:drop-shadow(0 0 2px rgba(0,0,0,0.85)); }
    .g3d-selbox .tl { left:0; top:0; border-right:none; border-bottom:none; }
    .g3d-selbox .tr { right:0; top:0; border-left:none; border-bottom:none; }
    .g3d-selbox .bl { left:0; bottom:0; border-right:none; border-top:none; }
    .g3d-selbox .br { right:0; bottom:0; border-left:none; border-top:none; }
    @keyframes g3d-selpulse { 0%,100% { opacity:0.95; } 50% { opacity:0.6; } }
    `}</style>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Galaxy3D });
