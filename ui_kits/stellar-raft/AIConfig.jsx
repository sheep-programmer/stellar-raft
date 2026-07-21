/* AIConfig — AI 配置面板 (玻璃 modal)。
   让"AI"变得可信、可设置：服务商接入（Base URL / API Key / 模型，默认 OpenAI）·
   费曼学生性格/严格度 · 复习提醒策略 · 摘要与建议开关。
   接入配置持久化到 localStorage，「测试连接」真实请求所配端点的 /models 校验密钥。
   Esc / 点击遮罩关闭。props: { onClose }。 */
const { GlassPanel, Button, Icon, IconButton, Input, Badge } = window.StellarRaftDesignSystem_2866af;

// ——— 服务商预设。openai 为默认；custom 兼容 one-api / Ollama / vLLM 等自建网关 ———
const PROVIDERS = [
  {
    id: 'openai', name: 'OpenAI', icon: 'sparkles',
    baseUrl: 'https://api.openai.com/v1', keyPh: 'sk-...',
    desc: 'OpenAI 官方接口，或任何遵循同一规范的服务',
    models: [
      { id: 'gpt-5.1',      name: 'GPT-5.1',      tier: '旗舰', desc: '复杂推导、深度费曼对话，推理最强', speed: '深思', cost: '高' },
      { id: 'gpt-5-mini',   name: 'GPT-5 mini',   tier: '均衡', desc: '日常摘要与建议的默认选择', speed: '迅捷', cost: '中' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', tier: '轻快', desc: '即时补全、标签建议，几乎无延迟', speed: '极速', cost: '低' },
    ],
  },
  {
    id: 'anthropic', name: 'Anthropic', icon: 'moon-star',
    baseUrl: 'https://api.anthropic.com/v1', keyPh: 'sk-ant-...',
    desc: 'Claude 系列模型的官方接口',
    models: [
      { id: 'claude-opus-4-8',  name: 'Claude Opus 4.8',  tier: '最强', desc: '复杂推导、深度费曼对话，响应稍慢', speed: '深思', cost: '高' },
      { id: 'claude-sonnet-5',  name: 'Claude Sonnet 5',  tier: '均衡', desc: '日常摘要与建议的默认选择', speed: '迅捷', cost: '中' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', tier: '轻快', desc: '即时补全、标签建议，几乎无延迟', speed: '极速', cost: '低' },
    ],
  },
  {
    id: 'custom', name: '自定义', icon: 'server',
    baseUrl: '', keyPh: 'sk-... 或网关令牌',
    desc: 'OpenAI 兼容接口：one-api / new-api / Ollama / vLLM 等',
    models: [],
  },
];

const REVIEW_STRATEGIES = [
  { id: 'cooling', label: '随星变暗', desc: '记忆温度衰减到阈值的那一刻到期，贴合遗忘曲线' },
  { id: 'sm2',     label: '间隔重复', desc: '按 1·3·7·15·30…天的经典间隔阶梯安排到期' },
  { id: 'daily',   label: '每日固定', desc: '每颗星每天到期一次，傍晚汇总今日待回顾' },
  { id: 'off',     label: '不提醒',   desc: '到期照常计算，但不再推送复习通知' },
];

// ——— 配置持久化：唯一读写入口在 SRAI（ai.js），费曼学生 / 编辑器助手 / 复习策略共用同一份 ———
function loadCfg() { return window.SRAI.getConfig(); }
function saveCfg(cfg) { window.SRAI.setConfig(cfg); }

// ——— 受控开关 ———
function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        position: 'relative', width: 42, height: 24, flex: '0 0 auto',
        borderRadius: 'var(--r-pill)', cursor: 'pointer', padding: 0,
        border: '1px solid',
        borderColor: on ? 'rgba(255,217,138,0.45)' : 'var(--glass-border)',
        background: on ? 'rgba(255,217,138,0.18)' : 'rgba(159,198,255,0.06)',
        boxShadow: on ? 'var(--glow-gold-soft)' : 'none',
        transition: 'background var(--dur-base), border-color var(--dur-base), box-shadow var(--dur-base)',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18,
        borderRadius: '50%',
        background: on ? 'var(--gold)' : 'var(--star-blue-dim)',
        boxShadow: on ? '0 0 8px rgba(255,217,138,0.6)' : 'none',
        transition: 'left var(--dur-base) var(--ease-flight), background var(--dur-base)',
      }} />
    </button>
  );
}

