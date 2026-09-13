/* Checkup — 知识体检报告 (整页仪表盘): a full-stage dashboard that reads the whole
   universe's memory health. Overall health, per-constellation bars, the memory
   distribution (牢固 / 正常 / 正变暗 / 将熄灭), the stars most in need of review,
   a recent ignite trend drawn from the timeline, and weak-constellation nudges.
   Click a star to open it, click a constellation to fly there. */
const { GlassPanel, Icon, IconButton, Button, MemoryBar, toast } = window.StellarRaftDesignSystem_2866af;

// memory band — same thresholds the rest of the kit uses
function band(s) {
  if (s < 0.2) return { key: 'dying', t: '将熄灭', c: 'var(--star-blue-deep)' };
  if (s < 0.4) return { key: 'fading', t: '正变暗', c: 'var(--star-blue-dim)' };
  if (s < 0.7) return { key: 'normal', t: '正常', c: 'var(--star-blue)' };
  return { key: 'solid', t: '牢固', c: 'var(--gold)' };
}

// parse a timeline delta string ("+0.12" / "−0.06") into a signed number
function parseDelta(d) {
  const neg = d.indexOf('−') === 0 || d.indexOf('-') === 0;
  const n = parseFloat(d.replace('−', '').replace('+', '').replace('-', '')) || 0;
  return neg ? -n : n;
}

/* ===== 时间之窗 · 未来 7 天预演（组件外纯函数）=====
   把遗忘从「事后发现」变成「事前预警」：
   已点亮星 → R 衰减到熄灭阈值 0.35 的时刻 t = last + S·ln(1/0.35)·天；
   未点亮星 → 到期时刻一律取 D.dueTsOf（策略感知，别在这里重算 due）。
   只取 0 < t − now ≤ 7 天：已到期的星归上方「今日待办」管，不重复预警。 */
const DAY_MS = 86400000;
const EMBER_R = 0.35;   // 与 data.js 的 MEM.emberR 同一阈值
function forecast7(D, now) {
  const horizon = now + 7 * DAY_MS;
  const rows = [];
  (D.stars || []).forEach(s => {
    if (D.isLit && D.isLit(s)) {
      const t = s.sr.last + s.sr.S * Math.log(1 / EMBER_R) * DAY_MS;
      if (t > now && t <= horizon) rows.push({ s, t, kind: 'ember' });
    } else if (D.dueTsOf) {
      const t = D.dueTsOf(s);
      if (t > now && t <= horizon) rows.push({ s, t, kind: 'due' });
    }
  });
  return rows.sort((a, b) => a.t - b.t);
}
// 熄灭类的紧迫感：越近越红（暖金 → 暗红）；到期类保持冷蓝
const emberUrgency = (days) =>
  `color-mix(in srgb, var(--danger) ${Math.round((7 - days) / 6 * 72)}%, var(--gold))`;
// 「排入复习」的即时回执：手动队列已指向今天（半天内）
const queuedToday = (s, now) => !!(s.sr && s.sr.due && s.sr.due - now < DAY_MS * 0.5);

/* ===== 观星热力图（组件外纯函数）=====
   时间线里带 ts 的记录按本地自然日聚合；dim（熄灭）是被动事件，不算主动观星。
   种子行只有文字时间（如「今天 10:30」），无法落到具体日期，不参与统计。 */
const heatDayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
function heatCounts(timeline) {
  const map = {};
  (timeline || []).forEach(t => {
    if (!t || !t.ts || t.kind === 'dim') return;
    const k = heatDayKey(new Date(t.ts));
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}
// 近 16 周：每列一周（周一为首行），最右一列是本周
function heatWeeks(now) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weeks = [];
  for (let w = 15; w >= 0; w--) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() - w * 7 + i);
      col.push(d);
    }
    weeks.push(col);
  }
  return weeks;
}
// 活动次数 → 金色浓度五档：0 近黑，越多越金
const HEAT_ALPHA = [0, 0.15, 0.35, 0.6, 0.9];
const heatAlpha = (n) => n <= 0 ? 0 : n === 1 ? 0.15 : n === 2 ? 0.35 : n <= 4 ? 0.6 : 0.9;
const heatBg = (a) => a > 0 ? `rgba(255,217,138,${a})` : 'rgba(120,150,205,0.09)';

/* ===== 星空周报卡（组件外纯函数）=====
   一键把最近 7 天的学习战报画成一张 1080×1350 的竖版 PNG。
   Canvas 里读不到 CSS 变量，设计系统色值硬编码为常量，来源 token 标注在旁。
   星总数不猜「本周新增」——stars 没有创建时间，报现有总量更诚实。 */
