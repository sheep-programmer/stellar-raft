/* AdminConsole — 星港管理台。整页仪表盘，只有 role='admin' 的账号能进
   （侧边栏底部出现「星港管理台」入口，服务端每个 /api/admin/* 也各自守一道）。
   七个分区：总览 · 旅客 · 分享 · 会话 · 广播 · 系统 · 日志。

   一条贯穿的原则：管理台展示的每个数字都由服务端实时算出，不缓存、不估算——
   刷新按钮拿到的就是此刻这台服务器的真实状态。危险操作（停用 / 删号 / 维护模式）
   一律走二次确认，删号还要求原样敲一遍用户名。 */
const { Icon, IconButton, Button, Input, Badge, Tag, Switch, Select, Modal, toast } = window.StellarRaftDesignSystem_2866af;

/* ============================ 小工具 ============================ */

// sqlite 的 datetime('now') 是 UTC 且不带时区标记，补 Z 才不会被当成本地时间
const parseTs = (s) => (s ? Date.parse(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z')) || 0 : 0);

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const ago = (s) => {
  const t = parseTs(s);
  if (!t) return '—';
  const d = Date.now() - t;
  if (d < MIN) return '刚刚';
  if (d < HOUR) return Math.floor(d / MIN) + ' 分钟前';
  if (d < DAY) return Math.floor(d / HOUR) + ' 小时前';
  if (d < 30 * DAY) return Math.floor(d / DAY) + ' 天前';
  return new Date(t).toLocaleDateString('zh-CN');
};
const fullTime = (s) => (parseTs(s) ? new Date(parseTs(s)).toLocaleString('zh-CN') : '—');
const bytes = (n) => {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
};
const duration = (ms) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + ' 秒';
  if (s < 3600) return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时 ' + Math.floor((s % 3600) / 60) + ' 分';
  return Math.floor(s / 86400) + ' 天 ' + Math.floor((s % 86400) / 3600) + ' 小时';
};
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'));

// 全部管理请求走这里：失败统一冒一个 toast，调用方只管拿数据
const adminApi = async (path, opts) => {
  try {
    return await window.SRNet.api('/api/admin' + path, opts);
  } catch (e) {
    toast((e && e.message) || '管理接口暂不可达', { tone: 'danger', icon: 'triangle-alert' });
    throw e;
  }
};

/* 每个分区共用的取数 hook：挂载即取，返回 [data, loading, reload]。
   error 不单独出态——adminApi 已经 toast 过，界面保留上一次的可用数据。 */
function useAdminData(path, deps) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const alive = React.useRef(true);
  const load = React.useCallback(() => {
    setLoading(true);
    return adminApi(path)
      .then(d => { if (alive.current) setData(d); })
      .catch(() => { })
      .finally(() => { if (alive.current) setLoading(false); });
  }, [path]);
  React.useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, deps || [path]);   // eslint-disable-line react-hooks/exhaustive-deps
  return [data, loading, load];
}

/* ============================ 通用零件 ============================ */

