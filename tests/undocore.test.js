/* 星图 Stellar Raft — 撤销栈核心（undocore.js）单元测试
   纯逻辑实现，import 后从 globalThis.SRUndoCore 取 API。覆盖：
   push/undo/redo 往返、redo 分支在新操作后被清空、容量上限丢最旧、
   「输入突发只压一次栈」的 typing 语义（含被结构操作打断后重新开启）。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import '../ui_kits/stellar-raft/undocore.js';

const U = globalThis.SRUndoCore;

test('push / undo / redo：基本往返，快照原样取回', () => {
  const h = U.create(10);
  assert.equal(U.canUndo(h), false);
  assert.equal(U.undo(h, 'now'), null);          // 空栈撤销：null，且不污染 future
  assert.equal(U.canRedo(h), false);

  U.push(h, 'v1');                                // 操作前压 v1，操作后状态为 v2
  U.push(h, 'v2');                                // 再一次操作前压 v2，状态变 v3
  assert.equal(U.undo(h, 'v3'), 'v2');            // ⌘Z：回到 v2，v3 进 redo
  assert.equal(U.undo(h, 'v2'), 'v1');            // 再 ⌘Z：回到 v1
  assert.equal(U.canUndo(h), false);
  assert.equal(U.redo(h, 'v1'), 'v2');            // ⌘⇧Z：向前到 v2
  assert.equal(U.redo(h, 'v2'), 'v3');            // 再 ⌘⇧Z：回到最新
  assert.equal(U.canRedo(h), false);
  assert.equal(U.canUndo(h), true);               // 往返后仍可继续撤销
});

test('undo 之后的新操作清空 redo 分支（不再能「重做」到被岔开的未来）', () => {
  const h = U.create(10);
  U.push(h, 'v1');
  U.undo(h, 'v2');                                // future = [v2]
  assert.equal(U.canRedo(h), true);
  U.push(h, 'v1b');                               // 在旧状态上做了新操作
  assert.equal(U.canRedo(h), false);
  assert.equal(U.redo(h, 'x'), null);
});

test('容量上限：超出 cap 丢最旧的快照', () => {
  const h = U.create(3);
  for (let i = 1; i <= 5; i++) U.push(h, 'v' + i);
  assert.equal(h.past.length, 3);
  assert.deepEqual(h.past, ['v3', 'v4', 'v5']);   // v1 / v2 被挤出
});

test('typing 语义：一次输入突发只压一次栈；结构操作或撤销后重新开启', () => {
  const h = U.create(10);
  assert.equal(U.noteTyping(h, 't0'), true);      // 突发起点：压栈
  assert.equal(U.noteTyping(h, 't1'), false);     // 突发中：忽略
  assert.equal(U.noteTyping(h, 't2'), false);
  assert.equal(h.past.length, 1);

  U.push(h, 's0');                                // 结构操作（如着色/删除）：压栈并结束突发
  assert.equal(U.noteTyping(h, 't3'), true);      // 之后的打字是新突发
  assert.equal(h.past.length, 3);

  assert.equal(U.undo(h, 'now'), 't3');           // 撤销也结束突发
  assert.equal(U.noteTyping(h, 't4'), true);
  assert.equal(U.canRedo(h), false);              // noteTyping 同样清空 redo 分支
});

test('不变量：future 栈永不超过 cap（撤销只能消耗 past，而 past 已封顶）', () => {
  /* 快照是整篇克隆。这条钉住内存上界：past + future 任何时候都 ≤ 2 × cap 份——
     撤销链再长，future 也只能长到 past 的存量那么多。 */
  const h = U.create(3);
  ['a', 'b', 'c', 'd', 'e', 'f'].forEach(s => U.push(h, s));
  let cur = 'now';
  let s;
  while ((s = U.undo(h, cur)) !== null) { assert.ok(h.future.length <= 3); cur = s; }
  while ((s = U.redo(h, cur)) !== null) { assert.ok(h.past.length <= 3); cur = s; }
  assert.ok(h.future.length <= 3 && h.past.length <= 3);
});