const CARD_W = 1080, CARD_H = 1350;
const CARD_C = {
  deep0: '#05060f',                    // --space-0 深空底（启动屏线性渐变首端）
  deep1: '#03040c',                    // 启动屏线性渐变中段
  deep2: '#04050e',                    // 启动屏线性渐变末端
  blue: '#9fc6ff',                     // --star-blue 星蓝
  gold: '#ffd98a',                     // --gold 暖金
  goldDeep: '#ffb86b',                 // 品牌星标渐变暗端（index.html sr-logo-g）
  goldHi: '#ffe9b8',                   // 品牌星标渐变亮端（index.html sr-logo-g）
  text1: 'rgba(255,255,255,0.93)',     // --text-1 主文字
  text2: 'rgba(208,220,255,0.66)',     // --text-2 次文字
  text3: 'rgba(159,198,255,0.40)',     // --text-3 弱文字
};
const cardFont = (w, px) => `${w} ${px}px Sora, "Noto Sans SC", sans-serif`;
const cardMono = (w, px) => `${w} ${px}px "JetBrains Mono", "Roboto Mono", monospace`;   // --font-mono

// 近 7 天聚合：点亮数 / 复习数 / 按天活动小条（dim 是被动事件，不算主动学习）
function weekStats(D, now) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
  const days = []; const idx = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    idx[heatDayKey(d)] = i;
    days.push({ week: '日一二三四五六'[d.getDay()], date: (d.getMonth() + 1) + '.' + d.getDate(), n: 0 });
  }
  let ignites = 0, reviews = 0;
  (D.timeline || []).forEach(t => {
    if (!t || !t.ts || t.ts < start.getTime() || t.ts > now) return;
    if (t.kind === 'ignite') ignites++;
    else if (t.kind === 'review') reviews++;
    if (t.kind !== 'dim') {
      const i = idx[heatDayKey(new Date(t.ts))];
      if (i != null) days[i].n++;
    }
  });
  return {
    name: (D.account && D.account.name) || '观星者',
    streak: (D.account && D.account.streak) || 0,
    total: (D.stars || []).length,
    ignites, reviews, days,
    range: days[0].date + ' – ' + days[6].date,
  };
}

// 四芒星品牌星标：index.html 里 sr-logo 的曲线四芒按比例移植成 canvas path
function cardSparkPath(ctx, cx, cy, R) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - R);
  ctx.bezierCurveTo(cx + 0.084 * R, cy - 0.23 * R, cx + 0.23 * R, cy - 0.084 * R, cx + R, cy);
  ctx.bezierCurveTo(cx + 0.23 * R, cy + 0.084 * R, cx + 0.084 * R, cy + 0.23 * R, cx, cy + R);
  ctx.bezierCurveTo(cx - 0.084 * R, cy + 0.23 * R, cx - 0.23 * R, cy + 0.084 * R, cx - R, cy);
  ctx.bezierCurveTo(cx - 0.23 * R, cy - 0.084 * R, cx - 0.084 * R, cy - 0.23 * R, cx, cy - R);
  ctx.closePath();
}
const cardRRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
};

