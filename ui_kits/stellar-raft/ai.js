/* SRAI — AI 能力核心层（plain global，在 api.js 之后、data.js 之前加载）
   - 配置的唯一读写入口：AIConfig 面板、费曼学生、编辑器 AI 助手、复习策略共用一份
   - chat(): 真实调用所配端点（OpenAI /chat/completions 兼容规范，或 Anthropic /v1/messages）
   - 未配置 / 请求失败时由调用方自行回退（费曼学生回退本地规则），这里只负责说清原因
   - 密钥只保存在本机浏览器与账号快照里，请求只发往用户配置的地址 */
window.SRAI = (function () {
  const CFG_KEY = 'sr.aiConfig';
  const DEFAULTS = {
    provider: 'openai',
    providers: {
      openai:    { baseUrl: 'https://api.openai.com/v1',    key: '', model: 'gpt-5.1' },
      anthropic: { baseUrl: 'https://api.anthropic.com/v1', key: '', model: 'claude-sonnet-5' },
      custom:    { baseUrl: '', key: '', model: '' },
    },
    persona: 45, strictness: 60, strategy: 'cooling',
    autoSummary: true, linkSuggest: true, tagSuggest: false,
  };

  const getConfig = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(CFG_KEY));
      if (!saved) return JSON.parse(JSON.stringify(DEFAULTS));
      return {
        ...DEFAULTS, ...saved,
        providers: Object.fromEntries(Object.keys(DEFAULTS.providers).map(k =>
          [k, { ...DEFAULTS.providers[k], ...(saved.providers && saved.providers[k]) }]
        )),
      };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  };
  // 保存并广播：AIConfig 面板、数据层（复习策略）、编辑器助手都监听 sr-ai-config 就地刷新
  const setConfig = (cfg) => {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { }
    try { window.dispatchEvent(new CustomEvent('sr-ai-config')); } catch (e) { }
  };
  const clearConfig = () => {
    try { localStorage.removeItem(CFG_KEY); } catch (e) { }
    try { window.dispatchEvent(new CustomEvent('sr-ai-config')); } catch (e) { }
  };

  // 当前生效的接入参数（服务商预设 + 用户覆写归并后）
  const active = () => {
    const cfg = getConfig();
    const prov = cfg.providers[cfg.provider] || cfg.providers.openai;
    return {
      provider: cfg.provider,
      baseUrl: String(prov.baseUrl || '').trim().replace(/\/+$/, ''),
      key: String(prov.key || '').trim(),
      model: String(prov.model || '').trim(),
      persona: cfg.persona, strictness: cfg.strictness, strategy: cfg.strategy,
      autoSummary: cfg.autoSummary, linkSuggest: cfg.linkSuggest, tagSuggest: cfg.tagSuggest,
    };
  };
  // 可用判定：有端点 + 模型即可（Ollama / 内网网关可以无密钥）；官方端点仍需密钥
  const isConfigured = () => {
    const a = active();
    if (!a.baseUrl || !a.model) return false;
    if ((a.provider === 'openai' || a.provider === 'anthropic') && !a.key) return false;
    return true;
  };

  // 把滑块值翻译成提示词里的措辞（与 AIConfig 面板展示同一口径）
  const personaWord = (v) => v < 33 ? '温和鼓励' : v < 67 ? '好奇求知' : '刨根问底';
  const strictWord = (v) => v < 33 ? '宽松' : v < 67 ? '适中' : '严格';

  const friendlyError = (e, status) => {
    if (e && e.name === 'AbortError') return 'AI 响应超时，请稍后再试';
    if (status === 401 || status === 403) return 'API 密钥无效或无权限';
    if (status === 404) return '接口路径不对，Base URL 通常以 /v1 结尾';
    if (status === 429) return '请求太频繁，稍等片刻再试';
    if (e && e.message === 'Failed to fetch') return '无法访问 AI 服务（网络或 CORS）';
    return (e && e.message) || 'AI 服务暂不可用';
  };

  /* 发起一次真实对话。
     messages: [{ role: 'user' | 'assistant', content: '…' }]
     opts: { system, maxTokens = 512, temperature = 0.7, timeout = 30000 }
     返回 Promise<string>（助手回复文本）；失败抛 Error（message 已人话化，err.status 保留）。 */
  const chat = async (messages, opts = {}) => {
    const a = active();
    if (!isConfigured()) { const e = new Error('尚未配置 AI 服务'); e.code = 'unconfigured'; throw e; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 30000);
    try {
      let url, headers, body, pick;
      if (a.provider === 'anthropic') {
        url = a.baseUrl + '/messages';
        headers = {
          'Content-Type': 'application/json', 'x-api-key': a.key,
          'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        };
        body = {
          model: a.model, max_tokens: opts.maxTokens || 512,
          system: opts.system || undefined,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        };
        if (opts.temperature != null) body.temperature = opts.temperature;
        pick = (d) => Array.isArray(d.content) ? d.content.map(c => c.text || '').join('') : '';
      } else {
        url = a.baseUrl + '/chat/completions';
        headers = { 'Content-Type': 'application/json' };
        if (a.key) headers.Authorization = 'Bearer ' + a.key;
        body = {
          model: a.model, max_tokens: opts.maxTokens || 512,
          messages: [
            ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
        };
        if (opts.temperature != null) body.temperature = opts.temperature;
        pick = (d) => (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data && (data.error && (data.error.message || data.error.type) || data.message);
        const err = new Error(friendlyError(detail ? new Error(detail) : null, res.status));
        err.status = res.status; throw err;
      }
      const text = String(pick(data) || '').trim();
      if (!text) throw new Error('AI 返回了空回复');
      return text;
    } catch (e) {
      if (e.status || e.code) throw e;
      const err = new Error(friendlyError(e)); err.cause = e; throw err;
    } finally { clearTimeout(timer); }
  };

  /* 要结构化结果的场景（标签推荐 / 连接建议）：从回复里剥出第一段 JSON。
     模型偶尔会带 markdown 围栏或说明文字，这里做宽松提取，解析失败抛人话错误。 */
  const chatJSON = async (messages, opts = {}) => {
    const raw = await chat(messages, { temperature: 0.3, ...opts });
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/([[{][\s\S]*[\]}])/);
    try { return JSON.parse(m ? m[1] : raw); }
    catch (e) { const err = new Error('AI 返回的结果无法解析'); err.raw = raw; throw err; }
  };

  return { getConfig, setConfig, clearConfig, active, isConfigured, chat, chatJSON, personaWord, strictWord };
})();
