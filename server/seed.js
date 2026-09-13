/* 星图 Stellar Raft — 新装数据库的种子
   演示好友与默认管理员，都只在首次启动时种一次。 */
const { q } = require('./db');
const { seedAdmin, ADMIN_IS_DEFAULT, DEMO_CODE } = require('./core');

function runSeeds() {
  (function seedDemo() {
  if (q.userByToken.get('demo-friend-token')) return;
  q.insertUser.run('demo-friend-token', '星图伙伴', '星');
  const u = q.userByToken.get('demo-friend-token');
  const mk = (id, con, x, y, t, label, heads) => ({
    id, con, x, y, strength: t, importance: 1, label,
    tags: ['概念'], summary: '（演示星系）',
    body: heads.map((h, i) => ({ id: id + '-h' + i, type: i === 0 ? 'h2' : 'h3', text: h })),
  });
  const galaxy = {
    constellations: [
      { id: 'astro', name: '天体物理', color: '#ffd98a', health: 0.8, count: 3 },
      { id: 'ml', name: '机器学习', color: '#9fc6ff', health: 0.5, count: 3 },
    ],
    stars: [
      mk('d1', 'astro', 24, 30, 0.9, '钱德拉塞卡极限', ['白矮星的质量上限', '电子简并压', '超新星的引信']),
      mk('d2', 'astro', 34, 48, 0.62, '哈勃定律', ['退行速度与距离', '宇宙膨胀']),
      mk('d3', 'astro', 18, 55, 0.4, '史瓦西半径', ['事件视界', '逃逸速度推导']),
      mk('d4', 'ml', 66, 34, 0.75, '反向传播', ['链式法则', '梯度消失', '计算图']),
      mk('d5', 'ml', 76, 52, 0.5, '注意力机制', ['QKV', '为什么是点积']),
      mk('d6', 'ml', 58, 58, 0.3, '正则化', ['L1 与稀疏性', 'Dropout 的集成视角']),
    ],
    connections: [
      { a: 'd1', b: 'd3', kind: 'intra', rel: '同属致密天体' },
      { a: 'd4', b: 'd5', kind: 'intra', rel: '是其基础' },
      { a: 'd2', b: 'd4', kind: 'cross', rel: '数据拟合的共同思想' },
    ],
    notes: [], inbox: [], timeline: [], trash: [],
    account: { name: '星图伙伴', avatar: '星' },
  };
  q.putGalaxy.run(u.id, JSON.stringify(galaxy), 1);
  q.upsertShare.run(u.id, 1, DEMO_CODE, 'outline');
  // 新装 DB 一次性标记：第一位建档的旅行者会收到两封演示「星际来信」
  q.metaSet.run('welcome_inbox_pending', '1');
  console.log('[seed] 演示好友「星图伙伴」已就绪，分享码', DEMO_CODE);
})();

/* 默认管理员入户：新装 DB 首次启动时建号并把凭据打在控制台上（只此一次）。
   出厂凭据是公开知识（README 与这段日志里都有），所以第一次登录会被交接卡拦住，
   当场把用户名与密码一起换掉；SR_ADMIN_USER / SR_ADMIN_PASS 指定过的不算出厂凭据，
   那是运维自己挑的，不再拦。 */
  (function announceAdmin() {
  const a = seedAdmin();
  if (!a) return;
  console.log('');
  console.log('  ┌─ 星港管理员已入户 ───────────────────────────────');
  console.log('  │  用户名   ' + a.username);
  console.log('  │  密码     ' + a.password);
  console.log('  │');
  if (ADMIN_IS_DEFAULT) {
    console.log('  │  这是出厂凭据，公开在 README 里 —— 第一次登录会要求你');
    console.log('  │  当场把用户名与密码一起换掉，换完请记牢：星图不发找回邮件。');
    console.log('  │  想跳过这一步，下次装机前先指定自己的凭据：');
    console.log('  │      SR_ADMIN_USER=captain SR_ADMIN_PASS=\'你的强密码\' npm run serve');
  } else {
    console.log('  │  凭据由 SR_ADMIN_USER / SR_ADMIN_PASS 指定，不是出厂值。');
  }
  console.log('  │  登录后侧边栏底部出现「星港管理台」入口。');
  console.log('  └──────────────────────────────────────────────────');
  console.log('');
})();
}

module.exports = { runSeeds };
