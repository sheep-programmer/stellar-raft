/* ===== Stellar Raft UI kit — mock data (plain global, no imports) =====
   Every star carries its own note: a one-line summary, frontmatter props,
   and a real block body. Connections carry a relation sentence. Plus
   inbox cards and an ignite timeline for those two views. */
window.SR_DATA = (function () {
  const constellations = [
    { id: 'qm',  name: '量子力学',   color: '#ffd98a', health: 0.9,  count: 48 },
    { id: 'la',  name: '线性代数',   color: '#9fc6ff', health: 0.66, count: 31 },
    { id: 'ds',  name: '数据结构',   color: '#7896cd', health: 0.34, count: 12 },
    { id: 'th',  name: '热力学',     color: '#bcd0ff', health: 0.55, count: 19 },
  ];

  // Each star: layout (x,y %), strength, importance, label + its own note.
  const stars = [
    {
      id: 's1', con: 'qm', x: 26, y: 32, strength: 0.95, importance: 1.5, label: '贝尔不等式', fav: true,
      summary: '贝尔不等式给出了任何定域隐变量理论所能产生的关联的统计上限；实验上对它的违背，确立了量子纠缠的非定域性。',
      props: { type: '推导', status: '牢固', source: '量子信息 · 第 4 讲', alias: 'Bell inequality', nextReview: '6 天后' },
      tags: ['推导', '考点'],
      body: [
        { id: 's1-r', type: 'rich' },
        { id: 's1-h', type: 'h2', text: 'CHSH 形式' },
        { id: 's1-c', type: 'callout', tone: 'gold', text: '关键判据：经典定域理论给出 |S| ≤ 2，而量子力学允许 |S| 达到 2√2 ≈ 2.83。' },
        { id: 's1-m', type: 'math', tex: 'S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′),   |S| ≤ 2' },
        { id: 's1-l1', type: 'bulleted', text: '经典定域理论：|S| ≤ 2' },
        { id: 's1-l2', type: 'bulleted', text: '量子力学预测：|S| 可达 2√2 ≈ 2.83' },
        { id: 's1-l3', type: 'bulleted', text: '实验值显著超过 2，排除定域隐变量' },
        { id: 's1-h2', type: 'h3', text: '实验验证' },
        { id: 's1-t1', type: 'todo', checked: true, text: 'Aspect 1982 实验（光子偏振关联）' },
        { id: 's1-t2', type: 'todo', checked: false, text: '复现 CHSH 推导（待整理）' },
        { id: 's1-code', type: 'code', lang: 'python', code: 'import numpy as np\n\n# CHSH: four correlation terms at optimal angles\nangles = [0, np.pi/4, np.pi/8, 3*np.pi/8]\ndef E(a, b):\n    return -np.cos(2 * (a - b))\n\nS = E(0, angles[2]) - E(0, angles[3]) + E(angles[1], angles[2]) + E(angles[1], angles[3])\nprint(abs(S))   # -> 2.828...  ( = 2*sqrt(2) )' },
        { id: 's1-q', type: 'quote', text: '"No reasonable definition of reality could be expected to permit this." — EPR, 1935' },
        { id: 's1-tg', type: 'toggle', open: false, text: '延伸：GHZ 态与三粒子佯谬', child: 'GHZ 态用三个粒子给出确定性（而非统计性）的矛盾，比 CHSH 更强地排除了定域实在论。' },
        { id: 's1-tb', type: 'table', head: ['理论', 'S 上限', '是否定域'], rows: [['经典隐变量', '2', '是'], ['量子力学', '2√2 ≈ 2.83', '否'], ['实验观测', '≈ 2.4', '—']] },
        { id: 's1-d', type: 'divider' },
        { id: 's1-p', type: 'p', text: '' },
      ],
    },
    {
      id: 's2', con: 'qm', x: 17, y: 48, strength: 0.78, importance: 1.0, label: '纠缠态',
      summary: '两个或多个粒子的联合态无法写成各自状态的张量积；测量其中一方，会瞬间确定另一方的结果。',
      props: { type: '概念', status: '复习中', source: '量子信息 · 第 3 讲', alias: 'Entanglement', nextReview: '明天' },
      tags: ['概念', '考点'],
      body: [
        { id: 's2-r', type: 'rich' },
        { id: 's2-h', type: 'h3', text: '贝尔基' },
        { id: 's2-m', type: 'math', tex: '|Φ⁺⟩ = (|00⟩ + |11⟩) / √2' },
        { id: 's2-l1', type: 'bulleted', text: '四个贝尔态构成两比特的一组正交基' },
        { id: 's2-l2', type: 'bulleted', text: '最大纠缠：单方约化密度矩阵为最大混合态' },
        { id: 's2-l3', type: 'bulleted', text: '纠缠无法靠局域操作与经典通信（LOCC）凭空增加' },
        { id: 's2-c', type: 'callout', tone: 'blue', text: '纠缠是一种资源——量子隐形传态、超密编码、量子密钥分发都建立在它之上。' },
        { id: 's2-q', type: 'quote', text: '"Spooky action at a distance." — Einstein' },
      ],
    },
    {
      id: 's3', con: 'qm', x: 33, y: 52, strength: 0.6, importance: 0.95, label: '叠加原理',
      summary: '量子态空间是线性的：若干本征态的线性组合仍是合法状态，测量时按振幅模方坍缩到某一本征态。',
      props: { type: '概念', status: '正常', source: '量子力学导论 · 第 2 章', alias: 'Superposition', nextReview: '4 天后' },
      tags: ['概念'],
      body: [
        { id: 's3-r', type: 'rich' },
        { id: 's3-h', type: 'h3', text: '线性与测量' },
        { id: 's3-m', type: 'math', tex: '|ψ⟩ = α|0⟩ + β|1⟩,   |α|² + |β|² = 1' },
        { id: 's3-l1', type: 'bulleted', text: '态空间线性 → 解可叠加' },
        { id: 's3-l2', type: 'bulleted', text: '测量按 |α|² 概率坍缩到对应本征态' },
        { id: 's3-l3', type: 'bulleted', text: '相对相位可观测，体现为干涉' },
        { id: 's3-c', type: 'callout', tone: 'gold', text: '双缝实验：单个粒子同时"经过"两条路径并与自身干涉，正是叠加的直接证据。' },
      ],
    },
    {
      id: 's4', con: 'qm', x: 24, y: 19, strength: 0.42, importance: 0.8, label: '波函数',
      summary: '波函数 ψ 编码了量子系统的全部信息；其模方给出测量结果的概率密度，随时间按薛定谔方程演化。',
      props: { type: '概念', status: '正变暗', source: '量子力学导论 · 第 1 章', alias: 'Wavefunction', nextReview: '已逾期' },
      tags: ['概念', '复习'],
      body: [
        { id: 's4-r', type: 'rich' },
        { id: 's4-m1', type: 'math', tex: 'P(x) = |ψ(x,t)|²' },
        { id: 's4-l1', type: 'bulleted', text: 'Born 规则：概率密度等于振幅模方' },
        { id: 's4-l2', type: 'bulleted', text: '归一化：∫|ψ|² dx = 1' },
        { id: 's4-l3', type: 'bulleted', text: '演化遵从薛定谔方程' },
        { id: 's4-m2', type: 'math', tex: 'iℏ ∂ψ/∂t = Ĥψ' },
        { id: 's4-c', type: 'callout', tone: 'blue', text: '波函数"坍缩"如何发生，至今仍是量子诠释争论的核心。' },
      ],
    },
    {
      id: 's5', con: 'la', x: 70, y: 27, strength: 0.82, importance: 1.3, label: '特征值', fav: true,
      summary: '特征向量在矩阵作用下只被缩放不被转向，缩放因子即特征值；它揭示线性变换的"主轴"。',
      props: { type: '推导', status: '牢固', source: '线性代数 · 第 5 章', alias: 'Eigenvalue', nextReview: '7 天后' },
      tags: ['推导', '公式'],
      body: [
        { id: 's5-r', type: 'rich' },
        { id: 's5-m', type: 'math', tex: 'A v = λ v' },
        { id: 's5-l1', type: 'bulleted', text: '特征多项式：det(A − λI) = 0' },
        { id: 's5-l2', type: 'bulleted', text: '可对角化 ⇔ 有 n 个线性无关特征向量' },
        { id: 's5-l3', type: 'bulleted', text: '对称矩阵：特征值为实数，特征向量相互正交' },
        { id: 's5-h', type: 'h3', text: '应用' },
        { id: 's5-n1', type: 'numbered', text: '主成分分析（PCA）取最大特征值方向' },
        { id: 's5-n2', type: 'numbered', text: '结构振动的固有模态' },
        { id: 's5-n3', type: 'numbered', text: '量子可观测量的本征值' },
        { id: 's5-code', type: 'code', lang: 'python', code: 'import numpy as np\n\nA = np.array([[2., 1.],\n              [1., 2.]])\nvals, vecs = np.linalg.eig(A)\nprint(vals)   # [3. 1.]\nprint(vecs)   # 正交特征向量' },
      ],
    },
    {
      id: 's6', con: 'la', x: 80, y: 40, strength: 0.55, importance: 0.95, label: '奇异值分解',
      summary: '任意矩阵都能分解为旋转·缩放·旋转三步（A = UΣVᵀ），是特征分解向非方阵的推广。',
      props: { type: '推导', status: '正常', source: '线性代数 · 第 6 章', alias: 'SVD', nextReview: '3 天后' },
      tags: ['推导', '公式'],
      body: [
        { id: 's6-r', type: 'rich' },
        { id: 's6-m', type: 'math', tex: 'A = U Σ Vᵀ' },
        { id: 's6-l1', type: 'bulleted', text: '奇异值是 AᵀA 特征值的平方根' },
        { id: 's6-l2', type: 'bulleted', text: '任意形状矩阵都可分解（不要求方阵）' },
        { id: 's6-l3', type: 'bulleted', text: '截断前 k 个奇异值即得最优低秩近似（Eckart–Young）' },
        { id: 's6-c', type: 'callout', tone: 'gold', text: '推荐系统、图像压缩、PCA 在 SVD 下统一为同一件事：抓住最强的几个方向。' },
      ],
    },
    {
      id: 's7', con: 'la', x: 63, y: 42, strength: 0.5, importance: 0.85, label: '正交基',
      summary: '一组两两正交且单位长度的向量构成标准正交基；在它之下，坐标就是内积投影，计算大为简化。',
      props: { type: '概念', status: '正常', source: '线性代数 · 第 4 章', alias: 'Orthonormal basis', nextReview: '5 天后' },
      tags: ['概念'],
      body: [
        { id: 's7-r', type: 'rich' },
        { id: 's7-m', type: 'math', tex: '⟨eᵢ, eⱼ⟩ = δᵢⱼ' },
        { id: 's7-l1', type: 'bulleted', text: 'Gram–Schmidt 把任意一组基正交化' },
        { id: 's7-l2', type: 'bulleted', text: '标准正交基下，坐标 = 与基向量的内积' },
        { id: 's7-l3', type: 'bulleted', text: '简化最小二乘投影与傅里叶展开' },
        { id: 's7-t', type: 'todo', checked: false, text: '复习 Gram–Schmidt 的逐步推导' },
      ],
    },
    {
      id: 's8', con: 'ds', x: 33, y: 68, strength: 0.3, importance: 1.0, label: '红黑树',
      summary: '一种自平衡二叉搜索树，用节点染色约束树高，保证查找、插入、删除都是 O(log n)。',
      props: { type: '考点', status: '正变暗', source: '算法导论 · 第 13 章', alias: 'Red-Black Tree', nextReview: '已逾期' },
      tags: ['考点', '复习'],
      body: [
        { id: 's8-r', type: 'rich' },
        { id: 's8-l1', type: 'bulleted', text: '每个节点非红即黑' },
        { id: 's8-l2', type: 'bulleted', text: '根与叶（NIL）为黑' },
        { id: 's8-l3', type: 'bulleted', text: '红节点的子节点必为黑（不出现连续红）' },
        { id: 's8-l4', type: 'bulleted', text: '从任一节点到其叶的每条路径黑节点数相同' },
        { id: 's8-c', type: 'callout', tone: 'blue', text: '这些约束让最长路径至多是最短路径的两倍，从而把树高锁在 O(log n)。' },
        { id: 's8-tb', type: 'table', head: ['操作', '平均', '最坏'], rows: [['查找', 'O(log n)', 'O(log n)'], ['插入', 'O(log n)', 'O(log n)'], ['删除', 'O(log n)', 'O(log n)']] },
      ],
    },
    {
      id: 's9', con: 'ds', x: 19, y: 70, strength: 0.16, importance: 0.75, label: '并查集',
      summary: '维护不相交集合的合并与查询；配合路径压缩与按秩合并，单次操作摊还近似 O(1)。',
      props: { type: '考点', status: '将熄灭', source: '算法导论 · 第 21 章', alias: 'Union-Find', nextReview: '已逾期' },
      tags: ['考点', '复习'],
      body: [
        { id: 's9-r', type: 'rich' },
        { id: 's9-l1', type: 'bulleted', text: 'find：查根 + 路径压缩' },
        { id: 's9-l2', type: 'bulleted', text: 'union：按秩 / 按大小合并' },
        { id: 's9-l3', type: 'bulleted', text: '摊还复杂度 O(α(n))，α 为反阿克曼函数，近似常数' },
        { id: 's9-code', type: 'code', lang: 'python', code: 'parent = list(range(n))\n\ndef find(x):\n    while parent[x] != x:\n        parent[x] = parent[parent[x]]   # 路径压缩\n        x = parent[x]\n    return x\n\ndef union(a, b):\n    parent[find(a)] = find(b)' },
        { id: 's9-c', type: 'callout', tone: 'blue', text: 'Kruskal 最小生成树、连通分量判定都以并查集为核心。' },
      ],
    },
    {
      id: 's10', con: 'ds', x: 40, y: 84, strength: 0.24, importance: 0.8, label: '跳表',
      summary: '在有序链表上叠加多级"快车道"索引，用随机化把查找期望复杂度降到 O(log n)。',
      props: { type: '考点', status: '正变暗', source: '算法导论 · 补充', alias: 'Skip List', nextReview: '明天' },
      tags: ['考点'],
      body: [
        { id: 's10-r', type: 'rich' },
        { id: 's10-l1', type: 'bulleted', text: '多层有序链表，底层包含全部元素' },
        { id: 's10-l2', type: 'bulleted', text: '每个节点以概率 p 提升到上一层' },
        { id: 's10-l3', type: 'bulleted', text: '期望层高与查找代价均为 O(log n)' },
        { id: 's10-m', type: 'math', tex: 'E[查找] = O(log₁/ₚ n)' },
        { id: 's10-c', type: 'callout', tone: 'gold', text: '用随机化换取实现简单——Redis 的有序集合（ZSet）底层即跳表。' },
      ],
    },
    {
      id: 's11', con: 'th', x: 72, y: 72, strength: 0.62, importance: 1.1, label: '熵增原理',
      summary: '孤立系统的总熵永不减少；这条第二定律给出了时间的方向，也刻画了不可逆性的根源。',
      props: { type: '推导', status: '正常', source: '热力学 · 第 3 章', alias: 'Entropy', nextReview: '6 天后' },
      tags: ['推导', '考点'],
      body: [
        { id: 's11-r', type: 'rich' },
        { id: 's11-m1', type: 'math', tex: 'dS ≥ δQ / T,   孤立系统 ΔS ≥ 0' },
        { id: 's11-l1', type: 'bulleted', text: '第二定律：孤立系统的熵不减' },
        { id: 's11-l2', type: 'bulleted', text: '可逆过程取等号 ΔS = 0' },
        { id: 's11-l3', type: 'bulleted', text: '玻尔兹曼：熵是微观态数的度量 S = k ln Ω' },
        { id: 's11-q', type: 'quote', text: '熵是时间之箭。 — Eddington' },
        { id: 's11-c', type: 'callout', tone: 'blue', text: '热力学熵与信息熵在形式上一致——都是对不确定性的计量。' },
      ],
    },
    {
      id: 's12', con: 'th', x: 83, y: 64, strength: 0.48, importance: 0.85, label: '卡诺循环',
      summary: '由两条等温线与两条绝热线构成的可逆循环，给出了在两个热源间工作的热机效率上限。',
      props: { type: '推导', status: '正常', source: '热力学 · 第 4 章', alias: 'Carnot cycle', nextReview: '3 天后' },
      tags: ['推导', '公式'],
      body: [
        { id: 's12-r', type: 'rich' },
        { id: 's12-h', type: 'h3', text: '四个过程' },
        { id: 's12-n1', type: 'numbered', text: '等温吸热（与高温热源接触）' },
        { id: 's12-n2', type: 'numbered', text: '绝热膨胀（温度降至低温）' },
        { id: 's12-n3', type: 'numbered', text: '等温放热（与低温热源接触）' },
        { id: 's12-n4', type: 'numbered', text: '绝热压缩（温度回到高温）' },
        { id: 's12-m', type: 'math', tex: 'η = 1 − T_c / T_h' },
        { id: 's12-c', type: 'callout', tone: 'gold', text: '任何热机的效率都不超过同温区间的卡诺效率——这是可逆性给出的理论上限。' },
      ],
    },
  ];

  // Connections: intra (blue) and cross-constellation 融会贯通 (gold), each with a relation sentence.
  const connections = [
    { a: 's1', b: 's2', kind: 'intra', rel: '纠缠态是检验贝尔不等式的物理载体' },
    { a: 's1', b: 's3', kind: 'intra', rel: '叠加原理是产生纠缠与贝尔关联的前提' },
    { a: 's2', b: 's4', kind: 'intra', rel: '波函数用于描述纠缠态的联合振幅' },
    { a: 's5', b: 's6', kind: 'intra', rel: '奇异值分解是特征分解向任意矩阵的推广' },
    { a: 's5', b: 's7', kind: 'intra', rel: '正交基张成特征向量所在的空间' },
    { a: 's8', b: 's9', kind: 'intra', rel: '同为支撑高效算法的基础数据结构' },
    { a: 's8', b: 's10', kind: 'intra', rel: '平衡树与概率结构是对同一问题的两种解法' },
    { a: 's11', b: 's12', kind: 'intra', rel: '卡诺循环是熵增 / 第二定律的理想化体现' },
    { a: 's1', b: 's5', kind: 'cross', rel: '量子可观测量即希尔伯特空间上算符的特征值' },
    { a: 's5', b: 's11', kind: 'cross', rel: '对角化是统计力学中密度矩阵与配分函数的计算工具' },
  ];

  const byId = Object.fromEntries(stars.map(s => [s.id, s]));

  /* ===== 记忆衰减模型（FSRS-lite）=========================================
     每颗星维护 sr = { S: 稳定度(天), last: 上次成功复习(ms), due: 手动队列覆盖(ms, 0=无),
                       lit: 0|点亮时刻(ms), ember: 0|熄灭时刻(ms) }。
     可提取率 R = exp(−Δt天 / S)，重算后直接写回 star.strength ——
     星图 / 鸟瞰 / 三维 / 列表 / MemoryBar 的亮度全部吃这个值（映射到 --mem-* 温度梯），
     放几天不看，星真的会变暗。

     点亮（认证轴，与亮度四档正交）：
       未点亮 := lit=0 ∧ ember=0（缺省，全部旧档案）
       已点亮 := lit>0 —— 费曼讲透授予；「记得」乘数升到 2.2，稳定度上限 365
       待重燃 := lit=0 ∧ ember>0 —— 已点亮星 R<0.35（或被评「忘了」）熄灭；
                三档复习按未点亮参数只回亮度，认证只能靠费曼重燃
     复习成功：S ×= (增长因子 + (1−R)·0.6)，点亮/重燃 2.5 / lit 星记得 2.2 / 普通复习 1.8；
     失败：S ×= 0.45（lit 星 0.55 且立即熄灭）。
     稳定度上限：曾点亮星（lit 或 ember）365；从未点亮星 min(新S, max(当前S, 60))——只封顶生长，
     绝不削减旧档案里已有的 S。R 衰减到 0.60 即视为到期，复习队列按到期时刻升序。 */
  const DAY = 86400000;
  const MEM = {
    rMin: 0.02, rMax: 0.98, dueR: 0.6, growIgnite: 2.5, growReview: 1.8, growPartial: 1.2,
    partialR: 0.85, shrinkFail: 0.45, sMin: 0.8, sMax: 365,
    emberR: 0.35,        // 熄灭阈值：已点亮星 R < 0.35 → 待重燃
    growReviewLit: 2.2,  // 已点亮星「记得」的 S 乘数（未点亮 1.8）
    shrinkFailLit: 0.55, // 已点亮星「忘了」的回缩（未点亮 0.45），且随即熄灭
    sMaxUnlit: 60,       // 从未点亮星的稳定度上限；sMax:365 只留给曾点亮星（lit 或 ember）
  };
  const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // 种子星：由 strength 反推「相对当前时间」的 lastReview / stability——
  // demo 一打开就有正发光 / 正变暗的层次，且此后随真实时间继续衰减。
  const seedStability = (r) => r >= 0.85 ? 34 : r >= 0.7 ? 21 : r >= 0.55 ? 12 : r >= 0.4 ? 7 : r >= 0.2 ? 3.5 : 1.8;
  // 唯一迁移入口：旧快照（localStorage / sqlite / 黑洞 payload / 无 sr 的种子星）
  // 打开即补默认 lit:0 / ember:0 —— 全部视为未点亮，旧「点亮」动画不追溯授予认证。
  const ensureMemory = (s, now) => {
    if (s.sr && s.sr.S > 0 && s.sr.last) {
      if (!(s.sr.lit > 0)) s.sr.lit = 0;
      if (!(s.sr.ember > 0)) s.sr.ember = 0;
      return s.sr;
    }
    now = now || Date.now();
    const r = clampN(typeof s.strength === 'number' ? s.strength : 0.5, 0.05, MEM.rMax);
    const S = seedStability(r);
    s.sr = { S, last: Math.round(now - Math.log(1 / r) * S * DAY), due: 0, lit: 0, ember: 0 };
    return s.sr;
  };
  // 认证轴的三个派生状态（不落盘）：isLit=已点亮 · isEmber=待重燃 · everLit=曾点亮（决定 S 上限）
  const isLit = (s) => !!(s && s.sr && s.sr.lit > 0);
  const isEmber = (s) => !!(s && s.sr && !(s.sr.lit > 0) && s.sr.ember > 0);
  const everLit = (s) => !!(s && s.sr && (s.sr.lit > 0 || s.sr.ember > 0));
  // 稳定度封顶：曾点亮星 365；从未点亮星 max(当前S, 60)——旧档案里 S 已超 60 的星只封顶生长、不回缩
  const sCapOf = (s) => everLit(s) ? MEM.sMax : Math.max(s.sr.S, MEM.sMaxUnlit);
  const retrievability = (s, now) => Math.exp(-Math.max(0, (now || Date.now()) - s.sr.last) / DAY / s.sr.S);
  // 到期时刻按复习策略（AI 配置面板）计算；「加入复习队列」可把它提前。
  // cooling（默认）= R 自然衰减到 dueR 的那一刻 · sm2 = 1·3·7·15·30…天阶梯（取不超过当前稳定度的最大档）
  // daily = 上次复习一天后 · off = 到期照常按 cooling 算（只是不推送通知，见 maybeRemind）
  const SM2_LADDER = [365, 240, 120, 60, 30, 15, 7, 3, 1];
  const strategyNow = () => {
    try { return (window.SRAI && window.SRAI.active().strategy) || 'cooling'; } catch (e) { return 'cooling'; }
  };
  const dueTsOf = (s) => {
    ensureMemory(s);
    // 手动指定的复习时刻（sr.due）是权威预约：提前或推迟都算数——星的亮度照样
    // 按遗忘曲线变暗（那是另一条轴），但复习队列尊重用户亲手定的日子。
    // 复习完成（成功/模糊/失败）都会清掉 due，之后回到策略的自然口径。
    if (s.sr.due) return s.sr.due;
    const strat = strategyNow();
    if (strat === 'sm2') return s.sr.last + (SM2_LADDER.find(v => v <= s.sr.S) || 1) * DAY;
    if (strat === 'daily') return s.sr.last + DAY;
    return s.sr.last + s.sr.S * Math.log(1 / MEM.dueR) * DAY;
  };
  const reviewLabel = (due, now) => {
    const diff = due - now;
    if (diff <= 0) return '已逾期';
    if (diff < DAY) return '今天';
    if (diff < DAY * 2) return '明天';
    return Math.ceil(diff / DAY) + ' 天后';
  };
  const statusOf = (r) => r >= 0.7 ? '牢固' : r >= 0.4 ? '正常' : r >= 0.2 ? '正变暗' : '将熄灭';
  // 按真实时间重算一颗星：strength / 下次复习 / 状态 全部由模型导出。
  // 熄灭检测也在这里：已点亮星衰减到 R < emberR → 转待重燃（lit=0, ember=now），
  // 心跳/开屏/视图切换自动执行，只在跨越阈值那一次写时间线；随后的 sr-memory 广播让在场视图就地更新。
  const refreshStar = (s, now) => {
    ensureMemory(s, now);
    now = now || Date.now();
    s.strength = Math.round(clampN(retrievability(s, now), MEM.rMin, MEM.rMax) * 1000) / 1000;
    if (s.sr.lit > 0 && s.strength < MEM.emberR) {
      s.sr.lit = 0; s.sr.ember = now;
      pushTimeline('dim', s.id, '熄灭 · 待重燃');
    }
    s.props = s.props || {};
    s.props.nextReview = reviewLabel(dueTsOf(s), now);
    s.props.status = isEmber(s) ? '待重燃' : statusOf(s.strength);
  };
  // 打开应用 / 定时心跳 / 视图切换时调用：全部星按真实时间重算
  const refreshMemory = (now) => {
    now = now || Date.now();
    stars.forEach(s => refreshStar(s, now));
    notes.forEach(n => {
      const s = byId[n.id]; if (!s) return;
      n.strength = s.strength; n.nextReview = s.props.nextReview;
    });
    syncCounts();
    account.streak = computeStreak(now);   // 跨天 / 取回快照后连续天数保持真实
    return now;
  };
  // 一次成功复习（费曼点亮/重燃 = ignite:true）：稳定度增长、R 回满，队列覆盖清除。
  // 乘数按认证态取档：ignite 2.5（点亮/重燃同乘数）· 已点亮「记得」2.2 · 其余 1.8。
  // ignite 时写入认证（lit=now, ember=0）并记时间线（待重燃星 note「重燃」）；
  // 待重燃星普通「记得」只回亮度不回认证——重燃只走费曼。
  const reviewSuccess = (id, opts) => {
    const s = byId[id]; if (!s) return null;
    const now = Date.now();
    ensureMemory(s, now);
    const ignite = !!(opts && opts.ignite);
    const relit = ignite && isEmber(s);
    const before = clampN(retrievability(s, now), MEM.rMin, MEM.rMax);
    const base = ignite ? MEM.growIgnite : (isLit(s) ? MEM.growReviewLit : MEM.growReview);
    const cap = ignite ? MEM.sMax : sCapOf(s);   // 点亮当场获得 365 档上限
    s.sr.S = clampN(s.sr.S * (base + (1 - before) * 0.6), MEM.sMin, cap);
    s.sr.last = now; s.sr.due = 0;
    s.sr.reviewedAt = now; s.sr.grade = ignite ? 'ignite' : 'ok';
    if (ignite) {
      s.sr.lit = now; s.sr.ember = 0;
      pushTimeline('ignite', id, relit ? '重燃' : '点亮', Math.max(0, MEM.rMax - before));
    }
    refreshStar(s, now);
    syncCounts();      // 星域健康度按新强度重算
    touchNote(id);     // 列表行刷新 + 防抖落盘
    return { strength: s.strength, gained: Math.max(0, s.strength - before), stability: s.sr.S, lit: isLit(s), relit };
  };
  // 复习模糊：想起来了但不牢——稳定度小幅增长（×1.2），R 回到 0.85 左右：
  // last 回拨到「刚好衰减至 partialR」的时刻，下次到期比「记得」更早、比「忘了」更晚。
  // 认证态不动：想起大概 ≠ 火灭——已点亮保持点亮，待重燃保持待重燃。
  const reviewPartial = (id) => {
    const s = byId[id]; if (!s) return null;
    const now = Date.now();
    ensureMemory(s, now);
    s.sr.S = clampN(s.sr.S * MEM.growPartial, MEM.sMin, sCapOf(s));
    s.sr.last = Math.round(now - Math.log(1 / MEM.partialR) * s.sr.S * DAY);
    s.sr.due = 0;
    s.sr.reviewedAt = now; s.sr.grade = 'hazy';
    refreshStar(s, now);
    syncCounts();
    touchNote(id);
    return { strength: s.strength, stability: s.sr.S };
  };
  /* 今天复习过的星，按复习先后升序。sr.last 在「模糊 / 忘了」两档会被回拨用来定亮度，
     判断「今天复习过」只认 sr.reviewedAt。跨自然日后自然为空。 */
  const dayKeyOf = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const reviewedToday = (now) => {
    const today = dayKeyOf(now || Date.now());
    return stars
      .filter(s => s.sr && s.sr.reviewedAt && dayKeyOf(s.sr.reviewedAt) === today)
      .sort((a, b) => a.sr.reviewedAt - b.sr.reviewedAt);
  };

  // 到期队列：R 已衰减到阈值（或被手动排入且已到时）的星，按到期先后升序
  const dueStars = (now) => {
    now = now || Date.now();
    return stars
      .map(s => ({ s, due: dueTsOf(s) }))
      .filter(x => x.due <= now)
      .sort((a, b) => a.due - b.due)
      .map(x => x.s);
  };
  // 复习失败（含费曼「还没讲透」）：稳定度回缩，下次到期大幅提前。
  // 显示强度保持评分前的值——把 last 回拨到「按新 S 刚好衰减至 R_before」的时刻，
  // 而不是 last=now（那会让被评「忘了」的星瞬间跳回 R≈0.98，反而最亮）。
  // 新 S 更小 ⇒ 到期时刻依然更近，三档间隔严格有序：fail < partial < success。
  // 已点亮星回缩更留情（×0.55，记忆节省效应：曾掌握者重学更快），但认证作废——立即熄灭转待重燃。
  const reviewFail = (id) => {
    const s = byId[id]; if (!s) return null;
    const now = Date.now();
    ensureMemory(s, now);
    const before = clampN(retrievability(s, now), MEM.rMin, MEM.rMax);
    const wasLit = isLit(s);
    s.sr.S = Math.max(MEM.sMin, s.sr.S * (wasLit ? MEM.shrinkFailLit : MEM.shrinkFail));
    s.sr.last = Math.round(now - Math.log(1 / before) * s.sr.S * DAY);
    s.sr.due = 0;
    s.sr.reviewedAt = now; s.sr.grade = 'fail';
    if (wasLit) {
      s.sr.lit = 0; s.sr.ember = now;   // 先于 refreshStar 落定，避免阈值检测重复写时间线
      pushTimeline('dim', id, '熄灭 · 待重燃');
    }
    refreshStar(s, now);
    syncCounts();
    touchNote(id);
    return { strength: s.strength, stability: s.sr.S, extinguished: wasLit };
  };
  // 手动加入复习队列：把到期时刻提前到 days 天内（0 = 今天，1 = 明天）
  const queueReview = (id, days) => {
    const s = byId[id]; if (!s) return null;
    const now = Date.now();
    ensureMemory(s, now);
    const target = now + (days == null ? 1 : Math.max(0.4, days)) * DAY;
    s.sr.due = s.sr.due ? Math.min(s.sr.due, target) : target;
    refreshStar(s, now);
    touchNote(id);
    return s.props.nextReview;
  };

  // ---- 黑洞（回收站）：被删除的星与星域先落入这里，可恢复或彻底销毁 ----
  const trash = [
    {
      id: 'tr-seed1', kind: 'star', deletedAt: '3 天前',
      payload: {
        star: {
          id: 'sx1', con: 'la', x: 74, y: 33, strength: 0.36, importance: 0.9, label: '卷积定理',
          summary: '时域卷积等于频域乘积；它把复杂的卷积运算变成简单的逐点相乘。',
          props: { type: '推导', status: '正变暗', source: '信号与系统 · 第 4 章', alias: 'Convolution theorem', nextReview: '已逾期' },
          tags: ['推导'],
          body: [{ id: 'sx1-r', type: 'rich' }, { id: 'sx1-m', type: 'math', tex: 'f * g ⟷ F · G' }],
        },
        connections: [],
      },
    },
    {
      id: 'tr-seed2', kind: 'domain', deletedAt: '上周',
      payload: {
        con: { id: 'fx', name: '傅里叶分析', color: '#8ea2cc', health: 0.3, count: 2 },
        stars: [
          {
            id: 'sx2', con: 'fx', x: 48, y: 22, strength: 0.22, importance: 1.0, label: '傅里叶级数',
            summary: '任何周期函数都能分解为一组正弦与余弦的加权和。',
            props: { type: '概念', status: '将熄灭', source: '数学物理方法', alias: 'Fourier series', nextReview: '已逾期' },
            tags: ['概念'], body: [{ id: 'sx2-r', type: 'rich' }],
          },
          {
            id: 'sx3', con: 'fx', x: 54, y: 30, strength: 0.18, importance: 0.8, label: '频谱泄漏',
            summary: '截断信号使能量从主瓣泄漏到旁瓣；加窗可以缓解。',
            props: { type: '考点', status: '将熄灭', source: '数字信号处理', alias: 'Spectral leakage', nextReview: '已逾期' },
            tags: ['考点'], body: [{ id: 'sx3-r', type: 'rich' }],
          },
        ],
        connections: [{ a: 'sx2', b: 'sx3', kind: 'intra', rel: '泄漏是级数/变换截断的直接后果' }],
      },
    },
  ];
  let trashSeq = 0;
  const trashId = () => 'tr' + (++trashSeq) + Math.random().toString(36).slice(2, 6);

  // 把一颗知识星移入黑洞（连同它的连接），返回黑洞条目
  const trashStar = (id) => {
    const s = byId[id]; if (!s) return null;
    const i = stars.findIndex(x => x.id === id); if (i >= 0) stars.splice(i, 1);
    delete byId[id];
    const conns = [];
    for (let j = connections.length - 1; j >= 0; j--) {
      if (connections[j].a === id || connections[j].b === id) conns.push(connections.splice(j, 1)[0]);
    }
    const ni = notes.findIndex(n => n.id === id); if (ni >= 0) notes.splice(ni, 1);
    const entry = { id: trashId(), kind: 'star', deletedAt: '刚刚', ts: Date.now(), payload: { star: s, connections: conns } };
    trash.unshift(entry);
    syncCounts();
    persistRemote();
    return entry;
  };
  // 把整个星域（连同全部成员星与连接）移入黑洞
  const trashDomain = (conId) => {
    const ci = constellations.findIndex(c => c.id === conId); if (ci < 0) return null;
    const con = constellations.splice(ci, 1)[0];
    const members = [];
    for (let i = stars.length - 1; i >= 0; i--) {
      if (stars[i].con === conId) { const s = stars.splice(i, 1)[0]; delete byId[s.id]; members.unshift(s); }
    }
    const memberIds = new Set(members.map(s => s.id));
    const conns = [];
    for (let j = connections.length - 1; j >= 0; j--) {
      if (memberIds.has(connections[j].a) || memberIds.has(connections[j].b)) conns.push(connections.splice(j, 1)[0]);
    }
    members.forEach(s => { const ni = notes.findIndex(n => n.id === s.id); if (ni >= 0) notes.splice(ni, 1); });
    const entry = { id: trashId(), kind: 'domain', deletedAt: '刚刚', ts: Date.now(), payload: { con, stars: members, connections: conns } };
    trash.unshift(entry);
    syncCounts();
    persistRemote();
    return entry;
  };
  // 从黑洞恢复：星回到原星域（若星域已不存在则落入第一个星域），星域整体归位
  const restoreTrash = (entryId) => {
    const i = trash.findIndex(t => t.id === entryId); if (i < 0) return null;
    const t = trash[i];
    if (t.kind === 'star') {
      const s = t.payload.star;
      if (!constellations.find(c => c.id === s.con)) {
        if (!constellations.length) return null;
        s.con = constellations[0].id;
      }
      trash.splice(i, 1);
      stars.push(s); byId[s.id] = s;
      t.payload.connections.forEach(c => { if (byId[c.a] && byId[c.b]) connections.push(c); });
      notes.unshift(noteFor(s));
    } else {
      trash.splice(i, 1);
      constellations.push(t.payload.con);
      t.payload.stars.forEach(s => { stars.push(s); byId[s.id] = s; });
      t.payload.connections.forEach(c => { if (byId[c.a] && byId[c.b]) connections.push(c); });
      t.payload.stars.forEach(s => notes.unshift(noteFor(s)));
    }
    refreshMemory();   // 恢复的星按真实时间重新点算亮度（含 syncCounts）
    persistRemote();
    return t;
  };
  // 彻底销毁（不可恢复）
  const purgeTrash = (entryId) => {
    const i = trash.findIndex(t => t.id === entryId);
    if (i >= 0) { trash.splice(i, 1); persistRemote(); }
  };

  // Note list for the management / list view — derived from each star's own data.
  const notes = stars.map((s, i) => ({
    id: s.id,
    title: s.label,
    con: s.con,
    strength: s.strength,
    tags: s.tags || ['概念'],
    edited: ['2 小时前', '昨天', '3 天前', '上周', '2 周前'][i % 5],
    nextReview: (s.props && s.props.nextReview) || (s.strength < 0.35 ? '已逾期' : s.strength < 0.6 ? '明天' : '6 天后'),
    links: connections.filter(c => c.a === s.id || c.b === s.id).length,
  }));

  // Inbox — unsorted captures waiting to be filed into a constellation (badge: 7).
  const inbox = [
    { id: 'in1', text: '费曼："如果你不能简单地解释它，说明你没有真正理解。" 想做成一颗元认知的星。', captured: '12 分钟前', suggest: 'qm' },
    { id: 'in2', text: '密度矩阵 ρ = Σ pᵢ|ψᵢ⟩⟨ψᵢ|，混合态与纯态的统一描述 —— 待整理进量子力学。', captured: '1 小时前', suggest: 'qm' },
    { id: 'in3', text: '哈希表开放寻址 vs 链地址法，负载因子与再散列的取舍。', captured: '今天 09:24', suggest: 'ds' },
    { id: 'in4', text: 'QR 分解与 Gram–Schmidt 的关系，最小二乘的数值稳定写法。', captured: '昨天', suggest: 'la' },
    { id: 'in5', text: '麦克斯韦妖与信息熵——Landauer 原理：擦除 1 bit 至少耗散 kT ln2。', captured: '昨天', suggest: 'th' },
    { id: 'in6', text: '随手记：B+ 树为什么更适合磁盘？节点扇出与页大小。', captured: '2 天前', suggest: 'ds' },
    { id: 'in7', text: '退相干（decoherence）：环境如何"测量"系统、把叠加抹成经典混合。', captured: '3 天前', suggest: 'qm' },
  ];

  // Timeline — recent ignite / review events, newest first.
  const timeline = [
    { id: 'tl1', starId: 's1',  con: 'qm', when: '今天 10:30', delta: '+0.12', kind: 'ignite', note: '点亮 · 融会贯通' },
    { id: 'tl2', starId: 's5',  con: 'la', when: '今天 09:05', delta: '+0.08', kind: 'review', note: '复习巩固' },
    { id: 'tl3', starId: 's11', con: 'th', when: '昨天 21:40', delta: '+0.10', kind: 'ignite', note: '点亮' },
    { id: 'tl4', starId: 's3',  con: 'qm', when: '昨天 16:12', delta: '+0.05', kind: 'review', note: '复习' },
    { id: 'tl5', starId: 's6',  con: 'la', when: '昨天 11:20', delta: '+0.09', kind: 'ignite', note: '点亮' },
    { id: 'tl6', starId: 's9',  con: 'ds', when: '3 天前',     delta: '−0.06', kind: 'dim',    note: '长时间未复习，开始变暗' },
    { id: 'tl7', starId: 's12', con: 'th', when: '3 天前',     delta: '+0.07', kind: 'review', note: '复习' },
    { id: 'tl8', starId: 's2',  con: 'qm', when: '上周',       delta: '+0.11', kind: 'ignite', note: '点亮 · 融会贯通' },
  ];

  // 任何写操作后调用：把整棵星系防抖同步到本地数据库（server/stellar.db）
  const persistRemote = () => { if (window.SRNet) window.SRNet.schedule(); };

  // 相对时间：带 ts 的记录显示真实的「n 分钟前」，而不是永远的「刚刚」
  const ago = (ts) => {
    if (!ts) return '刚刚';
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
    return Math.floor(s / 86400 / 30) + ' 个月前';
  };

  // ——— 派生数据同步：让所有视图看到同一份真相 ———
  // 星域的 count / health / litRatio 始终按现存成员实时重算，不留手写快照。
  // health 保持「记忆亮度均值」单一语义不变；点亮维度独立为 litRatio（已点亮成员占比），
  // 星域光环转金判据 = litRatio ≥ 0.5 ∧ health ≥ 0.5。
  const syncCounts = () => {
    constellations.forEach(c => {
      const members = stars.filter(s => s.con === c.id);
      c.count = members.length;
      c.health = members.length ? members.reduce((a, s) => a + s.strength, 0) / members.length : 0;
      c.litRatio = members.length ? members.filter(isLit).length / members.length : 0;
    });
  };
  // 待重燃队列：曾点亮但已熄灭的星（体检「今日待办」第二行），按熄灭先后升序
  const emberStars = () => stars.filter(isEmber).sort((a, b) => (a.sr.ember || 0) - (b.sr.ember || 0));
  // 统一今日待办（体检 = 唯一待办入口）：到期复习 n + 待重燃 m + 收件箱待整理 k。
  // due 与 ember 两行可重叠（熄灭星多半也到期）——重燃成功会同时清掉到期（R 回满）。
  const todayTodo = (now) => ({
    due: dueStars(now).length,
    ember: emberStars().length,
    inbox: inbox.length,
  });
  // 点亮的内容门槛：摘要去空白 ≥ 20 字，或正文带文本的非 rich/divider 块 ≥ 2
  //（沿用 deriveKeyPoints 的取块口径，跳过 code——不惩罚简短概念星，两条满足其一即可）。
  const hasSubstance = (star) => {
    if (!star) return false;
    if (String(star.summary || '').replace(/\s+/g, '').length >= 20) return true;
    const texty = (star.body || []).filter(b =>
      b && !['rich', 'divider', 'code'].includes(b.type) && String(b.text || b.tex || '').trim());
    return texty.length >= 2;
  };
  const noteFor = (s) => ({
    id: s.id, title: s.label, con: s.con, strength: s.strength,
    tags: s.tags || ['草稿'], edited: '刚刚',
    nextReview: (s.props && s.props.nextReview) || '明天',
    links: connections.filter(c => c.a === s.id || c.b === s.id).length,
  });
  // 新建知识星的唯一入口：stars/byId/notes/count 一次到位。
  // 记忆模型从「刚刚写下」开始：S 取初始稳定度、last=now、R 从满格自然衰减——
  // strength 反推 last 的逻辑只留给无 sr 的旧快照 / 种子，别让新星一出生就「已逾期」。
  const addStar = (ns) => {
    if (!(ns.sr && ns.sr.S > 0 && ns.sr.last)) ns.sr = { S: 2.5, last: Date.now(), due: 0, lit: 0, ember: 0 };
    refreshStar(ns, Date.now());
    stars.push(ns); byId[ns.id] = ns; notes.unshift(noteFor(ns)); syncCounts(); persistRemote(); return ns;
  };
  const renameStar = (id, label) => {
    const s = byId[id]; if (!s) return;
    s.label = label;
    const n = notes.find(x => x.id === id); if (n) { n.title = label; n.edited = '刚刚'; }
    persistRemote();
  };
  // 星的任何编辑后调用：把对应列表行刷新成当前真相
  const touchNote = (id) => {
    const s = byId[id]; if (!s) return;
    const n = notes.find(x => x.id === id); if (!n) return;
    n.title = s.label; n.con = s.con; n.strength = s.strength;
    n.tags = (s.tags || n.tags).slice();
    n.nextReview = (s.props && s.props.nextReview) || n.nextReview;
    n.links = connections.filter(c => c.a === id || c.b === id).length;
    n.edited = '刚刚'; n.editedTs = Date.now();
    persistRemote();
  };
  // 事件写入时间线（ignite/review/dim），鸟瞰、时间轴的统计才是活的
  const pushTimeline = (kind, starId, note, delta) => {
    const s = byId[starId]; if (!s) return;
    timeline.unshift({
      id: 'tl' + Math.random().toString(36).slice(2, 7), starId, con: s.con, when: '刚刚', ts: Date.now(),
      delta: delta != null ? (delta >= 0 ? '+' : '−') + Math.abs(delta).toFixed(2) : '—',
      kind, note,
    });
    account.streak = computeStreak();   // 今天的第一条学习记录即续上连续天数
    persistRemote();
  };
  // [deprecated] 点亮的时间线现由 reviewSuccess(id, { ignite:true }) 内部写入（note 点亮/重燃），
  // 这里保留空实现只为兼容旧调用点，避免同一次点亮记两条时间线。
  const logIgnite = () => { };

  // 连续观星天数：时间线上有主动学习记录（复习/点亮，dim 熄灭不算）的连续自然日。
  // 今天还没开张不断签——从今天或昨天起往回数；按本地时区的自然日切分。
  const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const computeStreak = (now) => {
    now = now || Date.now();
    const days = new Set(timeline.filter(t => t && t.ts && t.kind !== 'dim').map(t => dayKey(t.ts)));
    let n = 0, cur = now;
    if (!days.has(dayKey(cur))) cur -= DAY;
    while (days.has(dayKey(cur))) { n++; cur -= DAY; }
    return n;
  };

  // 账户信息单一来源：Sidebar 与设置页共用。username/email/registeredAt 由 /api/hello 回填，
  // streak 由时间线实时推算，bio 随快照走——不保留任何展示用的伪造值。
  const account = { name: '观星者', avatar: '观', email: '', bio: '', streak: 0 };
  // 社交状态：好友（可造访星系）数量，启动时取回、变更时由星际漫游视图刷新
  const social = { friends: 0 };
  /* 站点状态：管理员在管理台发布的全站公告、以及游客功能门禁，由 /api/hello 下发。
     gates[x] = true 表示「这项功能需要账号」。后端未运行 / file:// 打开时四项全 false——
     离线把玩一份本地星空不该被登录挡住，真正牵扯到服务器的操作本来也走不通。 */
  const site = { announcement: null, registrationOpen: true, gates: { editor: false, share: false, visit: false, vault: false } };

  const conName = id => (constellations.find(c => c.id === id) || {}).name;
  const conColor = id => (constellations.find(c => c.id === id) || {}).color;

  // Stars connected to `id`, with each connection's relation sentence and direction.
  const relatedStars = id => connections
    .filter(c => c.a === id || c.b === id)
    .map(c => { const otherId = c.a === id ? c.b : c.a; return { star: byId[otherId], kind: c.kind, rel: c.rel }; })
    .filter(r => r.star);

  // Backlinks: connected stars in a *different* constellation (notes that reference this one).
  const backlinksOf = id => {
    const me = byId[id]; if (!me) return [];
    return relatedStars(id).filter(r => r.star.con !== me.con);
  };

  /* ——— 星际来信（服务端收件箱镜像）———
     消息本体只存在服务器（inbox_messages 表），不进星系快照；这里保留一份
     内存镜像给收件箱视图与侧栏角标共用。后端未运行时 SRNet.inbox.list()
     返回 null——镜像保持为空，「星际来信」整区隐藏、不报错。 */
  const mail = { list: [], loaded: false };
  const unclaimedMail = () => mail.list.filter(m => m && !m.claimed).length;
  const refreshMail = () => {
    const N = window.SRNet;
    if (!(N && N.inbox)) return Promise.resolve(null);
    return N.inbox.list().then(r => {
      if (!Array.isArray(r)) return null;   // 网络失败 null / 业务错误 {error}——都按「暂不可用」静默
      mail.list = r; mail.loaded = true;
      window.dispatchEvent(new Event('sr-data'));   // 侧栏收件箱角标即时对齐
      return r;
    });
  };
  // 兜底剥 HTML + 钳长度：服务端投递时已剥过一遍，这里是建星入库前的最后一道保险
  const plainText = (v, max) => String(v == null ? '' : v)
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  /* 收纳一封「星际来信」赠星：用 payload 建星，落在目标星域质心附近（与收件箱
     本地捕捉「归入」同一口径）。keyPoints 转为正文列表块；新星经 addStar 从
     未点亮起步（S=2.5, lit=0, ember=0）——来自星际的知识要自己讲透，才配点亮。 */
  const adoptShared = (msg, conId) => {
    if (!msg || !msg.payload || !constellations.find(c => c.id === conId)) return null;
    const p = msg.payload;
    const fromName = plainText(msg.from && msg.from.name, 24) || '星际旅人';
    const label = plainText(p.label, 120) || '来自星际的星';
    const summary = plainText(p.summary, 2000);
    const keyPoints = (Array.isArray(p.keyPoints) ? p.keyPoints : [])
      .map(k => plainText(k, 300)).filter(Boolean).slice(0, 12);
    // 位置：星域质心附近随机散布（世界坐标与星图同参 1680×1040）
    const W = 1680, H = 1040;
    const members = stars.filter(s => s.con === conId);
    let wx = W / 2, wy = H / 2;
    if (members.length) {
      const px = (s) => s.wx != null ? s.wx : s.x / 100 * W;
      const py = (s) => s.wy != null ? s.wy : s.y / 100 * H;
      wx = members.reduce((a, s) => a + px(s), 0) / members.length;
      wy = members.reduce((a, s) => a + py(s), 0) / members.length;
    }
    const ang = Math.random() * Math.PI * 2, rad = 70 + Math.random() * 70;
    wx += Math.cos(ang) * rad; wy += Math.sin(ang) * rad;
    const id = 's' + Math.random().toString(36).slice(2, 8);
    const body = [{ id: id + '-r', type: 'rich' }];
    keyPoints.forEach((k, i) => body.push({ id: id + '-k' + i, type: 'bulleted', text: k }));
    body.push({ id: id + '-p', type: 'p', text: '' });
    const star = {
      id, con: conId, x: wx / W * 100, y: wy / H * 100, wx, wy,
      strength: 0.5, importance: 1, label, summary,
      tags: ['星际来信'],
      props: { type: '收纳', status: '正常', source: '星际来信 · ' + fromName, alias: '', nextReview: '明天' },
      body,
    };
    addStar(star);   // 无 sr 的新星在这里补默认：S=2.5, last=now, lit=0, ember=0
    pushTimeline('review', id, '收纳自 ' + fromName);
    // 领取：镜像立即置 claimed，再通知服务器（静默降级——失败时下次拉取自然对齐）
    const rec = mail.list.find(x => x && x.id === msg.id);
    if (rec) rec.claimed = true;
    if (window.SRNet && window.SRNet.inbox) window.SRNet.inbox.ack(msg.id, 'claim');
    window.dispatchEvent(new Event('sr-data'));
    return star;
  };

  // 演示星系快照：留给「载入示例星系」用。必须在 refreshMemory 之前深拷贝——
  // 演示数据只是可选的参观材料，绝不再当作新用户的真实数据落库。
  const DEMO_SEED = JSON.parse(JSON.stringify({ constellations, stars, connections, notes, inbox, timeline, trash }));

  // 种子里的 count/health/strength 只是占位：打开应用即按真实时间重算全部星的 R
  //（含 syncCounts），种子的 lastReview/stability 由 strength 相对当前时间反推生成。
  refreshMemory();

  // 长时间停留：每分钟按真实时间重算一次，广播给在场视图就地更新数值——
  // 只改数值不加动画，自然兼容 prefers-reduced-motion / data-motion="off"，不会闪烁。
  // 复习提醒：页面开着时，过了设定时刻且有到期星 → 一条系统通知。
  // daily 每天最多一次 · weekly 每 7 天一次 · smart 到期 ≥5 颗才提醒（安静哲学）。
  const maybeRemind = () => {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const prefs = JSON.parse(localStorage.getItem('sr.settings')) || {};
      if (strategyNow() === 'off') return;   // 策略「不提醒」：到期照常计算，任何复习类通知都不再打扰
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      // 星域变暗提醒（设置里的 dimNudge）：某个星域的记忆亮度均值跌破 0.35 → 每天至多提醒一次
      if (prefs.dimNudge !== false) {
        const dim = constellations.filter(c => c.count > 0 && c.health < 0.35);
        if (dim.length && (localStorage.getItem('sr.dimnudge.last') || '') !== today) {
          localStorage.setItem('sr.dimnudge.last', today);
          new Notification('星图 · 星域正在变暗', {
            body: '「' + dim[0].name + '」' + (dim.length > 1 ? '等 ' + dim.length + ' 个星域' : '') + '的记忆亮度明显下降，去看看它们。',
            tag: 'sr-dimnudge',
          });
        }
      }
      if (prefs.remind === false) return;
      const due = dueStars().length; if (!due) return;
      const freq = prefs.freq || 'daily';
      if (freq === 'smart' && due < 5) return;
      const [hh, mm] = String(prefs.remindTime || '21:00').split(':').map(Number);
      if (now.getHours() < hh || (now.getHours() === hh && now.getMinutes() < mm)) return;
      const last = localStorage.getItem('sr.remind.last') || '';
      if (freq === 'weekly' ? (last && Date.now() - Date.parse(last) < 6.5 * 864e5) : last === today) return;
      localStorage.setItem('sr.remind.last', today);
      new Notification('星图 · 复习提醒', { body: '有 ' + due + ' 颗星到了回望的时刻。', tag: 'sr-remind' });
    } catch (e) { }
  };
  if (typeof setTimeout !== 'undefined') setTimeout(maybeRemind, 8000);   // 打开应用稍后先查一次（测试沙箱无 setTimeout）
  setInterval(() => {
    if (document.hidden) return;
    refreshMemory();
    window.dispatchEvent(new CustomEvent('sr-memory'));
    maybeRemind();
  }, 60000);

  // AI 配置变更（面板保存 / 快照回灌）：到期口径立刻按新策略重算，各视图角标就地对齐；
  // 并把配置排进快照上传（水合前 ready=false 自然短路，不会把回灌又传一遍）
  window.addEventListener('sr-ai-config', () => {
    refreshMemory();
    window.dispatchEvent(new CustomEvent('sr-memory'));
    persistRemote();
  });

  // 应用本机已保存的设置：昵称覆盖账户信息，动效偏好落到 <html> data 属性供 CSS 读取
  try {
    const prefs = JSON.parse(localStorage.getItem('sr.settings')) || {};
    if (prefs.nickname) { account.name = prefs.nickname; account.avatar = prefs.nickname.trim()[0] || account.avatar; }
    document.documentElement.dataset.motion = prefs.motion === false ? 'off' : 'on';
    document.documentElement.dataset.twinkle = (prefs.twinkle === false || prefs.motion === false) ? 'off' : 'on';
  } catch (e) { }

  // ——— 真实存储：启动时取回上次的星空 ———
  // 有 server → 走 REST（sqlite）；无 server（file:// 打开 / 后端未启动）→ 降级 localStorage。
  // 两边都有快照时按 savedAt / updated_at 新者优先；本地较新则回推给服务器。
  // 注意：空星系（stars: []）也是合法快照——用户删光全部星域后刷新，
  // 不能把「空」误判成「没有」而让演示种子复活覆盖真实数据。
  const looksLikeGalaxy = (d) => d && Array.isArray(d.stars);
  const hydrate = (d) => {
    constellations.splice(0, constellations.length, ...(d.constellations || []));
    stars.splice(0, stars.length, ...d.stars);
    connections.splice(0, connections.length, ...(d.connections || []));
    notes.splice(0, notes.length, ...(d.notes || []));
    inbox.splice(0, inbox.length, ...(d.inbox || []));
    timeline.splice(0, timeline.length, ...(d.timeline || []));
    trash.splice(0, trash.length, ...(d.trash || []));
    Object.keys(byId).forEach(k => delete byId[k]);
    stars.forEach(s => { byId[s.id] = s; });
    if (d.account && d.account.name) { account.name = d.account.name; account.avatar = d.account.avatar || account.avatar; }
    if (d.account && d.account.bio != null) account.bio = d.account.bio;
    // 偏好与 AI 配置随快照走：换设备 / 换账号后同一套设置与接入自动就位。
    // 动效 / 星点闪烁是设备偏好，不进快照（见 SRNet.snapshot）——这里的归并不会碰它们。
    if (d.prefs && typeof d.prefs === 'object') {
      try {
        const cur = JSON.parse(localStorage.getItem('sr.settings')) || {};
        localStorage.setItem('sr.settings', JSON.stringify({ ...cur, ...d.prefs }));
        if (d.prefs.nickname) { account.name = d.prefs.nickname; account.avatar = d.prefs.nickname.trim()[0] || account.avatar; }
        if (d.prefs.bio != null) account.bio = d.prefs.bio;
      } catch (e) { }
    }
    if (d.aiConfig && typeof d.aiConfig === 'object' && window.SRAI) window.SRAI.setConfig(d.aiConfig);
    refreshMemory();               // 取回的星空立刻按真实时间重算 R —— 放几天不看真的变暗
    window.SRNet.setReady();       // 真实数据已就位，此后才允许上传
    window.dispatchEvent(new CustomEvent('sr-hydrated'));
  };
  // 并发冲突（409）：api.js 收到服务器最新版后广播，这里就地重载，收敛到服务器真相
  window.addEventListener('sr-conflict', (e) => { if (looksLikeGalaxy(e.detail)) hydrate(e.detail); });
  // 首次使用：进入真空态——「你的星空还很暗」，不再把 12 颗演示星连同
  // 伪造的 streak / 时间线当成新用户的真实数据落库。演示星系收进 loadDemo()。
  const startFresh = () => {
    account.streak = 0;
    hydrate({ constellations: [], stars: [], connections: [], notes: [], inbox: [], timeline: [], trash: [] });
    persistRemote();   // 把「空」作为起点写下，之后的空星空刷新不会被任何种子覆盖
  };
  // 载入示例星系（可选入口，如列表视图空态）：整棵演示快照替换当前星空并落库
  const loadDemo = () => {
    hydrate(JSON.parse(JSON.stringify(DEMO_SEED)));
    persistRemote();
  };

  if (window.SRNet) {
    const local = window.SRNet.loadLocal();                       // { savedAt, data } | null
    const localOk = local && looksLikeGalaxy(local.data);
    window.SRNet.api('/api/hello', { method: 'POST', body: { name: account.name, avatar: account.avatar } })
      .then(r => {
        if (r.user && r.user.name) { account.name = r.user.name; account.avatar = r.user.avatar || account.avatar; }
        if (r.account) Object.assign(account, {
          // id：管理台据此认出「这一行就是我自己」，把停用/删除/改角色对自己藏起来
          id: r.account.id,
          registered: r.account.registered, username: r.account.username,
          email: r.account.email, registeredAt: r.account.registeredAt,
          // 管理员身份由服务器说了算：前端只据此决定「星港管理台」入口显不显示，
          // 每个 /api/admin/* 在服务端另有一道守卫，改这里的布尔值拿不到任何数据
          role: r.account.role || 'user', admin: !!r.account.admin,
        });
        // 站点状态（全站公告 / 出厂密码提醒）随握手下发，广播给横幅与管理台
        if (r.site) {
          site.announcement = r.site.announcement || null;
          site.registrationOpen = r.site.registrationOpen !== false;
          if (r.site.gates) site.gates = r.site.gates;
          account.defaultPass = !!r.site.defaultPass;
          window.dispatchEvent(new CustomEvent('sr-site'));
        }
        return window.SRNet.api('/api/galaxy');
      })
      .then(r => {
        const d = r && r.data;
        if (r && r.version != null) window.SRNet.setVersion(r.version);   // 乐观锁基准版本
        const remoteOk = looksLikeGalaxy(d);
        // 服务器快照时间：优先 data 内嵌的客户端 savedAt，缺失时退回 sqlite 的 updated_at（UTC）
        const remoteTs = (remoteOk && d.savedAt) ||
          (remoteOk && r.updatedAt ? Date.parse(String(r.updatedAt).replace(' ', 'T') + 'Z') || 1 : (remoteOk ? 1 : 0));
        if (remoteOk && (!localOk || remoteTs >= local.savedAt)) {
          hydrate(d);
        } else if (localOk) {
          hydrate(local.data);     // 本地较新（或服务器为空）：以本地为准
          persistRemote();         // 并把它回推给服务器
        } else {
          startFresh();            // 首次使用：真空态起步，演示数据改为可选入口
        }
      })
      .catch(() => {
        // 后端未运行 / file:// 打开：降级 localStorage，仍然可读可写
        if (localOk) hydrate(local.data);
        else startFresh();
      });

    // 好友数量：给侧边栏「星际漫游」角标用
    window.SRNet.api('/api/friends')
      .then(r => { social.friends = (r.friends || []).length; window.dispatchEvent(new CustomEvent('sr-friends')); })
      .catch(() => { });

    // 星际来信：启动即取一次，侧栏收件箱角标才带上未领取来信（后端未运行时静默为空）
    refreshMail();
  }

  return {
    constellations, stars, connections, byId, notes, inbox, timeline,
    conName, conColor, relatedStars, backlinksOf,
    trash, trashStar, trashDomain, restoreTrash, purgeTrash,
    addStar, renameStar, touchNote, logIgnite, pushTimeline, syncCounts, account, social, site, ago, loadDemo,
    mail, refreshMail, unclaimedMail, adoptShared,
    refreshMemory, reviewSuccess, reviewFail, reviewPartial, queueReview, dueTsOf, dueStars, reviewedToday,
    isLit, isEmber, hasSubstance, emberStars, todayTodo,
    persist: persistRemote,
  };
})();
