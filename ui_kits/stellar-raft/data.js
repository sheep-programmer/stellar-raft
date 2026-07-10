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
    syncCounts();
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
  // 星域的 count / health 始终按现存成员实时重算，不留手写快照。
  const syncCounts = () => {
    constellations.forEach(c => {
      const members = stars.filter(s => s.con === c.id);
      c.count = members.length;
      c.health = members.length ? members.reduce((a, s) => a + s.strength, 0) / members.length : 0;
    });
  };
  const noteFor = (s) => ({
    id: s.id, title: s.label, con: s.con, strength: s.strength,
    tags: s.tags || ['草稿'], edited: '刚刚',
    nextReview: (s.props && s.props.nextReview) || '明天',
    links: connections.filter(c => c.a === s.id || c.b === s.id).length,
  });
  // 新建知识星的唯一入口：stars/byId/notes/count 一次到位
  const addStar = (ns) => { stars.push(ns); byId[ns.id] = ns; notes.unshift(noteFor(ns)); syncCounts(); persistRemote(); return ns; };
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
    persistRemote();
  };
  const logIgnite = (starId, delta) => pushTimeline('ignite', starId, '点亮 · 融会贯通', delta != null ? delta : 0.12);

  // 账户信息单一来源：Sidebar 与设置页共用，别各存一份
  const account = { name: '林深', avatar: '林', email: 'linshen@stellar.app', plan: '观星者 · Pro', joined: '2024 · 09 · 18', streak: 14 };
  // 社交状态：好友（可造访星系）数量，启动时取回、变更时由星际漫游视图刷新
  const social = { friends: 0 };

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

  // 种子里的 count/health 只是占位，载入即按真实成员重算，别让视图各说各话
  syncCounts();

  // 应用本机已保存的设置：昵称覆盖账户信息，动效偏好落到 <html> data 属性供 CSS 读取
  try {
    const prefs = JSON.parse(localStorage.getItem('sr.settings')) || {};
    if (prefs.nickname) { account.name = prefs.nickname; account.avatar = prefs.nickname.trim()[0] || account.avatar; }
    document.documentElement.dataset.motion = prefs.motion === false ? 'off' : 'on';
    document.documentElement.dataset.twinkle = (prefs.twinkle === false || prefs.motion === false) ? 'off' : 'on';
  } catch (e) { }

  // ——— 真实存储：启动时从数据库取回上次的星空 ———
  // 数据库里已有星系 → 原地替换种子数据并广播 sr-hydrated（app 整体重挂载）；
  // 首次使用 → 把种子星空写入数据库作为起点。
  if (window.SRNet) {
    window.SRNet.api('/api/hello', { method: 'POST', body: { name: account.name, avatar: account.avatar } })
      .then(r => { if (r.user && r.user.name) { account.name = r.user.name; account.avatar = r.user.avatar || account.avatar; } return window.SRNet.api('/api/galaxy'); })
      .then(r => {
        const d = r && r.data;
        if (d && Array.isArray(d.stars) && d.stars.length) {
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
          syncCounts();
          window.SRNet.setReady();   // 真实数据已就位，此后才允许上传
          window.dispatchEvent(new CustomEvent('sr-hydrated'));
        } else {
          window.SRNet.setReady();   // 首次使用：确认服务器为空后，把种子存为起点
          persistRemote();
        }
      })
      .catch(() => { window.SRNet.setReady(); /* 后端未运行时保持纯前端模式 */ });

    // 好友数量：给侧边栏「星际漫游」角标用
    window.SRNet.api('/api/friends')
      .then(r => { social.friends = (r.friends || []).length; window.dispatchEvent(new CustomEvent('sr-friends')); })
      .catch(() => { });
  }

  return {
    constellations, stars, connections, byId, notes, inbox, timeline,
    conName, conColor, relatedStars, backlinksOf,
    trash, trashStar, trashDomain, restoreTrash, purgeTrash,
    addStar, renameStar, touchNote, logIgnite, pushTimeline, syncCounts, account, social, ago,
  };
})();
