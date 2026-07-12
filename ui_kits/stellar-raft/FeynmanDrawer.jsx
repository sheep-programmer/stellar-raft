/* FeynmanDrawer — right drawer for 费曼内化 mode + the ignite climax (screen 5).
   真实闭环：你向 AI 学生讲解 → 学生按显式判据（有效讲解字数 / 覆盖要点 / 轮次）追问或「听懂了」→
   讲透后按认证态走状态机的三条边：
   · 未点亮 → 点亮（金色时刻：IgniteBurst + 金 toast）
   · 待重燃 → 重燃（快速通道：门槛减半，同一金色时刻，toast「重燃 · 星光归位」）
   · 已点亮 → 巩固（按「记得」lit 档计，无爆发、蓝 toast——金色只属于状态跃迁）
   「还没讲透」= 一次失败复习；对已点亮星模型会当场熄灭（extinguished），这里出冷色反馈。 */
const { IconButton, Icon, Button, MemoryBar, Tag, Input } = window.StellarRaftDesignSystem_2866af;

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

// 反馈横幅统一走 DS toast()（底部中央，与复习评分同一视觉词汇同一位置）。
// 金色纪律：tone:'gold' 只出现在点亮 / 重燃两次状态跃迁；巩固与熄灭全部走冷色。
const feyToast = (msg, opts) => {
  const t = window.StellarRaftDesignSystem_2866af.toast;
  if (t) t(msg, opts);
};

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

/* 复述门槛（显式判据，抽屉里就地自解释）：
   · 常规（点亮 / 巩固）：有效讲解累计 ≥ 60 字（被判「太短」的轮次不计）
     且（有效轮次 ≥ 2 或 覆盖要点 ≥ min(2, 要点数)）
   · 重燃快速通道（待重燃星）：有效讲解 ≥ 40 字 且 ≥ 1 轮——重燃是恢复不是初考 */
const FEY_SHORT = 12; // 单轮有效下限（与 AI 学生「太短」的判定同一口径）
const feyNeedChars = (mode) => (mode === 'relight' ? 40 : 60);
const feyReady = (mode, effChars, effRounds, coveredN, targetN) =>
  mode === 'relight'
    ? effChars >= 40 && effRounds >= 1
    : effChars >= 60 && (effRounds >= 2 || coveredN >= Math.min(2, targetN));

// 讲解文本对要点的命中：返回累计覆盖集合与本轮新命中
function matchTargets(targets, covered, txt) {
  const has = (t) => txt.toLowerCase().includes(t.toLowerCase());
  const newly = targets.filter((t) => !covered.has(t) && has(t));
  const after = new Set(covered);
  newly.forEach((t) => after.add(t));
  return { after, newly };
}

// AI 学生的回应措辞。达标与否由 send 里的显式门槛（feyReady）决定，这里只负责说话。
function studentText({ mode, targets, after, newly, round, tooShort, ready }) {
  if (tooShort) {
    return '这句话太短，我还没真的听懂。再展开一点——多讲一两句，最好带个例子或一步推导。';
  }
  if (ready) {
    const said = [...after].slice(0, 2).join('、');
    if (mode === 'relight') return `想起来了——${said ? `${said} 又对上了，` : ''}和你上次讲的连起来了。这颗星，可以重燃。`;
    if (mode === 'consolidate') return `比上次讲得还清楚，我现在能自己复述一遍了。`;
    return `懂了——${said ? `你把 ${said} 也讲清楚了，` : ''}我现在能自己复述一遍了。这颗星，可以点亮。`;
  }
  const remaining = targets.filter((t) => !after.has(t));
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
  return ack + q;
}

