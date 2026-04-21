const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function connectToPersistentChrome() {
  let wsUrl = '';
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    wsUrl = data.webSocketDebuggerUrl;
    console.log('🔗 [系统] 找到运行中的原生 Chrome 窗口...');
  } catch (e) {
    console.log('🚀 [系统] 未检测到 Chrome，拉起原生浏览器进程...');
    exec('"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="D:\\Code\\opencode\\.opencode\\chrome_data"');
    await new Promise(r => setTimeout(r, 3000));
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    wsUrl = data.webSocketDebuggerUrl;
  }
  return await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
}

async function run() {
  const siteArg = process.argv[2];
  if (!siteArg) {
    console.log('❌ 错误: 请指定要登录的网站，例如: node login_manager.js outlook');
    process.exit(1);
  }

  // 读取本地金库
  const accountsPath = path.join(__dirname, 'accounts.local.json');
  if (!fs.existsSync(accountsPath)) {
    console.log('❌ 错误: 未找到本地金库 (accounts.local.json)');
    process.exit(1);
  }
  
  const vault = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
  const account = vault[siteArg.toLowerCase()];
  
  if (!account) {
    console.log(`❌ 错误: 在金库中未找到针对 [${siteArg}] 的配置信息。`);
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`🔓 开始自动登录任务: [${siteArg}]`);
  console.log(`📧 登录账号: ${account.username}`);
  console.log(`========================================\n`);

  const browser = await connectToPersistentChrome();
  const page = await browser.newPage();

  try {
    if (account.type === 'custom' && account.scriptPath) {
      // 自定义模块登录策略
      const customModule = require(path.join(__dirname, account.scriptPath));
      await customModule.login(page, account);
      
    } else if (account.type === 'multi-step') {
      // 典型的分步登录 (输入账号 -> 翻页/动画 -> 输入密码)
      console.log('➡️ 访问登录页面...');
      await page.goto(account.url, { waitUntil: 'networkidle2' });
      
      console.log('➡️ 等待账号输入框...');
      await page.waitForSelector(account.selectors.user_input, { visible: true, timeout: 10000 });
      await page.type(account.selectors.user_input, account.username, { delay: 50 });
      await page.keyboard.press('Enter');
      
      console.log('➡️ 等待密码登录方式选项...');
      await new Promise(r => setTimeout(r, 2000));
      try {
        const elements = await page.$$('div');
        for (let el of elements) {
           const text = await page.evaluate(e => e.textContent, el);
           if (text && text.includes('使用密码') && text.length < 20) {
               console.log('➡️ 找到"使用密码"选项，正在点击...');
               await el.click();
               break;
           }
        }
      } catch(e) {}
      
      console.log('➡️ 等待密码框...');
      await new Promise(r => setTimeout(r, 2000)); // 动画硬等待
      await page.waitForSelector(account.selectors.pass_input, { visible: true, timeout: 10000 });
      await page.type(account.selectors.pass_input, account.password, { delay: 50 });
      await page.keyboard.press('Enter');
      console.log('✅ 通用多步登录提交完毕！');
      
      // 特殊的"保持登录状态"处理 (可选，专为微软配置)
      if (siteArg.toLowerCase() === 'outlook') {
         await new Promise(r => setTimeout(r, 4000));
         try {
             await page.waitForSelector('button, input[type="submit"], input[type="button"], input[id="idSIButton9"]', { visible: true, timeout: 10000 });
             const elements = await page.$$('button, input, div[role="button"]');
             let clicked = false;
             for (let el of elements) {
               const val = await page.evaluate(e => e.value || e.innerText || e.textContent, el);
               if (val && (val.trim() === '是' || val.trim() === 'Yes' || val.trim() === 'Accept')) {
                 console.log('➡️ 点击"保持登录状态" -> 是');
                 await el.click();
                 clicked = true;
                 break;
               }
             }
             if (!clicked) {
                 const mainBtn = await page.$('#idSIButton9');
                 if (mainBtn) await mainBtn.click();
             }
         } catch (e) {}
      }

    } else if (account.type === 'simple') {
      // 简单的一页式登录 (账号密码同页)
      console.log('➡️ 访问登录页面...');
      await page.goto(account.url, { waitUntil: 'networkidle2' });
      await page.waitForSelector(account.selectors.user_input, { visible: true });
      await page.type(account.selectors.user_input, account.username, { delay: 50 });
      await page.type(account.selectors.pass_input, account.password, { delay: 50 });
      await page.click(account.selectors.submit_btn);
      console.log('✅ 单页登录提交完毕！');
    }
  } catch (err) {
    console.error(`❌ 执行过程中发生错误:`, err.message);
  }

  // 我们不关闭 browser，让界面保留给用户
  browser.disconnect();
}

run();