function drawWeeklyCard(ctx, data) {
  const W = CARD_W, H = CARD_H, C = CARD_C;

  // 深空底：复刻启动屏的三层渐变（线性主底 + 两团蓝紫光晕）
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.deep0); bg.addColorStop(0.55, C.deep1); bg.addColorStop(1, C.deep2);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow1 = ctx.createRadialGradient(W * 0.78, -H * 0.1, 0, W * 0.78, -H * 0.1, 900);
  glow1.addColorStop(0, 'rgba(26,35,80,0.55)'); glow1.addColorStop(1, 'rgba(26,35,80,0)');
  ctx.fillStyle = glow1; ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(W * 0.12, H * 1.1, 0, W * 0.12, H * 1.1, 760);
  glow2.addColorStop(0, 'rgba(40,30,70,0.35)'); glow2.addColorStop(1, 'rgba(40,30,70,0)');
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);

  // 散布小星点：白 / 蓝 / 金三色轮转，少数带十字星芒
  const tints = ['rgba(214,230,255,', 'rgba(159,198,255,', 'rgba(255,231,176,'];
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    const r = 0.8 + Math.random() * 1.2, tint = tints[i % 3];
    ctx.fillStyle = tint + (0.35 + Math.random() * 0.5).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (i % 8 === 0) {
      ctx.strokeStyle = tint + '0.28)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 5, y); ctx.lineTo(x + r * 5, y);
      ctx.moveTo(x, y - r * 5); ctx.lineTo(x, y + r * 5);
      ctx.stroke();
    }
  }

  ctx.textAlign = 'center';

  // 顶部品牌星标：暖金渐变四芒 + 柔光
  const sx = W / 2, sy = 168, sR = 52;
  const sg = ctx.createLinearGradient(sx - sR, sy - sR, sx + sR, sy + sR);
  sg.addColorStop(0, C.goldHi); sg.addColorStop(1, C.goldDeep);
  ctx.save();
  ctx.shadowColor = 'rgba(255,217,138,0.55)'; ctx.shadowBlur = 36;
  cardSparkPath(ctx, sx, sy, sR);
  ctx.fillStyle = sg; ctx.fill();
  ctx.restore();

  // 标题与日期范围
  ctx.fillStyle = C.text1;
  ctx.font = cardFont(300, 58);
  ctx.fillText('星图 · 星空周报', W / 2, 318);
  ctx.fillStyle = 'rgba(159,198,255,0.55)';
  ctx.font = cardMono(300, 26);
  ctx.fillText(data.range + ' · 最近 7 天', W / 2, 372);

  // 中部四枚大数字：金 / 蓝交替，2×2 网格
  const stats = [
    { v: data.ignites, t: '本周点亮', c: C.gold, glow: true },
    { v: data.reviews, t: '本周复习', c: C.blue, glow: false },
    { v: data.streak, t: '连续观星（天）', c: C.gold, glow: true },
    { v: data.total, t: '知识星总数', c: C.blue, glow: false },
  ];
  stats.forEach((s, i) => {
    const cx = i % 2 === 0 ? W * 0.28 : W * 0.72;
    const by = i < 2 ? 560 : 780;
    ctx.save();
    if (s.glow) { ctx.shadowColor = 'rgba(255,217,138,0.35)'; ctx.shadowBlur = 22; }
    ctx.fillStyle = s.c;
    ctx.font = cardMono(200, 104);
    ctx.fillText(String(s.v), cx, by);
    ctx.restore();
    ctx.fillStyle = C.text2;
    ctx.font = cardFont(300, 26);
    ctx.fillText(s.t, cx, by + 52);
  });

  // 下部 7 天活动条形：金色渐变柱，无活动的天画暗槽
  const barW = 76, gap = 36, base = 1130, maxH = 150;
  const x0 = (W - (barW * 7 + gap * 6)) / 2;
  const maxN = Math.max(1, ...data.days.map(d => d.n));
  ctx.strokeStyle = 'rgba(159,198,255,0.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 - 14, base + 1); ctx.lineTo(W - x0 + 14, base + 1); ctx.stroke();
  data.days.forEach((d, i) => {
    const x = x0 + i * (barW + gap), cx = x + barW / 2;
    if (d.n > 0) {
      const h = Math.max(16, d.n / maxN * maxH);
      const bar = ctx.createLinearGradient(0, base - h, 0, base);
      bar.addColorStop(0, C.gold); bar.addColorStop(1, 'rgba(255,184,107,0.45)');
      cardRRect(ctx, x, base - h, barW, h, 8);
      ctx.fillStyle = bar; ctx.fill();
      ctx.fillStyle = C.gold;
      ctx.font = cardMono(300, 24);
      ctx.fillText(String(d.n), cx, base - h - 14);
    } else {
      cardRRect(ctx, x, base - 10, barW, 10, 5);
      ctx.fillStyle = 'rgba(120,150,205,0.10)'; ctx.fill();
    }
    ctx.fillStyle = C.text3;
    ctx.font = cardFont(300, 24);
    ctx.fillText('周' + d.week, cx, base + 44);
    ctx.fillStyle = 'rgba(159,198,255,0.30)';
    ctx.font = cardMono(300, 19);
    ctx.fillText(d.date, cx, base + 76);
  });

  // 底部署名行
  ctx.fillStyle = C.text2;
  ctx.font = cardFont(300, 31);
  ctx.fillText('@' + data.name + ' 的深空', W / 2, 1272);
  ctx.save();
  try { ctx.letterSpacing = '8px'; } catch (e) { /* 旧内核没有 letterSpacing，退回默认字距 */ }
  ctx.fillStyle = C.text3;
  ctx.font = cardFont(300, 21);
  ctx.fillText('STELLAR RAFT', W / 2 + 4, 1316);
  ctx.restore();
}

// 入口：离屏画布 → toBlob → 触发下载（同步很快，无需 loading）
function shareWeeklyCard(D) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W; canvas.height = CARD_H;
  drawWeeklyCard(canvas.getContext('2d'), weekStats(D, Date.now()));
  canvas.toBlob(blob => {
    if (!blob) { toast('周报卡生成失败，稍后再试', { tone: 'danger', icon: 'circle-alert' }); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '星图-星空周报.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('周报卡已保存 ✦', { icon: 'image-down' });
  }, 'image/png');
}

const HUD = { fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' };

function SectionTitle({ icon, children, hint, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      {icon && <Icon name={icon} size={14} color="var(--star-blue)" />}
      <span style={HUD}>{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text-3)', marginLeft: 'auto' }}>{hint}</span>}
      {action && <span style={{ flex: 'none', marginLeft: hint ? 0 : 'auto' }}>{action}</span>}
    </div>
  );
}

// 「去整理」直达收件箱：体检拿不到切视图的回调（app 层只下发了复习 / 费曼 / 星域），
// 从侧栏唯一的收件箱入口接力——展开态匹配按钮文字，收起态匹配 data-tip。
function goInbox() {
  const btn = Array.from(document.querySelectorAll('button')).find(b =>
    (b.dataset && b.dataset.tip === '收件箱') || (b.textContent || '').trim().startsWith('收件箱'));
  if (btn) btn.click();
}

/* 今日待办的一行：图标 + 类别（计数）+ 一句自解释 + 直达动作。
   待重燃行用暗金发丝边——「曾获认证」的残迹属于点亮语义本身，其余保持冷色。 */
function TodoRow({ icon, iconColor, title, count, desc, action, ember }) {
  return (
    <div className="sr-ck-todo" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 'var(--r-md)',
      border: '1px solid ' + (ember ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'var(--glass-border)'),
      background: ember ? 'color-mix(in srgb, var(--gold) 4%, transparent)' : 'rgba(120,150,205,0.05)' }}>
      <Icon name={icon} size={16} color={iconColor} style={{ flex: 'none' }} />
      <div className="sr-ck-todo-text" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{title}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: ember ? 'color-mix(in srgb, var(--gold) 72%, var(--text-3))' : 'var(--star-blue)' }}>{count}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.6 }}>{desc}</div>
      </div>
      {action && <div className="sr-ck-todo-action" style={{ flex: 'none' }}>{action}</div>}
    </div>
  );
}