// ——— 受控滑块。track 用冷蓝结构色，已填充段用暖金 ———
function Slider({ value, onChange, min = 0, max = 100, label, leftHint, rightHint }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <input
        type="range" min={min} max={max} value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 22, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
          background: `linear-gradient(90deg, var(--gold) 0%, var(--gold) ${pct}%, rgba(159,198,255,0.14) ${pct}%, rgba(159,198,255,0.14) 100%)`,
          borderRadius: 'var(--r-pill)', outline: 'none',
        }}
        className="sr-aicfg-range"
      />
      {(leftHint || rightHint) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
          <span>{leftHint}</span><span>{rightHint}</span>
        </div>
      )}
    </div>
  );
}

// ——— 区块标题 + 能力说明 ———
function Section({ icon, title, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, letterSpacing: 'var(--ls-hud)', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {icon && <Icon name={icon} size={15} color="var(--star-blue)" />}{title}
        </div>
        {hint && <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-3)', marginTop: 6, maxWidth: 460 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />;
}

// ——— 服务商切换（分段控件）———
function ProviderTabs({ value, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      borderRadius: 'var(--r-md)', border: '1px solid var(--glass-border)',
      background: 'rgba(3,4,12,0.35)',
    }}>
      {PROVIDERS.map(p => {
        const on = p.id === value;
        return (
          <button key={p.id} type="button" onClick={() => onChange(p.id)}
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 10px', cursor: 'pointer', border: '1px solid',
              borderColor: on ? 'rgba(255,217,138,0.4)' : 'transparent',
              borderRadius: 'var(--r-sm)', font: 'inherit', fontSize: 13,
              color: on ? 'var(--text-1)' : 'var(--text-3)',
              background: on ? 'rgba(255,217,138,0.10)' : 'transparent',
              transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
            }}>
            <Icon name={p.icon} size={15} color={on ? 'var(--gold)' : 'var(--text-3)'} />
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

function ModelDropdown({ value, onChange, models }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const customEntry = { id: '__custom', name: '自定义模型 ID', tier: '自定义', desc: '手动填写任意模型标识（如网关映射的模型名）', speed: '—', cost: '—' };
  const list = [...models, customEntry];
  const isPreset = models.some(m => m.id === value);
  const cur = models.find(m => m.id === value) || customEntry;

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderRadius: 'var(--r-md)', background: 'rgba(159,198,255,0.06)',
          border: '1px solid', borderColor: open ? 'var(--glass-border-strong)' : 'var(--glass-border)',
          transition: 'border-color var(--dur-fast)',
        }}
      >
        <Icon name="sparkles" size={18} color="var(--gold)" />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14.5, color: 'var(--text-1)', fontFamily: isPreset ? 'inherit' : 'var(--font-mono)' }}>
              {isPreset ? cur.name : (value || '自定义模型 ID')}
            </span>
            <Badge tone="gold">{cur.tier}</Badge>
          </span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{cur.desc}</span>
        </span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color="var(--text-3)" />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 5, animation: 'sr-cardin var(--dur-fast) var(--ease-flight) both' }}>
          <GlassPanel strong radius="md" pad="none" glow style={{ overflow: 'hidden' }}>
            <div role="listbox" style={{ padding: 6 }}>
              {list.map(m => {
                const on = m.id === '__custom' ? !isPreset : m.id === value;
                return (
                  <div key={m.id} role="option" aria-selected={on}
                    onClick={() => { onChange(m.id === '__custom' ? '' : m.id); setOpen(false); }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(159,198,255,0.08)'; }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 11, padding: '10px 12px',
                      borderRadius: 'var(--r-sm)', cursor: 'pointer',
                      background: on ? 'rgba(255,217,138,0.10)' : 'transparent',
                    }}>
                    <Icon name={m.id === '__custom' ? 'pen-line' : 'sparkles'} size={16} color={on ? 'var(--gold)' : 'var(--text-3)'} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, color: on ? 'var(--text-1)' : 'var(--text-2)' }}>{m.name}</span>
                        <Badge tone={on ? 'gold' : 'neutral'}>{m.tier}</Badge>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{m.desc}</div>
                      {m.id !== '__custom' && (
                        <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 10.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          <span>响应 · {m.speed}</span><span>消耗 · {m.cost}</span>
                        </div>
                      )}
                    </div>
                    {on && <Icon name="check" size={15} color="var(--gold)" style={{ marginTop: 2 }} />}
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

function AIConfig({ onClose }) {
  const [cfg, setCfg] = React.useState(loadCfg);
  const [showKey, setShowKey] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [test, setTest] = React.useState({ state: 'idle', msg: '' });

  const provider = PROVIDERS.find(p => p.id === cfg.provider) || PROVIDERS[0];
  const prov = cfg.providers[provider.id];

  const set = (patch) => { setCfg(c => ({ ...c, ...patch })); setSaved(false); };
  const setProv = (patch) => {
    setCfg(c => ({ ...c, providers: { ...c.providers, [provider.id]: { ...c.providers[provider.id], ...patch } } }));
    setSaved(false); setTest({ state: 'idle', msg: '' });
  };
  const switchProvider = (id) => { set({ provider: id }); setTest({ state: 'idle', msg: '' }); };

  // 模态焦点管理：移焦入内 · Tab 圈禁 · 关闭还原焦点；打开期间吞掉 ⌘K
  const modalRef = React.useRef(null);
  (window.SRKit && window.SRKit.useModalFocus ? window.SRKit.useModalFocus : () => { })(modalRef, { swallowCmdK: true });

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose && onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const persist = () => { saveCfg(cfg); setSaved(true); setTimeout(() => setSaved(false), 2400); };
  const applyAndClose = () => { saveCfg(cfg); onClose && onClose(); };

  // 真实请求所配端点的模型列表，验证 Base URL 与密钥是否可用
  const testConnection = async () => {
    const base = (prov.baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) { setTest({ state: 'err', msg: '请先填写 Base URL' }); return; }
    setTest({ state: 'testing', msg: '' });
    const headers = provider.id === 'anthropic'
      ? { 'x-api-key': prov.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : { Authorization: 'Bearer ' + prov.key };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(base + '/models', { headers, signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status + (res.status === 401 ? ' · 密钥无效' : res.status === 404 ? ' · 路径不对，Base URL 通常以 /v1 结尾' : ''));
      const data = await res.json();
      const n = Array.isArray(data.data) ? data.data.length : 0;
      setTest({ state: 'ok', msg: n ? `连接成功 · ${n} 个可用模型` : '连接成功' });
    } catch (e) {
      setTest({ state: 'err', msg: e.name === 'AbortError' ? '连接超时（8s）' : (e.message === 'Failed to fetch' ? '无法访问该地址（网络或 CORS）' : e.message || '网络错误') });
    } finally { clearTimeout(timer); }
  };

  const personaWord = cfg.persona < 33 ? '温和鼓励' : cfg.persona < 67 ? '好奇求知' : '刨根问底';
  const strictWord = cfg.strictness < 33 ? '宽松' : cfg.strictness < 67 ? '适中' : '严格';
  const baseUrlDirty = provider.baseUrl && prov.baseUrl !== provider.baseUrl;

  return (
    <div
      ref={modalRef}
      onMouseDown={onClose}
      onContextMenu={(e) => e.preventDefault()}
      role="dialog" aria-modal="true" aria-label="AI 配置"
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(3,4,12,0.58)',
        backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '7vh 20px 5vh',
      }}
    >
      <style>{`
        .sr-aicfg-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%;
          background:var(--gold-white); border:2px solid var(--gold); box-shadow:0 0 8px rgba(255,217,138,0.7); cursor:pointer; }
        .sr-aicfg-range::-moz-range-thumb{ width:16px; height:16px; border-radius:50%;
          background:var(--gold-white); border:2px solid var(--gold); box-shadow:0 0 8px rgba(255,217,138,0.7); cursor:pointer; }
        .sr-aicfg-range{ scrollbar-width:none; }
      `}</style>

      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: '94vw', maxHeight: '88vh', display: 'flex', animation: 'sr-cardin var(--dur-base) var(--ease-flight) both' }}
      >
        <GlassPanel strong radius="xl" pad="none" glow style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: 12, background: 'rgba(255,217,138,0.12)', border: '1px solid rgba(255,217,138,0.28)', boxShadow: 'var(--glow-gold-soft)' }}>
                <Icon name="bot" size={20} color="var(--gold)" />
              </span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 400, color: 'var(--text-1)' }}>AI 配置</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>设定那位陪你点亮星空的智能助手</div>
              </div>
            </div>
            <IconButton name="x" title="关闭" onClick={onClose} />
          </div>

          {/* body */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 22px 8px', display: 'flex', flexDirection: 'column', gap: 22 }}>

            <Section icon="plug-zap" title="服务商与接入" hint="默认使用 OpenAI 接口规范。Base URL 与 API Key 只保存在本机浏览器，也只会发往你配置的地址。">
              <ProviderTabs value={provider.id} onChange={switchProvider} />
              <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '-4px 2px 0' }}>{provider.desc}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 6 }}>Base URL</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Input
                      value={prov.baseUrl}
                      onChange={(e) => setProv({ baseUrl: e.target.value })}
                      placeholder={provider.baseUrl || 'https://your-gateway.example.com/v1'}
                      icon="globe"
                      size="md"
                      style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                    />
                    {baseUrlDirty && (
                      <IconButton name="rotate-ccw" title={'恢复默认 ' + provider.baseUrl} onClick={() => setProv({ baseUrl: provider.baseUrl })} />
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 6 }}>API Key</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Input
                      value={prov.key}
                      onChange={(e) => setProv({ key: e.target.value })}
                      placeholder={provider.keyPh}
                      icon="lock"
                      type={showKey ? 'text' : 'password'}
                      size="md"
                      style={{ flex: 1 }}
                    />
                    <IconButton name={showKey ? 'eye-off' : 'eye'} title={showKey ? '隐藏密钥' : '显示密钥'} onClick={() => setShowKey(s => !s)} />
                    <Button variant={saved ? 'primary' : 'secondary'} size="md" icon={saved ? 'check' : 'save'} disabled={!prov.key.trim() && !prov.baseUrl.trim()} onClick={persist}>
                      {saved ? '已保存' : '保存'}
                    </Button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                  <Button variant="ghost" size="sm" icon={test.state === 'testing' ? 'loader' : 'plug-zap'} disabled={test.state === 'testing'} onClick={testConnection}>
                    {test.state === 'testing' ? '测试中…' : '测试连接'}
                  </Button>
                  {test.state === 'ok' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gold)' }}>
                      <Icon name="circle-check" size={14} color="var(--gold)" />{test.msg}
                    </span>
                  )}
                  {test.state === 'err' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--danger)' }}>
                      <Icon name="circle-alert" size={14} color="var(--danger)" />{test.msg}
                    </span>
                  )}
                  {saved && test.state === 'idle' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gold)' }}>
                      <Icon name="shield-check" size={14} color="var(--gold)" />配置已存于本地浏览器
                    </span>
                  )}
                </div>
              </div>
            </Section>

            <Divider />

            <Section icon="sparkles" title="对话模型" hint="选择驱动所有 AI 能力的底层模型。越强的模型推理越深、越慢、消耗越多。">
              <ModelDropdown value={prov.model} onChange={(m) => setProv({ model: m })} models={provider.models} />
              {!provider.models.some(m => m.id === prov.model) && (
                <Input
                  value={prov.model}
                  onChange={(e) => setProv({ model: e.target.value })}
                  placeholder={provider.id === 'custom' ? '例如 qwen3-32b / deepseek-v3 / llama4' : '填写模型 ID'}
                  icon="pen-line"
                  size="md"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              )}
            </Section>

            <Divider />

            <Section icon="graduation-cap" title="费曼 AI 学生" hint="费曼内化时，AI 扮演一名学生听你讲解。它的性格与较真程度决定它会怎样追问你，把没讲透的地方逼出来。">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 2px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>性格</span>
                    <span style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{personaWord}</span>
                  </div>
                  <Slider value={cfg.persona} onChange={(v) => set({ persona: v })} label="学生性格" leftHint="温和鼓励" rightHint="刨根问底" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>严格度</span>
                    <span style={{ fontSize: 12, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>{strictWord}</span>
                  </div>
                  <Slider value={cfg.strictness} onChange={(v) => set({ strictness: v })} label="学生严格度" leftHint="听懂即过" rightHint="必须讲透" />
                </div>
              </div>
            </Section>

            <Divider />

            <Section icon="alarm-clock" title="复习提醒策略" hint="决定每颗星「何时算到期」：体检、复习队列与到期角标都按此计算。提醒送达的时刻与频率在 设置 → 复习提醒 里调整；选择「不提醒」则不再推送任何复习通知。">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REVIEW_STRATEGIES.map(s => {
                  const on = s.id === cfg.strategy;
                  return (
                    <div key={s.id} role="radio" aria-checked={on} onClick={() => set({ strategy: s.id })}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 13px', cursor: 'pointer',
                        borderRadius: 'var(--r-md)', border: '1px solid',
                        borderColor: on ? 'rgba(255,217,138,0.4)' : 'var(--glass-border)',
                        background: on ? 'rgba(255,217,138,0.08)' : 'rgba(159,198,255,0.04)',
                        transition: 'border-color var(--dur-fast), background var(--dur-fast)',
                      }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%', marginTop: 1, flex: '0 0 auto',
                        border: '1.5px solid', borderColor: on ? 'var(--gold)' : 'var(--text-3)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--gold)' }} />}
                      </span>
                      <div>
                        <div style={{ fontSize: 13.5, color: on ? 'var(--text-1)' : 'var(--text-2)' }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Divider />

            <Section icon="wand-sparkles" title="智能摘要与建议" hint="让 AI 在你书写时安静地帮忙：提炼摘要、发现可融会贯通的连接、推荐标签。它只在后台建议，永不替你下笔。">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <ToggleRow on={cfg.autoSummary} onChange={(v) => set({ autoSummary: v })}
                  title="自动摘要" desc="保存长笔记时生成一句话摘要，作为这颗星的悬停说明。" />
                <ToggleRow on={cfg.linkSuggest} onChange={(v) => set({ linkSuggest: v })}
                  title="连接建议" desc="发现跨星域的潜在关联，提示可点亮的「融会贯通」金色连线。" />
                <ToggleRow on={cfg.tagSuggest} onChange={(v) => set({ tagSuggest: v })}
                  title="标签推荐" desc="根据正文推荐合适的标签，整理收件箱时更省力。" />
              </div>
            </Section>
          </div>

          {/* footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-3)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '2px 6px' }}>ESC</span>
              关闭
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" size="md" onClick={onClose}>取消</Button>
              <Button variant="primary" size="md" icon="check" glow onClick={applyAndClose}>应用并关闭</Button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function ToggleRow({ on, onChange, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 2px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-1)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.55 }}>{desc}</div>
      </div>
      <div style={{ marginTop: 2 }}><Toggle on={on} onChange={onChange} label={title} /></div>
    </div>
  );
}

window.SRKit = Object.assign(window.SRKit || {}, { AIConfig });
