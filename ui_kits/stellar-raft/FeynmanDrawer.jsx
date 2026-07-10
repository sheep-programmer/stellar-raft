/* FeynmanDrawer — right drawer for 费曼内化 mode + the ignite climax (screen 5).
   Real loop: 你向 AI 学生讲解 → 学生用启发式(字数 / 是否覆盖要点 / 轮次)生成有针对性的
   追问或「听懂了」反馈 → 讲透后「点亮这颗星」激活 → 真正提升记忆强度 + 点亮爆发 + toast。 */
const { GlassPanel, IconButton, Icon, Button, MemoryBar, Tag, Input } = window.StellarRaftDesignSystem_2866af;

function IgniteBurst() {
  // particle ring + flash, 1.3s
  const parts = Array.from({ length: 18 });
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', background: 'var(--gold-white)',
        boxShadow: '0 0 60px 30px rgba(255,217,138,0.5)', animation: 'sr-flash var(--dur-ignite) var(--ease-flight) both' }} />
      <div style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--gold)',
        animation: 'sr-ring var(--dur-ignite) var(--ease-out) both' }} />
      {parts.map((_, i) => {
        const a = (i / parts.length) * Math.PI * 2;
        return <span key={i} style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', background: i % 3 ? 'var(--gold)' : 'var(--star-blue)',
          ['--dx']: `${Math.cos(a) * (120 + (i % 4) * 30)}px`, ['--dy']: `${Math.sin(a) * (120 + (i % 4) * 30)}px`,
          animation: `sr-particle var(--dur-ignite) var(--ease-out) both`, boxShadow: '0 0 6px var(--gold)' }} />;
      })}
    </div>
  );
}

function IgniteToast() {
  return (
    <div style={{ position: 'fixed', top: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 90, animation: 'sr-toast 2.6s var(--ease-flight) both' }}>
      <GlassPanel strong radius="pill" pad="none" glow style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 22px' }}>
        <Icon name="sparkles" size={20} color="var(--gold)" />
        <span style={{ fontSize: 15, color: 'var(--text-1)' }}>点亮 +1 · <b style={{ color: 'var(--gold)', fontWeight: 500 }}>融会贯通</b></span>
      </GlassPanel>
    </div>
  );
}

// 从一颗星里提取干净、可被讲解命中的「要点关键词」：别名的拉丁词、正文文本里的拉丁术语、再加标签兜底。
// 只取有文本意义的块（跳过 code，避免把 import/numpy 之类代码词当要点）。
function deriveKeyPoints(star) {
  const out = [];
  const push = (w) => { w = (w || '').trim(); if (w && !out.includes(w)) out.push(w); };
  if (star.props && star.props.alias) star.props.alias.split(/\s+/).forEach(push);
  const texts = [star.summary];
  (star.body || []).forEach((b) => {
    if (['bulleted', 'callout', 'h2', 'h3', 'quote', 'todo'].includes(b.type) && b.text) texts.push(b.text);
  });
  texts.forEach((t) => (String(t).match(/[A-Za-z][A-Za-z]{2,}/g) || []).forEach(push));
  (star.tags || []).forEach(push);
  return out.slice(0, 5);
}

// AI 学生的启发式回应：字数太短→催促；命中新要点→认可并继续追问；轮次/覆盖达标→「听懂了」。
function studentReply({ targets, covered, round, txt }) {
  const clean = txt.replace(/\s+/g, '');
  const has = (t) => txt.toLowerCase().includes(t.toLowerCase());
  const tooShort = clean.length < 12;
  const newly = targets.filter((t) => !covered.has(t) && has(t));
  const after = new Set(covered);
  newly.forEach((t) => after.add(t));
  const remaining = targets.filter((t) => !after.has(t));

  if (tooShort) {
    return { covered: after, ready: false, text: '这句话太短，我还没真的听懂。再展开一点——多讲一两句，最好带个例子或一步推导。' };
  }

  const ready = round >= 3 || (round >= 2 && after.size >= 1) || (round >= 1 && (after.size >= 2 || clean.length >= 60));
  if (ready) {
    const said = [...after].slice(0, 2).join('、');
    return {
      covered: after, ready: true,
      text: `懂了——${said ? `你把 ${said} 也讲清楚了，` : ''}我现在能自己复述一遍了。这颗星，可以点亮。`,
    };
  }

  const ack = newly.length ? `嗯，${newly[0]} 这点清楚了。` : '';
  let q;
  if (remaining.length && round % 2 === 1) {
    q = `那能顺带说说「${remaining[0]}」在这里是什么角色吗？我想确认我没理解错。`;
  } else {
    const deep = [
      '能再具体一点吗？比如举一个例子，或写出最关键的那一步。',
      '这背后的「为什么」是什么——为什么必须是这样，而不能是别的？',
      '如果要一句话讲给同学，让他立刻记住，你会怎么说？',
    ];
    q = deep[(round - 1) % deep.length];
  }
  return { covered: after, ready: false, text: ack + q };
}

