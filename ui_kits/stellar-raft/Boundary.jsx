/* Boundary — 崩溃兜底卡。

   零构建、浏览器里现场编译的代价之一：任何一个组件在渲染里抛出异常，React 会把
   整棵树卸载掉。用户看到的是一整屏纯黑——没有一句话，也无从判断「我刚写的东西
   还在不在」。这张卡替那片黑说三件事：出了什么事、数据在哪儿、怎么回去。

   两处使用（见 app.jsx）：
   · 整个 App 外面一层 —— 最后的防线，连侧栏都挂了的时候还能给出刷新的入口；
   · <main> 里的视图一层 —— 一个视图崩了，侧栏与其它视图照常可用。回得去，就不算绝路。
     视图那层带 key={view}，换个目的地即自动重挂载，不必手动清状态。

   props: { title?, onReset?, resetLabel? } —— onReset 给了才出现那颗返回键。 */
const { Button, GlassPanel, Icon } = window.StellarRaftDesignSystem_2866af;

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null, stack: '', copied: false };
  }

  static getDerivedStateFromError(err) { return { err }; }

  componentDidCatch(err, info) {
    // 控制台留全量堆栈：卡片上只给一句摘要，真要排查还是得看这里
    try { console.error('[星图] 渲染时崩了：', err, info && info.componentStack); } catch (e) { }
    this.setState({ stack: (info && info.componentStack) || '' });
  }

  diagnostics() {
    const e = this.state.err || {};
    return [
      '星图 · 崩溃诊断',
      '位置：' + (this.props.title || '应用'),
      '时间：' + new Date().toISOString(),
      '错误：' + (e.name ? e.name + ': ' : '') + (e.message || String(e)),
      '',
      (e.stack || '').trim(),
      '',
      '组件栈：' + (this.state.stack || '（无）').trim(),
    ].join('\n');
  }

  copy() {
    // 统一走 SRCopy：现代 API 不可用（非安全上下文）时它自己退回老办法
    window.SRCopy.copy(this.diagnostics()).then((ok) => {
      if (!ok) return;
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2200);
    });
  }



  render() {
    if (!this.state.err) return this.props.children;
    const msg = String((this.state.err && this.state.err.message) || this.state.err || '未知错误');

    return (
      <div role="alert" style={{
        flex: 1, minWidth: 0, width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto',
        background: 'radial-gradient(1200px 800px at 78% -10%, rgba(60,26,34,0.38), transparent 60%), linear-gradient(180deg, #05060f 0%, #03040c 55%, #04050e 100%)',
      }}>
        <div style={{ width: 460, maxWidth: '94vw', margin: 'auto' }}>
          <GlassPanel strong radius="lg" glow style={{ padding: '30px 26px 24px', textAlign: 'center' }}>
            <Icon name="triangle-alert" size={28} color="var(--danger)" />
            <div style={{ fontSize: '1.125rem', fontWeight: 300, color: 'var(--text-1)', marginTop: 14 }}>
              {this.props.title ? this.props.title + '碎了' : '这一块星图碎了'}
            </div>

            <div style={{ fontSize: '0.78125rem', color: 'var(--text-2)', marginTop: 12, lineHeight: 1.8 }}>
              这是星图自己的问题，不是你哪里点错了。
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 10, lineHeight: 1.75 }}>
              <b style={{ color: 'var(--star-blue)' }}>你的星空没事</b> —— 每次改动都同时落在本机与服务器上，
              这次崩溃发生在画面这一层，碰不到已经存下的东西。
            </div>

            {/* 错误摘要：等宽、可选中，出问题时最想抄走的就是这一行 */}
            <div style={{
              marginTop: 16, padding: '10px 12px', textAlign: 'left',
              borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: 'var(--space-1)',
              fontFamily: 'var(--font-mono)', fontSize: '0.71875rem', lineHeight: 1.7, color: 'var(--text-2)',
              maxHeight: 132, overflow: 'auto', userSelect: 'text', wordBreak: 'break-word',
            }}>{msg}</div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
              {this.props.onReset && (
                <Button variant="primary" icon="arrow-left" onClick={this.props.onReset}>
                  {this.props.resetLabel || '回到星图'}
                </Button>
              )}
              <Button variant="secondary" icon="refresh-cw" onClick={() => location.reload()}>刷新页面</Button>
              <Button variant="ghost" icon={this.state.copied ? 'check' : 'clipboard'} onClick={() => this.copy()}>
                {this.state.copied ? '已复制' : '复制诊断信息'}
              </Button>
            </div>

            <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: 14, lineHeight: 1.7 }}>
              完整堆栈已经打在浏览器控制台里。
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }
}

window.SRKit = Object.assign(window.SRKit || {}, { Boundary });
