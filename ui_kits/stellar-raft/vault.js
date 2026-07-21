/* vault.js — window.SRVault：把整片星空导出为 Obsidian 风格的 Markdown 仓库（zip）。
   纯字符串/字节实现，不依赖 DOM，Node 可直接 import 做单元测试（tests/vault.test.js）。
   - buildVault(data)  → [{ path, text }]：每颗星一个 .md（frontmatter + 正文 + [[wikilink]] 关联），
     按星域分文件夹，附一份 README.md 索引
   - buildZip(entries, nowMs) → Uint8Array：零依赖 zip（store 存储法 + CRC32，UTF-8 文件名），
     Typora / Obsidian / 系统解压器都能直接打开
   正文序列化复用 SRMd.blocksToMd——与单星导出同一 GFM 保真口径。 */
(function () {
  'use strict';

  /* ---------------- CRC32（标准查表法） ---------------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (bytes) => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  /* ---------------- zip（store 法，无压缩） ----------------
     知识仓库以文本为主，store 法免去 deflate 依赖；文件名带 UTF-8 标志位（bit 11），
     中文星名/星域名在任何现代解压器里都不乱码。 */
  const enc = new TextEncoder();
  const dosTime = (ms) => {
    const d = new Date(ms);
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
      date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  };
  function buildZip(entries, nowMs) {
    const { time, date } = dosTime(nowMs || 0);
    const chunks = [];
    const central = [];
    let offset = 0;
    const push = (buf) => { chunks.push(buf); offset += buf.length; };
    const u16 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
    const u32 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
    const cat = (arrs) => {
      const total = arrs.reduce((a, b) => a + b.length, 0);
      const out = new Uint8Array(total);
      let p = 0; arrs.forEach(a => { out.set(a, p); p += a.length; });
      return out;
    };
    (entries || []).forEach(e => {
      const name = enc.encode(e.path);
      const data = enc.encode(String(e.text == null ? '' : e.text));
      const crc = crc32(data);
      const headerOffset = offset;
      push(cat([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0),       // 签名 · 版本 · UTF-8 标志 · store
        u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), name, data,
      ]));
      central.push(cat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
        u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(headerOffset), name,
      ]));
    });
    const cdStart = offset;
    central.forEach(push);
    const cdSize = offset - cdStart;
    push(cat([
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(cdSize), u32(cdStart), u16(0),
    ]));
    return cat(chunks);
  }

  /* ---------------- 星空 → Markdown 仓库条目 ---------------- */
  // 文件名卫生：去掉文件系统与 Obsidian 链接的敏感字符，钳长度；空名回退「未命名星」
  const safeName = (s) => {
    const n = String(s == null ? '' : s)
      .replace(/[/\\:*?"<>|#^[\]\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.+$/, '')
      .slice(0, 60)
      .trim();
    return n || '未命名星';
  };
  const stripHtml = (h) => String(h == null ? '' : h).replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  /* data: { stars, constellations, connections, account } —— 与 SR_DATA / 快照同构。
     返回 [{ path, text }]；同名星自动追加序号，wikilink 始终指向去重后的最终文件名。 */
  function buildVault(data) {
    const Md = (typeof globalThis !== 'undefined' && globalThis.SRMd) || (typeof window !== 'undefined' && window.SRMd);
    if (!Md) throw new Error('SRMd 未加载');
    const stars = data.stars || [];
    const cons = data.constellations || [];
    const conns = data.connections || [];
    const conName = (id) => (cons.find(c => c.id === id) || {}).name || '未分域';

    // 第一遍：为每颗星定下唯一文件名（跨星域也不重名——Obsidian 的 [[链接]] 不带路径）
    const nameOf = {};
    const used = new Set();
    stars.forEach(s => {
      const base = safeName(s.label);
      let name = base, n = 2;
      while (used.has(name)) { name = base + ' ' + n; n++; }
      used.add(name);
      nameOf[s.id] = name;
    });

    const entries = [];
    stars.forEach(s => {
      // 关联小节：连线的对端星 → [[wikilink]] + 关系语句（跨仓库跳转在 Obsidian 里原生可点）
      const related = conns
        .filter(c => c.a === s.id || c.b === s.id)
        .map(c => {
          const other = stars.find(x => x.id === (c.a === s.id ? c.b : c.a));
          if (!other) return null;
          const rel = stripHtml(c.rel || '').trim();
          return '- [[' + nameOf[other.id] + ']]' + (rel ? ' — ' + rel : '');
        })
        .filter(Boolean);
      const bodyMd = Md.blocksToMd(s.body || [], {
        title: stripHtml(s.label),
        props: s.props, tags: s.tags, summary: stripHtml(s.summary || ''),
      });
      const text = bodyMd + (related.length ? '\n## 关联\n\n' + related.join('\n') + '\n' : '');
      entries.push({ path: safeName(conName(s.con)) + '/' + nameOf[s.id] + '.md', text });
    });

    // 索引：星域 → 星清单（wikilink），任何支持 Markdown 的工具都能作为入口浏览
    const owner = (data.account && data.account.name) || '观星者';
    const idx = ['# ' + owner + '的星空', '', '共 ' + stars.length + ' 颗知识星 · ' + cons.length + ' 个星域。', ''];
    cons.forEach(c => {
      const members = stars.filter(s => s.con === c.id);
      if (!members.length) return;
      idx.push('## ' + stripHtml(c.name));
      idx.push('');
      members.forEach(s => idx.push('- [[' + nameOf[s.id] + ']]'));
      idx.push('');
    });
    const orphans = stars.filter(s => !cons.find(c => c.id === s.con));
    if (orphans.length) {
      idx.push('## 未分域');
      idx.push('');
      orphans.forEach(s => idx.push('- [[' + nameOf[s.id] + ']]'));
      idx.push('');
    }
    entries.unshift({ path: 'README.md', text: idx.join('\n') });
    return entries;
  }

  const api = { buildZip, buildVault, crc32, safeName };
  if (typeof window !== 'undefined') window.SRVault = api;
  if (typeof globalThis !== 'undefined') globalThis.SRVault = api;
})();