const panel = { borderRadius: 'var(--r-lg)', border: '1px solid var(--glass-border)', background: 'var(--glass-bg-faint)' };
const hud = { fontSize: 10, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' };

/* 统计卡：一个大数字 + 一行注解。tone 决定数字的色温——
   gold 用于「有分量的成果」（点亮的星、管理员），blue 是常规读数，
   danger 只在真的有事时出现（被停用的账号、错误计数）。 */
function StatCard({ icon, label, value, unit, sub, tone, wide }) {
  const color = tone === 'gold' ? 'var(--gold)' : tone === 'danger' ? 'var(--danger)' : 'var(--text-1)';
  const glow = tone === 'gold' ? '0 0 18px rgba(255,217,138,0.28)' : tone === 'danger' ? '0 0 16px rgba(232,145,122,0.22)' : '0 0 16px rgba(159,198,255,0.14)';
  return (
    <div style={{ ...panel, padding: '15px 17px', flex: wide ? '1 1 100%' : '1 1 168px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <Icon name={icon} size={13} color={tone === 'gold' ? 'var(--gold)' : 'var(--star-blue)'} />
        <span style={hud}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 27, fontWeight: 300, color, textShadow: glow, fontFamily: 'var(--font-sans)', lineHeight: 1.1 }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 7, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

// 分区标题：图标 + 标题 + 右侧插槽
function SectionHead({ icon, title, note, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
      <Icon name={icon} size={15} color="var(--star-blue)" />
      <span style={{ fontSize: 14.5, color: 'var(--text-1)', fontWeight: 300 }}>{title}</span>
      {note && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{note}</span>}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// 头像圆片：与侧边栏 UserChip 同一枚，管理员镀金边
function Avatar({ user, size }) {
  const s = size || 30;
  const admin = user.role === 'admin';
  return (
    <span style={{
      width: s, height: s, flex: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: s * 0.42, color: 'var(--text-1)',
      background: admin ? 'linear-gradient(140deg, #5a4520, #8d6c2c)' : 'linear-gradient(140deg, #2a3566, #56689c)',
      border: '1px solid ' + (admin ? 'rgba(255,217,138,0.42)' : 'var(--glass-border-strong)'),
      opacity: user.banned ? 0.45 : 1,
      filter: user.banned ? 'grayscale(0.7)' : 'none',
    }}>{user.avatar || '星'}</span>
  );
}

// 角色 / 状态徽章组
function UserBadges({ u }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
      {u.role === 'admin' && <Badge tone="gold">管理员</Badge>}
      {!u.registered && <Badge tone="neutral">匿名</Badge>}
      {u.banned && <Badge tone="fading">已停用</Badge>}
    </span>
  );
}

// 空态：不留白板，说清「这里为什么是空的」
function Empty({ icon, text }) {
  return (
    <div style={{ padding: '46px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
      <Icon name={icon || 'telescope'} size={26} color="var(--text-disabled)" />
      <div style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function Loading({ text }) {
  return (
    <div style={{ padding: '46px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
      <span className="sr-admin-pulse">{text || '正在读取星港状态…'}</span>
    </div>
  );
}

// 一行「键 — 值」，系统页与详情页共用
function Row({ k, v, mono, tone }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)', flex: 'none' }}>{k}</span>
      <span style={{
        fontSize: 12.5, color: tone === 'danger' ? 'var(--danger)' : tone === 'gold' ? 'var(--gold)' : 'var(--text-1)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', textAlign: 'right', wordBreak: 'break-all',
      }}>{v}</span>
    </div>
  );
}

/* 比例条：一条 hairline 里按份额铺色块，用来把「注册/匿名」这类分解
   一眼看完，不必读两个数字再心算。 */
function SplitBar({ parts }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(159,198,255,0.08)' }}>
        {parts.map((p, i) => (
          <span key={i} style={{ width: (p.value / total * 100) + '%', background: p.color, transition: 'width var(--dur-base)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 9 }}>
        {parts.map((p, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--text-2)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flex: 'none' }} />
            {p.label} <span style={{ color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{num(p.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* 趋势条：每天一根，高度按当日计数占区间峰值的比例。
   没有平滑、没有插值——某天是 0 就画成一条底线，因为它确实是 0。
   与体检页的观星热力图同一套视觉语汇（冷蓝 = 有活动，越亮越多）。 */
function TrendBars({ buckets, field, color, label }) {
  const peak = Math.max(1, ...buckets.map(b => b[field]));
  const total = buckets.reduce((a, b) => a + b[field], 0);
  return (
    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={hud}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
          {num(total)} <span style={{ color: 'var(--text-3)' }}>· 峰值 {peak}</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 52 }}>
        {buckets.map((b, i) => {
          const v = b[field];
          const h = v ? Math.max(3, Math.round(v / peak * 52)) : 1;
          return (
            <span key={b.day} title={`${b.day} · ${v}`}
              style={{
                flex: 1, minWidth: 0, height: h, borderRadius: 2,
                background: v ? color : 'rgba(159,198,255,0.10)',
                opacity: v ? 0.45 + 0.55 * (v / peak) : 1,
                transition: 'height var(--dur-base) var(--ease-flight)',
              }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        <span>{buckets[0] && buckets[0].day.slice(5)}</span>
        <span>今天</span>
      </div>
    </div>
  );
}

/* ============================ 总览 ============================ */

/* 翻页条：所有名单共用一副。只有一页就整条不出现——
   一个永远点不动的「1 / 1」除了占地方没有别的作用。
   两端各给一个跳到首/末页的键：日志翻到第 30 页想回头时，不必按住上一页不放。 */
function AdmPager({ d, page, onGo, unit = '条' }) {
  if (!d || !(d.pages > 1)) return null;
  return (
    <div className="sr-adm-pager" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
      <IconButton name="chevrons-left" title="第一页" disabled={page <= 1} onClick={() => onGo(1)} />
      <IconButton name="chevron-left" title="上一页" disabled={page <= 1} onClick={() => onGo(page - 1)} />
      <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', minWidth: 92, textAlign: 'center' }}>
        {page} / {d.pages}
        <span style={{ color: 'var(--text-3)' }}> · {d.total} {unit}</span>
      </span>
      <IconButton name="chevron-right" title="下一页" disabled={page >= d.pages} onClick={() => onGo(page + 1)} />
      <IconButton name="chevrons-right" title="最后一页" disabled={page >= d.pages} onClick={() => onGo(d.pages)} />
    </div>
  );
}

function AdminOverview({ onGoto }) {
  const [d, loading, reload] = useAdminData('/overview');
  const [trend] = useAdminData('/trends?days=14');
  // 系统读数每 10 秒自刷一次：管理台开着不动的时候，uptime 与内存也是活的
  React.useEffect(() => {
    const t = setInterval(reload, 10000);
    return () => clearInterval(t);
  }, [reload]);

  if (!d) return loading ? <Loading /> : <Empty icon="server-crash" text="读不到服务器状态，检查后端是否还在运行。" />;
  const u = d.users, k = d.knowledge, s = d.social, sys = d.system;
  const litRatio = k.stars ? Math.round(k.lit / k.stars * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section>
        <SectionHead icon="users" title="旅客" note="这台服务器上的人"
          right={<Button variant="ghost" size="sm" icon="arrow-right" onClick={() => onGoto('users')}>逐个查看</Button>} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <StatCard icon="user" label="账号总数" value={num(u.total)} sub={`已注册 ${u.registered} · 匿名 ${u.anonymous}`} />
          <StatCard icon="sunrise" label="今日活跃" value={num(u.activeToday)} sub={`本周 ${u.activeThisWeek} 人回来过`} />
          <StatCard icon="user-plus" label="本周新增" value={num(u.newThisWeek)} tone={u.newThisWeek ? 'gold' : undefined} />
          <StatCard icon="shield" label="管理员" value={num(u.admins)} tone="gold" />
          <StatCard icon="user-x" label="已停用" value={num(u.banned)} tone={u.banned ? 'danger' : undefined} />
        </div>
        <div style={{ ...panel, padding: '14px 17px', marginTop: 12 }}>
          <div style={{ ...hud, marginBottom: 10 }}>账号构成</div>
          <SplitBar parts={[
            { label: '已注册', value: u.registered, color: 'var(--gold)' },
            { label: '匿名', value: u.anonymous, color: 'var(--star-blue-deep)' },
          ]} />
        </div>
      </section>

      {/* 近两周：三条曲线都由时间戳现算，某天没有人就是空的 */}
      {trend && (
        <section>
          <SectionHead icon="chart-no-axes-column" title="近 14 天" note="按 UTC 自然日分桶" />
          <div style={{ ...panel, padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: '20px 28px' }}>
            <TrendBars buckets={trend.buckets} field="joined" color="var(--star-blue)" label="新到访" />
            <TrendBars buckets={trend.buckets} field="registered" color="var(--gold)" label="注册" />
            <TrendBars buckets={trend.buckets} field="logins" color="var(--star-blue-dim)" label="登录" />
          </div>
        </section>
      )}

      {/* 游客治理的入口读数：名额顶满的 IP 越多，说明越多人被挡在注册前 */}
      <section>
        <SectionHead icon="user-round-search" title="游客" note="未注册的匿名旅客"
          right={<Button variant="ghost" size="sm" icon="arrow-right" onClick={() => onGoto('guests')}>游客治理</Button>} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <StatCard icon="users" label="游客账号" value={num(d.guests.total)} sub={`来自 ${num(d.guests.ips)} 个 IP`} />
          <StatCard icon="shield-alert" label="名额已满的 IP" value={num(d.guests.atLimit)}
            tone={d.guests.atLimit ? 'gold' : undefined}
            sub={d.guests.perIp ? `每 IP 上限 ${d.guests.perIp} 个` : '当前不限额'} />
          <StatCard icon="network" label="来源 IP 判定" value={d.guests.trustProxy ? '反代头' : '直连'}
            sub={d.guests.trustProxy ? 'X-Forwarded-For 首跳' : 'socket 地址'} />
        </div>
      </section>

      <section>
        <SectionHead icon="sparkles" title="知识" note="全站星空的总量" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <StatCard icon="star" label="星总数" value={num(k.stars)} sub={`分布在 ${num(k.constellations)} 个星域`} />
          <StatCard icon="flame" label="已点亮" value={num(k.lit)} tone="gold" sub={`占全站 ${litRatio}%`} />
          <StatCard icon="moon" label="待重燃" value={num(k.ember)} sub={k.ember ? '有星正在熄灭' : '没有熄灭的星'} />
          <StatCard icon="database" label="星系快照" value={bytes(k.snapshotBytes)} sub={`${k.galaxies} 片星空`} />
        </div>
      </section>

      <section>
        <SectionHead icon="telescope" title="星际" note="分享与来往"
          right={<Button variant="ghost" size="sm" icon="arrow-right" onClick={() => onGoto('shares')}>分享管理</Button>} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <StatCard icon="share-2" label="开放分享" value={num(s.sharesOpen)} sub={`累计生成 ${s.sharesTotal} 份密文`} />
          <StatCard icon="link" label="访问关系" value={num(s.friendships)} />
          <StatCard icon="mail" label="星际来信" value={num(s.mail)} />
        </div>
      </section>

      <section>
        <SectionHead icon="activity" title="运行" note="进程与磁盘"
          right={<Button variant="ghost" size="sm" icon="arrow-right" onClick={() => onGoto('system')}>系统维护</Button>} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <StatCard icon="timer" label="已运行" value={duration(sys.uptimeMs)} />
          <StatCard icon="radio" label="请求数" value={num(sys.requests)} sub={`API ${num(sys.apiRequests)} · 错误 ${sys.errors}`} tone={sys.errors ? 'danger' : undefined} />
          <StatCard icon="cpu" label="内存占用" value={bytes(sys.rss)} sub={`堆内 ${bytes(sys.heapUsed)}`} />
          <StatCard icon="hard-drive" label="数据库" value={bytes(sys.db.size + sys.db.wal + sys.db.shm)} sub={`主库 ${bytes(sys.db.size)} · WAL ${bytes(sys.db.wal)}`} />
        </div>
      </section>

      {/* 站点开关的现状速览：任何一项偏离常态都在这里显形 */}
      <section>
        <SectionHead icon="megaphone" title="站点" note="对所有人生效的开关"
          right={<Button variant="ghost" size="sm" icon="arrow-right" onClick={() => onGoto('broadcast')}>去设置</Button>} />
        <div style={{ ...panel, padding: '4px 17px 12px' }}>
          <Row k="新账号注册" v={d.site.registrationOpen ? '开放' : '已关闭'} tone={d.site.registrationOpen ? undefined : 'danger'} />
          <Row k="维护模式" v={d.site.maintenance.enabled ? '进行中 · 普通用户被挡在门外' : '未开启'} tone={d.site.maintenance.enabled ? 'danger' : undefined} />
          <Row k="全站公告" v={d.site.announcement.enabled ? d.site.announcement.text : '未发布'} tone={d.site.announcement.enabled ? 'gold' : undefined} />
        </div>
      </section>
    </div>
  );
}

/* ============================ 旅客（用户管理）============================ */

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'registered', label: '已注册' },
  { id: 'anonymous', label: '匿名' },
  { id: 'admin', label: '管理员' },
  { id: 'banned', label: '已停用' },
];
const SORTS = [
  { value: 'id', label: '按加入时间' },
  { value: 'stars', label: '按星的数量' },
  { value: 'lastSeen', label: '按最近活跃' },
  { value: 'name', label: '按名字' },
];

function AdminUsers({ meId }) {
  const [kw, setKw] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('id');
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(null);   // 展开详情的 userId

  // 搜索防抖 260ms：边打字边打服务器没必要
  React.useEffect(() => { const t = setTimeout(() => { setDebounced(kw.trim()); setPage(1); }, 260); return () => clearTimeout(t); }, [kw]);

  const path = `/users?q=${encodeURIComponent(debounced)}&filter=${filter}&sort=${sort}&page=${page}&size=20`;
  const [d, loading, reload] = useAdminData(path, [path]);

  const goto = (p) => { setPage(p); setOpen(null); };

  return (
    <div>
      <SectionHead icon="users" title="旅客" note={d ? `${num(d.total)} 个账号` : undefined}
        right={<IconButton name="refresh-cw" title="刷新" onClick={reload} />} />

      {/* 工具条：搜索 · 筛选 · 排序 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <Input icon="search" size="sm" placeholder="搜索名字 / 用户名 / 邮箱…" value={kw} onChange={(e) => setKw(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <Tag key={f.id} active={filter === f.id} onClick={() => { setFilter(f.id); setPage(1); setOpen(null); }}>{f.label}</Tag>
          ))}
        </div>
        <Select size="sm" value={sort} options={SORTS} onChange={(v) => { setSort(v); setPage(1); }} style={{ width: 148 }} />
      </div>

      {!d && loading && <Loading text="正在清点旅客…" />}
      {d && !d.users.length && <Empty icon="user-round-search" text={debounced ? `没有匹配「${debounced}」的账号。` : '这一档下还没有账号。'} />}

      {d && !!d.users.length && (
        <div style={{ ...panel, overflow: 'hidden' }}>
          {/* 表头 */}
          <div className="sr-adm-head" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid var(--line-strong)', background: 'rgba(159,198,255,0.03)' }}>
            <span style={{ ...hud, flex: '1 1 190px' }}>旅客</span>
            <span style={{ ...hud, width: 118, flex: 'none' }}>星空</span>
            <span style={{ ...hud, width: 112, flex: 'none' }}>来源 IP</span>
            <span style={{ ...hud, width: 92, flex: 'none' }}>最近活跃</span>
            <span style={{ ...hud, width: 62, flex: 'none', textAlign: 'right' }}>会话</span>
            <span style={{ width: 30, flex: 'none' }} />
          </div>
          {d.users.map(u => (
            <UserRow key={u.id} u={u} meId={meId}
              open={open === u.id} onToggle={() => setOpen(open === u.id ? null : u.id)} onChanged={reload} />
          ))}
        </div>
      )}

      <AdmPager d={d} page={page} onGo={goto} unit="个账号" />
    </div>
  );
}

/* 一行用户：折叠时是一览，展开后在同一张卡里长出详情与操作区——
   不用抽屉，视线不必离开这一行。 */
function UserRow({ u, meId, open, onToggle, onChanged }) {
  const [hover, setHover] = React.useState(false);
  const self = u.id === meId;
  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <div role="button" tabIndex={0} className="sr-focus-ring sr-adm-row"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer',
          background: open ? 'rgba(159,198,255,0.06)' : (hover ? 'rgba(159,198,255,0.035)' : 'transparent'),
          transition: 'background var(--dur-fast)',
        }}>
        <div className="sr-adm-cell sr-adm-name" style={{ flex: '1 1 190px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar user={u} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.username || u.name}
              </span>
              <UserBadges u={u} />
              {self && <Badge tone="blue">你</Badge>}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {u.username ? u.name : '未注册'}{u.email ? ' · ' + u.email : ''} · #{u.id}
            </div>
          </div>
        </div>

        <div className="sr-adm-cell" data-k="星空" style={{ width: 118, flex: 'none' }}>
          {u.stars ? (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                {u.stars} <span style={{ color: 'var(--text-3)', fontSize: 11 }}>颗</span>
                {!!u.lit && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>{u.lit} 亮</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{u.constellations} 个星域</div>
            </>
          ) : <span style={{ fontSize: 12, color: 'var(--text-disabled)' }}>空</span>}
        </div>

        {/* 来源 IP：最近一次请求的地址，与建档地址不同时把原始地址也带出来 */}
        <div className="sr-adm-cell" data-k="IP" style={{ width: 112, flex: 'none', minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: u.lastIp ? 'var(--text-2)' : 'var(--text-disabled)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {u.lastIp || '—'}
          </div>
          {u.ip && u.lastIp && u.ip !== u.lastIp && (
            <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>建档 {u.ip}</div>
          )}
        </div>

        <div className="sr-adm-cell" data-k="活跃" style={{ width: 92, flex: 'none', fontSize: 12, color: 'var(--text-2)' }}>{ago(u.lastSeen)}</div>

        <div className="sr-adm-cell" data-k="会话" style={{ width: 62, flex: 'none', textAlign: 'right', fontSize: 12, color: u.sessions ? 'var(--star-blue)' : 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>
          {u.sessions || '—'}
        </div>

        <span className="sr-adm-caret" style={{ width: 30, flex: 'none', display: 'flex', justifyContent: 'flex-end' }}>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} color="var(--text-3)" />
        </span>
      </div>

      {open && <UserDetail user={u} meId={meId} onChanged={onChanged} />}
    </div>
  );
}

/* 展开区：左边是这个人的星空实况，右边是能对他做的事。
   每个危险动作都先弹确认框，说清后果，再执行。 */
function UserDetail({ user, meId, onChanged }) {
  const [d, loading, reload] = useAdminData('/users/' + user.id, [user.id]);
  const [dialog, setDialog] = React.useState(null);   // ban | unban | role | password | profile | delete | revoke
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [confirmText, setConfirmText] = React.useState('');
  const [name, setName] = React.useState(user.name);
  const [username, setUsername] = React.useState(user.username || '');

  const self = user.id === meId;
  const close = () => { setDialog(null); setReason(''); setPw(''); setConfirmText(''); };

  // gone=true 表示这个人已经不存在了（删号）——只刷新列表，不再去取详情，
  // 否则紧跟着一个 404 会冒出「用户不存在」的错误提示，把成功盖掉
  const act = async (path, body, okMsg, gone) => {
    setBusy(true);
    try {
      await adminApi(`/users/${user.id}/${path}`, { method: 'POST', body: body || {} });
      toast(okMsg, { icon: 'check' });
      close();
      if (!gone) reload();
      onChanged();
    } catch (e) { /* adminApi 已经提示过 */ }
    finally { setBusy(false); }
  };

  const btn = { flex: '1 1 auto' };

  return (
    <div style={{ padding: '4px 16px 18px', background: 'rgba(3,4,12,0.28)', borderTop: '1px solid var(--line)' }}>
      {!d && loading && <Loading text="正在取回这片星空…" />}
      {d && (
        <div className="sr-adm-detail" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, paddingTop: 14 }}>

          {/* 左：星空实况 */}
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={{ ...hud, marginBottom: 8 }}>星空</div>
            {d.galaxy ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <MiniStat label="星" value={d.galaxy.stars} />
                  <MiniStat label="已点亮" value={d.galaxy.lit} tone="gold" />
                  <MiniStat label="待重燃" value={d.galaxy.ember} />
                  <MiniStat label="星域" value={d.galaxy.constellations} />
                  <MiniStat label="笔记" value={d.galaxy.notes} />
                  <MiniStat label="黑洞" value={d.galaxy.trash} />
                </div>
                {!!d.galaxy.breakdown.length && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {d.galaxy.breakdown.map(c => (
                      <Tag key={c.id} dot={c.color}>{c.name} · {c.count}</Tag>
                    ))}
                  </div>
                )}
                <Row k="平均记忆强度" v={Math.round(d.galaxy.avgStrength * 100) + '%'} mono />
                <Row k="快照体积" v={bytes(d.galaxy.snapshotBytes)} mono />
                <Row k="最后同步" v={`${ago(d.galaxy.updatedAt)} · v${d.galaxy.version}`} />
              </>
            ) : <div style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '6px 0 14px' }}>还没有存过任何星空。</div>}

            <div style={{ ...hud, margin: '16px 0 8px' }}>账号</div>
            <Row k="加入时间" v={fullTime(d.user.createdAt)} />
            {d.user.registeredAt && <Row k="注册时间" v={fullTime(d.user.registeredAt)} />}
            <Row k="最近活跃" v={fullTime(d.user.lastSeen)} />
            <Row k="最近登录" v={d.user.lastLogin ? fullTime(d.user.lastLogin) : '从未用密码登录过'} />
            <Row k="建档 IP" v={d.user.ip || '—'} mono />
            <Row k="最近 IP" v={d.user.lastIp || '—'} mono />
            <Row k="星系分享" v={d.share.enabled ? `${d.share.visibility === 'outline' ? '星名+大纲' : '仅星名'} · ${d.share.code}` : '未开启'} mono={d.share.enabled} />
            <Row k="访客 / 好友" v={`${d.visitors.length} / ${d.friends.length}`} mono />
            <Row k="来信" v={num(d.mail)} mono />
            {d.user.banned && <Row k="停用理由" v={d.user.banReason || '—'} tone="danger" />}

            {!!d.sessions.length && (
              <>
                <div style={{ ...hud, margin: '16px 0 8px' }}>在线会话 · {d.sessions.length}</div>
                {d.sessions.map((s, i) => (
                  <Row key={i} k={s.current ? '本次登录' : '设备 ' + (i + 1)} v={`${ago(s.lastSeen)} · 建于 ${fullTime(s.createdAt)}`} />
                ))}
              </>
            )}
          </div>

          {/* 右：操作区 */}
          <div style={{ flex: '0 1 250px', minWidth: 210 }}>
            <div style={{ ...hud, marginBottom: 10 }}>管理操作</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button variant="secondary" size="sm" icon="pen-line" style={btn} onClick={() => setDialog('profile')}>修改资料</Button>
              {d.user.registered && <Button variant="secondary" size="sm" icon="key-round" style={btn} onClick={() => setDialog('password')}>重置密码</Button>}
              <Button variant="secondary" size="sm" icon="log-out" style={btn} disabled={!d.sessions.length}
                onClick={() => setDialog('revoke')}>强制下线{d.sessions.length ? ` (${d.sessions.length})` : ''}</Button>
              {d.share.enabled && (
                <Button variant="secondary" size="sm" icon="share-2" style={btn}
                  onClick={async () => { await adminApi('/shares/close', { method: 'POST', body: { userId: user.id } }); toast('已关闭这片星系的分享', { icon: 'check' }); reload(); onChanged(); }}>
                  关闭星系分享
                </Button>
              )}
              {!self && d.user.registered && (
                <Button variant="secondary" size="sm" icon={d.user.role === 'admin' ? 'shield-off' : 'shield'} style={btn}
                  onClick={() => setDialog('role')}>{d.user.role === 'admin' ? '撤销管理员' : '任命为管理员'}</Button>
              )}
              {!self && (
                <>
                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                  <Button variant="ghost" size="sm" icon={d.user.banned ? 'user-check' : 'user-x'} style={{ ...btn, color: d.user.banned ? 'var(--star-blue)' : 'var(--danger)' }}
                    onClick={() => setDialog(d.user.banned ? 'unban' : 'ban')}>{d.user.banned ? '解除停用' : '停用账号'}</Button>
                  <Button variant="ghost" size="sm" icon="trash-2" style={{ ...btn, color: 'var(--danger)' }}
                    onClick={() => setDialog('delete')}>删除账号</Button>
                </>
              )}
              {self && <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 4 }}>这是你自己的账号——停用、删除与角色变更都不对自己开放。</div>}
            </div>
          </div>
        </div>
      )}

      {/* ——— 确认对话框 ——— */}

      <Modal open={dialog === 'profile'} onClose={close} title="修改资料" icon="pen-line" width={420}
        footer={<><Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy} onClick={() => act('profile', { name, avatar: (name.trim()[0] || '星'), username: username || undefined }, '资料已更新')}>保存</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ ...hud, marginBottom: 6 }}>昵称</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="昵称" />
          </div>
          {user.registered && (
            <div>
              <div style={{ ...hud, marginBottom: 6 }}>用户名（登录用）</div>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.6 }}>改动用户名后，对方要用新的用户名登录。</div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={dialog === 'password'} onClose={close} title="重置密码" icon="key-round" width={420}
        footer={<><Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy || pw.length < 6} onClick={() => act('password', { password: pw }, '密码已重置，该账号全部会话已断开')}>重置</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 12 }}>
          给 <b style={{ color: 'var(--text-1)' }}>{user.username || user.name}</b> 设一个新密码。旧的登录会话会全部断开，需要用新密码重新登录。
        </div>
        <Input type="password" icon="lock" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="新密码（至少 6 位）" autoFocus />
      </Modal>

      <Modal open={dialog === 'revoke'} onClose={close} title="强制下线" icon="log-out" width={400}
        footer={<><Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy} onClick={() => act('revoke', {}, '已断开该账号的全部登录')}>断开全部会话</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
          断开 <b style={{ color: 'var(--text-1)' }}>{user.username || user.name}</b> 在所有设备上的登录。
          对方下次操作时会被要求重新登录，星空数据不受影响。
        </div>
      </Modal>

      <Modal open={dialog === 'role'} onClose={close} title={user.role === 'admin' ? '撤销管理员' : '任命为管理员'} icon="shield" width={420}
        footer={<><Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy}
            onClick={() => act('role', { role: user.role === 'admin' ? 'user' : 'admin' }, user.role === 'admin' ? '已撤销管理员' : '已任命为管理员')}>确认</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
          {user.role === 'admin'
            ? <>撤销后 <b style={{ color: 'var(--text-1)' }}>{user.username}</b> 将失去管理台的全部权限，账号与星空保持原样。</>
            : <><b style={{ color: 'var(--text-1)' }}>{user.username}</b> 将能进入星港管理台，看到全站数据，并能停用或删除其他账号——这份权柄只交给你信得过的人。</>}
        </div>
      </Modal>

      <Modal open={dialog === 'ban'} onClose={close} title="停用账号" icon="user-x" width={430}
        footer={<><Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy} onClick={() => act('ban', { banned: true, reason }, '账号已停用')}>停用</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 12 }}>
          停用后 <b style={{ color: 'var(--text-1)' }}>{user.username || user.name}</b> 立刻被踢下线且无法再登录，会看到你写的这句理由。
          星空数据完整保留，随时可以解除。
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="停用理由（对方可见，选填）" autoFocus />
      </Modal>

      <Modal open={dialog === 'unban'} onClose={close} title="解除停用" icon="user-check" width={400}
        footer={<><Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy} onClick={() => act('ban', { banned: false }, '已解除停用')}>解除</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
          恢复 <b style={{ color: 'var(--text-1)' }}>{user.username || user.name}</b> 的登录。对方需要重新登录一次。
        </div>
      </Modal>

      <Modal open={dialog === 'delete'} onClose={close} title="删除账号" icon="trash-2" width={440}
        footer={<><Button variant="ghost" onClick={close}>取消</Button>
          <Button variant="primary" disabled={busy || confirmText !== (user.username || user.name)}
            onClick={() => act('delete', { confirm: confirmText }, '账号与其全部数据已删除', true)}>永久删除</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.7, marginBottom: 6 }}>
          这一步不可撤销，星图的黑洞也捞不回来。
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 12 }}>
          将连同这个账号的星系快照、分享密文、全部访问关系与星际来信一并抹除
          {user.stars ? <>——那是 <b style={{ color: 'var(--text-1)' }}>{user.stars} 颗星</b>。</> : '。'}
          若只是想让对方进不来，用「停用账号」，数据会留着。
        </div>
        <div style={{ ...hud, marginBottom: 6 }}>输入「{user.username || user.name}」以确认</div>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={user.username || user.name} autoFocus />
      </Modal>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 5, padding: '5px 10px', borderRadius: 'var(--r-pill)',
      border: '1px solid var(--line-strong)', background: 'var(--input-bg, rgba(3,4,12,0.45))',
    }}>
      <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: tone === 'gold' ? 'var(--gold)' : 'var(--text-1)' }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</span>
    </span>
  );
}

/* ============================ 游客 ============================ */

const GATE_ITEMS = [
  { id: 'editor', label: '写笔记', icon: 'pen-line', note: '打开块编辑器（前端门禁：拦的是入口）' },
  { id: 'vault', label: 'Markdown 仓库进出', icon: 'folder-down', note: '导出 / 导入整片星空（前端门禁）' },
  { id: 'share', label: '分享星系', icon: 'radio-tower', note: '生成密文把星系开出去（服务端硬拦）' },
  { id: 'visit', label: '星际漫游', icon: 'telescope', note: '造访好友、收纳与来信（服务端硬拦）' },
];

function AdminGuests() {
  const [page, setPage] = React.useState(1);
  const [d, loading, reload] = useAdminData(`/guests?idleDays=7&page=${page}&size=10`, [page]);
  const [site, , reloadSite] = useAdminData('/site');
  const [openIp, setOpenIp] = React.useState(null);
  const [perIp, setPerIp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [purge, setPurge] = React.useState(null);   // { ip } | { all: true }

  React.useEffect(() => { if (site) setPerIp(String(site.guestPerIp)); }, [site]);

  const saveSite = async (patch, msg) => {
    setBusy(true);
    try { await adminApi('/site', { method: 'POST', body: patch }); toast(msg, { icon: 'check' }); reloadSite(); reload(); }
    catch (e) { /* 已提示 */ }
    finally { setBusy(false); }
  };

  const runPurge = async () => {
    setBusy(true);
    try {
      const r = await adminApi('/guests/purge', { method: 'POST', body: { idleDays: 7, ip: purge.ip || undefined } });
      toast(r.removed ? `已清理 ${r.removed} 个空游客` : '没有符合条件的空游客', { icon: 'check' });
      setPurge(null); reload();
    } catch (e) { /* 已提示 */ }
    finally { setBusy(false); }
  };

  const rows = (d && d.rows) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      <section>
        <SectionHead icon="user-round-search" title="游客" note={d ? `${num(d.guests)} 个账号 · ${num(d.ips)} 个来源` : undefined}
          right={<IconButton name="refresh-cw" title="刷新" onClick={reload} />} />
        {d && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <StatCard icon="users" label="游客账号" value={num(d.guests)} />
            <StatCard icon="network" label="来源 IP" value={num(d.ips)} />
            <StatCard icon="wind" label="空游客" value={num(d.zombies)} tone={d.zombies ? 'gold' : undefined}
              sub="从没存过星系，且 7 天没露面" />
          </div>
        )}
      </section>

      {/* 限额 */}
      <section>
        <SectionHead icon="shield-alert" title="每个 IP 允许几个游客" />
        <div style={{ ...panel, padding: 17 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.75, marginBottom: 14 }}>
            超出限额的新访客会被挡在门外，并被请去登录或注册——注册之后账号不再算游客，
            这个 IP 的名额立刻释放。填 <b style={{ color: 'var(--text-1)' }}>0</b> 表示不限。
            {d && !d.trustProxy && (
              <><br />当前按 <b style={{ color: 'var(--text-1)' }}>socket 直连地址</b> 判定来源。
                如果星图跑在 nginx / Caddy 之类的反向代理后面，所有人都会长着同一个 IP——
                那种情况下要用 <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>SR_TRUST_PROXY=1</code> 启动，
                否则整台服务器会被锁成一个游客。</>
            )}
            {d && d.trustProxy && (
              <><br />当前信任 <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>X-Forwarded-For</code> 的第一跳——
                请确认前面确实有一层你自己的反向代理，否则这个头可以被伪造。</>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 110 }}>
              <Input type="number" size="sm" value={perIp} onChange={(e) => setPerIp(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" icon="save" disabled={busy || site == null || String(site.guestPerIp) === perIp}
              onClick={() => saveSite({ guestPerIp: Number(perIp) || 0 }, Number(perIp) > 0 ? `每 IP 最多 ${Number(perIp)} 个游客` : '已取消游客限额')}>
              保存
            </Button>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
              {site ? (site.guestPerIp > 0 ? `当前：每 IP ${site.guestPerIp} 个` : '当前：不限') : ''}
            </span>
          </div>
        </div>
      </section>

      {/* 功能门禁 */}
      <section>
        <SectionHead icon="lock" title="哪些功能需要账号" note="只对游客生效" />
        <div style={{ ...panel, padding: '6px 17px 14px' }}>
          {GATE_ITEMS.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: i === GATE_ITEMS.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <Icon name={g.icon} size={15} color={site && site.guestGates[g.id] ? 'var(--gold)' : 'var(--text-3)'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{g.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.55 }}>{g.note}</div>
              </div>
              <Switch checked={!!(site && site.guestGates[g.id])} disabled={busy || !site}
                onChange={(v) => saveSite({ guestGates: { [g.id]: v } }, v ? `「${g.label}」现在需要账号` : `「${g.label}」已对游客开放`)}
                label={site && site.guestGates[g.id] ? '需要账号' : '游客可用'} />
            </div>
          ))}
        </div>
      </section>

      {/* 按 IP 的游客名单 */}
      <section>
        <SectionHead icon="network" title="按来源 IP" note={d ? `${d.ips} 个地址` : undefined}
          right={d && d.zombies ? (
            <Button variant="ghost" size="sm" icon="brush-cleaning" onClick={() => setPurge({ all: true })}>
              清理全部空游客 ({d.zombies})
            </Button>
          ) : undefined} />

        {!d && loading && <Loading text="正在清点游客…" />}
        {d && !rows.length && <Empty icon="user-round-search" text="还没有匿名游客——所有人都注册了账号。" />}

        {d && !!rows.length && (
          <div style={{ ...panel, overflow: 'hidden' }}>
            {rows.map((r, i) => {
              const open = openIp === r.ip;
              const full = d.limit > 0 && r.count >= d.limit;
              return (
                <div key={r.ip} style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)' }}>
                  <div role="button" tabIndex={0} className="sr-focus-ring sr-adm-row"
                    onClick={() => setOpenIp(open ? null : r.ip)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenIp(open ? null : r.ip); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: open ? 'rgba(159,198,255,0.06)' : 'transparent' }}>
                    <span className="sr-adm-cell"><Icon name="network" size={15} color={full ? 'var(--gold)' : 'var(--star-blue)'} /></span>
                    <span className="sr-adm-cell sr-adm-name" style={{ flex: '1 1 140px', minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)' }}>{r.ip}</span>
                    <span className="sr-adm-cell" style={{ width: 92, flex: 'none', fontSize: 12, color: 'var(--text-2)' }}>
                      {r.count} 个游客{full && <span style={{ color: 'var(--gold)' }}> · 满</span>}
                    </span>
                    <span className="sr-adm-cell" style={{ width: 76, flex: 'none', fontSize: 12, color: r.stars ? 'var(--text-2)' : 'var(--text-disabled)' }}>{r.stars} 颗星</span>
                    <span className="sr-adm-cell" style={{ width: 84, flex: 'none', fontSize: 12, color: r.zombies ? 'var(--gold)' : 'var(--text-disabled)' }}>
                      {r.zombies ? r.zombies + ' 个空' : '—'}
                    </span>
                    <span className="sr-adm-cell" style={{ width: 96, flex: 'none', fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>{ago(r.lastSeen)}</span>
                    <span className="sr-adm-cell" style={{ width: 26, flex: 'none', display: 'flex', justifyContent: 'flex-end' }}>
                      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} color="var(--text-3)" />
                    </span>
                  </div>

                  {open && (
                    <div style={{ padding: '4px 16px 16px', background: 'rgba(3,4,12,0.28)' }}>
                      {r.guests.map(g => (
                        <div key={g.id} className="sr-adm-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                          <span className="sr-adm-cell"><Avatar user={g} size={24} /></span>
                          <span className="sr-adm-cell sr-adm-name" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-1)' }}>
                            {g.name} <span style={{ color: 'var(--text-3)' }}>#{g.id}</span>
                            {g.zombie && <span style={{ color: 'var(--text-3)' }}> · 空账号</span>}
                            {g.banned && <span style={{ color: 'var(--danger)' }}> · 已停用</span>}
                          </span>
                          <span className="sr-adm-cell" style={{ width: 70, flex: 'none', fontSize: 12, color: g.stars ? 'var(--text-2)' : 'var(--text-disabled)' }}>{g.stars} 颗星</span>
                          <span className="sr-adm-cell" style={{ width: 92, flex: 'none', fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>{ago(g.lastSeen || g.createdAt)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 9, marginTop: 12, alignItems: 'center' }}>
                        <Button variant="ghost" size="sm" icon="brush-cleaning" disabled={!r.zombies}
                          onClick={() => setPurge({ ip: r.ip })}>
                          {r.zombies ? `清理这个 IP 的 ${r.zombies} 个空游客` : '没有可清理的空账号'}
                        </Button>
                        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>存过星空的账号不在清理范围内</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={!!purge} onClose={() => setPurge(null)} title="清理空游客" icon="brush-cleaning" width={430}
        footer={<><Button variant="ghost" onClick={() => setPurge(null)}>取消</Button>
          <Button variant="primary" disabled={busy} onClick={runPurge}>清理</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.75 }}>
          将删除{purge && purge.ip ? <> <b style={{ color: 'var(--text-1)' }}>{purge.ip}</b> 下</> : '全站'}
          <b style={{ color: 'var(--text-1)' }}>从没存过任何星系、且 7 天没有露面</b>的匿名账号。
          <br />存过星空的游客一个都不会动——哪怕只有一颗星。
          {purge && purge.ip && <><br />清理之后这个 IP 的游客名额随即空出来。</>}
        </div>
      </Modal>

      <AdmPager d={d} page={page} onGo={setPage} unit="个地址" />
    </div>
  );
}

/* ============================ 分享 ============================ */

function AdminShares() {
  const [page, setPage] = React.useState(1);
  const [d, loading, reload] = useAdminData(`/shares?page=${page}&size=20`, [page]);
  const [closing, setClosing] = React.useState(null);

  const close = async (row) => {
    await adminApi('/shares/close', { method: 'POST', body: { userId: row.userId } });
    toast('已关闭这片星系的对外分享', { icon: 'check' });
    setClosing(null); reload();
  };

  const rows = (d && d.shares) || [];
  const open = rows.filter(r => r.enabled);

  return (
    <div>
      <SectionHead icon="share-2" title="星系分享" note={d ? `${open.length} 片星系正对外开放` : undefined}
        right={<IconButton name="refresh-cw" title="刷新" onClick={reload} />} />
      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 14 }}>
        分享由星系主人自己开启。这里能看到谁开着、开到什么程度，必要时可以强制关闭——
        密文会保留，主人随时能自己再打开。
      </div>

      {!d && loading && <Loading />}
      {d && !rows.length && <Empty icon="share-2" text="还没有人开启星系分享。" />}

      {d && !!rows.length && (
        <div style={{ ...panel, overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <div key={r.userId} className="sr-adm-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)' }}>
              <span className="sr-adm-cell"><Avatar user={r} /></span>
              <div className="sr-adm-cell sr-adm-name" style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.username || r.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  {r.enabled ? (r.visibility === 'outline' ? '星名 + 标签 + 大纲' : '仅星名与星域') : '已关闭'}
                </div>
              </div>
              <span className="sr-adm-cell" data-k="密文" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.enabled ? 'var(--gold)' : 'var(--text-disabled)', flex: 'none' }}>{r.code}</span>
              <span className="sr-adm-cell" style={{ width: 76, flex: 'none', textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>{r.visitors} 位访客</span>
              <span className="sr-adm-cell" style={{ width: 92, flex: 'none', display: 'flex', justifyContent: 'flex-end' }}>
                {r.enabled
                  ? <Button variant="ghost" size="sm" icon="eye-off" onClick={() => setClosing(r)}>关闭</Button>
                  : <Badge tone="neutral">未开放</Badge>}
              </span>
            </div>
          ))}
        </div>
      )}


      <AdmPager d={d} page={page} onGo={setPage} unit="片星系" />

      <Modal open={!!closing} onClose={() => setClosing(null)} title="强制关闭分享" icon="eye-off" width={420}
        footer={<><Button variant="ghost" onClick={() => setClosing(null)}>取消</Button>
          <Button variant="primary" onClick={() => close(closing)}>关闭分享</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
          关闭后，持有密文的访客将无法再造访 <b style={{ color: 'var(--text-1)' }}>{closing && (closing.username || closing.name)}</b> 的星系。
          密文本身保留，主人可以在自己的设置里重新开启。
        </div>
      </Modal>
    </div>
  );
}

/* ============================ 会话 ============================ */

function AdminSessions() {
  const [page, setPage] = React.useState(1);
  const [d, loading, reload] = useAdminData(`/sessions?page=${page}&size=20`, [page]);
  const rows = (d && d.sessions) || [];
  return (
    <div>
      <SectionHead icon="monitor-smartphone" title="登录会话" note={d ? `${d.total} 个活跃会话` : undefined}
        right={<IconButton name="refresh-cw" title="刷新" onClick={reload} />} />
      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 14 }}>
        每一行是一台登录过的设备。令牌只显示一小段指纹（完整令牌永不出库）；
        要断开某个人的登录，去「旅客」里对他用「强制下线」。
      </div>

      {!d && loading && <Loading />}
      {d && !rows.length && <Empty icon="monitor-off" text="当前没有任何登录会话。" />}

      {d && !!rows.length && (
        <div style={{ ...panel, overflow: 'hidden' }}>
          {rows.map((s, i) => (
            <div key={i} className="sr-adm-row" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
              borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)',
              background: s.current ? 'rgba(255,217,138,0.05)' : 'transparent',
            }}>
              <span className="sr-adm-cell"><Avatar user={s} size={26} /></span>
              <div className="sr-adm-cell sr-adm-name" style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{s.username || s.name}</span>
                  {s.role === 'admin' && <Badge tone="gold">管理员</Badge>}
                  {s.current && <Badge tone="blue">当前设备</Badge>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {s.fingerprint}{s.ip ? ' · ' + s.ip : ''}
                </div>
              </div>
              <span className="sr-adm-cell" style={{ width: 120, flex: 'none', fontSize: 12, color: 'var(--text-2)' }}>活跃于 {ago(s.lastSeen)}</span>
              <span className="sr-adm-cell" style={{ width: 130, flex: 'none', fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>登录于 {ago(s.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      <AdmPager d={d} page={page} onGo={setPage} unit="个会话" />
    </div>
  );
}

/* ============================ 广播 ============================ */

const TONES = [
  { value: 'info', label: '寻常 · 冷蓝' },
  { value: 'warn', label: '提醒 · 暖金' },
  { value: 'danger', label: '要紧 · 警示' },
];

function AdminBroadcast() {
  const [d, loading, reload] = useAdminData('/site');
  const [text, setText] = React.useState('');
  const [tone, setTone] = React.useState('info');
  const [enabled, setEnabled] = React.useState(false);
  const [regOpen, setRegOpen] = React.useState(true);
  const [maint, setMaint] = React.useState(false);
  const [maintMsg, setMaintMsg] = React.useState('');
  const [confirmMaint, setConfirmMaint] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // 服务端为准：取回后一次性灌进表单（之后随用户编辑走）
  React.useEffect(() => {
    if (!d) return;
    setText(d.announcement.text || '');
    setTone(d.announcement.tone || 'info');
    setEnabled(!!d.announcement.enabled);
    setRegOpen(!!d.registrationOpen);
    setMaint(!!d.maintenance.enabled);
    setMaintMsg(d.maintenance.message || '');
  }, [d]);

  const save = async (patch, msg) => {
    setBusy(true);
    try { await adminApi('/site', { method: 'POST', body: patch }); toast(msg, { icon: 'check' }); reload(); }
    catch (e) { /* 已提示 */ }
    finally { setBusy(false); }
  };

  if (!d && loading) return <Loading />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* 全站公告 */}
      <section>
        <SectionHead icon="megaphone" title="全站公告" note="所有人打开星图时看到的一条横幅" />
        <div style={{ ...panel, padding: 17 }}>
          <div style={{ ...hud, marginBottom: 7 }}>公告内容</div>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：本周日 02:00 服务器维护，届时星图会短暂不可用。" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginTop: 14 }}>
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ ...hud, marginBottom: 6 }}>语气</div>
              <Select size="sm" value={tone} options={TONES} onChange={setTone} style={{ width: 148 }} />
            </div>
            <div style={{ flex: 1, minWidth: 140, paddingTop: 16 }}>
              <Switch checked={enabled} onChange={setEnabled} label={enabled ? '正在展示' : '暂不展示'} />
            </div>
          </div>

          {/* 实时预览：管理员按下保存前就看到用户会看到的样子 */}
          <div style={{ ...hud, margin: '18px 0 8px' }}>预览</div>
          {text.trim()
            ? <AnnouncementBanner announcement={{ text: text.trim(), tone }} preview />
            : <div style={{ fontSize: 12, color: 'var(--text-disabled)', padding: '10px 0' }}>写点什么，这里会显示用户看到的样子。</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="primary" size="sm" icon="send" disabled={busy}
              onClick={() => save({ announcement: { text, tone, enabled } }, enabled && text.trim() ? '公告已发布' : '公告已保存')}>
              保存公告
            </Button>
            {d && d.announcement.enabled && (
              <Button variant="ghost" size="sm" icon="eye-off" disabled={busy}
                onClick={() => { setEnabled(false); save({ announcement: { text, tone, enabled: false } }, '公告已撤下'); }}>撤下</Button>
            )}
            {d && d.announcement.updatedAt && (
              <span style={{ fontSize: 11.5, color: 'var(--text-3)', alignSelf: 'center' }}>
                上次更新 {ago(d.announcement.updatedAt.replace('T', ' ').slice(0, 19))}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 注册开关 */}
      <section>
        <SectionHead icon="user-plus" title="新账号注册" />
        <div style={{ ...panel, padding: 17, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
            关闭后，新访客仍可以匿名试用星图，但无法注册成账号。已有账号不受影响。
          </div>
          <Switch checked={regOpen} onChange={(v) => { setRegOpen(v); save({ registrationOpen: v }, v ? '已开放注册' : '已关闭注册'); }}
            label={regOpen ? '开放注册' : '已关闭'} />
        </div>
      </section>

      {/* 维护模式 */}
      <section>
        <SectionHead icon="construction" title="维护模式" />
        <div style={{ ...panel, padding: 17, border: maint ? '1px solid rgba(232,145,122,0.34)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
              开启后，除管理员外所有人的请求都会被挡下并看到下面这句话。
              本地已经打开的星图仍能离线编辑，恢复后自动补写——不会丢数据。
            </div>
            <Switch checked={maint} onChange={(v) => { if (v) { setConfirmMaint(true); } else { setMaint(false); save({ maintenance: { enabled: false, message: maintMsg } }, '维护模式已结束'); } }}
              label={maint ? '维护中' : '未开启'} />
          </div>
          <div style={{ ...hud, margin: '16px 0 7px' }}>维护说明</div>
          <Input value={maintMsg} onChange={(e) => setMaintMsg(e.target.value)} placeholder="星图正在维护，稍后回来看看。" />
          <Button variant="secondary" size="sm" icon="save" style={{ marginTop: 12 }} disabled={busy}
            onClick={() => save({ maintenance: { enabled: maint, message: maintMsg } }, '维护说明已保存')}>保存说明</Button>
        </div>
      </section>

      <Modal open={confirmMaint} onClose={() => setConfirmMaint(false)} title="开启维护模式" icon="construction" width={430}
        footer={<><Button variant="ghost" onClick={() => setConfirmMaint(false)}>取消</Button>
          <Button variant="primary" onClick={() => { setMaint(true); setConfirmMaint(false); save({ maintenance: { enabled: true, message: maintMsg } }, '维护模式已开启'); }}>开启</Button></>}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
          开启后，<b style={{ color: 'var(--text-1)' }}>除管理员外的所有人</b>都会被挡在门外，正在使用的人下一次同步就会看到维护提示。
          记得办完事回来关掉它。
        </div>
      </Modal>
    </div>
  );
}

/* ============================ 系统 ============================ */

function AdminSystem() {
  const [d, loading, reload] = useAdminData('/overview');
  const [busy, setBusy] = React.useState('');
  const [confirmVacuum, setConfirmVacuum] = React.useState(false);

  React.useEffect(() => { const t = setInterval(reload, 10000); return () => clearInterval(t); }, [reload]);

  const run = async (action, msg) => {
    setBusy(action);
    try {
      const r = await adminApi('/maintenance', { method: 'POST', body: { action } });
      toast(typeof msg === 'function' ? msg(r) : msg, { icon: 'check' });
      reload();
    } catch (e) { /* 已提示 */ }
    finally { setBusy(''); setConfirmVacuum(false); }
  };

  // 备份走浏览器下载：带 token 的 URL 直接开新窗口，二进制不经过 fetch
  const backup = () => {
    const url = '/api/admin/backup?token=' + encodeURIComponent(window.SRNet.token);
    const a = document.createElement('a');
    a.href = url; a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
    toast('正在下载数据库备份…', { icon: 'download' });
  };

  if (!d && loading) return <Loading />;
  if (!d) return <Empty icon="server-crash" text="读不到服务器状态。" />;
  const sys = d.system;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <SectionHead icon="server" title="运行状态" note="每 10 秒自动刷新" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <StatCard icon="timer" label="已运行" value={duration(sys.uptimeMs)} />
          <StatCard icon="cpu" label="内存占用" value={bytes(sys.rss)} sub={`堆内 ${bytes(sys.heapUsed)}`} />
          <StatCard icon="radio" label="请求总数" value={num(sys.requests)} sub={`API ${num(sys.apiRequests)}`} />
          <StatCard icon="triangle-alert" label="错误" value={num(sys.errors)} tone={sys.errors ? 'danger' : undefined} />
        </div>
        <div style={{ ...panel, padding: '4px 17px 12px' }}>
          <Row k="Node 版本" v={sys.node} mono />
          <Row k="平台" v={sys.platform} mono />
          <Row k="进程 PID" v={sys.pid} mono />
          <Row k="监听端口" v={sys.port} mono />
        </div>
      </section>

      <section>
        <SectionHead icon="database" title="数据库" note={sys.db.path} />
        <div style={{ ...panel, padding: '4px 17px 14px' }}>
          <Row k="主库" v={bytes(sys.db.size)} mono />
          <Row k="WAL 日志" v={bytes(sys.db.wal)} mono tone={sys.db.wal > 8 * 1024 * 1024 ? 'gold' : undefined} />
          <Row k="共享内存 (SHM)" v={bytes(sys.db.shm)} mono />
          <Row k="合计占用" v={bytes(sys.db.size + sys.db.wal + sys.db.shm)} mono />
          <Row k="星系快照" v={`${d.knowledge.galaxies} 片 · ${bytes(d.knowledge.snapshotBytes)}`} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 16 }}>
            <Button variant="primary" size="sm" icon="download" onClick={backup}>下载备份</Button>
            <Button variant="secondary" size="sm" icon="fold-vertical" disabled={!!busy}
              onClick={() => run('checkpoint', 'WAL 已收进主库')}>{busy === 'checkpoint' ? '收拢中…' : '收拢 WAL'}</Button>
            <Button variant="secondary" size="sm" icon="minimize-2" disabled={!!busy}
              onClick={() => setConfirmVacuum(true)}>压缩数据库</Button>
            <Button variant="secondary" size="sm" icon="brush-cleaning" disabled={!!busy}
              onClick={() => run('prune-sessions', (r) => r.removed ? `清掉 ${r.removed} 个过期会话` : '没有过期会话')}>扫掉过期会话</Button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.7, marginTop: 12 }}>
            备份会先把 WAL 收进主库，下载到的是一个可直接替换使用的完整 .db 文件。
            压缩（VACUUM）会重建整个数据库文件回收空洞，期间短暂阻塞写入——建议在没人用的时候做。
            90 天没露面的会话在下次被使用时就地失效，这里只是顺手把那些死行从表里扫掉——不点也不影响安全。
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================ 日志 ============================ */

// 动作 → 中文说法与图标；未登记的动作原样显示，不假装认识
const ACTIONS = {
  'user.ban': { t: '停用了账号', i: 'user-x', c: 'var(--danger)' },
  'user.unban': { t: '解除了停用', i: 'user-check', c: 'var(--star-blue)' },
  'user.promote': { t: '任命了管理员', i: 'shield', c: 'var(--gold)' },
  'user.demote': { t: '撤销了管理员', i: 'shield-off', c: 'var(--text-2)' },
  'user.password': { t: '重置了密码', i: 'key-round', c: 'var(--star-blue)' },
  'user.profile': { t: '修改了资料', i: 'pen-line', c: 'var(--star-blue)' },
  'user.revoke': { t: '强制下线', i: 'log-out', c: 'var(--star-blue)' },
  'user.delete': { t: '删除了账号', i: 'trash-2', c: 'var(--danger)' },
  'share.close': { t: '关闭了星系分享', i: 'eye-off', c: 'var(--star-blue)' },
  'site.update': { t: '改动了站点设置', i: 'megaphone', c: 'var(--gold)' },
  'db.checkpoint': { t: '收拢了 WAL', i: 'fold-vertical', c: 'var(--text-2)' },
  'db.vacuum': { t: '压缩了数据库', i: 'minimize-2', c: 'var(--text-2)' },
  'db.backup': { t: '下载了备份', i: 'download', c: 'var(--text-2)' },
  'db.prune-sessions': { t: '清理了过期会话', i: 'brush-cleaning', c: 'var(--text-2)' },
};

function AdminAudit() {
  const [page, setPage] = React.useState(1);
  const [d, loading, reload] = useAdminData(`/audit?page=${page}&size=20`, [page]);
  const [clearing, setClearing] = React.useState(false);
  const rows = (d && d.entries) || [];

  const clearAll = async () => {
    const r = await adminApi('/audit/clear', { method: 'POST', body: {} });
    toast(`已清空 ${r && r.removed != null ? r.removed : ''} 条日志`, { icon: 'check' });
    setClearing(false); setPage(1); reload();
  };
  return (
    <div>
      <SectionHead icon="scroll-text" title="操作日志" note={d ? `共 ${d.total} 条` : undefined}
        right={<span style={{ display: 'inline-flex', gap: 6 }}>
          <IconButton name="refresh-cw" title="刷新" onClick={reload} />
          <IconButton name="trash-2" title="清空日志" disabled={!d || !d.total} onClick={() => setClearing(true)} />
        </span>} />
      <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 14 }}>
        每一次停用、删号、改密与站点变更都留在这里，服务器只保留最近 2000 条。
      </div>

      {!d && loading && <Loading />}
      {d && !rows.length && <Empty icon="scroll-text" text="还没有任何管理操作。" />}

      {d && !!rows.length && (
        <div style={{ ...panel, padding: '6px 18px 14px' }}>
          {rows.map((e, i) => {
            const a = ACTIONS[e.action] || { t: e.action, i: 'dot', c: 'var(--text-2)' };
            return (
              <div key={e.id} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--line)' }}>
                <span style={{ flex: 'none', paddingTop: 1 }}><Icon name={a.i} size={14} color={a.c} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5 }}>
                    <b style={{ fontWeight: 400, color: 'var(--gold)' }}>{e.actor}</b>
                    <span style={{ color: 'var(--text-2)' }}> {a.t} </span>
                    {e.target && <b style={{ fontWeight: 400 }}>{e.target}</b>}
                    {e.detail && <span style={{ color: 'var(--text-3)' }}> · {e.detail}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{ago(e.at)} · {fullTime(e.at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdmPager d={d} page={page} onGo={setPage} unit="条" />

      <Modal open={clearing} onClose={() => setClearing(false)} title="清空操作日志" width={440}
        footer={<><Button variant="ghost" onClick={() => setClearing(false)}>取消</Button>
          <Button variant="danger" onClick={clearAll}>清空</Button></>}>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)' }}>
          将删除全部 <b style={{ color: 'var(--text-1)' }}>{d ? d.total : 0}</b> 条留痕，不可撤销。
          <br />清空这件事本身会作为一条新日志记下来——审计日志不该被无声抹掉。
        </div>
      </Modal>
    </div>
  );
}

/* ============================ 公告横幅 ============================ */
/* 普通用户视角的那条横幅，也用作管理台里的预览——同一个组件，
   预览就不可能与真实展示长得不一样。 */
function AnnouncementBanner({ announcement, onDismiss, preview }) {
  if (!announcement || !announcement.text) return null;
  const tone = announcement.tone || 'info';
  const skin = {
    info: { c: 'var(--star-blue)', bg: 'rgba(159,198,255,0.10)', bd: 'rgba(159,198,255,0.26)', icon: 'info' },
    warn: { c: 'var(--gold)', bg: 'rgba(255,217,138,0.10)', bd: 'rgba(255,217,138,0.30)', icon: 'triangle-alert' },
    danger: { c: 'var(--danger)', bg: 'rgba(232,145,122,0.12)', bd: 'rgba(232,145,122,0.34)', icon: 'octagon-alert' },
  }[tone];
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
      background: skin.bg, border: '1px solid ' + skin.bd, borderRadius: 'var(--r-sm)',
      WebkitBackdropFilter: 'blur(var(--glass-blur))', backdropFilter: 'blur(var(--glass-blur))',
    }}>
      <Icon name={skin.icon} size={15} color={skin.c} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.6 }}>{announcement.text}</span>
      {preview && <Badge tone="neutral">预览</Badge>}
      {onDismiss && <IconButton name="x" size="sm" title="知道了" onClick={onDismiss} />}
    </div>
  );
}

/* ============================ 主体 ============================ */

const TABS = [
  { id: 'overview', label: '总览', icon: 'layout-dashboard' },
  { id: 'users', label: '旅客', icon: 'users' },
  { id: 'guests', label: '游客', icon: 'user-round-search' },
  { id: 'shares', label: '分享', icon: 'share-2' },
  { id: 'sessions', label: '会话', icon: 'monitor-smartphone' },
  { id: 'broadcast', label: '广播', icon: 'megaphone' },
  { id: 'system', label: '系统', icon: 'server' },
  { id: 'audit', label: '日志', icon: 'scroll-text' },
];

const SR_ADMIN_CSS = `
@keyframes sr-admin-pulse { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }
.sr-admin-pulse { animation: sr-admin-pulse 1.6s ease-in-out infinite; }

/* ——— 手机 ———
   管理台的行是「表格」：定宽列在 375px 上必然挤成一坨。窄屏改成卡片式——
   行内换行、列宽作废、表头整条隐去（每格自带 data-k 标签说明自己是什么）。 */
html[data-screen="phone"] .sr-adm-head { display: none !important; }
html[data-screen="phone"] .sr-adm-row { flex-wrap: wrap !important; row-gap: 8px; padding: 12px 13px !important; }
html[data-screen="phone"] .sr-adm-cell { width: auto !important; flex: 0 0 auto !important; text-align: left !important; }
/* 每格前缀一个小标签，替代被隐去的表头 */
html[data-screen="phone"] .sr-adm-cell[data-k]::before {
  content: attr(data-k) ' '; font-family: var(--font-mono); font-size: 10px;
  letter-spacing: var(--ls-hud); text-transform: uppercase; color: var(--text-3); margin-right: 4px;
}
/* 标签是内联的，可格子里的值有的是纯文本（活跃 / 会话）、有的是块级 <div>（星空 / IP）。
   块级子元素必然另起一行，标签就被独自撂在上一行——同一行卡片里几个格子基线参差。
   把首个子元素拉回内联，让它与标签同行；第二行（「N 个星域」「建档 IP」）照旧堆在下面。 */
html[data-screen="phone"] .sr-adm-cell[data-k] > :first-child {
  display: inline-block !important; vertical-align: baseline; max-width: 100%;
}
html[data-screen="phone"] .sr-adm-name { flex: 1 1 100% !important; min-width: 0 !important; }
/* 展开箭头：卡片里的格子换行后它常被挤到新的一行，孤零零靠左像是没对齐的意外。
   推到行尾去，它才读得出「点我展开」的意思。 */
html[data-screen="phone"] .sr-adm-caret { margin-left: auto; }
/* 名字那一格里还嵌着「星名 + 标签 + 大纲」这类说明：不给它换行机会，
   它就会在被压窄时一个字一行地竖下来 */
html[data-screen="phone"] .sr-adm-name > * { white-space: normal !important; }
/* 页头：标题与「回到我的星图」在窄屏上下叠，别互相挤 */
html[data-screen="phone"] .sr-adm-head-bar { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
html[data-screen="phone"] .sr-adm-head-bar h1 { font-size: 20px !important; }
/* 分区切换在窄屏横向滚动，不折成三行 */
html[data-screen="phone"] .sr-admin-tabs {
  flex-wrap: nowrap !important; overflow-x: auto; padding-bottom: 10px !important; margin-bottom: 12px !important;
}
html[data-screen="phone"] .sr-admin-tab { flex: none; }
/* 详情区两栏 → 一栏 */
html[data-screen="phone"] .sr-adm-detail { flex-direction: column !important; }
.sr-admin-tab { display: flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; cursor: pointer;
  border-radius: var(--r-pill); border: 1px solid transparent; background: transparent; color: var(--text-2);
  font-size: 13px; font-family: var(--font-sans); white-space: nowrap;
  transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast); }
.sr-admin-tab:hover { background: rgba(159,198,255,0.06); color: var(--text-1); }
.sr-admin-tab[aria-selected="true"] { background: rgba(255,217,138,0.13); border-color: rgba(255,217,138,0.28); color: var(--gold); }
`;
function injectAdminCss() {
  if (typeof document === 'undefined' || document.getElementById('sr-admin-css')) return;
  const s = document.createElement('style'); s.id = 'sr-admin-css'; s.textContent = SR_ADMIN_CSS;
  document.head.appendChild(s);
}

function AdminConsole({ onClose }) {
  const [tab, setTab] = React.useState('overview');
  const A = (window.SR_DATA && window.SR_DATA.account) || {};
  const [defaultPass, setDefaultPass] = React.useState(!!A.defaultPass);

  React.useEffect(() => { injectAdminCss(); }, []);

  // 稳定 ref：只在分区真正重挂载（key 变化）时跑一次入场
  const sectionEnter = React.useCallback((el) => {
    const T = window.srTransition;
    if (el && T && T.enter) T.enter(el);
  }, []);

  // 出厂凭据警告：交接卡（或设置里的改密）成功后广播 sr-account，这里跟着摘掉红条
  React.useEffect(() => {
    const h = () => setDefaultPass(!!(window.SR_DATA.account || {}).defaultPass);
    window.addEventListener('sr-account', h);
    return () => window.removeEventListener('sr-account', h);
  }, []);

  // 越权兜底：非管理员不该走到这里（侧栏不给入口），真到了也只看到一句话
  if (!A.admin) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty icon="shield-off" text="这片区域只对管理员开放。" />
      </div>
    );
  }

  return (
    <div onContextMenu={(e) => e.preventDefault()}
      className="sr-view" style={{ position: 'relative', flex: 1, minWidth: 0, overflow: 'auto', padding: '22px 30px 56px' }}>

      {/* 页头 */}
      <div className="sr-adm-head-bar" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="shield" size={19} color="var(--gold)" />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 300, letterSpacing: '0.02em', color: 'var(--text-1)' }}>星港管理台</h1>
            <Badge tone="gold">{A.username || A.name}</Badge>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 7, lineHeight: 1.6 }}>
            这台服务器上的每一片星空、每一次登录、每一条来信——都在这里。
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="arrow-left" onClick={onClose}>回到我的星图</Button>
      </div>

      {/* 出厂凭据警告：正常路径上交接卡会先把人拦住，这条红字是它没能挂上时的兜底 */}
      {defaultPass && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', marginBottom: 16,
          borderRadius: 'var(--r-sm)', border: '1px solid rgba(232,145,122,0.34)', background: 'rgba(232,145,122,0.10)',
        }}>
          <Icon name="triangle-alert" size={16} color="var(--danger)" />
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.6 }}>
            管理员账号还在用出厂的用户名与密码 —— 两样都写在 README 和启动日志里。刷新页面会弹出交接卡，把它们一起换掉。
          </span>
        </div>
      )}

      {/* 分区切换 */}
      <div role="tablist" aria-label="管理分区" className="sr-admin-tabs"
        style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingBottom: 16, marginBottom: 18, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="sr-admin-tab sr-focus-ring"
            onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={14} color="currentColor" />
            {t.label}
          </button>
        ))}
      </div>

      {/* 分区内容：key 让切换时干净重挂载，取数从头来一次。
          入场动画走 srTransition.enter（动画结束摘类）而不是常驻 className——
          带 transform 且 fill:both 的动画会让这个 div 永久成为 position:fixed 的
          包含块，里面的确认对话框就会整体偏移一个侧栏的宽度。 */}
      <div key={tab} ref={sectionEnter}>
        {tab === 'overview' && <AdminOverview onGoto={setTab} />}
        {tab === 'users' && <AdminUsers meId={A.id} />}
        {tab === 'guests' && <AdminGuests />}
        {tab === 'shares' && <AdminShares />}
        {tab === 'sessions' && <AdminSessions />}
        {tab === 'broadcast' && <AdminBroadcast />}
        {tab === 'system' && <AdminSystem />}
        {tab === 'audit' && <AdminAudit />}
      </div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { AdminConsole, AnnouncementBanner });
