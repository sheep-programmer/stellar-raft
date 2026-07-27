/* 星图 Stellar Raft — 运行配置
   端口、路径与数据库落点。这里只读环境变量、不碰数据库，任何模块都能安全 require。 */
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8756);
const ROOT = path.resolve(__dirname, '..');            // stellar-raft/
const APP_DIR = '/ui_kits/stellar-raft/';              // 应用入口（目录式，页面内相对引用才成立）
/* 数据库位置默认落在 server/ 边上；SR_DB 可以把它挪走 —— 部署时指向数据盘、
   本地起第二个实例做验证时指向临时库，都不必动代码。相对路径按启动时的工作
   目录解析，父目录不存在就当场建出来（否则 sqlite 只会甩一个没头没脑的错）。 */
const DB_PATH = process.env.SR_DB ? path.resolve(process.env.SR_DB) : path.join(__dirname, 'stellar.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
/* 展示用的库路径：在仓库里就给相对路径（短、好认），被 SR_DB 挪到仓库外就给绝对路径——
   否则会打出一长串 ../../.. ，比绝对路径还难读。 */
const DB_SHOWN = (() => {
  const rel = path.relative(ROOT, DB_PATH);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : DB_PATH;
})();

module.exports = { PORT, ROOT, APP_DIR, DB_PATH, DB_SHOWN };