function FeynmanDrawer({ starId, onClose }) {
  const D = window.SR_DATA;
  const star = D.byId[starId] || D.stars[0];
  const targets = React.useMemo(() => deriveKeyPoints(star), [star.id]);
  // 会话模式在进场时定格（认证态是状态机上的边，不在会话中途换轨）：
  // relight = 待重燃星重燃（门槛减半）· consolidate = 已点亮星巩固 · ignite = 首次点亮
  const mode = React.useMemo(
    () => (D.isEmber && D.isEmber(star) ? 'relight' : D.isLit && D.isLit(star) ? 'consolidate' : 'ignite'),
    [star.id]);
  // 内容门槛：摘要去空白 ≥ 20 字，或带文本的非 rich/divider 块 ≥ 2——空星先去写，才谈得上点亮
  const substance = React.useMemo(() => (D.hasSubstance ? D.hasSubstance(star) : true), [star.id]);
  const gated = !substance && mode !== 'consolidate';
  const needChars = feyNeedChars(mode);

  const [strength, setStrength] = React.useState(star.strength);
  const [stability, setStability] = React.useState(0); // 成功后的稳定度（天）——sr 增益提示
  const [igniting, setIgniting] = React.useState(false);
  const [lit, setLit] = React.useState(false);                    // 本次会话完成点亮 / 重燃
  const [consolidated, setConsolidated] = React.useState(false);  // 已点亮星本次完成巩固
  const [deferred, setDeferred] = React.useState(false);          // 「还没讲透」：按失败记
  const [extinguished, setExtinguished] = React.useState(false);  // 「还没讲透」把已点亮星讲灭了

  const [input, setInput] = React.useState('');
  const [round, setRound] = React.useState(0);
  const [effChars, setEffChars] = React.useState(0);   // 有效讲解累计字数（「太短」轮次不计）
  const [effRounds, setEffRounds] = React.useState(0); // 有效轮次
  const [covered, setCovered] = React.useState(() => new Set());
  const [thinking, setThinking] = React.useState(false);
  const [canIgnite, setCanIgnite] = React.useState(false);
  const [messages, setMessages] = React.useState(() => (gated ? [] : [{
    who: 'ai', name: 'AI 学生',
    text: mode === 'relight'
      ? '上次你把它讲得很清楚，现在它暗下来了。再帮我回忆一遍——它到底在解决什么问题？'
      : `用最简单的话告诉我：${star.label} 到底在解决什么问题？`,
  }]));

  const scrollRef = React.useRef(null);
  const timers = React.useRef([]);
  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // 抽屉即模态：移焦入内、Tab 圈禁、关闭还原焦点；Esc 关闭（全站一致）
  const drawerRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => { })(drawerRef);
  React.useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, thinking]);

  const send = () => {
    const txt = input.trim();
    if (!txt || thinking || lit || consolidated || gated) return;
    const r = round + 1;
    const clean = txt.replace(/\s+/g, '');
    const tooShort = clean.length < FEY_SHORT;
    const { after, newly } = matchTargets(targets, covered, txt);
    const nextChars = effChars + (tooShort ? 0 : clean.length);
    const nextRounds = effRounds + (tooShort ? 0 : 1);
    const ready = canIgnite || feyReady(mode, nextChars, nextRounds, after.size, targets.length);
    setMessages((m) => [...m, { who: 'me', text: txt }]);
    setInput('');
    setRound(r);
    setEffChars(nextChars);
    setEffRounds(nextRounds);
    setThinking(true);
    const t = setTimeout(() => {
      setCovered(after);
      setThinking(false);
      setMessages((m) => [...m, { who: 'ai', name: 'AI 学生', text: studentText({ mode, targets, after, newly, round: r, tooShort, ready }) }]);
      if (ready) setCanIgnite(true);
    }, 720 + Math.random() * 420);
    timers.current.push(t);
  };

  // 点亮 / 重燃 = 状态跃迁：S×(2.5+(1−R)·0.6) 封顶 365、R 回满、lit=now——
  // 时间线（点亮 / 重燃）由 reviewSuccess({ ignite:true }) 内部写入，这里不再重复记录。
  const ignite = () => {
    if (!canIgnite || lit || igniting || gated) return;
    setIgniting(true);
    feyToast(mode === 'relight' ? '重燃 · 星光归位' : '点亮 +1 · 融会贯通',
      { tone: 'gold', icon: mode === 'relight' ? 'flame' : 'sparkles', duration: 2600 });
    timers.current.push(setTimeout(() => setLit(true), 200));
    timers.current.push(setTimeout(() => {
      const res = D.reviewSuccess(star.id, { ignite: true });
      if (!res) return;
      setStrength(res.strength);
      setStability(res.stability);
      // 广播点亮事件：星图 / 三维星系等在场视图就地变暖，无需重新挂载
      window.dispatchEvent(new CustomEvent('sr-ignite', { detail: { id: star.id, strength: res.strength } }));
    }, 250));
    timers.current.push(setTimeout(() => {
      setMessages((m) => [...m, { who: 'ai', name: 'AI 学生', text: '这颗星亮了。只要按时复习，它就不会熄灭。' }]);
    }, 900));
    timers.current.push(setTimeout(() => setIgniting(false), 2600));
  };

  // 已点亮星讲透 = 巩固：按「记得」lit 档（×2.2 + 奖励项）计，认证保持。
  // 金色只属于状态跃迁——这里无爆发、蓝 toast。
  const consolidate = () => {
    if (!canIgnite || consolidated || igniting || extinguished) return;
    const res = D.reviewSuccess(star.id);
    if (!res) return;
    setConsolidated(true);
    setStrength(res.strength);
    setStability(res.stability);
    feyToast('讲得更清楚了 · 记忆更牢', { icon: 'check' });
    window.dispatchEvent(new CustomEvent('sr-memory'));
  };

  // 还没讲透 = 一次失败复习：稳定度回缩、到期提前。已点亮星会当场熄灭（模型返回
  // extinguished），出冷色 toast；未点亮星保持原来那句克制的反馈。不播点亮动画。
  const defer = () => {
    if (deferred || lit || consolidated || igniting) return;
    const res = D.reviewFail(star.id);
    if (!res) return;
    setDeferred(true);
    setStrength(res.strength);
    if (res.extinguished) {
      setExtinguished(true);
      feyToast(`「${star.label}」已熄灭 · 待重燃`, { icon: 'cloud-off' });
    }
    // 在场视图（星图 / 鸟瞰 / 侧栏复习角标）就地读回新亮度
    window.dispatchEvent(new CustomEvent('sr-memory'));
  };

  // 「去写笔记」：抽屉拿不到打开编辑器的回调（app 层未下发），从上下文接力——
  // 关闭抽屉后若星图摘要卡仍在场，替用户按下它的「打开编辑」；其他上下文
  //（体检 / 列表）关闭抽屉即回到能打开这颗星的地方。
  const goWrite = () => {
    onClose();
    requestAnimationFrame(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === '打开编辑');
      if (btn) btn.click();
    });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const doneFlag = lit || consolidated;
  // 右侧状态口径：随模式自解释
  const statusText = mode === 'relight'
    ? (lit ? '星光归位' : canIgnite ? '可以重燃' : '再讲透一次，就能重燃')
    : mode === 'consolidate'
      ? (consolidated ? '记忆更牢' : extinguished ? '已熄灭 · 待重燃' : canIgnite ? '可以巩固' : '把它讲得更清楚')
      : (lit ? '已融会贯通' : canIgnite ? '可以点亮' : '继续讲，直到讲透');
  // 金色只给点亮 / 重燃的「可以跃迁」提示；巩固的就绪提示走星蓝
  const statusColor = canIgnite && !doneFlag && !extinguished
    ? (mode === 'consolidate' ? 'var(--star-blue)' : 'var(--gold)')
    : 'var(--text-3)';

  // 认证态徽标（差异呈现）：已点亮 = 金发丝 · 待重燃 = 暗金余烬；
  // 本次会话点亮 / 重燃成功后就地转正，被「还没讲透」讲灭则转暗金
  const litChip = { text: '已点亮', border: 'color-mix(in srgb, var(--gold) 45%, transparent)', color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 8%, transparent)' };
  const emberChip = { text: '待重燃', border: 'color-mix(in srgb, var(--gold) 30%, transparent)', color: 'color-mix(in srgb, var(--gold) 72%, var(--text-3))', bg: 'color-mix(in srgb, var(--gold) 6%, transparent)' };
  const certChip = lit ? litChip
    : extinguished ? emberChip
      : mode === 'relight' ? emberChip
        : mode === 'consolidate' ? litChip
          : null;

  return (
    <React.Fragment>
      {igniting && <IgniteBurst />}
      <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(3,4,12,0.45)', backdropFilter: 'blur(2px)' }} onClick={onClose} aria-hidden="true" />
      <div ref={drawerRef} role="dialog" aria-modal="true" aria-label={'费曼内化 · ' + star.label}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 392, zIndex: 62, boxShadow: 'var(--shadow-drawer)',
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.conColor(star.con), boxShadow: `0 0 8px ${D.conColor(star.con)}` }} />{D.conName(star.con)}
              </span>
              {certChip && (
                <span style={{ fontSize: 10, letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 'var(--r-pill)',
                  border: `1px solid ${certChip.border}`, color: certChip.color, background: certChip.bg }}>{certChip.text}</span>
              )}
            </div>
            <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-1)', textShadow: lit ? 'var(--text-glow-warm)' : 'var(--text-glow-cool)', transition: 'text-shadow var(--dur-slow)' }}>{star.label}</div>
          </div>

          <MemoryBar value={strength} label="记忆强度" showPct />

          {/* 常驻副标题：随认证态自解释（世界观一句话） */}
          <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-2)' }}>
            {mode === 'relight'
              ? '曾点亮的星暗了下来。再讲透一次，就能重燃。'
              : mode === 'consolidate'
                ? '已点亮 · 讲清楚的东西，暗得更慢。'
                : '把这颗星讲清楚，它就被点亮——点亮的星，记得更久。'}
          </div>

          {/* 内容门槛不足：点亮区禁用 + 去写笔记 */}
          {gated && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 15px', borderRadius: 'var(--r-md)',
              border: '1px dashed var(--line-strong)', background: 'color-mix(in srgb, var(--star-blue) 4%, transparent)' }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
                <Icon name="pen-line" size={15} color="var(--star-blue)" style={{ marginTop: 2, flex: 'none' }} />
                <span>这颗星还没有内容——先写下它，才谈得上点亮。</span>
              </div>
              <Button size="sm" icon="pen-line" onClick={goWrite} style={{ alignSelf: 'flex-start' }}>去写笔记</Button>
            </div>
          )}

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

        {/* footer：输入讲解 + 门槛进度 + 点亮 / 重燃 / 巩固 */}
        <div style={{ padding: 18, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!doneFlag && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={gated ? '先写下这颗星，再来讲给 AI 学生' : canIgnite ? '还想补充就继续讲…' : '把你的理解讲给 AI 学生…'}
                  icon="message-circle"
                  size="md"
                  disabled={thinking || gated}
                />
              </div>
              <IconButton name="send" title="讲给 AI 学生" onClick={send} disabled={!input.trim() || thinking || gated} />
            </div>
          )}

          {/* 门槛进度：判据就地自解释（有效讲解字数 / 轮次 / 要点） */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            <span>有效讲解 {effChars}/{needChars} 字 · {effRounds} 轮{targets.length ? ` · 要点 ${covered.size}/${targets.length}` : ''}</span>
            <span style={{ color: statusColor, textAlign: 'right', flex: 'none' }}>{statusText}</span>
          </div>

          {/* sr 增益提示：成功后展示稳定度（点亮 / 重燃走金，巩固走蓝） */}
          {doneFlag && stability > 0 && (
            <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
              <Icon name="trending-up" size={13} color={lit ? 'var(--gold)' : 'var(--star-blue)'} />
              记忆稳定度升至 {Math.round(stability)} 天 · 复习间隔更长
            </div>
          )}

          {mode === 'consolidate' ? (
            <Button variant="primary" icon="check" disabled={!canIgnite || consolidated || extinguished} onClick={consolidate}
              style={{ width: '100%', height: 48, fontSize: 16 }}>
              {consolidated ? '已巩固 · 记忆更牢' : '巩固这颗星'}
            </Button>
          ) : (
            <Button variant="primary" icon={mode === 'relight' ? 'flame' : 'zap'} glow={canIgnite && !lit && !gated}
              disabled={!canIgnite || lit || gated} onClick={ignite} style={{ width: '100%', height: 48, fontSize: 16 }}>
              {mode === 'relight' ? (lit ? '已重燃 · 星光归位' : '重燃这颗星') : (lit ? '已点亮 · 融会贯通' : '点亮这颗星')}
            </Button>
          )}
          {!doneFlag && (
            deferred ? (
              <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, color: 'var(--text-3)', padding: '2px 0' }}>
                <Icon name={extinguished ? 'cloud-off' : 'rotate-ccw'} size={13} color="var(--star-blue-dim)" />
                {extinguished ? '已熄灭 · 待重燃——把它讲透，光就会回来' : '这颗星还需要时间 — 已排回复习队列'}
              </div>
            ) : (
              <Button variant="ghost" size="sm" icon="rotate-ccw" onClick={defer} disabled={gated} style={{ width: '100%' }}>
                还没讲透 · 之后再来
              </Button>
            )
          )}
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
