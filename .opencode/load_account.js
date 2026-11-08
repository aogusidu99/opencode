const fs = require('fs');
const path = require('path');

// 从本地金库 accounts.local.json 读取指定站点的账号信息。
// 该文件已被 .gitignore 忽略、不会提交到仓库；login_manager.js 也使用同一个金库。
// 这样登录脚本里不再出现明文账号密码，换设备时只需复制 accounts.local.json。
function loadAccount(site) {
  const vaultPath = path.join(__dirname, 'accounts.local.json');
  if (!fs.existsSync(vaultPath)) {
    console.error(`❌ 错误: 未找到本地金库 ${vaultPath}`);
    process.exit(1);
  }
  const account = JSON.parse(fs.readFileSync(vaultPath, 'utf8'))[site];
  if (!account || !account.username || !account.password) {
    console.error(`❌ 错误: 本地金库中缺少 [${site}] 的 username 或 password`);
    process.exit(1);
  }
  return account;
}

module.exports = { loadAccount };