function FeynmanDrawer({ starId, onClose }) {
  const D = window.SR_DATA;
  const star = D.byId[starId] || D.stars[0];
  const targets = React.useMemo(() => deriveKeyPoints(star), [star.id]);

  const [strength, setStrength] = React.useState(star.strength);
  const [igniting, setIgniting] = React.useState(false);
  const [lit, setLit] = React.useState(false);

  const [input, setInput] = React.useState('');
  const [round, setRound] = React.useState(0);
  const [covered, setCovered] = React.useState(() => new Set());
  const [thinking, setThinking] = React.useState(false);
  const [canIgnite, setCanIgnite] = React.useState(false);
  const [messages, setMessages] = React.useState(() => ([
    { who: 'ai', name: 'AI 学生', text: `用最简单的话告诉我：${star.label} 到底在解决什么问题？` },
  ]));

  const scrollRef = React.useRef(null);
  const timers = React.useRef([]);
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, thinking]);

  const send = () => {
    const txt = input.trim();
    if (!txt || thinking || lit) return;
    const r = round + 1;
    setMessages((m) => [...m, { who: 'me', text: txt }]);
    setInput('');
    setRound(r);
    setThinking(true);
    const t = setTimeout(() => {
      const res = studentReply({ targets, covered, round: r, txt });
      setCovered(res.covered);
      setThinking(false);
      setMessages((m) => [...m, { who: 'ai', name: 'AI 学生', text: res.text }]);
      if (res.ready) setCanIgnite(true);
    }, 720 + Math.random() * 420);
    timers.current.push(t);
  };

  const ignite = () => {
    if (!canIgnite || lit || igniting) return;
    setIgniting(true);
    const next = Math.min(0.98, Math.max(strength + 0.22, 0.9));
    timers.current.push(setTimeout(() => setLit(true), 200));
    timers.current.push(setTimeout(() => {
      setStrength(next);
      const gained = next - strength;
      D.byId[star.id].strength = next; // 真正提升记忆强度
      D.logIgnite(star.id, gained);    // 记入时间线，鸟瞰等统计随之更新
      D.syncCounts();                  // 星域健康度按新强度重算
      // 广播点亮事件：星图 / 三维星系等在场视图就地变暖，无需重新挂载
      window.dispatchEvent(new CustomEvent('sr-ignite', { detail: { id: star.id, strength: next } }));
    }, 250));
    timers.current.push(setTimeout(() => {
      setMessages((m) => [...m, { who: 'ai', name: 'AI 学生', text: '这颗星亮了。下次复习，你会更轻松。' }]);
    }, 900));
    timers.current.push(setTimeout(() => setIgniting(false), 2600));
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <React.Fragment>
      {igniting && <IgniteBurst />}
      {igniting && <IgniteToast />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(3,4,12,0.45)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 392, zIndex: 62, boxShadow: 'var(--shadow-drawer)',
        animation: 'sr-drawerin var(--dur-base) var(--ease-flight) both', display: 'flex', flexDirection: 'column',
        background: 'var(--glass-bg-strong)', WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(1.2)', backdropFilter: 'blur(var(--glass-blur)) saturate(1.2)', borderLeft: '1px solid var(--glass-border-strong)' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, letterSpacing: '0.06em', color: 'var(--text-3)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            <Icon name="brain" size={16} color="var(--gold)" />费曼内化
          </span>
          <IconButton name="x" title="关闭" onClick={onClose} />
        </div>

        <div ref={scrollRef} onContextMenu={(e) => e.preventDefault()}
          style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(star.con), boxShadow: `0 0 8px ${D.conColor(star.con)}` }} />{D.conName(star.con)}
            </div>
            <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-1)', textShadow: lit ? 'var(--text-glow-warm)' : 'var(--text-glow-cool)', transition: 'text-shadow var(--dur-slow)' }}>{star.label}</div>
          </div>

          <MemoryBar value={strength} label="记忆强度" showPct />

          <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-2)' }}>
            用最简单的话向 AI 学生讲清楚这颗星。讲明白了，它就被点亮。
          </div>

          {/* 要点：讲到时点亮成暖金 */}
          {targets.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>要点</span>
              {targets.map((t) => {
                const on = covered.has(t);
                return (
                  <span key={t} style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 'var(--r-pill)',
                    border: '1px solid', transition: 'all var(--dur-base) var(--ease-flight)',
                    borderColor: on ? 'rgba(255,217,138,0.5)' : 'var(--glass-border)',
                    background: on ? 'rgba(255,217,138,0.12)' : 'transparent',
                    color: on ? 'var(--gold)' : 'var(--text-3)',
                    boxShadow: on ? 'var(--glow-faint)' : 'none',
                  }}>{t}</span>
                );
              })}
            </div>
          )}

          {/* AI student chat — 真实多轮滚动 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <Bubble key={i} who={m.who} name={m.name}>{m.text}</Bubble>
            ))}
            {thinking && <TypingBubble />}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(star.tags || []).slice(0, 3).map((t) => <Tag key={t} icon="hash">{t}</Tag>)}
          </div>
        </div>

        {/* footer：输入讲解 + 进度 + 点亮 */}
        <div style={{ padding: 18, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!lit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={canIgnite ? '还想补充就继续讲…' : '把你的理解讲给 AI 学生…'}
                  icon="message-circle"
                  size="md"
                  disabled={thinking}
                />
              </div>
              <IconButton name="send" title="讲给 AI 学生" onClick={send} disabled={!input.trim() || thinking} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            <span>已对话 {round} 轮 · 覆盖要点 {covered.size}/{targets.length}</span>
            <span style={{ color: canIgnite && !lit ? 'var(--gold)' : 'var(--text-3)' }}>
              {lit ? '已融会贯通' : canIgnite ? '可以点亮' : '继续讲，直到讲透'}
            </span>
          </div>

          <Button variant="primary" icon="zap" glow={canIgnite && !lit} disabled={!canIgnite || lit} onClick={ignite} style={{ width: '100%', height: 48, fontSize: 16 }}>
            {lit ? '已点亮 · 融会贯通' : '点亮这颗星'}
          </Button>
        </div>
      </div>
    </React.Fragment>
  );
}

function TypingBubble() {
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, marginLeft: 2 }}>AI 学生</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '12px 14px', borderRadius: '4px 14px 14px 14px',
        background: 'rgba(159,198,255,0.08)', border: '1px solid var(--glass-border)' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--star-blue)', opacity: 0.7,
            animation: 'sr-breathe 1.2s var(--ease-flight) infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  );
}

function Bubble({ who, name, children }) {
  const ai = who === 'ai';
  return (
    <div style={{ alignSelf: ai ? 'flex-start' : 'flex-end', maxWidth: '88%', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}>
      {name && <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, marginLeft: 2 }}>{name}</div>}
      <div style={{ fontSize: 13, lineHeight: 1.6, padding: '10px 13px', borderRadius: ai ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
        background: ai ? 'rgba(159,198,255,0.08)' : 'rgba(255,217,138,0.10)',
        border: '1px solid', borderColor: ai ? 'var(--glass-border)' : 'rgba(255,217,138,0.24)',
        color: ai ? 'var(--text-2)' : 'var(--text-1)' }}>{children}</div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { FeynmanDrawer });