function Checkup({ onClose, onOpenStar, onFocusCon, onFeynman, onReview }) {
  const D = window.SR_DATA;
  // 待办与亮度都是活数据：费曼抽屉 / 复习会话在本视图之上操作后，就地读回新真相
  const [, bump] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const h = () => bump();
    ['sr-memory', 'sr-data', 'sr-ignite'].forEach(ev => window.addEventListener(ev, h));
    return () => ['sr-memory', 'sr-data', 'sr-ignite'].forEach(ev => window.removeEventListener(ev, h));
  }, []);
  // 时间之窗折叠态：预演超过 8 行时先收起
  const [foreOpen, setForeOpen] = React.useState(false);
  const stars = D.stars;
  const total = stars.length;
  const dueN = D.dueStars ? D.dueStars().length : 0;
  // 统一今日待办：到期复习 + 待重燃 + 收件箱待整理（due 与 ember 可重叠——重燃会同时清掉到期）
  const todo = D.todayTodo ? D.todayTodo() : { due: dueN, ember: 0, inbox: (D.inbox || []).length };
  const embers = D.emberStars ? D.emberStars() : [];
  const todoEmpty = todo.due === 0 && todo.ember === 0 && todo.inbox === 0;

  // overall memory health（0 颗星时为 0，不做除零）
  const overall = total ? Math.round(stars.reduce((a, s) => a + s.strength, 0) / total * 100) : 0;
  const overallCol = overall >= 70 ? 'var(--gold)' : overall >= 45 ? 'var(--star-blue)' : 'var(--star-blue-dim)';

  // distribution by band
  const bandDefs = [
    { key: 'solid', t: '牢固', c: 'var(--gold)', desc: '记忆稳固，无需打扰' },
    { key: 'normal', t: '正常', c: 'var(--star-blue)', desc: '光度平稳' },
    { key: 'fading', t: '正变暗', c: 'var(--star-blue-dim)', desc: '开始遗忘，宜复习' },
    { key: 'dying', t: '将熄灭', c: 'var(--star-blue-deep)', desc: '濒临熄灭，尽快回看' },
  ];
  const counts = bandDefs.map(b => ({ ...b, n: stars.filter(s => band(s.strength).key === b.key).length }));
  const fadingTotal = counts.filter(b => b.key === 'fading' || b.key === 'dying').reduce((a, b) => a + b.n, 0);

  // per-constellation health, weakest first
  const cons = D.constellations.map(c => {
    const ss = stars.filter(s => s.con === c.id);
    const avg = ss.length ? ss.reduce((a, s) => a + s.strength, 0) / ss.length : 0;
    const weakest = ss.slice().sort((a, b) => a.strength - b.strength)[0];
    return { ...c, avg, members: ss.length, weakStar: weakest, dim: ss.filter(s => s.strength < 0.4).length };
  }).sort((a, b) => a.avg - b.avg);

  // 复习队列：与侧栏角标、「开始复习」按钮同一口径（dueStars），
  // 按真实到期时刻升序——逾期最久的排最前，列表只展示最需要的前 6 颗
  const urgent = (D.dueStars ? D.dueStars() : []).slice(0, 6);
  const topUrgent = urgent[0];

  // weak-constellation nudges — the two coldest domains with dim members
  const weakCons = cons.filter(c => c.avg < 0.6).slice(0, 2);

  // recent ignite trend, oldest → newest, cumulative net light gained
  //（只统计仍然存在的星：已销毁的星不该继续贡献假曲线）
  const events = D.timeline.filter(ev => D.byId[ev.starId]).slice().reverse();
  let acc = 0;
  const series = events.map(ev => { acc += parseDelta(ev.delta); return { ev, v: acc }; });
  const netDelta = acc;
  const igniteN = events.filter(t => t.kind === 'ignite').length;
  const reviewN = events.filter(t => t.kind === 'review').length;
  const dimN = events.filter(t => t.kind === 'dim').length;

  // sparkline geometry
  const SW = 320, SH = 96, PAD = 8;
  const vals = series.map(p => p.v).concat([0]);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  const span = (vMax - vMin) || 1;
  const px = i => PAD + (series.length <= 1 ? 0 : i / (series.length - 1)) * (SW - PAD * 2);
  const py = v => SH - PAD - ((v - vMin) / span) * (SH - PAD * 2);
  const linePts = series.map((p, i) => `${px(i).toFixed(1)},${py(p.v).toFixed(1)}`).join(' ');
  const areaPts = series.length
    ? `${px(0).toFixed(1)},${(SH - PAD).toFixed(1)} ${linePts} ${px(series.length - 1).toFixed(1)},${(SH - PAD).toFixed(1)}`
    : '';

  // 时间之窗：未来 7 天将熄灭 / 到期的星（已到期的归上方「今日待办」，不重复）
  const now = Date.now();
  const fRows = forecast7(D, now);
  const fShown = foreOpen ? fRows : fRows.slice(0, 8);
  const fEmberN = fRows.filter(r => r.kind === 'ember').length;
  const fDueN = fRows.length - fEmberN;
  // 排入今日：与列表 / 编辑器的「加入复习队列」同一口径，广播后各在场视图就地对齐
  const queueToday = (id) => {
    D.queueReview(id, 0);
    D.pushTimeline('review', id, '加入复习队列');
    window.dispatchEvent(new CustomEvent('sr-memory'));
  };

  // 观星热力图：近 16 周的每日主动学习次数
  const heat = heatCounts(D.timeline);
  const weeks = heatWeeks(now);
  const activeDays = Object.keys(heat).length;

  const card = { borderRadius: 'var(--r-lg)', border: '1px solid var(--glass-border)', background: 'var(--glass-bg-faint)', padding: 18 };

  return (
    <div onContextMenu={e => e.preventDefault()} className="sr-view" style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', padding: '22px 30px 56px' }}>
      <sr-starfield density="0.55"></sr-starfield>
      <style>{`
        /* ——— 手机 ———
           体检页原本按桌面的宽度画：每行待办是「图标 + 说明 + 右侧按钮」的横排，
           窄屏上按钮吃掉一半宽度，说明文字只能从它底下穿过去。窄屏改成竖排：
           说明占满一行，动作按钮沉到下面铺满——顺手也把点击区做大。 */
        html[data-screen="phone"] .sr-view { padding: 16px 14px 72px !important; }
        html[data-screen="phone"] .sr-ck-todo { flex-wrap: wrap; row-gap: 10px; }
        html[data-screen="phone"] .sr-ck-todo-text { flex: 1 1 calc(100% - 28px) !important; }
        html[data-screen="phone"] .sr-ck-todo-action { flex: 1 1 100% !important; }
        html[data-screen="phone"] .sr-ck-todo-action > button { width: 100%; justify-content: center; }
        /* 右上角那行英文 HUD 在 390px 上必然被裁掉半个词；标题已经写着「知识体检报告」，
           它只是装饰，窄屏直接不出现，比切一半体面 */
        html[data-screen="phone"] .sr-ck-hud { display: none !important; }
        /* 页尾三个并列动作在 390px 上排不下，第三个整个被推出屏外（点都点不到）。
           窄屏改成竖排铺满；中间那根撑开的弹簧在竖排里没有意义，收掉。 */
        html[data-screen="phone"] .sr-ck-actions { flex-direction: column !important; align-items: stretch !important; }
        html[data-screen="phone"] .sr-ck-actions > button { width: 100%; justify-content: center; }
        html[data-screen="phone"] .sr-ck-actions > div:empty { display: none !important; }
      `}</style>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 1080, margin: '0 auto' }}>

        {/* header with back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={onClose}>返回</Button>
          <div style={{ flex: 1 }} />
          <span className="sr-ck-hud" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...HUD }}>
            <Icon name="activity" size={13} color="var(--gold)" />KNOWLEDGE CHECKUP
          </span>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 25, fontWeight: 300, color: 'var(--text-1)' }}>知识体检报告</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
            为你的整片星空做一次记忆体检 —— 哪些星在发光，哪些正在变暗，哪些该回来看看。
          </div>
        </div>

        {/* 统一今日待办：到期复习 / 待重燃 / 收件箱积压——体检是唯一的待办入口，
            每类一句自解释 + 一个直达动作 */}
        <GlassPanel strong radius="lg" pad="none" glow style={{ padding: 18, marginBottom: 16 }}>
          <SectionTitle icon="list-todo" hint={todoEmpty ? undefined : '到期与待重燃可能重叠'}>今日待办</SectionTitle>
          {todoEmpty && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 4px 4px', color: 'var(--text-3)', fontSize: 13 }}>
              <Icon name="sparkles" size={15} color="var(--star-blue)" />
              星空明亮，观测台今夜无事。
            </div>
          )}
          {!todoEmpty && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todo.due > 0 && (
                <TodoRow icon="repeat" iconColor="var(--star-blue)"
                  title="到期复习" count={`${todo.due} 颗`}
                  desc="到期的星正在变暗——复习负责保温，别让光溜走。"
                  action={onReview && <Button variant="primary" size="sm" icon="repeat" glow onClick={onReview}>开始复习</Button>} />
              )}
              {todo.ember > 0 && (
                <TodoRow icon="flame" iconColor="color-mix(in srgb, var(--gold) 60%, var(--text-3))" ember
                  title="待重燃" count={`${todo.ember} 颗`}
                  desc="曾点亮的星熄灭后，会在这里等你重燃。"
                  action={onFeynman && embers[0] &&
                    <Button size="sm" icon="flame" onClick={() => onFeynman(embers[0].id)}>去重燃{embers[0] ? `「${embers[0].label}」` : ''}</Button>} />
              )}
              {todo.inbox > 0 && (
                <TodoRow icon="inbox" iconColor="var(--star-blue)"
                  title="收件箱" count={`${todo.inbox} 条待整理`}
                  desc="捕捉还躺在收件箱里——归入星域、写下内容，才会成为星。"
                  action={<Button size="sm" icon="folder-input" onClick={goInbox}>去整理</Button>} />
              )}
            </div>
          )}
        </GlassPanel>

        {/* hero row: big health number + distribution */}
        <div className="sr-ck-2col" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginBottom: 16 }}>
          {/* overall */}
          <GlassPanel strong radius="lg" pad="none" glow style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={HUD}>整体记忆健康度</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 2px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 64, fontWeight: 200, lineHeight: 1, color: overallCol, textShadow: overall >= 70 ? 'var(--text-glow-warm)' : 'var(--text-glow-cool)' }}>{overall}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 200, color: 'var(--text-3)' }}>%</span>
            </div>
            <div style={{ marginTop: 14 }}>
              <MemoryBar value={overall / 100} height={6} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, marginTop: 14 }}>
              {total === 0
                ? <span>你的星空还很暗。写下第一颗星，让它发光。</span>
                : <span>
                    共 <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)', fontWeight: 500 }}>{total}</b> 颗知识星，其中
                    <b style={{ color: 'var(--star-blue-dim)', fontWeight: 500 }}> {fadingTotal} </b>颗偏暗（正变暗或将熄灭）。
                    {fadingTotal > 0 ? '该回来看看了。' : '星空明亮，保持节奏。'}
                  </span>}
            </div>
          </GlassPanel>

          {/* distribution */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="layers" hint="按记忆强度分层">记忆分布</SectionTitle>
            {/* stacked proportion bar */}
            <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'rgba(159,198,255,0.08)', marginBottom: 16 }}>
              {total > 0 && counts.map(b => b.n > 0 && (
                <div key={b.key} title={`${b.t} · ${b.n}`} style={{ width: `${b.n / total * 100}%`, background: b.c, boxShadow: b.key === 'solid' ? '0 0 8px rgba(255,217,138,0.5)' : 'none' }} />
              ))}
            </div>
            <div className="sr-ck-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {counts.map(b => (
                <div key={b.key} style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(159,198,255,0.03)', padding: '12px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: b.c, boxShadow: `0 0 6px ${b.c}` }} />
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{b.t}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 200, color: 'var(--text-1)', lineHeight: 1.1, marginTop: 8 }}>{b.n}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* forecast + heatmap row */}
        <div className="sr-ck-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* 时间之窗 · 未来 7 天预演 */}
          <GlassPanel data-tour="checkup-window" radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="calendar-clock" hint={fRows.length ? '按剩余天数升序' : undefined}>时间之窗 · 未来 7 天</SectionTitle>
            {fRows.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                未来 7 天你的星空安然无恙 ✦
              </div>
            )}
            {fRows.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 10 }}>
                若这 7 天不回望，将有
                {fEmberN > 0 && <> <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 500 }}>{fEmberN}</b> 颗星熄灭</>}
                {fEmberN > 0 && fDueN > 0 && '、'}
                {fDueN > 0 && <> <b style={{ fontFamily: 'var(--font-mono)', color: 'var(--star-blue)', fontWeight: 500 }}>{fDueN}</b> 颗到期</>}
                。
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fShown.map(({ s, t, kind }) => {
                const days = Math.max(1, Math.ceil((t - now) / DAY_MS));
                const col = kind === 'ember' ? emberUrgency(days) : 'var(--star-blue)';
                const queued = queuedToday(s, now);
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 'var(--r-md)',
                    border: '1px solid ' + (kind === 'ember' ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'var(--glass-border)'),
                    background: kind === 'ember' ? 'color-mix(in srgb, var(--gold) 4%, transparent)' : 'rgba(120,150,205,0.05)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: col, boxShadow: `0 0 7px ${col}` }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{D.conName(s.con) || '—'}</span>
                        <span style={{ fontSize: 11, color: col }}>· {days} 天后{kind === 'ember' ? '熄灭' : '到期'}</span>
                      </div>
                    </div>
                    <div style={{ width: 52, flex: 'none' }}><MemoryBar value={s.strength} height={4} fading={s.strength < 0.4} /></div>
                    {queued
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)' }}>
                          <Icon name="check" size={12} color="var(--gold)" />已排入今日
                        </span>
                      : <Button size="sm" icon="repeat" onClick={() => queueToday(s.id)} style={{ flex: 'none' }}>排入复习</Button>}
                  </div>
                );
              })}
            </div>
            {fRows.length > 8 && (
              <Button variant="ghost" size="sm" icon={foreOpen ? 'chevron-up' : 'chevron-down'}
                onClick={() => setForeOpen(v => !v)} style={{ marginTop: 8 }}>
                {foreOpen ? '收起' : `还有 ${fRows.length - 8} 颗…`}
              </Button>
            )}
          </GlassPanel>

          {/* 观星热力图 */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="telescope" hint={`连续 ${D.account.streak} 天 · 共 ${activeDays} 个活动日`}
              action={<Button variant="ghost" size="sm" icon="image-down" onClick={() => shareWeeklyCard(D)}>生成周报卡</Button>}>
              观星热力图
            </SectionTitle>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* 周标尺：周一为首行 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 'none' }}>
                {['一', '', '三', '', '五', '', '日'].map((t, i) => (
                  <span key={i} style={{ width: 12, height: 12, lineHeight: '12px', fontSize: 9, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 3, minWidth: 0, overflowX: 'auto', paddingBottom: 2 }}>
                {weeks.map((col, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {col.map((d, di) => {
                      const future = d.getTime() > now;
                      const n = heat[heatDayKey(d)] || 0;
                      const a = heatAlpha(n);
                      /* 格子只靠金色浓度说话——读屏与触摸用户拿不到逐日数据。
                         role=img + aria-label 让每格在读屏浏览模式下报得出
                         「几月几日 · 几次观星」，但不进 Tab 序列（一年三百多个
                         停靠点是灾难，不是可达性）；摘要文字在图例后补上。 */
                      const dayLabel = `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${n} 次观星`;
                      return (
                        <div key={di}
                          title={future ? undefined : dayLabel}
                          {...(future ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': dayLabel })}
                          style={{ width: 12, height: 12, borderRadius: 3, background: heatBg(a),
                            boxShadow: a >= 0.6 ? '0 0 5px rgba(255,217,138,0.35)' : 'none',
                            visibility: future ? 'hidden' : 'visible' }} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
              <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginRight: 3 }}>少</span>
              {HEAT_ALPHA.map((a, i) => (
                <span key={i} style={{ width: 10, height: 10, borderRadius: 2.5, background: heatBg(a) }} />
              ))}
              <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginLeft: 3 }}>多</span>
            </div>
            {/* 热力图的非视觉等价物：总数 + 最活跃的一天（格子不逐日进 Tab 序列） */}
            {(() => {
              const days = Object.entries(heat);
              const total = days.reduce((a, [, n]) => a + n, 0);
              const busiest = days.sort((a, b) => b[1] - a[1])[0];
              const fmt = (k) => { const [y, m, d] = k.split('-'); return `${y} 年 ${m} 月 ${d} 日`; };
              const text = total === 0
                ? '近一年还没有观星记录'
                : `近一年共 ${total} 次观星` + (busiest ? `，最活跃的一天是 ${fmt(busiest[0])} · ${busiest[1]} 次` : '');
              return (
                <div role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>{text}</div>
              );
            })()}
          </GlassPanel>
        </div>

        {/* main grid */}
        <div className="sr-ck-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* per-domain health */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="orbit" hint={cons.length ? '点击飞入该星域' : undefined}>各星域健康度</SectionTitle>
            {cons.length === 0 && (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, lineHeight: 1.8 }}>
                还没有星域。写下第一颗星，体检才有对象。
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {cons.map(c => (
                <div key={c.id} onClick={() => onFocusCon && onFocusCon(c.id)} title={`在星图中聚焦 ${c.name}`}
                  role="button" tabIndex={0} className="sr-focus-ring"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocusCon && onFocusCon(c.id); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'background var(--dur-fast)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--star-blue) 8%, transparent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 92, flex: 'none', fontSize: 13, color: 'var(--text-2)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />{c.name}
                  </span>
                  <div style={{ flex: 1 }}><MemoryBar value={c.avg} height={6} fading={c.avg < 0.4} /></div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: c.avg < 0.4 ? 'var(--star-blue-dim)' : 'var(--text-2)', width: 34, textAlign: 'right' }}>{Math.round(c.avg * 100)}%</span>
                  <Icon name="chevron-right" size={15} color="var(--text-3)" />
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* most-needed review list */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="trending-down" hint={dueN > 0 ? `${dueN} 颗到期 · 优先回看` : undefined}>最需复习</SectionTitle>
            {/* 到期队列头部：进入复习会话（回忆 → 翻开 → 三档自评） */}
            {dueN > 0 && onReview && (
              <Button variant="primary" size="sm" icon="repeat" glow onClick={onReview}
                style={{ width: '100%', marginBottom: 10 }}>
                开始复习（{dueN} 颗到期）
              </Button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {urgent.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  {total === 0 ? '还没有星。回到星图写下第一颗，它会在需要时来这里等你。' : '没有到期的星，状态很好。'}
                </div>
              )}
              {urgent.map(s => {
                // 待重燃覆盖亮度四档的状态文字（与 props.status 同一口径），用暗金余烬色
                const ember = D.isEmber && D.isEmber(s);
                const b = ember ? { key: 'ember', t: '待重燃', c: 'color-mix(in srgb, var(--gold) 60%, var(--text-3))' } : band(s.strength);
                const overdue = s.props && s.props.nextReview === '已逾期';
                return (
                  <div key={s.id} onClick={() => (onFeynman ? onFeynman(s.id) : onOpenStar && onOpenStar(s.id))} title="费曼内化"
                    role="button" tabIndex={0} className="sr-focus-ring"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onFeynman ? onFeynman(s.id) : onOpenStar && onOpenStar(s.id)); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(120,150,205,0.05)', cursor: 'pointer', transition: 'background var(--dur-fast)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--star-blue) 10%, transparent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(120,150,205,0.05)'; }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: b.c, boxShadow: `0 0 7px ${b.c}` }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: D.conColor(s.con) }} />
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{D.conName(s.con)}</span>
                        <span style={{ fontSize: 11, color: b.c }}>· {b.t}</span>
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text-3)', flex: 'none' }}>
                      {(s.props && s.props.nextReview) || '—'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: b.c, width: 34, textAlign: 'right', flex: 'none' }}>{Math.round(s.strength * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </GlassPanel>

          {/* recent ignite trend */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="sparkles" hint={series.length ? '本周点亮 / 复习 / 变暗' : undefined}>近期点亮趋势</SectionTitle>
            {series.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                还没有点亮记录。第一次「融会贯通」之后，这里会亮起来。
              </div>
            )}
            {series.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <svg width="100%" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" style={{ flex: 1, height: SH }}>
                <defs>
                  <linearGradient id="sr-checkup-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,217,138,0.30)" />
                    <stop offset="100%" stopColor="rgba(255,217,138,0)" />
                  </linearGradient>
                </defs>
                {/* zero baseline */}
                <line x1={PAD} x2={SW - PAD} y1={py(0)} y2={py(0)} stroke="var(--line)" strokeDasharray="3 4" />
                {areaPts && <polygon points={areaPts} fill="url(#sr-checkup-trend)" />}
                <polyline points={linePts} fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                {series.map((p, i) => {
                  const col = p.ev.kind === 'dim' ? 'var(--star-blue-dim)' : p.ev.kind === 'review' ? 'var(--star-blue)' : 'var(--gold)';
                  return <circle key={p.ev.id} cx={px(i)} cy={py(p.v)} r="3" fill={col} stroke="var(--space-0)" strokeWidth="1.5" />;
                })}
              </svg>
              <div style={{ flex: 'none', width: 86, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 200, color: netDelta >= 0 ? 'var(--gold)' : 'var(--star-blue-dim)', lineHeight: 1 }}>
                    {netDelta >= 0 ? '+' : '−'}{Math.abs(netDelta).toFixed(2)}
                  </div>
                  <div style={{ ...HUD, marginTop: 4 }}>净光度</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'var(--text-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />点亮 {igniteN}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--star-blue)' }} />复习 {reviewN}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--star-blue-dim)' }} />变暗 {dimN}</span>
                </div>
              </div>
            </div>
            )}
          </GlassPanel>

          {/* weak-domain nudges */}
          <GlassPanel radius="lg" pad="none" style={{ padding: 18 }}>
            <SectionTitle icon="compass" hint={weakCons.length ? '点击前往' : undefined}>薄弱星域建议</SectionTitle>
            {weakCons.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                {cons.length === 0 ? '有了星域之后，这里会提醒你哪一片正在变暗。' : '各星域都还明亮，无需特别关注。'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weakCons.map(c => (
                <div key={c.id} style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)', background: 'rgba(120,150,205,0.05)', padding: '13px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, boxShadow: `0 0 7px ${c.color}` }} />
                    <span style={{ fontSize: 14, color: 'var(--text-1)' }}>{c.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--star-blue-dim)' }}>{Math.round(c.avg * 100)}%</span>
                    <div style={{ flex: 1 }} />
                    <Button variant="ghost" size="sm" icon="arrow-right" onClick={() => onFocusCon && onFocusCon(c.id)}>前往</Button>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, marginTop: 8 }}>
                    {c.dim} 颗星正在变暗{c.weakStar ? <>，最暗的是「<span onClick={() => onOpenStar && onOpenStar(c.weakStar.id)} role="button" tabIndex={0} className="sr-focus-ring" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenStar && onOpenStar(c.weakStar.id); } }} style={{ color: 'var(--star-blue)', cursor: 'pointer' }}>{c.weakStar.label}</span>」</> : null}。
                    建议优先回看这片星域，把光度找回来。
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* actions */}
        <div className="sr-ck-actions" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22 }}>
          {total === 0 ? (
            <Button variant="primary" size="md" icon="orbit" glow onClick={onClose}>
              回到星图，写下第一颗星
            </Button>
          ) : (
            <Button variant="primary" size="md" icon="repeat" glow disabled={!topUrgent}
              onClick={() => topUrgent && (onFeynman ? onFeynman(topUrgent.id) : onOpenStar && onOpenStar(topUrgent.id))}>
              去复习最暗的星{topUrgent ? `「${topUrgent.label}」` : ''}
            </Button>
          )}
          {cons[0] && (
            <Button variant="secondary" size="md" icon="compass" onClick={() => onFocusCon && onFocusCon(cons[0].id)}>
              前往最薄弱星域
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="md" icon="check" onClick={onClose}>完成体检</Button>
        </div>
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { Checkup });
