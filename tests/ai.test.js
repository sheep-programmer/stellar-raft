/* 星图 Stellar Raft — SRAI（AI 能力核心层）与 SRNet 快照/账号卫生测试
   ai.js / api.js 都是 plain global 脚本，用 node:vm 加最小 shim 载入。

   覆盖：配置默认值归并 · isConfigured 判定（官方端点须有密钥，自定义网关可无）
   · chat 的 OpenAI / Anthropic 双协议请求形状 · 错误人话化（401）· chatJSON 剥围栏
   · snapshot 携带账号级偏好与 AI 配置（设备偏好 motion/twinkle 不进快照）
   · adoptSession 的本地卫生：密钥/提醒标记/密文备忘绝不串到下一个账号。 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AI_CODE = fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'ai.js'), 'utf8');
const API_CODE = fs.readFileSync(path.join(ROOT, 'ui_kits', 'stellar-raft', 'api.js'), 'utf8');

function makeCtx({ fetchImpl } = {}) {
  const storage = new Map();
  const windowObj = {
    addEventListener: () => { },
    removeEventListener: () => { },
    dispatchEvent: () => true,
  };
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  const ctx = vm.createContext({
    window: windowObj,
    localStorage,
    document: { hidden: true },
    addEventListener: () => { },
    setInterval: () => 0,
    clearInterval: () => { },
    setTimeout, clearTimeout,
    fetch: fetchImpl || (() => Promise.reject(new Error('Failed to fetch'))),
    AbortController,
    CustomEvent: class CustomEvent { constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; } },
    crypto: { randomUUID: () => 'test-uuid' },
    navigator: { sendBeacon: () => true },
    JSON, Math, Date, Promise, Object, Array, String, Number, Error,
    console,
  });
  return { ctx, windowObj, storage };
}

const okJson = (payload) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });

/* ------------------------------ SRAI 配置 ------------------------------ */

test('配置默认值归并：残缺存档补默认；isConfigured 官方端点须密钥、自定义网关可无', () => {
  const { ctx, windowObj, storage } = makeCtx();
  storage.set('sr.aiConfig', JSON.stringify({ provider: 'anthropic', providers: { anthropic: { key: 'sk-ant-x' } } }));
  vm.runInContext(AI_CODE, ctx, { filename: 'ai.js' });
  const AI = windowObj.SRAI;
  const cfg = AI.getConfig();
  assert.equal(cfg.providers.anthropic.baseUrl, 'https://api.anthropic.com/v1');   // 默认补齐
  assert.equal(cfg.providers.anthropic.model, 'claude-sonnet-5');
  assert.equal(cfg.strategy, 'cooling');
  assert.equal(AI.isConfigured(), true);

  AI.setConfig({ ...cfg, provider: 'openai' });          // openai 无密钥 → 不可用
  assert.equal(AI.isConfigured(), false);
  AI.setConfig({ ...cfg, provider: 'custom', providers: { ...cfg.providers, custom: { baseUrl: 'http://127.0.0.1:11434/v1', key: '', model: 'qwen3' } } });
  assert.equal(AI.isConfigured(), true);                 // 本地网关可无密钥
});

test('chat：OpenAI 兼容协议的请求形状（system 併入 messages，Bearer 头）', async () => {
  const calls = [];
  const { ctx, windowObj, storage } = makeCtx({
    fetchImpl: (url, opts) => { calls.push({ url, opts }); return okJson({ choices: [{ message: { content: ' 你好 ' } }] }); },
  });
  storage.set('sr.aiConfig', JSON.stringify({ provider: 'custom', providers: { custom: { baseUrl: 'https://gw.example.com/v1/', key: 'tok', model: 'm1' } } }));
  vm.runInContext(AI_CODE, ctx, { filename: 'ai.js' });
  const out = await windowObj.SRAI.chat([{ role: 'user', content: '讲讲熵' }], { system: '你是学生' });
  assert.equal(out, '你好');
  assert.equal(calls[0].url, 'https://gw.example.com/v1/chat/completions');   // 末尾斜杠已归一
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer tok');
  const body = JSON.parse(calls[0].opts.body);
  assert.deepEqual(body.messages[0], { role: 'system', content: '你是学生' });
  assert.deepEqual(body.messages[1], { role: 'user', content: '讲讲熵' });
});

test('chat：Anthropic 协议的请求形状（独立 system 字段，x-api-key 头）', async () => {
  const calls = [];
  const { ctx, windowObj, storage } = makeCtx({
    fetchImpl: (url, opts) => { calls.push({ url, opts }); return okJson({ content: [{ type: 'text', text: '追问：为什么？' }] }); },
  });
  storage.set('sr.aiConfig', JSON.stringify({ provider: 'anthropic', providers: { anthropic: { key: 'sk-ant-1' } } }));
  vm.runInContext(AI_CODE, ctx, { filename: 'ai.js' });
  const out = await windowObj.SRAI.chat([{ role: 'user', content: '讲讲熵' }], { system: '你是学生' });
  assert.equal(out, '追问：为什么？');
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].opts.headers['x-api-key'], 'sk-ant-1');
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.system, '你是学生');
  assert.ok(!body.messages.some(m => m.role === 'system'), 'anthropic 的 system 不进 messages');
});

