/* SRUndoCore — 编辑器应用级撤销/重做栈的纯逻辑核心（无 DOM / 无 React）。
   快照对调用方不透明：这里只负责 past/future 两个栈的推进、容量上限、
   「输入突发只在起点压一次栈」的 typing 语义。Editor.jsx 负责生成快照
   （DOM-synced 块数组 + 所属星域）并在回放时应用。
   Node 可直接 import（tests/undocore.test.js），浏览器挂 window.SRUndoCore。 */
(function (g) {
  'use strict';

  /** 新建一个撤销历史。cap：past 栈的容量上限（超出丢最旧）。 */
  function create(cap) {
    return { cap: cap > 0 ? cap : 120, past: [], future: [], typing: false };
  }

  /** 结构变更 / 格式操作前压一份快照：清空 redo 分支，结束当前输入突发。 */
  function push(h, snap) {
    h.past.push(snap);
    if (h.past.length > h.cap) h.past.shift();
    h.future = [];
    h.typing = false;
  }

  /** 纯打字：一次输入突发只在起点压一份快照。
      返回 true = 本次真的压栈了；false = 突发已在进行中，忽略。 */
  function noteTyping(h, snap) {
    if (h.typing) return false;
    h.past.push(snap);
    if (h.past.length > h.cap) h.past.shift();
    h.future = [];
    h.typing = true;
    return true;
  }

  /** 撤销：把「当前状态」压进 future，弹出并返回上一份快照；无可撤销时返回 null。 */
  function undo(h, current) {
    if (!h.past.length) return null;
    h.future.push(current);
    /* future 同样封顶：快照是整篇克隆，cap=120 时 past+future 最坏 240 份——
       一篇 1MB 的笔记就是 ~240MB。超出丢最旧（离现在最远的那个重做端）。 */
    if (h.future.length > h.cap) h.future.shift();
    h.typing = false;
    return h.past.pop();
  }

  /** 重做：把「当前状态」压回 past，弹出并返回 future 顶部快照；无可重做时返回 null。 */
  function redo(h, current) {
    if (!h.future.length) return null;
    h.past.push(current);
    if (h.past.length > h.cap) h.past.shift();
    h.typing = false;
    return h.future.pop();
  }

  const api = {
    create,
    push,
    noteTyping,
    undo,
    redo,
    canUndo: (h) => h.past.length > 0,
    canRedo: (h) => h.future.length > 0,
    /* 巨型笔记的内存护栏：快照是整篇克隆，两个栈最坏 2 × cap 份正文。
       普通笔记（几 KB）120 步毫无压力；1MB 的书摘按 120 步就是 ~240MB。
       按体量降档（字节按 UTF-16 估算：length × 2）。 */
    capForBytes: (bytes) => (bytes > 512 * 1024 ? 15 : bytes > 128 * 1024 ? 40 : 120),
  };

  g.SRUndoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