test('chat 错误人话化：401 → 密钥无效；未配置直接抛 unconfigured', async () => {
  const { ctx, windowObj, storage } = makeCtx({
    fetchImpl: () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: { message: 'bad key' } }) }),
  });
  storage.set('sr.aiConfig', JSON.stringify({ provider: 'openai', providers: { openai: { key: 'sk-x' } } }));
  vm.runInContext(AI_CODE, ctx, { filename: 'ai.js' });
  await assert.rejects(() => windowObj.SRAI.chat([{ role: 'user', content: 'hi' }]), /密钥无效/);
  windowObj.SRAI.clearConfig();
  await assert.rejects(() => windowObj.SRAI.chat([{ role: 'user', content: 'hi' }]), (e) => e.code === 'unconfigured');
});

test('chatJSON：剥 markdown 围栏取 JSON；解析失败给人话错误', async () => {
  let reply = '```json\n["量子", "熵"]\n```';
  const { ctx, windowObj, storage } = makeCtx({
    fetchImpl: () => okJson({ choices: [{ message: { content: reply } }] }),
  });
  storage.set('sr.aiConfig', JSON.stringify({ provider: 'openai', providers: { openai: { key: 'sk-x' } } }));
  vm.runInContext(AI_CODE, ctx, { filename: 'ai.js' });
  assert.deepEqual(await windowObj.SRAI.chatJSON([{ role: 'user', content: 'tags' }]), ['量子', '熵']);
  reply = '这不是 JSON';
  await assert.rejects(() => windowObj.SRAI.chatJSON([{ role: 'user', content: 'tags' }]), /无法解析/);
});

/* ------------------------- SRNet 快照与账号卫生 ------------------------- */

function loadNet({ storage: preset } = {}) {
  const { ctx, windowObj, storage } = makeCtx({ fetchImpl: () => okJson({ ok: true, version: 1 }) });
  if (preset) Object.entries(preset).forEach(([k, v]) => storage.set(k, v));
  vm.runInContext(AI_CODE, ctx, { filename: 'ai.js' });
  vm.runInContext(API_CODE, ctx, { filename: 'api.js' });
  return { windowObj, storage };
}

test('snapshot：携带账号级偏好与 AI 配置；motion/twinkle 设备偏好不进快照', () => {
  const { windowObj } = loadNet({
    storage: {
      'sr.settings': JSON.stringify({ nickname: '深空', bio: '观星者', remindTime: '20:00', motion: false, twinkle: false, dimNudge: true }),
      'sr.aiConfig': JSON.stringify({ provider: 'openai', providers: { openai: { key: 'sk-snap' } } }),
    },
  });
  windowObj.SR_DATA = {
    constellations: [], stars: [], connections: [], notes: [], inbox: [], timeline: [], trash: [],
    account: { name: '深空', avatar: '深', bio: '观星者' },
  };
  const snap = windowObj.SRNet.snapshot();
  assert.equal(snap.account.bio, '观星者');
  assert.equal(snap.prefs.remindTime, '20:00');
  assert.equal(snap.prefs.dimNudge, true);
  assert.ok(!('motion' in snap.prefs) || snap.prefs.motion === undefined, 'motion 不进快照');
  assert.ok(!('twinkle' in snap.prefs) || snap.prefs.twinkle === undefined, 'twinkle 不进快照');
  assert.equal(snap.aiConfig.providers.openai.key, 'sk-snap');
});

test('adoptSession：换身份清干净——密钥/提醒标记/密文备忘不串号，设备偏好保留', async () => {
  const { windowObj, storage } = loadNet({
    storage: {
      'sr.settings': JSON.stringify({ nickname: '旧号', bio: '旧简介', remindTime: '20:00', motion: false }),
      'sr.aiConfig': JSON.stringify({ provider: 'openai', providers: { openai: { key: 'sk-old' } } }),
      'sr.remind.last': '2026-07-20',
      'sr.dimnudge.last': '2026-07-20',
      'sr.visit.codes.v1': JSON.stringify({ 3: 'XING-AAAA-BBBB' }),
      'sr.galaxy.v1': JSON.stringify({ savedAt: 1, data: { stars: [] } }),
    },
  });
  await windowObj.SRNet.adoptSession('session-token-new');
  assert.equal(storage.get('sr.token'), 'session-token-new');
  assert.equal(storage.has('sr.galaxy.v1'), false);
  assert.equal(storage.has('sr.aiConfig'), false, 'AI 密钥绝不能留给下一个账号');
  assert.equal(storage.has('sr.remind.last'), false);
  assert.equal(storage.has('sr.dimnudge.last'), false);
  assert.equal(storage.has('sr.visit.codes.v1'), false);
  const prefs = JSON.parse(storage.get('sr.settings'));
  assert.equal(prefs.nickname, undefined);
  assert.equal(prefs.bio, undefined);
  assert.equal(prefs.remindTime, undefined);
  assert.equal(prefs.motion, false, '动效等设备偏好保留');
});
